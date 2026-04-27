# GCP A-Z Deployment Setup

**Quick Start: Copy-paste commands below to deploy AXIOM to GCP**

---

## ✨ Fastest Path (Automated)

```bash
cd /Users/karthik/Downloads/All\ Projects/Google\ /axiom

# 1. Set your GCP project ID
export GCP_PROJECT_ID="axiom-conscience"

# 2. Login to Google Cloud
gcloud auth login
gcloud auth application-default login

# 3. Set project
gcloud config set project $GCP_PROJECT_ID

# 4. Run deployment (handles everything)
bash deploy.sh
```

---

## 📋 Step-by-Step Manual Deployment

### Phase 1: GCP Setup (5 minutes)

```bash
# Set variables
PROJECT_ID="axiom-conscience"
REGION="us-central1"
SA_NAME="axiom-backend"

# Configure gcloud
gcloud auth login
gcloud config set project $PROJECT_ID

# Create service account
gcloud iam service-accounts create $SA_NAME \
  --display-name="AXIOM Backend"

SA_EMAIL="$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com"

# Grant roles
for role in roles/run.admin \
            roles/datastore.user \
            roles/firebase.viewer \
            roles/storage.objectAdmin \
            roles/aiplatform.user \
            roles/logging.logWriter; do
  gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SA_EMAIL" \
    --role="$role" 2>/dev/null || true
done

# Create key
gcloud iam service-accounts keys create ~/axiom-sa-key.json \
  --iam-account=$SA_EMAIL

export GOOGLE_APPLICATION_CREDENTIALS=~/axiom-sa-key.json

# Enable APIs
gcloud services enable \
  run.googleapis.com \
  firestore.googleapis.com \
  firebase.googleapis.com \
  storage-api.googleapis.com \
  aiplatform.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com
```

### Phase 2: Backend Deployment (10 minutes)

```bash
# Create storage bucket
gsutil mb -p $PROJECT_ID gs://axiom-conscience-storage/
gsutil -m mkdir gs://axiom-conscience-storage/reports/

# Build Docker image
cd /Users/karthik/Downloads/All\ Projects/Google\ /axiom
docker build -t axiom-backend:latest -f Dockerfile .

# Configure Docker auth
gcloud auth configure-docker $REGION-docker.pkg.dev

# Create Artifact Registry
gcloud artifacts repositories create axiom-repo \
  --repository-format=docker \
  --location=$REGION || true

# Push image
IMAGE_URL="$REGION-docker.pkg.dev/$PROJECT_ID/axiom-repo/axiom-backend:latest"
docker tag axiom-backend:latest $IMAGE_URL
docker push $IMAGE_URL

# Deploy to Cloud Run
gcloud run deploy axiom-backend \
  --image $IMAGE_URL \
  --platform managed \
  --region $REGION \
  --memory 2Gi \
  --cpu 2 \
  --timeout 900s \
  --max-instances 100 \
  --service-account=$SA_EMAIL \
  --allow-unauthenticated

# Get URL
BACKEND_URL=$(gcloud run services describe axiom-backend \
  --platform managed --region $REGION \
  --format='value(status.url)')

echo "Backend deployed at: $BACKEND_URL"
```

### Phase 3: Frontend Deployment (5 minutes)

```bash
# Build frontend
cd frontend
npm install
echo "REACT_APP_API_URL=$BACKEND_URL" > .env.production
npm run build

# Deploy to Firebase Hosting
cd ..
firebase login
firebase init hosting --project=$PROJECT_ID
firebase deploy --project=$PROJECT_ID

echo "✅ AXIOM deployed successfully!"
```

---

## 🏗️ Using Terraform (IaC)

```bash
cd terraform

# Initialize Terraform
terraform init

# Plan deployment
terraform plan -var="project_id=$PROJECT_ID"

# Apply (create resources)
terraform apply -var="project_id=$PROJECT_ID"

# Get outputs
terraform output
```

---

## ✅ Verification

```bash
# Check backend health
curl $(gcloud run services describe axiom-backend \
  --platform managed --region us-central1 \
  --format='value(status.url)')/health

# Expected response: {"status":"ok","version":"0.1.0"}

# View logs
gcloud run logs read axiom-backend --limit 50

# Check Cloud Run metrics
gcloud monitoring time-series list \
  --filter='metric.type="run.googleapis.com/request_count"'
```

---

## 🔑 Important Variables

Update these in your environment:

```bash
export PROJECT_ID="axiom-conscience"
export REGION="us-central1"
export SERVICE_ACCOUNT_EMAIL="axiom-backend@axiom-conscience.iam.gserviceaccount.com"
export BACKEND_URL="https://axiom-backend-xxxxx.run.app"
export CREDENTIALS_FILE="$HOME/axiom-sa-key.json"
```

---

## 📊 Post-Deployment Checklist

- [ ] GCP APIs enabled
- [ ] Service account created
- [ ] Cloud Storage bucket created
- [ ] Docker image pushed to Artifact Registry
- [ ] Backend deployed to Cloud Run
- [ ] Backend health check passing
- [ ] Frontend built
- [ ] Frontend deployed to Firebase Hosting
- [ ] CORS configured
- [ ] Firestore database initialized
- [ ] Firebase Realtime Database initialized
- [ ] Logging sink created
- [ ] Custom domain configured (optional)

---

## 🆘 Troubleshooting

**Issue: "gcloud: command not found"**
```bash
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
```

**Issue: "Billing not enabled"**
- Go to: https://console.cloud.google.com/billing
- Link billing account to project

**Issue: "Backend returns 500 error"**
```bash
gcloud run logs read axiom-backend --limit 100 --format json | jq '.payload.jsonPayload'
```

**Issue: "Firebase deployment fails"**
```bash
npm install -g firebase-tools@latest
firebase login --reauth
firebase deploy --debug
```

**Issue: "CORS errors in frontend"**
```bash
# Update backend CORS
gcloud run services update axiom-backend \
  --update-env-vars CORS_ORIGINS="https://your-frontend-domain.com"
```

---

## 📞 Quick Commands

```bash
# Redeploy backend without rebuilding
gcloud run deploy axiom-backend \
  --image $IMAGE_URL \
  --region us-central1

# Rollback to previous version
gcloud run deploy axiom-backend \
  --image <previous-image-hash> \
  --region us-central1

# Scale instances
gcloud run services update axiom-backend \
  --max-instances 200 \
  --region us-central1

# Delete everything (WARNING!)
gcloud run services delete axiom-backend --region us-central1
firebase hosting:disable --project=$PROJECT_ID
gsutil -m rm -r gs://axiom-conscience-storage/
```

---

## 📚 Resources

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Firebase Hosting Guide](https://firebase.google.com/docs/hosting)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security)
- [Google Cloud Console](https://console.cloud.google.com)

---

**Status:** Ready for deployment ✅
