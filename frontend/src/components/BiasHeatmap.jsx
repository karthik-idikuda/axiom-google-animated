import React, { useState } from "react";

export default function BiasHeatmap({ matrix = [], labels = [] }) {
  const [hovered, setHovered] = useState(null);

  if (!matrix.length) return null;

  const maxVal = Math.max(...matrix.flat().map(v => Math.abs(v)), 0.001);

  return (
    <div className="tech-card anim-fade" style={{ padding: 0, overflow: "hidden", background: "#FFFFFF" }}>
      {/* Header HUD */}
      <div style={{ 
        padding: "16px 24px", 
        borderBottom: "1px solid var(--border-light)",
        background: "linear-gradient(90deg, #F8F9FA 0%, #FFFFFF 100%)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
        <div>
          <div className="tech-label" style={{ color: "var(--blue)" }}>Causal Influence Matrix</div>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
            ROW_FEATURE → COL_TARGET | INTENSITY = CAUSAL_STRENGTH
          </div>
        </div>
        {hovered && (
          <div className="anim-scale-small" style={{ 
            display: "flex", 
            gap: 16, 
            alignItems: "center",
            padding: "6px 16px",
            background: "rgba(26,115,232,0.05)",
            borderRadius: "var(--radius-full)",
            border: "1px solid var(--blue-border)"
          }}>
            <div style={{ fontSize: 12, fontFamily: "var(--font-mono)" }}>
              <span style={{ color: "var(--text-tertiary)" }}>FROM:</span> <span style={{ fontWeight: 700, color: "var(--blue)" }}>{labels[hovered.i]}</span>
            </div>
            <span className="material-symbols-rounded" style={{ fontSize: 16, color: "var(--text-tertiary)" }}>arrow_forward</span>
            <div style={{ fontSize: 12, fontFamily: "var(--font-mono)" }}>
              <span style={{ color: "var(--text-tertiary)" }}>TO:</span> <span style={{ fontWeight: 700, color: "var(--blue)" }}>{labels[hovered.j]}</span>
            </div>
            <div style={{ 
              fontSize: 14, 
              fontWeight: 700, 
              color: matrix[hovered.i][hovered.j] > 0 ? "var(--green)" : "var(--red)",
              fontFamily: "var(--font-mono)",
              marginLeft: 8
            }}>
              {matrix[hovered.i][hovered.j] > 0 ? "+" : ""}{matrix[hovered.i][hovered.j].toFixed(4)}
            </div>
          </div>
        )}
      </div>

      {/* Grid Container */}
      <div style={{ padding: "24px", overflowX: "auto" }}>
        <table style={{ borderCollapse: "separate", borderSpacing: "2px", margin: "0 auto" }}>
          <thead>
            <tr>
              <th style={{ padding: "8px" }}></th>
              {labels.map((l, j) => (
                <th key={j} style={{ 
                  padding: "8px",
                  height: "120px",
                  verticalAlign: "bottom",
                  position: "relative"
                }}>
                  <div style={{
                    transform: "rotate(-45deg)",
                    transformOrigin: "bottom left",
                    width: "20px",
                    whiteSpace: "nowrap",
                    fontSize: "11px",
                    fontFamily: "var(--font-mono)",
                    fontWeight: 700,
                    color: hovered?.j === j ? "var(--blue)" : "var(--text-secondary)",
                    transition: "color 0.2s"
                  }}>
                    {l.toUpperCase()}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, i) => (
              <tr key={i}>
                <td style={{ 
                  padding: "8px 16px",
                  textAlign: "right",
                  fontSize: "11px",
                  fontFamily: "var(--font-mono)",
                  fontWeight: 700,
                  color: hovered?.i === i ? "var(--blue)" : "var(--text-secondary)",
                  whiteSpace: "nowrap",
                  transition: "color 0.2s"
                }}>
                  {labels[i].toUpperCase()}
                </td>
                {row.map((val, j) => {
                  const intensity = Math.abs(val) / maxVal;
                  const isHovered = hovered?.i === i && hovered?.j === j;
                  const inCrosshair = hovered?.i === i || hovered?.j === j;
                  
                  return (
                    <td 
                      key={j}
                      onMouseEnter={() => setHovered({ i, j })}
                      onMouseLeave={() => setHovered(null)}
                      style={{
                        width: "36px",
                        height: "36px",
                        background: val > 0 
                          ? `rgba(26, 115, 232, ${0.05 + intensity * 0.8})`
                          : `rgba(234, 67, 53, ${0.05 + intensity * 0.8})`,
                        borderRadius: "4px",
                        cursor: "crosshair",
                        transition: "all 0.15s ease",
                        position: "relative",
                        border: isHovered ? "2px solid #FFFFFF" : "1px solid transparent",
                        boxShadow: isHovered ? "0 0 15px rgba(0,0,0,0.2)" : "none",
                        transform: isHovered ? "scale(1.15)" : inCrosshair ? "scale(1.02)" : "none",
                        zIndex: isHovered ? 10 : 1
                      }}
                    >
                      {intensity > 0.4 && (
                        <div style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "8px",
                          fontFamily: "var(--font-mono)",
                          fontWeight: 700,
                          color: intensity > 0.7 ? "#FFFFFF" : "rgba(0,0,0,0.4)",
                          pointerEvents: "none"
                        }}>
                          {Math.abs(val).toFixed(2)}
                        </div>
                      )}
                      
                      {isHovered && (
                        <div className="anim-pulse" style={{
                          position: "absolute",
                          inset: "-4px",
                          border: `2px solid ${val > 0 ? "var(--blue)" : "var(--red)"}`,
                          borderRadius: "6px",
                          pointerEvents: "none"
                        }} />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer Info */}
      <div style={{ 
        padding: "12px 24px", 
        borderTop: "1px solid var(--border-light)",
        background: "var(--bg-secondary)",
        fontSize: "11px",
        color: "var(--text-tertiary)",
        display: "flex",
        gap: 24,
        fontFamily: "var(--font-mono)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, background: "var(--blue)", borderRadius: "2px" }} />
          POSITIVE CAUSAL FLOW
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, background: "var(--red)", borderRadius: "2px" }} />
          NEGATIVE CAUSAL FLOW
        </div>
        <div style={{ marginLeft: "auto" }}>
          HOVER CELL FOR INTERACTIVE HUD
        </div>
      </div>
    </div>
  );
}
