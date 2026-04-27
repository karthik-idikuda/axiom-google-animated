import React, { useEffect, useMemo, useState } from "react";
import Panel from "../components/Panel";
import CausalGraph from "../components/CausalGraph";
import { saveConstitution, getConstitution, getCausalGraph } from "../api";
import { useProjectId } from "../projectStore";

const PLACEHOLDER =
  "Example:\n" +
  "Gender must never influence hiring decisions.\n" +
  "Age should not affect loan approvals.\n" +
  "Race must have zero causal influence on criminal-justice predictions.";

function RuleItem({ rule, index }) {
  const type = rule.severity_if_violated === "CRITICAL" ? "red" : rule.severity_if_violated === "HIGH" ? "yellow" : "blue";
  return (
    <div className={`tech-card anim-slide-up ${type}`} style={{ 
      padding: "16px", 
      marginBottom: 16,
      animationDelay: `${index * 0.08}s`
    }}>
      <div className="tech-card-vents"><span/><span/><span/></div>
      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span className="material-symbols-rounded" style={{ color: `var(--${type})`, fontSize: 20 }}>
            {rule.severity_if_violated === "CRITICAL" ? "report" : "gavel"}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>
            {rule.rule_id?.toUpperCase() || `RULE_${index + 1}`}
          </span>
          <span className="chip chip-grey" style={{ fontSize: 10, marginLeft: "auto", fontFamily: "var(--font-mono)" }}>
            INF ≤ {rule.allowed_causal_influence ?? 0}
          </span>
        </div>
        <div style={{ fontSize: 15, color: "var(--text-primary)", lineHeight: 1.5, fontWeight: 500 }}>
          {rule.description || rule.text || "Formal causal constraint enforced."}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 12, display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--font-mono)" }}>
          <span className="material-symbols-rounded" style={{ fontSize: 14 }}>shield</span>
          PROTECTED_ATTR: {rule.protected_attribute?.toUpperCase() || "UNKNOWN"}
        </div>
      </div>
    </div>
  );
}

export default function Constitution() {
  const [projectId, setProjectId] = useProjectId();
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  const [graph, setGraph] = useState({ causal_graph: [], protected_attributes: [] });

  useEffect(() => {
    if (!projectId) { setText(""); setParsed([]); return; }
    getConstitution(projectId).then((r) => {
      setText(r.data?.rules_text || "");
      setParsed(r.data?.parsed || r.data?.parsed_rules || []);
    }).catch(() => { setText(""); setParsed([]); });
  }, [projectId]);

  useEffect(() => {
    if (!projectId) {
      setGraph({ causal_graph: [], protected_attributes: [] });
      return;
    }
    let lastGraphSig = "";
    const loadGraph = () => {
      getCausalGraph(projectId)
        .then((r) => {
          const g = r.data;
          if (g && Array.isArray(g.causal_graph) && g.causal_graph.length > 0) {
            const sig = JSON.stringify({
              edges: g.causal_graph,
              protected: g.protected_attributes || [],
              matrixRows: (g.adjacency_matrix || []).length,
            });
            if (sig !== lastGraphSig) {
              lastGraphSig = sig;
              setGraph(g);
            }
          } else {
            if (lastGraphSig !== "") {
              lastGraphSig = "";
              setGraph({ causal_graph: [], protected_attributes: [] });
            }
          }
        })
        .catch(() => {
          if (lastGraphSig !== "") {
            lastGraphSig = "";
            setGraph({ causal_graph: [], protected_attributes: [] });
          }
        });
    };
    loadGraph();
    const id = setInterval(loadGraph, 20000);
    return () => clearInterval(id);
  }, [projectId]);

  const save = async () => {
    if (!projectId) return;
    setBusy(true); setErr(null);
    try {
      const r = await saveConstitution(projectId, text);
      const newRules = r.data?.parsed || r.data?.parsed_rules || [];
      setParsed(newRules);
      setSavedAt(new Date().toLocaleTimeString());
      if (newRules.length === 0) {
        setErr("Policy saved, but no formal rules could be compiled. Try being more specific (e.g. 'Gender should not affect income').");
      }
    } catch (e) {
      setErr(e.response?.data?.detail || e.message);
    } finally { setBusy(false); }
  };

  const policyGraph = useMemo(() => {
    const cleanedRules = Array.isArray(parsed) ? parsed : [];
    const edges = [];
    const protectedSet = new Set();
    const lineFallback = (text || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const inferOutcome = (ruleText) => {
      const t = String(ruleText || "");
      const fromOn = t.match(/influence on ([a-z0-9 _-]+)/i);
      if (fromOn?.[1]) return fromOn[1].trim();
      const fromAffect = t.match(/affect ([a-z0-9 _-]+)/i);
      if (fromAffect?.[1]) return fromAffect[1].trim();
      return "outcome";
    };

    cleanedRules.forEach((rule, idx) => {
      const protectedAttr = String(rule?.protected_attribute || `protected_${idx + 1}`).toLowerCase();
      const ruleNode = String(rule?.rule_id || `rule_${idx + 1}`).toLowerCase();
      const ruleText = rule?.description || rule?.text || lineFallback[idx] || "";
      const outcomeNode = inferOutcome(ruleText).toLowerCase().replace(/\s+/g, "_");
      protectedSet.add(protectedAttr);

      edges.push({ source: protectedAttr, target: ruleNode, weight: 1 });
      edges.push({ source: ruleNode, target: outcomeNode, weight: 1 });
    });

    return {
      edges,
      protectedAttributes: Array.from(protectedSet),
    };
  }, [parsed, text]);

  return (
    <div className="main anim-fade">
      <header className="page-header">
        <h1 className="page-title">Fairness <em>Constitution</em></h1>
        <p className="page-subtitle">
          Define your organization's ethical boundaries in plain English. 
          Axiom's reasoning engine compiles these into formal causal restrictions.
        </p>
      </header>

      <div className="grid-main">
        {/* Policy Editor */}
        <Panel title="Draft Policy" icon="edit_note">
          <div className="form-group">
            <label className="form-label">Project Identifier</label>
            <input 
              className="form-input"
              value={projectId} 
              placeholder="e.g. compas-recidivism" 
              onChange={(e) => setProjectId(e.target.value.trim())}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Policy Language (Plain English)</label>
            <textarea
              className="form-textarea"
              value={text}
              placeholder={PLACEHOLDER}
              onChange={(e) => setText(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button onClick={save} disabled={busy || !text.trim() || !projectId} className="btn-google">
              <span className="material-symbols-rounded">
                {busy ? "sync" : "auto_awesome"}
              </span>
              {busy ? "Compiling..." : "Save & Enforce"}
            </button>
            
            {savedAt && (
              <div className="anim-fade" style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--green)", fontSize: 13, fontWeight: 500 }}>
                <span className="material-symbols-rounded" style={{ fontSize: 18 }}>check_circle</span>
                Last saved {savedAt}
              </div>
            )}
          </div>

          {err && (
            <div className="alert alert-error" style={{ marginTop: 20 }}>
              <span className="material-symbols-rounded">error</span>
              {err}
            </div>
          )}
        </Panel>

        {/* Enforced Rules Visualization */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <Panel title="Causal Logic Graph" icon="account_tree">
            <CausalGraph
              edges={policyGraph.edges.length ? policyGraph.edges : (graph.causal_graph || [])}
              protected={policyGraph.edges.length ? policyGraph.protectedAttributes : (graph.protected_attributes || [])}
              animated={policyGraph.edges.length > 0}
            />
          </Panel>

          <Panel title={`Enforced Rules (${parsed.length})`} icon="gavel">
            {parsed.length === 0 ? (
              <div className="empty-state" style={{ padding: "32px 0" }}>
                <span className="material-symbols-rounded" style={{ fontSize: 32, color: "var(--border)", display: "block", marginBottom: 12 }}>
                  description
                </span>
                <div className="empty-state-desc">No rules compiled yet. Write a policy and save to see formal constraints.</div>
              </div>
            ) : (
              <div className="staggered">
                {parsed.map((rule, i) => (
                  <RuleItem key={i} rule={rule} index={i} />
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
