# AXIOM Development Setup & Troubleshooting Guide

## 🚀 Quick Start

### 1️⃣ Install Dependencies

```bash
cd /Users/karthik/Downloads/All\ Projects/Google\ /axiom

# Backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Frontend
cd frontend
npm install
cd ..
```

### 2️⃣ Setup Environment Variables

```bash
# Copy template
cp .env.example .env

# Edit .env with your GCP credentials
# IMPORTANT: Set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON path
```

### 3️⃣ Start Development Servers

**Option A: Manual (two terminals)**

Terminal 1 - Backend:
```bash
source .venv/bin/activate
uvicorn backend.main:app --reload --port 8000
```

Terminal 2 - Frontend:
```bash
cd frontend
npm start
```

**Option B: Using startup script**
```bash
chmod +x dev-server.sh
./dev-server.sh
```

---

## ❌ Troubleshooting "Failed to fetch" / 404 Errors

### Issue 1: Backend Not Running

**Symptom:** "Failed to fetch" error in browser console  
**Cause:** Backend server isn't started

**Fix:**
```bash
# Check if backend is running
curl http://localhost:8000/health

# If 404 or connection refused:
source .venv/bin/activate
uvicorn backend.main:app --reload --port 8000
```

### Issue 2: CORS Error

**Symptom:** Console shows "Cross-Origin Request Blocked"  
**Cause:** Frontend and backend CORS mismatch

**Fix:**
```bash
# Check CORS_ORIGINS in .env
echo $CORS_ORIGINS  # Should include http://localhost:3000

# Or set it:
export CORS_ORIGINS="http://localhost:3000,http://localhost:3001"

# Restart backend after changing
```

### Issue 3: Wrong API Endpoint

**Symptom:** 404 errors for specific routes  
**Cause:** Frontend API calls don't match backend routes

**Verify in frontend/src/api.js:**
```javascript
// ✅ Correct
api.post("/api/v1/constitution", { project_id, rules_text })

// ❌ Wrong (path in URL instead of body)
api.post(`/api/v1/constitution/${projectId}`, { rules_text })
```

**All backend routes:**
- POST `/api/v1/upload` — Upload CSV
- POST `/api/v1/intercept` — Intercept decision  
- POST `/api/v1/constitution` — Save fairness rules
- GET `/api/v1/constitution/{project_id}` — Get rules
- GET `/api/v1/metrics/{project_id}` — Get metrics
- GET `/api/v1/decisions/{project_id}` — Get decisions
- GET `/api/v1/report/{session_id}` — Get audit report
- GET `/api/v1/causal_graph/{project_id}` — Get causal graph
- POST `/api/v1/batch_audit/{project_id}` — Audit batch
- DELETE `/api/v1/project/{project_id}` — Delete project
- GET `/health` — Health check

### Issue 4: Environment Variables Not Set

**Symptom:** Backend crashes or returns 500 errors  
**Cause:** Missing .env configuration

**Fix:**
```bash
# Create .env
cat > .env << 'EOF'
# Google Cloud
GOOGLE_CLOUD_PROJECT=axiom-conscience
GOOGLE_CLOUD_LOCATION=global
GOOGLE_APPLICATION_CREDENTIALS=/path/to/your/service-account.json
GEMINI_MODEL=gemini-3.1-pro-preview
GEMINI_THINKING_LEVEL=HIGH
GOOGLE_GENAI_USE_VERTEXAI=True

# Firebase (optional - will fail gracefully if not set)
FIREBASE_DATABASE_URL=https://axiom-conscience-default-rtdb.firebaseio.com
FIREBASE_PROJECT_ID=axiom-conscience

# App
CORS_ORIGINS=http://localhost:3000
API_PORT=8000

# Feature flags (set to 1 to disable)
AXIOM_DISABLE_FIRESTORE=0
AXIOM_DISABLE_STORAGE=0
EOF
```

### Issue 5: Frontend Can't Find Backend

**Symptom:** Console shows "GET http://localhost:8000/api/v1/... failed"  
**Cause:** API_BASE_URL pointing to wrong location

**Fix:**
```bash
# Check frontend/.env (or .env.local)
echo "REACT_APP_API_URL=http://localhost:8000" > frontend/.env.local

# Or set in frontend/src/config.js:
// ✅ Correct
const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";
```

### Issue 6: Datasets Not Found

**Symptom:** "Dataset not found" error after upload  
**Cause:** Cloud Storage not configured

**Fix (for local development):**
```bash
# Set to use local files instead
export AXIOM_DISABLE_STORAGE=1
export AXIOM_LOCAL_REPORTS_DIR=./reports

# Restart backend
uvicorn backend.main:app --reload --port 8000
```

---

## 🔍 Debugging Commands

```bash
# Check backend is running
curl http://localhost:8000/health

# Check specific route
curl -X GET http://localhost:8000/api/v1/metrics/test-project

# Check frontend console
# Open http://localhost:3000 and open DevTools (F12)

# View backend logs
# Check terminal where uvicorn is running

# Test Firebase connection
python -c "from backend.services import firebase_service; firebase_service._init(); print('✅ Firebase connected')"

# Test Gemini connection
python -c "from backend.services import gemini_service; print(gemini_service._get_client()); print('✅ Gemini connected')"
```

---

## 📊 Common Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| 404 | Route not found | Check route path in api.js matches backend |
| 500 | Server error | Check backend logs for exception |
| CORS | Cross-origin blocked | Update CORS_ORIGINS in .env |
| Connection refused | Backend not running | Start backend with uvicorn |
| Timeout | Request taking too long | Check Firebase/Gemini API connectivity |

---

## 🆘 Still Having Issues?

1. **Check backend logs:**
   ```bash
   # Look for error messages in the terminal running uvicorn
   ```

2. **Check browser console:**
   ```
   F12 → Console tab → Look for red error messages
   ```

3. **Verify .env variables:**
   ```bash
   source .venv/bin/activate
   python -c "from backend import config; print(f'API Port: {config.API_PORT}'); print(f'CORS: {config.CORS_ORIGINS}')"
   ```

4. **Test endpoints directly:**
   ```bash
   curl -X POST http://localhost:8000/api/v1/intercept \
     -H "Content-Type: application/json" \
     -d '{"project_id":"test","decision_record":{"age":30}}'
   ```

5. **Clear frontend cache:**
   ```bash
   # In frontend directory
   rm -rf node_modules/.cache
   npm start
   ```
