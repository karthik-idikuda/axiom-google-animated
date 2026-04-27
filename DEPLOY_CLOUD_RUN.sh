#!/bin/bash
set -e

# AXIOM Cloud Run Deployment - FIXED
# Deploys pre-built Docker image to Google Cloud Run

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}🚀 AXIOM Backend Deployment to Cloud Run${NC}"
echo ""

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-gen-lang-client-0976545577}"
REGION="${GOOGLE_CLOUD_LOCATION:-us-central1}"
SERVICE="axiom-backend"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE}:latest"

echo -e "${YELLOW}📋 Configuration:${NC}"
echo "   Project ID: $PROJECT_ID"
echo "   Region: $REGION"
echo "   Service: $SERVICE"
echo "   Image: $IMAGE"
echo ""

# Load .env if present
if [ -f .env ]; then
  echo -e "${YELLOW}📖 Loading .env file...${NC}"
  set -a
  source .env
  set +a
else
  echo -e "${RED}⚠️  .env file not found!${NC}"
  echo "   Please create .env with GOOGLE_API_KEY and FIREBASE_DATABASE_URL"
  echo ""
fi

GEMINI_API_KEY="${GOOGLE_API_KEY:-}"
FIREBASE_DB_URL="${FIREBASE_DATABASE_URL:-https://${PROJECT_ID}-default-rtdb.firebaseio.com}"

if [ -z "$GEMINI_API_KEY" ]; then
  echo -e "${RED}❌ GOOGLE_API_KEY not set!${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Environment variables loaded${NC}"
echo ""

echo -e "${YELLOW}🔄 Deploying to Cloud Run...${NC}"
echo ""

# FIXED: Proper environment variable syntax for gcloud run deploy
# Format: KEY1="value1",KEY2="value2" (NO SPACES, comma-separated)
gcloud run deploy "$SERVICE" \
  --image "$IMAGE" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 900 \
  --set-env-vars "GEMINI_MODEL=gemini-3.1-pro-preview,GEMINI_API_KEY=${GEMINI_API_KEY},FIREBASE_DATABASE_URL=${FIREBASE_DB_URL},GOOGLE_CLOUD_PROJECT=${PROJECT_ID},USE_VERTEXAI=False,GEMINI_THINKING_LEVEL=HIGH" \
  --project "$PROJECT_ID"

echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""

# Get the service URL
echo -e "${YELLOW}📡 Retrieving service URL...${NC}"
SERVICE_URL=$(gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJECT_ID" --format 'value(status.url)')

echo ""
echo -e "${GREEN}🎉 Backend deployed successfully!${NC}"
echo ""
echo -e "${GREEN}Backend URL:${NC} $SERVICE_URL"
echo -e "${GREEN}Health Check:${NC} $SERVICE_URL/health"
echo -e "${GREEN}View Logs:${NC} gcloud run logs read $SERVICE --region $REGION --limit 50"
echo ""
