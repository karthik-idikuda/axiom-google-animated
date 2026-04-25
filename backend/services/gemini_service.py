"""Gemini on Vertex AI / AI Studio wrapper."""
from __future__ import annotations

import json
import logging
import re
from typing import List

from google import genai
from google.genai.types import GenerateContentConfig, HttpOptions, ThinkingConfig, ThinkingLevel

from backend import config

log = logging.getLogger("axiom.gemini")

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        if config.USE_VERTEXAI:
            _client = genai.Client(
                http_options=HttpOptions(api_version="v1"),
                vertexai=True,
                project=config.GOOGLE_CLOUD_PROJECT,
                location=config.GOOGLE_CLOUD_LOCATION,
            )
        else:
            # AI Studio API key mode (free tier, no billing required)
            if not config.GOOGLE_API_KEY:
                raise RuntimeError(
                    "GOOGLE_API_KEY is empty. Either set it in .env or flip "
                    "GOOGLE_GENAI_USE_VERTEXAI=True."
                )
            _client = genai.Client(api_key=config.GOOGLE_API_KEY)
    return _client


def _generate(prompt: str, temperature: float = 0.2) -> str:
    client = _get_client()
    thinking_config = None
    if str(config.GEMINI_MODEL).startswith("gemini-3"):
        level = str(config.GEMINI_THINKING_LEVEL).upper()
        thinking_level = ThinkingLevel.HIGH if level == "HIGH" else (
            ThinkingLevel.MEDIUM if level == "MEDIUM" else ThinkingLevel.LOW
        )
        thinking_config = ThinkingConfig(thinking_level=thinking_level)
    resp = client.models.generate_content(
        model=config.GEMINI_MODEL,
        contents=prompt,
        config=GenerateContentConfig(
            temperature=temperature,
            thinking_config=thinking_config,
        ),
    )
    return (resp.text or "").strip()


def _extract_json(text: str):
    """Strip ```json fences and parse."""
    cleaned = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.MULTILINE).strip()
    try:
        return json.loads(cleaned)
    except Exception:
        # try to find first [...] or {...}
        m = re.search(r"(\[.*\]|\{.*\})", cleaned, re.DOTALL)
        if m:
            return json.loads(m.group(1))
        raise


# ----------------------------------------------------------------------
# Public helpers
# ----------------------------------------------------------------------
def detect_protected_attributes(column_names: List[str]) -> List[str]:
    """Ask Gemini which columns are protected attributes."""
    prompt = f"""You are a fairness auditor. From this list of dataset columns,
return ONLY a JSON array of column names that are legally protected attributes
(e.g., sex, gender, race, ethnicity, age, nationality, disability, religion).

Columns: {column_names}

Return ONLY a JSON array. No prose. No markdown."""
    try:
        text = _generate(prompt, temperature=0.1)
        arr = _extract_json(text)
        return [c for c in arr if c in column_names]
    except Exception as e:
        log.warning("Gemini protected-attr detection failed (%s); using heuristic", e)
        keywords = ("sex", "gender", "race", "ethnic", "age",
                    "nationality", "disab", "religion")
        return [c for c in column_names if any(k in c.lower() for k in keywords)]


def parse_constitution(rules_text: str, column_names: List[str] = None) -> list:
    """Convert plain-English rules into structured constraint list."""
    cols_hint = ""
    if column_names:
        cols_hint = f"\nAvailable dataset columns: {column_names}\nUse these exact names for 'protected_attribute' if they match the user's intent (e.g. map 'Gender' to 'sex' if 'sex' is in the list)."

    prompt = f"""You are a legal AI fairness system. Parse the following fairness
constitution into structured JSON rules for a causal fairness engine.{cols_hint}

Each rule must have:
- rule_id: string (e.g., "RULE_001")
- description: string (A 1-sentence summary of the rule in plain English)
- protected_attribute: string (The specific dataset column name that is protected)
- allowed_causal_influence: float (0.0 to 1.0, where 0.0 is zero influence allowed)
- severity_if_violated: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"

Constitution text:
{rules_text}

Return ONLY a valid JSON array. No explanation. No markdown."""
    try:
        text = _generate(prompt, temperature=0.1)
        parsed = _extract_json(text)
        if not isinstance(parsed, list):
            return []
        
        # Validation: ensure protected_attribute is actually in the column list
        if column_names:
            valid_rules = []
            for r in parsed:
                if r.get("protected_attribute") in column_names:
                    valid_rules.append(r)
                else:
                    # try fuzzy match
                    attr = str(r.get("protected_attribute")).lower()
                    match = next((c for c in column_names if c.lower() == attr), None)
                    if match:
                        r["protected_attribute"] = match
                        valid_rules.append(r)
            return valid_rules
            
        return parsed
    except Exception as e:
        log.error("Gemini parse_constitution failed: %s", e)
        return []

def parse_constitution_fallback(rules_text: str, column_names: List[str] = None) -> list:
    """Fallback constitution parser when Gemini is unavailable.
    Create a minimal, safe set of rules from plain English using lightweight heuristics.
    This is intended to keep the pipeline functional during quota outages.
    """
    import re
    rules: List[dict] = []
    lines = [ln.strip() for ln in rules_text.splitlines() if ln.strip()]
    for idx, line in enumerate(lines[:10], start=1):
        m = re.search(r"(?P<attr>\w+(?:_\w+)?)\s+(?:must|shall|should|must_not|not|not_in|never|cannot|can not)\s+(?:influence|affect|affect|causal|predict|decide|outcome|decision)", line, re.IGNORECASE)
        if not m:
            continue
        attr = m.group("attr")
        rule = {
            "rule_id": f"RULE_{idx:03d}",
            "protected_attribute": attr,
            "description": line,
            "threshold": 0.0,
            "severity": "CRITICAL",
            "allowed_exceptions": []
        }
        rules.append(rule)
    if not rules:
        rules.append({
            "rule_id": "RULE_DEFAULT",
            "protected_attribute": "any",
            "description": "Protected attributes must not causally influence final decisions.",
            "threshold": 0.0,
            "severity": "CRITICAL",
            "allowed_exceptions": []
        })
    return rules

def generate_audit_report(session_data: dict) -> str:
    """Return a markdown audit report."""
    prompt = f"""You are AXIOM's audit scribe. Given the session data below,
write a fairness audit report in markdown with these sections:
1. Executive Summary
2. Measured Bias Evidence
3. Observed-Match Evidence
4. Constitution Violations
5. Remediation Recommendation
6. Fairness Metrics
7. Certification Status

Session data:
{json.dumps(session_data, indent=2, default=str)[:12000]}

Rules:
- Use only values present in the session data.
- If a value is null, empty, or missing, write "Not measured" or "Not available".
- Do not invent before/after improvements, corrected decisions, record counts, or certificates.
- Do not claim legal proof; describe DirectLiNGAM output as a measured causal signal under model assumptions.

Return only markdown. No code fences."""
    return _generate(prompt, temperature=0.7)


def explain_biased_record(index: int, features: dict, score: float) -> str:
    prompt = (
        f"Record {index} has these values: {features}\n"
        f"This record contributes {score:.2f} to the detected bias.\n"
        "In ONE sentence, explain in plain English why this record reinforces bias."
    )
    try:
        return _generate(prompt, temperature=0.4)
    except Exception:
        return "Record contributes to bias via protected attribute correlation."
