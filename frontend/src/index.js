import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, NavLink, useLocation } from "react-router-dom";
import "./theme.css";
import Dashboard from "./pages/Dashboard";
import Upload from "./pages/Upload";
import Constitution from "./pages/Constitution";
import Report from "./pages/Report";
import { useProjectId } from "./projectStore";
import config from "./config";

const API_BASE = config.API_BASE_URL;

// One-time migration: clear stale local project IDs from earlier builds.
try {
  const _STALE = new Set(["karthik", "test", "demo"]);
  const _cur = (localStorage.getItem("axiom.projectId") || "").toLowerCase();
  if (_STALE.has(_cur)) localStorage.removeItem("axiom.projectId");
} catch (_) {}

function Brand() {
  return (
    <a href="/" className="brand" aria-label="Axiom">
      <img src="/axiom-logo.png" alt="Axiom" className="brand-logo" />
    </a>
  );
}

function ProjectPicker() {
  const [pid, setPid] = useProjectId();
  return (
    <div className="project-picker" title="All pages share this project ID">
      <span className="material-symbols-rounded picker-icon">folder_open</span>
      <input
        className="project-input"
        value={pid}
        placeholder="project_id"
        onChange={(e) => setPid(e.target.value.trim())}
        spellCheck={false}
      />
      {pid && (
        <button
          className="picker-clear"
          onClick={() => setPid("")}
          title="Clear project"
          aria-label="Clear project"
        >
          <span className="material-symbols-rounded" style={{ fontSize: 16 }}>close</span>
        </button>
      )}
    </div>
  );
}

function StatusPill() {
  const [ok, setOk] = useState(null);
  useEffect(() => {
    let alive = true;
    const ping = () =>
      fetch(`${API_BASE}/health`, { cache: "no-store" })
        .then((r) => r.ok)
        .catch(() => false)
        .then((v) => alive && setOk(v));
    ping();
    const id = setInterval(ping, 15000);
    return () => { alive = false; clearInterval(id); };
  }, []);
  const cls = ok === null ? "status-pill" : ok ? "status-pill ok" : "status-pill down";
  const label = ok === null ? "Connecting" : ok ? "Live" : "Offline";
  return (
    <div className={cls} title={ok ? "All systems normal" : "Backend offline"}>
      <span className="status-dot" />
      <span className="status-label">{label}</span>
    </div>
  );
}

function useScrollReveal() {
  const location = useLocation();
  useEffect(() => {
    const els = document.querySelectorAll(".reveal, .reveal-stagger");
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    const t = setTimeout(() => els.forEach((el) => io.observe(el)), 30);
    return () => { clearTimeout(t); io.disconnect(); };
  }, [location.pathname]);
}

function Shell() {
  useScrollReveal();
  const navItems = [
    { to: "/", end: true, label: "Dashboard", icon: "monitoring" },
    { to: "/upload", label: "Dataset", icon: "upload_file" },
    { to: "/constitution", label: "Constitution", icon: "gavel" },
  ];
  return (
    <>
      <header className="appbar">
        <Brand />
        <nav className="nav">
          {navItems.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
            >
              <span className="material-symbols-rounded nav-ico">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <StatusPill />
        <ProjectPicker />
      </header>
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/constitution" element={<Constitution />} />
          <Route path="/report/:sessionId" element={<Report />} />
        </Routes>
      </main>
      <footer className="footer">
        <span className="footer-mark">Axiom</span>
        <span>Causal fairness firewall · powered by the configured Gemini model</span>
        <span>© 2026 · Solution Challenge</span>
      </footer>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Shell />
  </BrowserRouter>
);
