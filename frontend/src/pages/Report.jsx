import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Panel from "../components/Panel";
import { getReport } from "../api";

function ScoreGauge({ label, value, delayClass }) {
  const score = typeof value === "number" ? Math.round(value) : null;
  const statusClass = score === null ? "" : score >= 85 ? "pass" : score >= 70 ? "warning" : "fail";
  const labelText = score === null ? "N/A" : score >= 85 ? "Certified" : score >= 70 ? "Warning" : "Critical";

  return (
    <div className={`anim-slide-up ${delayClass}`} style={{
      textAlign: "center",
      padding: "20px 16px",
      borderRadius: "var(--radius-lg)",
      background: "var(--bg-secondary)",
      border: "1px solid var(--border-light)",
    }}>
      <div className="form-label" style={{ marginBottom: 8 }}>{label}</div>
      <div style={{ 
        fontSize: 32, 
        fontWeight: 400, 
        color: score === null ? "var(--text-secondary)" : score >= 85 ? "var(--green)" : score >= 70 ? "var(--yellow)" : "var(--red)",
        lineHeight: 1 
      }}>
        {score !== null ? `${score}%` : "—"}
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, marginTop: 8, color: "var(--text-secondary)", textTransform: "uppercase" }}>
        {labelText}
      </div>
    </div>
  );
}

function EvidenceCard({ item, index }) {
  const isBias = item.bias_signal || item.group_outcome_delta > 0.15;
  return (
    <div className="anim-slide-up" style={{
      padding: "16px",
      border: "1px solid var(--border-light)",
      borderRadius: "var(--radius-md)",
      background: isBias ? "var(--red-light)" : "var(--bg)",
      animationDelay: `${index * 0.05}s`,
      marginBottom: 12
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span className="material-symbols-rounded" style={{ fontSize: 18, color: isBias ? "var(--red)" : "var(--green)" }}>
          {isBias ? "warning" : "check_circle"}
        </span>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
          {item.protected_attribute || item.changed || "—"}
        </span>
        <span className="chip chip-grey" style={{ fontSize: 10, marginLeft: "auto" }}>
          {item.type === "direct_lingam_edge" ? "Causal" : "Observed"}
        </span>
      </div>
      <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
        {item.causal_effect !== undefined && `Direct Effect: ${item.causal_effect.toFixed(3)} (Threshold: ${item.threshold})`}
        {item.group_outcome_delta !== undefined && `Outcome Disparity: ${(item.group_outcome_delta * 100).toFixed(1)}%`}
      </div>
    </div>
  );
}

export default function Report() {
  const { sessionId } = useParams();
  const [report, setReport] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    getReport(sessionId).then((r) => setReport(r.data))
      .catch((e) => setErr(e.response?.data?.detail || e.message));
  }, [sessionId]);

  if (err) {
    return (
      <div className="main anim-fade">
        <Panel title="Audit Error" icon="error">
          <div className="alert alert-error">
            <span className="material-symbols-rounded">error</span>
            {err}
          </div>
          <Link to="/" className="btn-google secondary" style={{ marginTop: 24 }}>
            <span className="material-symbols-rounded">arrow_back</span>
            Back to Dashboard
          </Link>
        </Panel>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="main anim-fade">
        <div className="empty-state" style={{ padding: "100px 0" }}>
          <div className="spinner" style={{ margin: "0 auto 24px" }} />
          <div>Retrieving audit evidence...</div>
        </div>
      </div>
    );
  }

  const verdict = report.verdict || "—";
  const isPass = verdict === "PASS";
  const evidence = report.bias_evidence || [];
  const counterfactuals = report.counterfactuals || [];
  const recommendation = report.remediation_recommendation || {};
  const actions = recommendation.actions || [];

  return (
    <div className="main anim-fade">
      <header className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <Link to="/" className="chip chip-grey" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
            <span className="material-symbols-rounded" style={{ fontSize: 16 }}>arrow_back</span>
            Dashboard
          </Link>
          <span className="chip chip-grey">ID: {String(sessionId).slice(0, 8)}</span>
        </div>
        <h1 className="page-title">Audit <em>Trace</em></h1>
        <p className="page-subtitle">
          Deep-dive into the causal reasoning and counterfactual evidence discovered by the Axiom engine.
        </p>
      </header>

      <div className="grid-main">
        {/* Main Content */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <Panel title="Executive Summary" icon="article">
            <div style={{ 
              fontSize: 15, 
              lineHeight: 1.7, 
              color: "var(--text-primary)", 
              whiteSpace: "pre-wrap",
              background: "var(--bg-secondary)",
              padding: 24,
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--border-light)"
            }}>
              {report.audit_report || report.audit_report_md || "No narrative generated."}
            </div>
          </Panel>

          {evidence.length > 0 && (
            <Panel title={`Bias Signals (${evidence.length})`} icon="analytics">
              <div className="staggered">
                {evidence.map((e, i) => <EvidenceCard key={i} item={e} index={i} />)}
              </div>
            </Panel>
          )}

          {counterfactuals.length > 0 && (
            <Panel title="Counterfactual Proofs" icon="compare_arrows">
              <div style={{ overflowX: "auto", margin: "0 -24px" }}>
                <table className="decision-table">
                  <thead>
                    <tr>
                      <th>Factor</th>
                      <th>Original</th>
                      <th>Counterfactual</th>
                      <th>Distance</th>
                      <th>Disparity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {counterfactuals.slice(0, 10).map((cf, i) => (
                      <tr key={i} className="anim-slide-up" style={{ animationDelay: `${i * 0.05}s` }}>
                        <td style={{ fontWeight: 600, color: "var(--red)" }}>{cf.changed}</td>
                        <td>{String(cf.from)}</td>
                        <td>{String(cf.to)}</td>
                        <td style={{ fontFamily: "monospace", fontSize: 12 }}>{cf.distance?.toFixed(3)}</td>
                        <td style={{ fontWeight: 600, color: cf.group_outcome_delta > 0.15 ? "var(--red)" : "var(--green)" }}>
                          {(cf.group_outcome_delta * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </div>

        {/* Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <Panel title="Audit Verdict" icon="workspace_premium">
            <div style={{ textAlign: "center", padding: "12px 0 24px" }}>
              <div className={`verdict ${isPass ? "verdict-pass" : "verdict-fail"}`} style={{ display: "inline-flex", fontSize: 18, padding: "12px 32px" }}>
                <span className="material-symbols-rounded" style={{ fontSize: 24 }}>
                  {isPass ? "verified" : "gavel"}
                </span>
                {verdict}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
              <ScoreGauge label="Pre-Audit" value={report.fairness_score_before} delayClass="delay-1" />
              <ScoreGauge label="Post-Audit" value={report.fairness_score_after} delayClass="delay-2" />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ padding: 16, background: "var(--bg-secondary)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-light)" }}>
                <div className="form-label">Remediation Status</div>
                <div style={{ fontSize: 16, fontWeight: 500, color: "var(--text-primary)", marginTop: 4 }}>
                  {isPass ? "No action required" : (actions.length > 0 ? "Corrective actions generated" : "Manual review pending")}
                </div>
              </div>
              
              {report.pdf_url && (
                <a href={report.pdf_url} target="_blank" rel="noreferrer" className="btn-google" style={{ justifyContent: "center" }}>
                  <span className="material-symbols-rounded">picture_as_pdf</span>
                  Download Official Report
                </a>
              )}
            </div>

            {!isPass && actions.length > 0 && (
              <div style={{ marginTop: 32 }}>
                <div className="form-label" style={{ color: "var(--red)", marginBottom: 12 }}>Remediation Roadmap</div>
                <div className="staggered">
                  {actions.map((a, i) => (
                    <div key={i} className="anim-slide-up" style={{ 
                      padding: 12, 
                      background: "var(--red-light)", 
                      borderRadius: 8, 
                      fontSize: 13, 
                      marginBottom: 8,
                      border: "1px solid var(--red-light)",
                      display: "flex",
                      gap: 10,
                      animationDelay: `${i * 0.1}s`
                    }}>
                      <span style={{ fontWeight: 800, color: "var(--red)" }}>{i+1}</span>
                      <div style={{ color: "var(--text-primary)" }}>{a}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Panel>

          {report.bias_dna && (
            <Panel title="Bias DNA Fingerprint" icon="fingerprint">
              <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5, margin: 0 }}>
                {report.bias_dna.bias_source_summary || "Analyzing contributing factors..."}
              </p>
              {report.bias_dna.total_bias_contributors > 0 && (
                <div className="chip chip-red" style={{ marginTop: 16, display: "inline-flex" }}>
                  {report.bias_dna.total_bias_contributors} high-impact clusters
                </div>
              )}
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
