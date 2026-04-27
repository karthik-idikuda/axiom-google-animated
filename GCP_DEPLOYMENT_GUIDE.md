# AXIOM GCP Deployment: Complete A-Z Guide

**Last Updated:** April 25, 2026  
**Project:** axiom-conscience  
**Deployment Target:** Google Cloud Run + Firebase Hosting

---

## 📋 Prerequisites

- ✅ GCP Account with Enterprise/Premium plan
- ✅ `gcloud` CLI installed ([install](https://cloud.google.com/sdk/docs/install))
- ✅ `gcloud` authenticated: `gcloud auth login`
- ✅ Project ID set: `gcloud config set project axiom-conscience`
- ✅ Billing enabled on GCP project
- ✅ Docker installed locally

---

## 🔐 Step 1: Setup GCP Credentials & Authentication

### 1.1 Create Service Account

```bash
# Set your project ID
PROJECT_ID="axiom-conscience"
gcloud config set project $PROJECT_ID

# Create service account
gcloud iam service-accounts create axiom-backend \
  --display-name="AXIOM Backend Service Account"

# Get the service account email
SA_EMAIL=$(gcloud iam service-accounts list --filter="displayName:axiom-backend" --format='value(email)')
echo "Service Account: $SA_EMAIL"
```

### 1.2 Grant Required Roles

```bash
# Cloud Run
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/run.admin"

# Firestore
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/datastore.user"

# Firebase Realtime Database
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/firebase.viewer"

# Storage
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/storage.objectAdmin"

# Vertex AI / AI Platform
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/aiplatform.user"

# Cloud Logs
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/logging.logWriter"
```

### 1.3 Create and Download JSON Key

```bash
# Create key
gcloud iam service-accounts keys create \
  ~/axiom-sa-key.json \
  --iam-account=$SA_EMAIL

# Verify
cat ~/axiom-sa-key.json | head -5

# Set environment variable
export GOOGLE_APPLICATION_CREDENTIALS=~/axiom-sa-key.json
```

---

## 🔧 Step 2: Configure GCP Services

### 2.1 Enable Required APIs

```bash
gcloud services enable \
  run.googleapis.com \
  firestore.googleapis.com \
  firebase.googleapis.com \
  storage-api.googleapis.com \
  aiplatform.googleapis.com \
  cloudbuild.googleapis.com \
  logging.googleapis.com \
  compute.googleapis.com
```

### 2.2 Create Cloud Storage Bucket

```bash
# Create bucket
gsutil mb -p $PROJECT_ID gs://axiom-conscience-storage/

# Create reports folder
gsutil -m mkdir gs://axiom-conscience-storage/reports/

# Set permissions
gsutil iam ch serviceAccount:$SA_EMAIL:objectAdmin \
  gs://axiom-conscience-storage/
```

### 2.3 Setup Firebase (if not already done)

```bash
# Initialize Firebase
firebase init --project=$PROJECT_ID

# Create Realtime Database
firebase database:create --location=us-central1 --project=$PROJECT_ID

# Create Firestore Database
firebase firestore:create --location=us-central1 --project=$PROJECT_ID

# Enable Storage
firebase storage:create --location=us-central1 --project=$PROJECT_ID
```

---

## 🏗️ Step 3: Prepare Backend for Deployment

### 3.1 Create `.env.production`

```bash
# Backend environment variables
cat > backend/.env.production << 'EOF'
# Google Cloud
GOOGLE_CLOUD_PROJECT=axiom-conscience
GOOGLE_CLOUD_LOCATION=us-central1
GOOGLE_APPLICATION_CREDENTIALS=/var/run/secrets/axiom-sa-key.json
GEMINI_MODEL=gemini-3.1-pro-preview
GEMINI_THINKING_LEVEL=HIGH
GOOGLE_GENAI_USE_VERTEXAI=True
GOOGLE_GENAI_USE_VERTEX_AI_LOCATION=us-central1

# Firebase
FIREBASE_DATABASE_URL=https://axiom-conscience-default-rtdb.firebaseio.com
FIREBASE_PROJECT_ID=axiom-conscience
FIREBASE_STORAGE_BUCKET=axiom-conscience-storage.appspot.com

# App
CORS_ORIGINS=https://axiom-frontend.firebaseapp.com,https://axiom.run.app
API_PORT=8080
API_HOST=0.0.0.0

# Feature Flags
AXIOM_DISABLE_FIRESTORE=0
AXIOM_DISABLE_STORAGE=0
AXIOM_LOCAL_REPORTS_DIR=/tmp/reports
EOF

cat backend/.env.production
```

### 3.2 Update Backend Dockerfile

See `Dockerfile` in project root (already provided).

### 3.3 Build & Test Locally

```bash
# Build Docker image
docker build -t axiom-backend:latest -f Dockerfile .

# Run locally with env
docker run -it \
  -e GOOGLE_APPLICATION_CREDENTIALS=/var/run/secrets/axiom-sa-key.json \
  -v $GOOGLE_APPLICATION_CREDENTIALS:/var/run/secrets/axiom-sa-key.json:ro \
  -p 8080:8080 \
  axiom-backend:latest

# Test
curl http://localhost:8080/health
```

---

## ☁️ Step 4: Deploy Backend to Cloud Run

### 4.1 Push Image to Artifact Registry

```bash
# Enable Artifact Registry API
gcloud services enable artifactregistry.googleapis.com

# Create repository
gcloud artifacts repositories create axiom-repo \
  --repository-format=docker \
  --location=us-central1 \
  --description="AXIOM backend images"

# Configure Docker auth
gcloud auth configure-docker us-central1-docker.pkg.dev

# Tag image
docker tag axiom-backend:latest \
  us-central1-docker.pkg.dev/axiom-conscience/axiom-repo/axiom-backend:latest

# Push image
docker push \
  us-central1-docker.pkg.dev/axiom-conscience/axiom-repo/axiom-backend:latest
```

### 4.2 Deploy to Cloud Run

```bash
# Deploy service
gcloud run deploy axiom-backend \
  --image us-central1-docker.pkg.dev/axiom-conscience/axiom-repo/axiom-backend:latest \
  --platform managed \
  --region us-central1 \
  --memory 2Gi \
  --cpu 2 \
  --timeout 900s \
  --max-instances 100 \
  --service-account=$SA_EMAIL \
  --set-env-vars GOOGLE_APPLICATION_CREDENTIALS=/var/run/secrets/axiom-sa-key.json \
  --allow-unauthenticated

# Get service URL
BACKEND_URL=$(gcloud run services describe axiom-backend \
  --platform managed --region us-central1 \
  --format='value(status.url)')

echo "Backend deployed at: $BACKEND_URL"
```

### 4.3 Verify Backend

```bash
# Health check
curl $BACKEND_URL/health

# Expected response:
# {"status":"ok","version":"0.1.0"}
```

---

## 🎨 Step 5: Deploy Frontend to Firebase Hosting

### 5.1 Build Frontend

```bash
cd frontend

# Install dependencies
npm install

# Set API URL for production
echo "REACT_APP_API_URL=$BACKEND_URL" > .env.production

# Build
npm run build

# Verify build
ls -la build/index.html
```

### 5.2 Configure Firebase Hosting

```bash
# Login to Firebase
firebase login

# Initialize hosting
firebase init hosting --project=$PROJECT_ID

# Deploy
firebase deploy --project=$PROJECT_ID

# Get hosting URL
FRONTEND_URL=$(firebase hosting:channel:list --project=$PROJECT_ID | grep 'LIVE' | awk '{print $NF}')
echo "Frontend deployed at: $FRONTEND_URL"
```

### 5.3 Update CORS on Backend

```bash
# Update backend CORS to include new frontend URL
gcloud run services update axiom-backend \
  --region us-central1 \
  --update-env-vars CORS_ORIGINS=$FRONTEND_URL
```

---

## 🗄️ Step 6: Setup Databases

### 6.1 Configure Firestore Rules

```bash
cat > firestore.rules << 'EOF'
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /projects/{project} {
      allow read, write: if request.auth != null;
    }
    match /decisions/{decision} {
      allow read, write: if request.auth != null;
    }
    match /reports/{report} {
      allow read, write: if request.auth != null;
    }
  }
}
EOF

firebase deploy --only firestore:rules --project=$PROJECT_ID
```

### 6.2 Configure Realtime Database Rules

```bash
cat > database.rules.json << 'EOF'
{
  "rules": {
    "projects": {
      "$uid": {
        ".read": true,
        ".write": true
      }
    },
    "decisions": {
      "$uid": {
        ".read": true,
        ".write": true
      }
    }
  }
}
EOF

firebase database:update / database.rules.json --project=$PROJECT_ID
```

### 6.3 Configure Cloud Storage Rules

```bash
cat > storage.rules << 'EOF'
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
EOF

firebase deploy --only storage --project=$PROJECT_ID
```

---

## 📊 Step 7: Setup Monitoring & Logging

### 7.1 Create Log Sink

```bash
# Create Cloud Logging sink
gcloud logging sinks create axiom-sink \
  logging.googleapis.com/projects/$PROJECT_ID/logs/axiom \
  --log-filter='resource.type="cloud_run_revision" AND resource.labels.service_name="axiom-backend"'
```

### 7.2 Setup Alerts

```bash
# Create notification channel (email)
CHANNEL=$(gcloud alpha monitoring channels create \
  --display-name="AXIOM Admin" \
  --type=email \
  --channel-labels=email_address=your-email@example.com \
  --format='value(name)')

# Create alert policy for errors
gcloud alpha monitoring policies create \
  --notification-channels=$CHANNEL \
  --display-name="AXIOM Backend Errors" \
  --condition-display-name="High error rate" \
  --condition-threshold-value=0.05 \
  --condition-threshold-duration=300s
```

---

## 🔄 Step 8: Setup CI/CD Pipeline

### 8.1 Create Cloud Build Configuration

See `docker/cloudbuild.yaml` in project root.

### 8.2 Setup Repository Connection

```bash
# If using GitHub
gcloud builds connect github \
  --repository-name=axiom \
  --repository-owner=your-github-username \
  --region=us-central1
```

### 8.3 Create Build Trigger

```bash
gcloud builds triggers create github \
  --name="axiom-backend-deploy" \
  --repo-name=axiom \
  --repo-owner=your-github-username \
  --branch-pattern="^main$" \
  --build-config=docker/cloudbuild.yaml \
  --region=us-central1
```

---

## 🧪 Step 9: Testing & Validation

### 9.1 Health Checks

```bash
# Backend health
curl -X GET $BACKEND_URL/health

# Expected: {"status":"ok","version":"0.1.0"}
```

### 9.2 API Tests

```bash
# Test upload endpoint
curl -X POST $BACKEND_URL/api/v1/upload \
  -F "project_id=test-123" \
  -F "file=@datasets/adult_income_sample.csv"

# Test intercept endpoint
curl -X POST $BACKEND_URL/api/v1/intercept \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "test-123",
    "decision_record": {"age": 30, "income": "50K"},
    "protected_attributes": ["age"]
  }'
```

### 9.3 Load Testing

```bash
# Install load testing tool
pip install locust

# Create load test
cat > locustfile.py << 'EOF'
from locust import HttpUser, task, between

class APIUser(HttpUser):
    wait_time = between(1, 3)
    
    @task
    def health_check(self):
        self.client.get("/health")
    
    @task(2)
    def get_metrics(self):
        self.client.get("/api/v1/metrics/test-project")
EOF

# Run load test
locust -f locustfile.py --host=$BACKEND_URL
```

---

## 📈 Step 10: Post-Deployment Tasks

### 10.1 Setup Custom Domain

```bash
# Add custom domain
firebase hosting:sites:create axiom-run

# Update Cloud Run custom domain
gcloud run domain-mappings create \
  --service=axiom-backend \
  --domain=axiom-api.run.app \
  --region=us-central1
```

### 10.2 Setup SSL/TLS

```bash
# Managed SSL automatically enabled for .run.app domain
# For custom domain:
gcloud compute ssl-certificates create axiom-ssl \
  --domains=axiom-api.run.app
```

### 10.3 Backup Database

```bash
# Schedule daily backup
gcloud firestore backups create \
  --retention=30d \
  --project=$PROJECT_ID

# Export to Cloud Storage
gcloud firestore export gs://axiom-conscience-storage/backups/ \
  --project=$PROJECT_ID
```

---

## 🔍 Troubleshooting

| Issue | Solution |
|-------|----------|
| Backend deployment fails | Check logs: `gcloud run logs read axiom-backend --limit 50` |
| CORS errors | Update `CORS_ORIGINS` env var on Cloud Run |
| Firebase auth fails | Verify service account has Firebase roles |
| High latency | Increase Cloud Run memory/CPU or enable caching |
| Database quota exceeded | Upgrade Firebase plan or optimize queries |

---

## 📚 Useful Commands

```bash
# View logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=axiom-backend" --limit 50

# Scale Cloud Run
gcloud run services update axiom-backend --max-instances 200 --region us-central1

# Check Cloud Run metrics
gcloud monitoring time-series list --filter='metric.type="run.googleapis.com/request_count"'

# Rollback deployment
gcloud run deploy axiom-backend --image <previous-image-hash> --region us-central1

# SSH to Cloud Run (debug)
gcloud beta run debug axiom-backend --region us-central1
```

---

## 📞 Support

For issues:
1. Check GCP Console: https://console.cloud.google.com
2. View Cloud Run logs
3. Check Firebase Console: https://console.firebase.google.com
4. Verify APIs are enabled
5. Confirm service account roles

---

**Next:** Run `bash deploy.sh` to automate this entire process (see next section).
