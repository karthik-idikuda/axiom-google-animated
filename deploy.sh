#!/usr/bin/env bash
# AXIOM end-to-end deploy: Cloud Run (backend) + Firebase Hosting (frontend)
#
# USAGE
#   ./deploy.sh                              # deploy backend then frontend
#   ./deploy.sh backend                      # backend only (needs billing)
#   ./deploy.sh frontend                     # frontend only (free)
#   API_URL=https://my.api ./deploy.sh frontend   # frontend with custom API
#
# PREREQUISITES
#   gcloud auth login
#   firebase login --reauth        (must be the SAME account as gcloud)
#   gcloud config set project gen-lang-client-0976545577
set -euo pipefail

# always run from the repo root (where this script lives)
cd "$(dirname "$0")"

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-gen-lang-client-0976545577}"
REGION="${GOOGLE_CLOUD_LOCATION:-us-central1}"
SERVICE="axiom-backend"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE}:latest"

# load .env if present (so GOOGLE_API_KEY etc. are available)
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

GEMINI_API_KEY="${GOOGLE_API_KEY:-}"
FIREBASE_DB_URL="${FIREBASE_DATABASE_URL:-https://${PROJECT_ID}-default-rtdb.firebaseio.com}"

deploy_backend() {
  echo "▶ Enabling required APIs (requires billing on $PROJECT_ID)…"
  gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
    artifactregistry.googleapis.com --project "$PROJECT_ID" || {
      echo ""
      echo "❌ Could not enable APIs — billing is not enabled on $PROJECT_ID."
      echo "   Enable it (free tier still applies):"
      echo "     https://console.cloud.google.com/billing/linkedaccount?project=$PROJECT_ID"
      echo ""
      exit 1
  }

  echo "▶ Building image with Cloud Build…"
  gcloud builds submit --tag "$IMAGE" --project "$PROJECT_ID" .

  echo "▶ Deploying to Cloud Run…"
  gcloud run deploy "$SERVICE" \
    --image="$IMAGE" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --platform=managed \
    --allow-unauthenticated \
    --memory=2Gi --cpu=2 \
    --max-instances=5 --min-instances=0 \
    --port=8080 --timeout=300 \
    --set-env-vars="GOOGLE_CLOUD_PROJECT=${PROJECT_ID},GOOGLE_CLOUD_LOCATION=${REGION},GEMINI_MODEL=gemini-2.5-flash,GOOGLE_GENAI_USE_VERTEXAI=False,GOOGLE_API_KEY=${GEMINI_API_KEY},FIREBASE_PROJECT_ID=${PROJECT_ID},FIREBASE_DATABASE_URL=${FIREBASE_DB_URL},AXIOM_DISABLE_FIRESTORE=1,AXIOM_DISABLE_STORAGE=1,CORS_ORIGINS=https://${PROJECT_ID}.web.app,https://${PROJECT_ID}.firebaseapp.com"

  URL=$(gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJECT_ID" --format='value(status.url)')
  echo "✅ Backend live: $URL"
  echo "$URL" > .cloud_run_url
}

deploy_frontend() {
  if [ -n "${API_URL:-}" ]; then
    BACKEND_URL="$API_URL"
  elif [ -f .cloud_run_url ]; then
    BACKEND_URL=$(cat .cloud_run_url)
  else
    BACKEND_URL=$(gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJECT_ID" --format='value(status.url)' 2>/dev/null || echo "")
  fi
  if [ -z "$BACKEND_URL" ]; then
    echo "⚠ No backend URL found. Re-run with:  API_URL=https://your-api ./deploy.sh frontend"
    echo "  (Building anyway with http://localhost:8000 — only works while you run the backend locally.)"
    BACKEND_URL="http://localhost:8000"
  fi
  echo "▶ Building React app with REACT_APP_API_URL=$BACKEND_URL"
  ( cd frontend && REACT_APP_API_URL="$BACKEND_URL" npm run build )

  echo "▶ Deploying to Firebase Hosting…"
  firebase deploy --only hosting --project "$PROJECT_ID"
  echo "✅ Frontend live: https://${PROJECT_ID}.web.app"
}

case "${1:-all}" in
  backend)  deploy_backend  ;;
  frontend) deploy_frontend ;;
  all)      deploy_backend; deploy_frontend ;;
  *)        echo "Usage: $0 [backend|frontend|all]"; exit 1 ;;
esac
