import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Panel from "../components/Panel";
import CausalGraph from "../components/CausalGraph";
import DriftChart from "../components/DriftChart";
import BiasHeatmap from "../components/BiasHeatmap";
import { getCausalGraph, getDecisions, getMetrics, wipeProject } from "../api";
import { useProjectId } from "../projectStore";

const SEVERITY_LABELS = {
  100: "Critical",
  75: "High",
  50: "Medium",
  25: "Low",
};

function formatTimeAgo(timestamp) {
  if (!timestamp) return "—";
  const seconds = Math.floor((Date.now() - new Date(timestamp)) / 1000);
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function StatCard({ label, value, icon, tone, sublabel, delay = 0 }) {
  const accentMap = { blue: "#1A73E8", red: "#C5221F", yellow: "#B06000", green: "#137333" };
  return (
    <div className={`stat-card ${tone || 'blue'}`} style={{ position: 'relative', animation: `cardEnter 0.5s cubic-bezier(0.4,0,0.2,1) ${delay}s both` }}>
      <div className="stat-label">
        <span className="material-symbols-rounded" style={{ fontSize: 18, color: accentMap[tone] || accentMap.blue }}>{icon}</span>
        {label}
      </div>
      <div className="stat-value">{value}</div>
      {sublabel && <div className="stat-sub">{sublabel}</div>}
    </div>
  );
}

function ProtectedBadge({ attributes }) {
  if (!attributes || attributes.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
      {attributes.map((attr) => (
        <span key={attr} style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 14px",
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 600,
          background: "#FCE8E6",
          color: "#C5221F",
          border: "1px solid #F4C7C3",
        }}>
          <span className="material-symbols-rounded" style={{ fontSize: 14 }}>shield</span>
          {attr}
        </span>
      ))}
    </div>
  );
}

function DecisionRow({ decision, index }) {
  const r = decision.raw || decision;
  const verdict = r.verdict || "—";
  const isFail = verdict === "FAIL";
  const reportId = r.session_id || r.uuid || r._id || "";
  
  return (
    <tr className="table-row-anim" style={{
      background: index % 2 === 0 ? "transparent" : "#F8F8F8",
      animation: `rowEnter 0.3s cubic-bezier(0.4, 0, 0.2, 1) ${index * 0.03}s both`,
    }}>
      <td style={{ padding: "16px 20px", fontFamily: "monospace", fontSize: 12, color: "#1A73E8" }}>
        {reportId ? (
          <Link to={`/report/${reportId}`} style={{
            color: "#1A73E8",
            textDecoration: "none",
            transition: "opacity 0.15s",
          }}>
            {String(reportId).slice(0, 8)}…
          </Link>
        ) : (
          <span style={{ color: "#9E9E9E" }}>—</span>
        )}
      </td>
      <td style={{ padding: "16px 20px", fontSize: 13, color: "#5F6368" }}>
        {formatTimeAgo(r.timestamp)}
      </td>
      <td style={{ padding: "16px 20px" }}>
        <span style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 12px",
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 600,
          background: isFail ? "#FCE8E6" : "#E6F4EA",
          color: isFail ? "#C5221F" : "#137333",
          border: `1px solid ${isFail ? "#F4C7C3" : "#CEEAD6"}`,
        }}>
          <span className="material-symbols-rounded" style={{ fontSize: 14 }}>
            {isFail ? "error" : "check_circle"}
          </span>
          {verdict}
        </span>
      </td>
      <td style={{ padding: "16px 20px" }}>
        {r.severity_score !== undefined && r.severity_score > 0 ? (
          <span style={{
            padding: "4px 10px",
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 700,
            background: r.severity_score >= 75 ? "#FCE8E6" : r.severity_score >= 50 ? "#FEF7E0" : "#E6F4EA",
            color: r.severity_score >= 75 ? "#C5221F" : r.severity_score >= 50 ? "#B06000" : "#137333",
          }}>
            {SEVERITY_LABELS[r.severity_score] || r.severity_score}
          </span>
        ) : "—"}
      </td>
      <td style={{ padding: "16px 20px", fontSize: 13, color: "#5F6368" }}>
        {r.violated_rule_id || r.violated_rule || "—"}
      </td>
      <td style={{ padding: "16px 20px" }}>
        {r.remediated_decision ? (
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "6px 12px",
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 600,
            background: "#E6F4EA",
            color: "#137333",
            border: "1px solid #CEEAD6",
          }}>
            <span className="material-symbols-rounded" style={{ fontSize: 12 }}>auto_fix_high</span>
            Fixed
          </span>
        ) : (
          <span style={{ color: "#9E9E9E", fontSize: 13 }}>—</span>
        )}
      </td>
    </tr>
  );
}

export default function Dashboard() {
  const [projectId] = useProjectId();
  const [graph, setGraph] = useState({ causal_graph: [], protected_attributes: [] });
  const [decisions, setDecisions] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [wiping, setWiping] = useState(false);
  const [showMatrix, setShowMatrix] = useState(false);

  useEffect(() => {
    if (!projectId) {
      setGraph({ causal_graph: [], protected_attributes: [] });
      setDecisions([]);
      setMetrics(null);
      return;
    }
    let lastGraphSig = "";
    let lastDecisionsSig = "";
    let lastMetricsSig = "";
    const load = () => {
      // REAL DATA ONLY - No fake/sample data
      // Fetch causal graph from Firebase
      getCausalGraph(projectId).then((r) => {
        const g = r.data;
        if (g && g.causal_graph) {
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
      }).catch((err) => {
        console.warn("getCausalGraph failed:", err);
        // Fallback: build a simple live graph from decision evidence.
        getDecisions(projectId).then((res) => {
          const list = Array.isArray(res.data) ? res.data
            : Array.isArray(res.data?.decisions) ? res.data.decisions : [];
          const edgeMap = new Map();
          const protectedSet = new Set();
          list.forEach((item) => {
            const rec = item?.raw || item || {};
            const evidence = Array.isArray(rec.bias_evidence) ? rec.bias_evidence : [];
            evidence.forEach((ev) => {
              const src = String(ev?.protected_attribute || "").trim();
              const dst = String(ev?.outcome_column || "").trim();
              if (!src || !dst) return;
              protectedSet.add(src);
              edgeMap.set(`${src}=>${dst}`, { source: src, target: dst, weight: 1 });
            });
          });
          const causalEdges = Array.from(edgeMap.values());
          const featureNames = Array.from(
            new Set(
              causalEdges.flatMap((e) => [String(e.source), String(e.target)])
            )
          );
          const idx = new Map(featureNames.map((n, i) => [n, i]));
          const adjacencyMatrix = featureNames.map(() => featureNames.map(() => 0));
          causalEdges.forEach((e) => {
            const r = idx.get(String(e.source));
            const c = idx.get(String(e.target));
            if (r !== undefined && c !== undefined) adjacencyMatrix[r][c] = 1;
          });
          const fallback = {
            causal_graph: causalEdges,
            protected_attributes: Array.from(protectedSet),
            feature_names: featureNames,
            adjacency_matrix: adjacencyMatrix,
          };
          const sig = JSON.stringify(fallback);
          if (sig !== lastGraphSig) {
            lastGraphSig = sig;
            setGraph(fallback);
          }
        }).catch(() => {
          if (lastGraphSig !== "") {
            lastGraphSig = "";
            setGraph({ causal_graph: [], protected_attributes: [] });
          }
        });
      });
      
      // Fetch real decisions from Firebase
      getDecisions(projectId).then((r) => {
        const d = r.data;
        const list = Array.isArray(d) ? d
                  : Array.isArray(d?.decisions) ? d.decisions
                  : (d && typeof d === "object") ? Object.values(d) : [];
        const sig = JSON.stringify(
          list.map((x) => ({
            id: x?.session_id || x?.uuid || x?._id || x?.raw?.session_id || "",
            t: x?.timestamp || x?.raw?.timestamp || "",
            v: x?.verdict || x?.raw?.verdict || "",
            s: x?.severity_score || x?.raw?.severity_score || null,
          }))
        );
        if (sig !== lastDecisionsSig) {
          lastDecisionsSig = sig;
          setDecisions(list);
        }
      }).catch((err) => {
        console.warn("getDecisions failed:", err);
        if (lastDecisionsSig !== "") {
          lastDecisionsSig = "";
          setDecisions([]);
        }
      });
      
      // Fetch real metrics from Firebase
      getMetrics(projectId).then((r) => {
        const m = r.data;
        if (m && typeof m === "object") {
          const sig = JSON.stringify({
            total: m.total_decisions,
            flagged: m.flagged,
            remediated: m.remediated,
            avg: m.average_fairness_score,
            drift: m.drift_data || [],
          });
          if (sig !== lastMetricsSig) {
            lastMetricsSig = sig;
            setMetrics(m);
          }
        } else {
          if (lastMetricsSig !== "empty") {
            lastMetricsSig = "empty";
            setMetrics({ total_decisions: 0, flagged: 0, remediated: 0, average_fairness_score: 0, drift_data: [] });
          }
        }
      }).catch((err) => {
        console.warn("getMetrics failed:", err);
        if (lastMetricsSig !== "empty") {
          lastMetricsSig = "empty";
          setMetrics({ total_decisions: 0, flagged: 0, remediated: 0, average_fairness_score: 0, drift_data: [] });
        }
      });
    };
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [projectId]);

  const total = metrics?.total_decisions ?? decisions.length;
  const flagged = metrics?.flagged ?? 0;
  const remediated = metrics?.remediated ?? 0;
  const avgScore = metrics?.average_fairness_score ?? 0;
  const drift = metrics?.drift_data || [];

  const hasData = total > 0;
  const hasGraph = (graph.causal_graph || []).length > 0;

  const onWipe = async () => {
    if (!projectId) return;
    if (!window.confirm(`Delete ALL data for "${projectId}"? This cannot be undone.`)) return;
    setWiping(true);
    try {
      await wipeProject(projectId);
      setGraph({ causal_graph: [], protected_attributes: [] });
      setDecisions([]);
      setMetrics(null);
    } catch (e) {
      alert("Wipe failed: " + (e.response?.data?.detail || e.message));
    } finally { setWiping(false); }
  };

  if (!projectId) {
    return (
      <div style={{ maxWidth: 1340, margin: "0 auto", padding: "32px 24px 64px" }}>
        <Panel title="Dashboard" icon="monitoring">
          <div style={{ textAlign: "center", padding: "64px 24px", color: "#5F6368" }}>
            <span className="material-symbols-rounded" style={{ fontSize: 56, color: "#DADCE0", display: "block", marginBottom: 16 }}>
              folder_off
            </span>
            <div style={{ fontWeight: 500, fontSize: 16, marginBottom: 8, color: "#202124" }}>No project selected</div>
            <div style={{ fontSize: 14, color: "#5F6368" }}>
              Enter a <strong style={{ color: "#1A73E8" }}>project_id</strong> in the top picker, then go to <Link to="/upload" style={{ color: "#1A73E8" }}>Upload</Link> to begin.
            </div>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1340, margin: "0 auto", padding: "32px 24px 64px" }}>
      <style>{`
        @keyframes cardEnter {
          from { opacity: 0; transform: translateY(16px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes heroEnter {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes rowEnter {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes iconSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .btn-google {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .btn-google:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(26,115,232,0.4);
        }
        .btn-google:active {
          transform: translateY(0);
          box-shadow: 0 2px 4px rgba(26,115,232,0.3);
        }
        .link-hover:hover {
          opacity: 0.8;
        }
      `}</style>

      {/* Hero Section */}
      <section style={{
        background: "#FFFFFF",
        borderRadius: 16,
        padding: "40px 40px",
        marginBottom: 28,
        boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
        border: "1px solid #E8E8E8",
        animation: "heroEnter 0.5s cubic-bezier(0.4, 0, 0.2, 1) both",
        position: "relative",
      }}>
        {/* Progress bar at top (solid, animated) */}
        <div className="hero-progress">
          <div className="hero-progress-inner" style={{ width: total ? `${Math.max(0, Math.min(100, Math.round(avgScore)))}%` : '0%' }} />
        </div>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 32 }}>
          <div style={{ flex: 1, minWidth: 300 }}>
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 14px",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.5px",
              textTransform: "uppercase",
              background: "#E8F0FE",
              color: "#1A73E8",
              marginBottom: 20,
            }}>
              <span className="material-symbols-rounded" style={{ fontSize: 16 }}>shield</span>
              Fairness Control Room
            </div>
            
            <h1 style={{
              fontFamily: "'Google Sans', Roboto, Arial, sans-serif",
              fontSize: 46,
              fontWeight: 400,
              color: "#202124",
              margin: "0 0 16px",
              lineHeight: 1.15,
              letterSpacing: "-0.5px",
            }}>
              Every decision,<br/>
              <em style={{ fontStyle: "italic", color: "#5F6368" }}>judged</em> in <span style={{ color: "#1A73E8", fontStyle: "italic" }}>real time</span>
            </h1>
            
            <p style={{
              color: "#5F6368",
              fontSize: 15,
              maxWidth: 520,
              lineHeight: 1.6,
              margin: "0 0 28px",
            }}>
              Causal counterfactual auditing of your model outputs — reasoned at the speed of inference by Gemini 3.1 Pro
            </p>
            
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link to="/upload" className="btn-google" style={{ textDecoration: 'none' }}>
                <span className="material-symbols-rounded" style={{ fontSize: 20 }}>upload_file</span>
                Upload Dataset
              </Link>
              <Link to="/constitution" className="btn-google secondary" style={{ textDecoration: 'none' }}>
                <span className="material-symbols-rounded" style={{ fontSize: 20 }}>gavel</span>
                Set Constitution
              </Link>
              <button onClick={onWipe} disabled={wiping || total === 0} className="btn-google secondary" style={{ cursor: wiping || total === 0 ? "not-allowed" : "pointer", opacity: wiping || total === 0 ? 0.6 : 1 }}>
                <span className="material-symbols-rounded" style={{ fontSize: 20 }}>delete_sweep</span>
                {wiping ? "Wiping..." : "Clear Data"}
              </button>
            </div>
          </div>
          
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            minWidth: 200,
          }}>
            <div style={{
              padding: 20,
              borderRadius: 12,
              background: "#FAFAFA",
              border: "1px solid #E8E8E8",
            }}>
              <div style={{ fontSize: 11, letterSpacing: "0.5px", textTransform: "uppercase", color: "#5F6368", marginBottom: 6 }}>
                Project
              </div>
              <div style={{ fontSize: 15, fontWeight: 500, color: "#202124", fontFamily: "monospace" }}>
                {projectId}
              </div>
            </div>
            <div style={{
              padding: 20,
              borderRadius: 12,
              background: "#E8F0FE",
              border: "1px solid #D2E3FC",
            }}>
              <div style={{ fontSize: 11, letterSpacing: "0.5px", textTransform: "uppercase", color: "#1A73E8", marginBottom: 6 }}>
                Engine
              </div>
              <div style={{ fontSize: 15, fontWeight: 500, color: "#1A73E8", fontFamily: "monospace" }}>
                Gemini 3.1 Pro
              </div>
            </div>
            <div style={{
              padding: 20,
              borderRadius: 12,
              background: hasData ? "#E6F4EA" : "#FAFAFA",
              border: `1px solid ${hasData ? "#CEEAD6" : "#E8E8E8"}`,
            }}>
              <div style={{ fontSize: 11, letterSpacing: "0.5px", textTransform: "uppercase", color: hasData ? "#137333" : "#5F6368", marginBottom: 6 }}>
                Status
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: hasData ? "#34A853" : "#9E9E9E",
                  display: "inline-block",
                }} />
                <span style={{ fontSize: 15, fontWeight: 500, color: hasData ? "#137333" : "#5F6368" }}>
                  {hasData ? "Active" : "Ready"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 16,
        marginBottom: 28,
      }}>
        <StatCard label="Total Decisions" value={total} icon="monitoring" tone="blue" sublabel="processed" delay={0.1} />
        <StatCard label="Flagged" value={flagged} icon="report" tone="red" sublabel={flagged > 0 ? `${Math.round(flagged/total*100)}% flagged` : "no violations"} delay={0.15} />
        <StatCard label="Auto-Fixed" value={remediated} icon="auto_fix" tone="yellow" sublabel={remediated > 0 ? "bias removed" : "pending"} delay={0.2} />
        <StatCard label="Fairness Score" value={total ? `${Math.round(avgScore)}%` : "—"} icon="verified" tone="green" sublabel={avgScore >= 85 ? "certified" : avgScore >= 70 ? "acceptable" : avgScore > 0 ? "needs work" : "no data"} delay={0.25} />
      </div>

      {/* Main Content Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1.5fr 1fr",
        gap: 20,
        marginBottom: 24,
      }}>
        <Panel title="Causal Graph" icon="hub">
          {!hasGraph ? (
            <div style={{ textAlign: "center", padding: "48px 24px", color: "#5F6368" }}>
              <span className="material-symbols-rounded" style={{ fontSize: 48, color: "#DADCE0", display: "block", marginBottom: 16 }}>hub</span>
              <div style={{ fontWeight: 500, fontSize: 15, marginBottom: 4, color: "#202124" }}>No graph built yet</div>
              <div style={{ fontSize: 13, marginBottom: 20, color: "#5F6368" }}>Upload a CSV dataset to discover causal relationships</div>
              <Link to="/upload" className="btn-google" style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 24px",
                borderRadius: 8,
                background: "#1A73E8",
                color: "#FFFFFF",
                fontWeight: 500,
                fontSize: 14,
                textDecoration: "none",
              }}>
                <span className="material-symbols-rounded" style={{ fontSize: 18 }}>upload_file</span>
                Upload Dataset
              </Link>
            </div>
          ) : (
            <>
              <CausalGraph edges={graph.causal_graph || []} protected={graph.protected_attributes || []} animated />
              <ProtectedBadge attributes={graph.protected_attributes} />
              
              <button onClick={() => setShowMatrix(!showMatrix)} style={{
                marginTop: 20,
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                color: "#1A73E8",
                padding: "8px 0",
              }}>
                <span className="material-symbols-rounded" style={{ fontSize: 16, transform: showMatrix ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>expand_more</span>
                {showMatrix ? "Hide" : "Show"} Causal Adjacency Matrix
              </button>
              
              {showMatrix && graph.adjacency_matrix && graph.feature_names && (
                <div style={{ marginTop: 16 }}>
                  <BiasHeatmap matrix={graph.adjacency_matrix} labels={graph.feature_names} />
                </div>
              )}
            </>
          )}
        </Panel>

        <Panel title="Fairness Drift" icon="trending_up">
          {drift.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 24px", color: "#5F6368" }}>
              <span className="material-symbols-rounded" style={{ fontSize: 48, color: "#DADCE0", display: "block", marginBottom: 16 }}>timeline</span>
              <div style={{ fontWeight: 500, fontSize: 15, marginBottom: 4, color: "#202124" }}>No data yet</div>
              <div style={{ fontSize: 13, color: "#5F6368" }}>Intercepted decisions will appear here over time</div>
            </div>
          ) : (
            <DriftChart data={drift} />
          )}
        </Panel>
      </div>

      {/* Decision Log */}
      <Panel title="Decision Log" icon="receipt_long">
        {decisions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 24px", color: "#5F6368" }}>
            <span className="material-symbols-rounded" style={{ fontSize: 48, color: "#DADCE0", display: "block", marginBottom: 16 }}>inbox</span>
            <div style={{ fontWeight: 500, fontSize: 15, marginBottom: 4, color: "#202124" }}>No decisions yet</div>
            <div style={{ fontSize: 13, color: "#5F6368" }}>POST a decision to <code style={{ background: "#F1F3F4", padding: "2px 6px", borderRadius: 4 }}>/api/v1/intercept</code> to see it here</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 650 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #E8E8E8" }}>
                  {["ID", "Time", "Verdict", "Severity", "Attribute", "Action"].map((h) => (
                    <th key={h} style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.5px",
                      textTransform: "uppercase",
                      color: "#5F6368",
                      padding: "14px 20px",
                      textAlign: "left",
                      background: "#FAFAFA",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {decisions.slice(0, 25).map((d, i) => (
                  <DecisionRow key={i} decision={d} index={i} />
                ))}
              </tbody>
            </table>
            {decisions.length > 25 && (
              <div style={{ textAlign: "center", padding: 16, fontSize: 13, color: "#5F6368", borderTop: "1px solid #E8E8E8" }}>
                Showing 25 of {decisions.length} decisions
              </div>
            )}
          </div>
        )}
      </Panel>

      {/* Footer */}
      <div style={{
        marginTop: 32,
        padding: "24px 32px",
        borderRadius: 12,
        background: "#FFFFFF",
        border: "1px solid #E8E8E8",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 20,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.5px", textTransform: "uppercase", color: "#9E9E9E", marginBottom: 4 }}>Graph</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: hasGraph ? "#34A853" : "#9E9E9E" }} />
              <span style={{ fontWeight: 500, fontSize: 14, color: "#202124" }}>{hasGraph ? "Built" : "Not built"}</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.5px", textTransform: "uppercase", color: "#9E9E9E", marginBottom: 4 }}>Protected Attrs</div>
            <div style={{ fontWeight: 500, fontSize: 14, color: "#C5221F" }}>{(graph.protected_attributes || []).join(", ") || "None detected"}</div>
          </div>
        </div>
        <div style={{ fontSize: 13, color: "#5F6368" }}>
          <strong style={{ color: "#202124" }}>Axiom</strong> · Causal fairness firewall · powered by Gemini 3.1 Pro on Vertex AI
        </div>
      </div>
    </div>
  );
}