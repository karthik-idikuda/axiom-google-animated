# AXIOM API Documentation

**Base URL:** `http://localhost:8000` (development) | `https://axiom-api.run.app` (production)

---

## Health Check

### GET `/health`
Health status and version info.

**Response:**
```json
{
  "status": "ok",
  "version": "0.1.0",
  "timestamp": "2026-04-25T10:30:00Z"
}
```

---

## Dataset Management

### POST `/api/v1/upload`
Upload a CSV dataset for analysis.

**Request:**
- **Type:** `multipart/form-data`
- **Fields:**
  - `project_id` (string, required) - Unique project identifier
  - `file` (file, required) - CSV dataset file

**Response:**
```json
{
  "project_id": "project-123",
  "rows_loaded": 500,
  "columns": ["age", "income", "gender", "race"],
  "feature_names": ["age", "income", "gender", "race"],
  "sampling_method": "stratified"
}
```

**Status Codes:**
- `200` - Upload successful
- `400` - Invalid project_id or empty file
- `413` - File too large (>100MB)
- `500` - Server error

---

## Decision Interception

### POST `/api/v1/intercept`
Process a single decision through the bias detection pipeline.

**Request:**
```json
{
  "project_id": "project-123",
  "decision_record": {
    "age": 35,
    "income": "50K",
    "gender": "M",
    "race": "White",
    "decision": "Approved"
  },
  "protected_attributes": ["gender", "race"]
}
```

**Response:**
```json
{
  "session_id": "session-abc123",
  "decision_record": {...},
  "verdict": "PASS|FAIL",
  "flagged": false,
  "fairness_score_before": 85.5,
  "fairness_score_after": 92.3,
  "remediations": [
    {
      "attribute": "gender",
      "bias_type": "Statistical Parity Difference",
      "severity": "HIGH",
      "recommendation": "Adjust decision thresholds for protected group"
    }
  ],
  "remediated_decision": {...},
  "explanation": "..."
}
```

---

## Fairness Constitution

### POST `/api/v1/constitution`
Save fairness rules for the project.

**Request:**
```json
{
  "project_id": "project-123",
  "rules_text": "Age and gender must not causally influence hiring decisions. Income must be checked for statistical parity across protected groups."
}
```

**Response:**
```json
{
  "project_id": "project-123",
  "parsed": [
    {
      "id": "rule-1",
      "attribute": "age",
      "rule_type": "causal_constraint",
      "description": "Age must not causally influence hiring decisions"
    },
    ...
  ]
}
```

### GET `/api/v1/constitution/{project_id}`
Retrieve the fairness constitution for a project.

**Response:**
```json
{
  "project_id": "project-123",
  "rules_text": "Age and gender must not causally influence hiring decisions...",
  "parsed": [...],
  "updated_at": "2026-04-25T10:00:00Z"
}
```

---

## Audit & Batch Processing

### POST `/api/v1/batch_audit/{project_id}`
Audit multiple decisions in batch.

**Request:**
```json
{
  "count": 10
}
```

**Response:**
```json
{
  "project_id": "project-123",
  "batch_id": "batch-xyz",
  "total_decisions": 10,
  "flagged": 2,
  "passed": 8,
  "report_url": "https://axiom-storage.blob.core.windows.net/reports/batch-xyz.pdf"
}
```

---

## Analytics & Reporting

### GET `/api/v1/metrics/{project_id}`
Get fairness metrics aggregated across all decisions.

**Response:**
```json
{
  "project_id": "project-123",
  "total_decisions": 500,
  "flagged": 12,
  "remediated": 8,
  "recommendations": 5,
  "average_fairness_score": 87.3,
  "drift_data": [
    { "bucket": 1, "fairness_score": 85.2 },
    { "bucket": 2, "fairness_score": 87.1 },
    ...
  ]
}
```

### GET `/api/v1/decisions/{project_id}`
List all decisions for a project.

**Query Parameters:**
- `limit` (optional, default 100) - Max results
- `offset` (optional, default 0) - Pagination offset

**Response:**
```json
{
  "project_id": "project-123",
  "total": 500,
  "decisions": [
    {
      "session_id": "session-1",
      "decision_record": {...},
      "verdict": "PASS",
      "fairness_score": 88.5,
      "timestamp": "2026-04-25T09:00:00Z"
    },
    ...
  ]
}
```

### GET `/api/v1/report/{session_id}`
Get detailed audit report for a specific decision.

**Response:**
```json
{
  "session_id": "session-abc123",
  "project_id": "project-123",
  "decision": {...},
  "verdict": "FAIL",
  "bias_findings": [...],
  "remediations": [...],
  "explanation": "...",
  "pdf_url": "https://axiom-storage.blob.core.windows.net/reports/session-abc123.pdf"
}
```

---

## Causal Analysis

### GET `/api/v1/causal_graph/{project_id}`
Get the inferred causal graph for the dataset.

**Response:**
```json
{
  "project_id": "project-123",
  "nodes": [
    { "id": "age", "label": "Age" },
    { "id": "income", "label": "Income" },
    ...
  ],
  "edges": [
    { "source": "age", "target": "income", "strength": 0.45 },
    { "source": "income", "target": "decision", "strength": 0.78 },
    ...
  ],
  "feature_names": ["age", "income", "gender", "race", "decision"]
}
```

---

## Project Management

### DELETE `/api/v1/project/{project_id}`
Delete all data for a project (decisions, reports, constitution, causal graph).

**Response:**
```json
{
  "project_id": "project-123",
  "deleted": {
    "decisions": 500,
    "reports": 50,
    "constitution": 1,
    "causal_graph": 1
  }
}
```

---

## Error Handling

All errors return JSON with standard format:

```json
{
  "detail": "Error message describing what went wrong"
}
```

**Common Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad request (invalid parameters)
- `404` - Not found
- `422` - Validation error
- `500` - Internal server error
- `503` - Service unavailable

---

## Frontend Integration Examples

### JavaScript/React with Axios

```javascript
import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:8000'
});

// Upload dataset
const uploadDataset = (projectId, file) => {
  const fd = new FormData();
  fd.append('project_id', projectId);
  fd.append('file', file);
  return API.post('/api/v1/upload', fd);
};

// Intercept decision
const interceptDecision = (projectId, decisionRecord) => {
  return API.post('/api/v1/intercept', {
    project_id: projectId,
    decision_record: decisionRecord,
    protected_attributes: ['gender', 'race']
  });
};

// Save fairness rules
const saveConstitution = (projectId, rulesText) => {
  return API.post('/api/v1/constitution', {
    project_id: projectId,
    rules_text: rulesText
  });
};
```

---

## Rate Limiting

- **Free Tier:** 100 requests/minute per project
- **Pro Tier:** 1000 requests/minute per project
- **Enterprise:** Unlimited

---

## Timeout

Default request timeout: **30 seconds**

If your decision analysis takes longer (e.g., large causal graph inference), requests may timeout. Use `/api/v1/batch_audit` for async processing.
