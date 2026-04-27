import React, { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";

export default function CausalGraph({ edges = [], protected: protectedAttrs = [], animated = false }) {
  const fgRef = useRef();
  const [size, setSize] = useState({ w: 600, h: 500 });
  const containerRef = useRef();
  const hoveredNodeRef = useRef(null);
  const pinnedForHashRef = useRef("");

  const seedFromId = (id) => {
    let h = 0;
    const s = String(id || "");
    for (let i = 0; i < s.length; i += 1) {
      h = (h * 31 + s.charCodeAt(i)) >>> 0;
    }
    return h;
  };

  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const r = containerRef.current.getBoundingClientRect();
        setSize({ w: Math.max(r.width, 320), h: 500 });
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
    };
  }, []);

  const edgesHash = JSON.stringify(edges);
  useEffect(() => {
    pinnedForHashRef.current = "";
    try { fgRef.current?.d3ReheatSimulation?.(); } catch (e) {}
  }, [edgesHash]);

  useEffect(() => {
    if (fgRef.current) {
      fgRef.current.d3Force('charge').strength(-500);
      fgRef.current.d3Force('link').distance(150);
      if (fgRef.current.d3Force('center')) {
        fgRef.current.d3Force('center').strength(animated ? 0.08 : 0.05);
      }
      if (fgRef.current.d3Force('collide')) {
        fgRef.current.d3Force('collide').radius(70);
      }
    }
  }, [edgesHash, animated]);

  const graphData = useMemo(() => {
    const nodeSet = new Set();
    edges.forEach((e) => { nodeSet.add(e.source); nodeSet.add(e.target); });
    const nodes = Array.from(nodeSet).map((id) => ({
      id,
      isProtected: protectedAttrs.includes(id),
      // Deterministic initial coordinates so layout style stays consistent
      // between Discovery Results and Causal Logic Graph.
      x: ((seedFromId(id) % 1000) / 1000 - 0.5) * 800,
      y: ((seedFromId(`${id}-y`) % 1000) / 1000 - 0.5) * 500,
    }));
    const links = edges.map((e) => ({
      source: e.source,
      target: e.target,
      weight: e.weight,
      biased: protectedAttrs.includes(e.source),
    }));
    return { nodes, links };
  }, [edges, protectedAttrs]);

  if (!edges.length) {
    return (
      <div style={{ textAlign: "center", padding: "64px 24px", color: "#5F6368", background: "#FFFFFF", borderRadius: 16 }}>
        <span className="material-symbols-rounded" style={{ fontSize: 56, color: "#DADCE0", display: "block", marginBottom: 16 }}>hub</span>
        <div style={{ fontWeight: 500, fontSize: 16, color: "#202124", marginBottom: 6 }}>No causal graph yet</div>
        <div style={{ fontSize: 13, color: "#5F6368" }}>Upload a dataset to discover causal relationships via DirectLiNGAM</div>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ width: "100%", background: "#FFFFFF", padding: 0 }}>
      {/* Graph canvas */}
      <div style={{
        borderRadius: 16, overflow: "hidden",
        border: "1px solid #E8EAED", background: "#FAFBFC",
        position: "relative"
      }}>
        <ForceGraph2D
          ref={fgRef}
          graphData={graphData}
          width={size.w}
          height={size.h}
          backgroundColor="#FAFBFC"
          enableNodeDrag={false}
          onNodeHover={(n) => { hoveredNodeRef.current = n?.id || null; }}
          linkCurvature={0.25}
          linkDirectionalParticles={animated ? 2 : 0}
          linkDirectionalParticleSpeed={animated ? 0.004 : 0}
          linkDirectionalParticleWidth={4}
          linkDirectionalParticleColor={l => l.biased ? "#EA4335" : "#4285F4"}
          warmupTicks={animated ? 120 : 80}
          cooldownTicks={animated ? 100000 : 80}
          d3VelocityDecay={0.65}
          onEngineStop={() => {
            if (animated) return;
            // Freeze layout once settled to fully stop drift/jitter.
            if (pinnedForHashRef.current === edgesHash) return;
            try {
              const gd = fgRef.current?.graphData?.();
              if (gd?.nodes?.length) {
                gd.nodes.forEach((n) => {
                  n.fx = n.x;
                  n.fy = n.y;
                });
                fgRef.current?.d3Force("center")?.strength(0);
                fgRef.current?.refresh?.();
                pinnedForHashRef.current = edgesHash;
              }
            } catch (e) {}
          }}
          nodeCanvasObjectMode={() => "replace"}
          nodeCanvasObject={(n, ctx, scale) => {
            const isHovered = hoveredNodeRef.current === n.id;
            
            const size = n.isProtected ? 20 : 15;
            const h = size * 0.5; 
            const x = n.x;
            const y = n.y;

            const colors = n.isProtected ? {
                light: "#F28B82", medium: "#EA4335", dark: "#C5221F", glow: "rgba(234,67,53,0.5)"
            } : {
                light: "#ADCCFF", medium: "#4285F4", dark: "#1967D2", glow: "rgba(66,133,244,0.5)"
            };

            ctx.save();
            
            // 1. Soft Ambient Shadow
            ctx.fillStyle = "rgba(0,0,0,0.06)";
            ctx.beginPath();
            ctx.ellipse(n.x, n.y + size + 2, size * 1.5, h * 1.5, 0, 0, 2 * Math.PI);
            ctx.fill();

            // 2. Isometric Cube with Hardware Details
            // Right Face (Darker)
            ctx.fillStyle = colors.dark;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + size, y - h);
            ctx.lineTo(x + size, y + size - h);
            ctx.lineTo(x, y + size);
            ctx.fill();
            
            // Render Hardware Vents on Right Face
            ctx.strokeStyle = "rgba(0,0,0,0.2)";
            ctx.lineWidth = 1;
            for (let i = 0; i < 4; i++) {
                const step = (size / 5) * (i + 1);
                ctx.beginPath();
                ctx.moveTo(x + 4, y + step);
                ctx.lineTo(x + size - 4, y - h + step);
                ctx.stroke();
            }

            // Left Face (Medium)
            ctx.fillStyle = colors.medium;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x - size, y - h);
            ctx.lineTo(x - size, y + size - h);
            ctx.lineTo(x, y + size);
            ctx.fill();
            
            // Render Circuit Pattern on Left Face
            ctx.strokeStyle = "rgba(255,255,255,0.15)";
            ctx.beginPath();
            ctx.moveTo(x - 4, y + 4);
            ctx.lineTo(x - size + 4, y - h + 10);
            ctx.lineTo(x - size + 4, y + size - h - 4);
            ctx.stroke();
            
            // Top Face (Light / Glowing)
            ctx.fillStyle = colors.light;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + size, y - h);
            ctx.lineTo(x, y - 2*h);
            ctx.lineTo(x - size, y - h);
            ctx.fill();
            
            // Glowing CPU Core on top
            ctx.shadowBlur = 10;
            ctx.shadowColor = colors.medium;
            ctx.fillStyle = "#FFFFFF";
            ctx.beginPath();
            ctx.ellipse(x, y - h, size * 0.5, h * 0.5, 0, 0, 2 * Math.PI);
            ctx.fill();
            ctx.shadowBlur = 0;

            // 3. Floating Holographic Rings
            const ringR = size + 6;
            const ringY = y - size - 8;
            ctx.strokeStyle = colors.glow;
            ctx.lineWidth = 1;
            ctx.setLineDash([6, 3]);
            ctx.beginPath();
            ctx.ellipse(x, ringY, ringR, ringR * 0.5, 0, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.setLineDash([]);

            if (isHovered) {
              ctx.strokeStyle = "#FFFFFF";
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.ellipse(x, ringY - 4, ringR + 4, (ringR + 4) * 0.5, 0, 0, 2 * Math.PI);
              ctx.stroke();
            }

            // 4. Label (High-Tech Badge)
            const fontSize = Math.max(9, 11 / scale);
            ctx.font = `600 ${fontSize}px "Google Sans", Inter, sans-serif`;
            let label = n.id.toUpperCase();
            if (label.length > 16) label = label.substring(0, 14) + "..";
            
            const textWidth = ctx.measureText(label).width;
            ctx.fillStyle = "rgba(255,255,255,0.98)";
            ctx.shadowBlur = 10;
            ctx.shadowColor = "rgba(0,0,0,0.1)";
            ctx.beginPath();
            ctx.roundRect(x - textWidth/2 - 8, y + size + 14, textWidth + 16, fontSize + 10, 6);
            ctx.fill();
            ctx.shadowBlur = 0;
            
            ctx.fillStyle = "#202124";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(label, x, y + size + 14 + (fontSize+10)/2);

            ctx.restore();
          }}
          linkCanvasObjectMode={() => "after"}
          linkCanvasObject={(link, ctx) => {
            const s = link.source;
            const t = link.target;
            if (!s || !t || typeof s.x !== 'number' || typeof t.x !== 'number') return;
            
            // Draw multi-strand ribbon cable effect
            ctx.save();
            ctx.setLineDash([]);
            ctx.globalAlpha = 0.3;
            ctx.lineWidth = link.biased ? 4 : 2;
            ctx.strokeStyle = link.biased ? "#EA4335" : "#ADCCFF";
            
            // Ribbon cable strand offset
            const offset = 2;
            ctx.beginPath();
            // Draw three parallel strands
            for (let i = -1; i <= 1; i++) {
                // Approximate the curvature (using straight lines for strands for simplicity, 
                // or just let the default renderer handle curvature if we used Mode:after)
            }
            ctx.restore();
          }}
          linkColor={l => l.biased ? "rgba(234, 67, 53, 0.4)" : "rgba(66, 133, 244, 0.25)"}
          linkWidth={l => l.biased ? 4 : 2}
        />
      </div>
    </div>
  );
}
