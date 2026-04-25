import React, { useState } from "react";
import Panel from "../components/Panel";
import CausalGraph from "../components/CausalGraph";
import { uploadDataset, saveConstitution, batchAudit } from "../api";
import { useProjectId } from "../projectStore";

const SAMPLES = [
  {
    id: "adult-income",
    name: "Adult Income (UCI Census)",
    file: "/samples/adult-income.csv",
    rows: 32561,
    cols: 15,
    protected: ["sex", "race", "age"],
    target: "income",
    desc: "Predict whether income exceeds $50K. Classic gender / race bias benchmark.",
    policy: "Gender and race must not influence income predictions. Age should have minimal causal effect on outcome."
  },
  {
    id: "german-credit",
    name: "German Credit Risk",
    file: "/samples/german-credit.csv",
    rows: 1000,
    cols: 21,
    protected: ["personal_status_sex", "age"],
    target: "credit_risk",
    desc: "Loan default prediction with sensitive demographic attributes.",
    policy: "Sex and age must not affect credit risk assessment. Personal status should be causally isolated from the decision."
  },
  {
    id: "compas-recidivism",
    name: "COMPAS Recidivism (ProPublica)",
    file: "/samples/compas-recidivism.csv",
    rows: 7214,
    cols: 53,
    protected: ["race", "sex", "age"],
    target: "two_year_recid",
    desc: "Criminal-risk scoring tool shown to be biased against Black defendants.",
    policy: "Race and sex must have zero causal influence on recidivism scores. Age should be handled as a non-biasing factor."
  },
];

function SampleCard({ sample, onUse, delayClass }) {
  return (
    <div className={`tech-card anim-slide-up ${delayClass}`} style={{
      display: "flex",
      alignItems: "center",
      padding: "20px",
      marginBottom: 16,
    }}>
      <div className="tech-card-vents"><span/><span/><span/></div>
      <div style={{ flex: 1, position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 16, color: "var(--text-primary)" }}>{sample.name.toUpperCase()}</span>
          <div style={{ display: "flex", gap: 6 }}>
            {sample.protected.map((p) => (
              <span key={p} className="chip chip-red" style={{ fontSize: 9, padding: "2px 8px", fontFamily: "var(--font-mono)" }}>{p.toUpperCase()}</span>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4, fontFamily: "var(--font-mono)" }}>
          {sample.rows.toLocaleString()} ROWS · {sample.cols} COLS · TARGET: <code style={{ background: "var(--blue-light)", color: "var(--blue)" }}>{sample.target.toUpperCase()}</code>
        </div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", maxWidth: 500 }}>{sample.desc}</div>
      </div>
      <div style={{ display: "flex", gap: 12, position: "relative", zIndex: 1 }}>
        <a href={sample.file} download={`${sample.id}.csv`} className="btn-google secondary" style={{ width: 44, height: 44, padding: 0, justifyContent: "center" }}>
          <span className="material-symbols-rounded">download</span>
        </a>
        <button onClick={() => onUse(sample)} className="btn-google">
          <span className="material-symbols-rounded">analytics</span>
          ANALYZE
        </button>
      </div>
    </div>
  );
}


export default function Upload() {
  const [projectId, setProjectId] = useProjectId();
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const analyzeSample = async (sample) => {
    setBusy(true); setError(null); setResult(null);
    try {
      setProjectId(sample.id);
      const res = await fetch(sample.file);
      const blob = await res.blob();
      const csvFile = new File([blob], `${sample.id}.csv`, { type: "text/csv" });
      
      const uploadRes = await uploadDataset(sample.id, csvFile);
      
      // Show results immediately so UI doesn't hang!
      setResult(uploadRes.data);
      setBusy(false);

      // Inject constitution and batch audit in the background
      saveConstitution(sample.id, sample.policy).then(() => {
        batchAudit(sample.id, 10).catch(console.error);
      }).catch(console.error);
      
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!file || !projectId) return;
    setBusy(true); setError(null); setResult(null);
    try {
      const r = await uploadDataset(projectId, file);
      setResult(r.data);
    } catch (e) {
      setError(e.response?.data?.detail || e.message);
    } finally { setBusy(false); }
  };


  return (
    <div className="main anim-fade">
      <header className="page-header">
        <h1 className="page-title">Dataset <em>Cartography</em></h1>
        <p className="page-subtitle">
          Upload a raw CSV to automatically discover causal pathways. 
          Axiom identifies protected attributes and maps the decision logic for fairness auditing.
        </p>
      </header>

      <div className="grid-main">
        {/* Left Column: Upload & Samples */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <Panel title="Upload Custom Data" icon="cloud_upload">
            <div className="form-group">
              <label className="form-label">Project Identifier</label>
              <input
                className="form-input"
                value={projectId}
                placeholder="e.g. mortgage-risk-audit"
                onChange={(e) => setProjectId(e.target.value.trim())}
              />
            </div>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); setFile(e.dataTransfer.files?.[0]); }}
              onClick={() => document.getElementById("file-input").click()}
              className="dropzone"
              style={file ? { borderColor: "var(--blue)", background: "var(--blue-light)" } : {}}
            >
              <span className="material-symbols-rounded">
                {file ? "description" : "upload_file"}
              </span>
              <div className="dropzone-title">
                {file ? file.name : "Drop CSV file here"}
              </div>
              <div className="dropzone-sub">
                {file ? `${(file.size/1024).toFixed(1)} KB` : "or click to select file"}
              </div>
              <input
                id="file-input" type="file" accept=".csv"
                style={{ display: "none" }}
                onChange={(e) => setFile(e.target.files?.[0])}
              />
            </div>

            <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
              <button onClick={submit} disabled={!file || !projectId || busy} className="btn-google">
                <span className="material-symbols-rounded">
                  {busy ? "sync" : "analytics"}
                </span>
                {busy ? "Analyzing pathways..." : "Run Causal Discovery"}
              </button>
              {file && (
                <button onClick={() => { setFile(null); setResult(null); }} className="btn-google secondary">
                  Clear
                </button>
              )}
            </div>

            {error && (
              <div className="alert alert-error" style={{ marginTop: 20 }}>
                <span className="material-symbols-rounded">error</span>
                {error}
              </div>
            )}
          </Panel>

          <Panel title="Sample Datasets" icon="dataset">
            <div className="staggered">
              {SAMPLES.map((s, i) => (
                <SampleCard key={s.id} sample={s} onUse={analyzeSample} delayClass={`delay-${i+1}`} />
              ))}
            </div>
          </Panel>

        </div>

        {/* Right Column: Discovery Results */}
        <Panel title="Discovery Results" icon="insights">
          {!result && !busy && (
            <div className="empty-state">
              <span className="material-symbols-rounded" style={{ fontSize: 48, color: "var(--border)", display: "block", marginBottom: 16 }}>
                travel_explore
              </span>
              <div style={{ fontWeight: 500, fontSize: 16, color: "var(--text-primary)", marginBottom: 8 }}>Ready for analysis</div>
              <div className="empty-state-desc">Select a dataset and run the discovery engine to see causal nodes and protected pathways.</div>
            </div>
          )}

          {busy && (
            <div className="empty-state">
              <div className="spinner" style={{ margin: "0 auto 24px" }} />
              <div style={{ fontWeight: 500, fontSize: 16, color: "var(--text-primary)", marginBottom: 8 }}>Causal Discovery in progress</div>
              <div className="empty-state-desc">Running DirectLiNGAM on {file?.name}...</div>
            </div>
          )}

          {result && (
            <div className="anim-fade">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 32 }}>
                <div className="tech-card" style={{ padding: "16px" }}>
                  <div className="tech-label">Target Outcome</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>{result.outcome_column?.toUpperCase() ?? "—"}</div>
                </div>
                <div className="tech-card blue" style={{ padding: "16px" }}>
                  <div className="tech-label">Features</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "var(--blue)", fontFamily: "var(--font-mono)" }}>{result.num_nodes ?? "—"}</div>
                </div>
                <div className="tech-card green" style={{ padding: "16px" }}>
                  <div className="tech-label">Causal Links</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "var(--green)", fontFamily: "var(--font-mono)" }}>{result.num_edges ?? "—"}</div>
                </div>
              </div>

              <div className="form-label" style={{ marginBottom: 12 }}>Protected Attributes Identified</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 32 }}>
                {(result.protected_attributes || []).length === 0 ? (
                  <span className="chip chip-grey">None identified</span>
                ) : (
                  result.protected_attributes.map((p) => (
                    <span key={p} className="chip chip-red anim-scale">
                      <span className="material-symbols-rounded" style={{ fontSize: 14 }}>shield</span>
                      {p}
                    </span>
                  ))
                )}
              </div>

              <div style={{ marginBottom: 32 }}>
                <CausalGraph 
                  edges={result.causal_graph_edges || []} 
                  protected={result.protected_attributes || []} 
                />
              </div>

              <div style={{ padding: 24, background: "var(--bg-secondary)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-light)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <span className="material-symbols-rounded" style={{ color: "var(--blue)" }}>rocket_launch</span>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>Next: Define Rules</div>
                </div>
                <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "0 0 20px", lineHeight: 1.5 }}>
                  Now that we have a causal map, you should define a Fairness Constitution to enforce rules against these protected attributes.
                </p>
                <a href="/constitution" className="btn-google secondary" style={{ width: "100%", justifyContent: "center" }}>
                  Go to Constitution
                </a>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
