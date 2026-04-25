# Axiom Fairness Platform: Theoretical Foundation & Deep Dive

## 1. Introduction: The Crisis of Correlational Fairness

Modern machine learning models are fundamentally pattern-matching engines. Traditional approaches to algorithmic fairness rely heavily on **Correlational Fairness Metrics** (such as Demographic Parity or Equalized Odds). 

### The Flaw of Correlation (Simpson's Paradox)
If a model predicts that "Group A is 20% more likely to default on a loan than Group B," a correlational fairness tool will penalize the model, assuming the difference is due to bias against Group A. However, correlation cannot distinguish between:
1. **Malicious Bias:** The model is penalizing Group A directly because of their group membership.
2. **Valid Proxy Prediction:** Group A happens to correlate with a completely independent, valid factor (e.g., lower average credit history length), and the model is scoring based on that valid factor.

By blindly adjusting outputs to force statistical parity across groups, correlational fairness often destroys model accuracy and introduces "reverse bias."

---

## 2. The Axiom Solution: Causal Inference

Axiom abandons correlation in favor of **Causal Inference**. Instead of asking "Are the predictions different across groups?", Axiom asks: *"If we were to intervene and magically change a person's protected attribute (e.g., their race or gender) while holding everything else constant, would the outcome change?"*

If the answer is **Yes**, there is a causal bias pathway. If **No**, the model is fair, regardless of what correlational statistics imply.

### Structural Equation Models (SEM)
Axiom represents the decision-making logic of any AI system as a Structural Equation Model. 
Variables are defined as a system of linear equations:
`X_i = sum(B_ij * X_j) + e_i`
Where `X` represents features (Age, Income, Sex), `B` represents the causal weight (how much X_j influences X_i), and `e` represents exogenous, independent noise.

---

## 3. DirectLiNGAM: Mathematical Discovery of Causal Graphs

To automatically discover these causal pathways without human intervention, the Cartographer Agent utilizes **DirectLiNGAM (Linear Non-Gaussian Acyclic Model)**.

### How DirectLiNGAM Works:
1. **Assumption of Non-Gaussianity:** In real-world data, the residual noise (`e`) is rarely perfectly Gaussian. DirectLiNGAM exploits this non-Gaussianity to determine causal direction. If X correlates with Y, standard statistics can't tell if X -> Y or Y -> X. LiNGAM proves that if X -> Y, the residuals of predicting Y from X will be independent of X, but the reverse will not hold.
2. **Graph Construction:** Axiom uses this mathematical proof to draw a Directed Acyclic Graph (DAG) mapping exactly how every feature influences the final prediction.

### Axiom's Causal Effect Threshold
Axiom calculates the absolute causal weight from the Protected Attribute to the Target Outcome. 
By default, **Causal Effect Threshold = 0.05**.
If the weight exceeds this threshold, the Oracle agent flags the system for structural bias.

---

## 4. LangGraph: The Autonomous Agent Pipeline

Axiom operates using an advanced multi-agent orchestrator built on LangGraph. The pipeline is deterministic and highly specialized:

1. **Agent 0 - SENTINEL:** Intercepts real-time AI decisions. Stubs the data into the Firebase persistence layer to prevent data loss.
2. **Agent 1 - CARTOGRAPHER:** Reads the raw dataset, detects sensitive variables (via Gemini LLM), and executes the DirectLiNGAM mathematical matrix to map the Causal Graph.
3. **Agent 2 - ORACLE:** The evidence engine. It isolates the specific mathematical edges connecting the protected attribute to the outcome. It produces quantitative evidence (e.g., "Sex directly influences Credit Score with a weight of 0.14").
4. **Agent 3 - JUDGE:** The moral enforcer. It reads the AI Constitution (rules defined by the enterprise) and checks if the Oracle's evidence violates the allowed thresholds.
5. **Agent 4 - SURGEON:** If the Judge issues a "FAIL" verdict, the Surgeon computes the inverse mathematical pathway to "subtract" the biased influence from the specific prediction, rewriting the decision to be fair.
6. **Agent 5 - SCRIBE:** Translates the complex multi-dimensional matrix math into a human-readable PDF Audit Report.

---

## 5. The Fairness Constitution & JSON Schema

To make advanced causal math accessible, Axiom bridges the gap between Legal Compliance and Data Science. Users write policies in plain English (e.g., *"Race must have zero influence on recidivism scores."*)

Gemini 3.1 Pro translates this using Few-Shot Prompting into a strict JSON Schema executed by the JUDGE:
```json
{
  "rule_id": "RULE_001",
  "protected_attribute": "race",
  "allowed_causal_influence": 0.0,
  "severity_if_violated": "CRITICAL"
}
```

### The Fairness Formula
Axiom translates bias into a simple, board-level metric using the following equation:
`Fairness_Score = max(0.0, min(100.0, (1.0 - abs(causal_effect)) * 100.0))`

If the causal effect is exactly 0.0, the Fairness Score is 100%. If the effect climbs above the permitted threshold, the score exponentially decays, triggering automated interventions.
