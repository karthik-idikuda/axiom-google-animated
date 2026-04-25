import React, { useEffect, useRef, useState } from "react";

export default function RulesGraph({ rules = [] }) {
  const canvasRef = useRef();
  const startRef = useRef(Date.now());
  const [size, setSize] = useState({ w: 600, h: 400 });
  const containerRef = useRef();

  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const r = containerRef.current.getBoundingClientRect();
        setSize({ w: Math.max(r.width, 320), h: 400 });
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // reset animation when rules change
  useEffect(() => {
    startRef.current = Date.now();
  }, [rules]);

  // compute rule layout in a radial grid
  const nodes = rules.map((rule, idx) => {
    const total = rules.length;
    const angle = (idx / Math.max(total, 1)) * Math.PI * 2;
    const radius = 120;
    const cx = size.w / 2;
    const cy = size.h / 2;
    return {
      id: rule.rule_id || `RULE_${idx + 1}`,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
      severity: rule.severity || rule.severity_if_violated || "MEDIUM",
      protected: rule.protected_attribute || rule.protected || "?",
      description: rule.description || `Causal influence <= ${rule.threshold || rule.allowed_causal_influence || 0}`,
      idx,
    };
  });

  // central hub
  const hub = { x: size.w / 2, y: size.h / 2, id: "fairness" };

  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    const elapsed = Date.now() - startRef.current;
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, size.w, size.h);

    // draw connecting lines from hub to each rule node (animated)
    nodes.forEach((node, idx) => {
      const delay = idx * 100;
      const duration = 500;
      const p = easeOutCubic(Math.min(1, Math.max(0, (elapsed - delay) / duration)));

      ctx.save();
      ctx.globalAlpha = p * 0.6;
      ctx.strokeStyle = getSeverityColor(node.severity);
      ctx.lineWidth = p * 2;
      ctx.setLineDash([4, 3]);

      // animate line from hub to node
      const sx = hub.x;
      const sy = hub.y;
      const ex = hub.x + (node.x - hub.x) * p;
      const ey = hub.y + (node.y - hub.y) * p;

      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.restore();
    });

    // draw hub (center circle)
    ctx.save();
    const hubElapsed = Math.max(0, elapsed - 100);
    const hubP = easeOutCubic(Math.min(1, hubElapsed / 400));
    ctx.globalAlpha = hubP;
    ctx.fillStyle = "#1A73E8";
    ctx.beginPath();
    ctx.arc(hub.x, hub.y, 16 * hubP, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 3;
    ctx.stroke();

    // hub label
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 10px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("RULES", hub.x, hub.y);
    ctx.restore();

    // draw rule nodes (badges)
    nodes.forEach((node, idx) => {
      const delay = idx * 100 + 200;
      const duration = 400;
      const p = easeOutCubic(Math.min(1, Math.max(0, (elapsed - delay) / duration)));

      ctx.save();
      ctx.globalAlpha = p;

      const color = getSeverityColor(node.severity);
      const bgLight = getSeverityBg(node.severity);

      // node circle background
      ctx.fillStyle = bgLight;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      const r = 24 + p * 4;
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      // node icon/badge
      ctx.fillStyle = color;
      ctx.font = "bold 11px 'Material Symbols Rounded', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("shield", node.x, node.y - 2);

      // severity label below
      ctx.fillStyle = color;
      ctx.font = "600 10px Inter, sans-serif";
      ctx.fillText(node.severity, node.x, node.y + 14);

      ctx.restore();
    });

    // hover tooltip (optional: show on hover via canvas mouse tracking)
    // For now, just display info under the graph
  }, [size, rules, nodes]);

  const getSeverityColor = (sev) => {
    if (sev === "CRITICAL") return "#C5221F";
    if (sev === "HIGH") return "#B06000";
    if (sev === "MEDIUM") return "#1A73E8";
    if (sev === "LOW") return "#137333";
    return "#5F6368";
  };

  const getSeverityBg = (sev) => {
    if (sev === "CRITICAL") return "#FCE8E6";
    if (sev === "HIGH") return "#FEF7E0";
    if (sev === "MEDIUM") return "#E8F0FE";
    if (sev === "LOW") return "#E6F4EA";
    return "#F1F3F4";
  };

  if (!rules || rules.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "48px 24px", color: "#5F6368" }}>
        <span className="material-symbols-rounded" style={{ fontSize: 40, color: "#DADCE0", display: "block", marginBottom: 12 }}>
          policy
        </span>
        <div style={{ fontWeight: 500, fontSize: 15, color: "#202124", marginBottom: 4 }}>No rules yet</div>
        <div style={{ fontSize: 13, color: "#5F6368" }}>Enter your rules and click save to see them enforced.</div>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ width: "100%" }}>
      <canvas
        ref={canvasRef}
        width={size.w}
        height={size.h}
        style={{
          border: "1px solid #E8E8E8",
          borderRadius: 12,
          background: "#FFFFFF",
          display: "block",
        }}
      />
      {/* Rule summary below graph */}
      <div style={{ marginTop: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          {nodes.map((node) => (
            <div
              key={node.id}
              style={{
                padding: "12px 16px",
                border: "1px solid #E8E8E8",
                borderRadius: 8,
                background: getSeverityBg(node.severity),
                animation: `fadeIn 0.4s ease-out ${node.idx * 0.06}s both`,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: getSeverityColor(node.severity), marginBottom: 4 }}>
                {node.id} · {node.severity}
              </div>
              <div style={{ fontSize: 12, color: "#202124", marginBottom: 6 }}>
                {node.description}
              </div>
              <div style={{ fontSize: 11, color: "#5F6368", display: "flex", alignItems: "center", gap: 4 }}>
                <span className="material-symbols-rounded" style={{ fontSize: 14 }}>shield</span>
                {node.protected}
              </div>
            </div>
          ))}
        </div>
      </div>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
