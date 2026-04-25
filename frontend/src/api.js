import axios from "axios";
import config from "./config";

const api = axios.create({ baseURL: config.API_BASE_URL });

export const uploadDataset = (projectId, file) => {
  const fd = new FormData();
  fd.append("project_id", projectId);
  fd.append("file", file);
  return api.post("/api/v1/upload", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const saveConstitution = (projectId, rules_text) => api.post("/api/v1/constitution", { project_id: projectId, rules_text });
export const getConstitution = (projectId) => api.get(`/api/v1/constitution/${projectId}`);
export const batchAudit = (projectId, count = 10) => api.post(`/api/v1/batch_audit/${projectId}`, { count });

export const intercept = (projectId, record) =>
  api.post("/api/v1/intercept", {
    project_id: projectId,
    decision_record: record,
  });

export const getReport = (sessionId) =>
  api.get(`/api/v1/report/${sessionId}`);

export const getCausalGraph = (projectId) =>
  api.get(`/api/v1/causal_graph/${projectId}`);

export const getDecisions = (projectId) =>
  api.get(`/api/v1/decisions/${projectId}`);

export const getMetrics = (projectId) =>
  api.get(`/api/v1/metrics/${projectId}`);

export const wipeProject = (projectId) =>
  api.delete(`/api/v1/project/${projectId}`);

export default api;
