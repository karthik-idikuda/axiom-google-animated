import { useEffect, useState } from "react";

const KEY = "axiom.projectId";
const listeners = new Set();

export function getProjectId() {
  return localStorage.getItem(KEY) || "";
}

export function setProjectId(pid) {
  if (pid) localStorage.setItem(KEY, pid);
  else localStorage.removeItem(KEY);
  listeners.forEach((cb) => cb(pid || ""));
}

export function useProjectId() {
  const [pid, setPid] = useState(getProjectId());
  useEffect(() => {
    const cb = (v) => setPid(v);
    listeners.add(cb);
    return () => listeners.delete(cb);
  }, []);
  return [pid, setProjectId];
}
