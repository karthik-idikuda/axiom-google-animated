#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

PROJECT_ID="gen-lang-client-0976545577"
REGION="us-central1"
SERVICE="axiom-backend"
IMAGE_NAME="axiom-backend"

echo -e "${BLUE}=== AXIOM BACKEND REBUILD & REDEPLOY ===${NC}"
echo ""

# Step 1: Build Docker image
echo -e "${BLUE}📦 Building Docker image...${NC}"
docker build -t "$IMAGE_NAME:latest" -f Dockerfile . || {
    echo -e "${RED}❌ Docker build failed${NC}"
    exit 1
}
echo -e "${GREEN}✓ Docker image built successfully${NC}"
echo ""

# Step 2: Tag for Google Container Registry
echo -e "${BLUE}🏷️  Tagging image for GCR...${NC}"
docker tag "$IMAGE_NAME:latest" "gcr.io/$PROJECT_ID/$IMAGE_NAME:latest"
echo -e "${GREEN}✓ Image tagged${NC}"
echo ""

# Step 3: Push to GCR
echo -e "${BLUE}☁️  Pushing to Google Container Registry...${NC}"
docker push "gcr.io/$PROJECT_ID/$IMAGE_NAME:latest" || {
    echo -e "${RED}❌ Docker push failed${NC}"
    exit 1
}
echo -e "${GREEN}✓ Image pushed to GCR${NC}"
echo ""

# Step 4: Deploy to Cloud Run
echo -e "${BLUE}🚀 Deploying to Cloud Run...${NC}"
gcloud run deploy "$SERVICE" \
  --image "gcr.io/$PROJECT_ID/$IMAGE_NAME:latest" \
  --region "$REGION" \
  --platform managed \
  --memory 2Gi \
  --timeout 3600 \
  --max-instances 10 \
  --set-env-vars "GEMINI_MODEL=gemini-3.1-pro-preview,GEMINI_API_KEY=${GEMINI_API_KEY},FIREBASE_DATABASE_URL=https://${PROJECT_ID}-default-rtdb.firebaseio.com,FIREBASE_PROJECT_ID=${PROJECT_ID},GOOGLE_CLOUD_PROJECT=${PROJECT_ID},CORS_ORIGINS=http://localhost:3000,https://gen-lang-client-0976545577.firebaseapp.com" \
  --allow-unauthenticated \
  --project "$PROJECT_ID" || {
    echo -e "${RED}❌ Cloud Run deployment failed${NC}"
    exit 1
}
echo -e "${GREEN}✓ Deployment successful${NC}"
echo ""

# Step 5: Get service URL
echo -e "${BLUE}📍 Getting service URL...${NC}"
SERVICE_URL=$(gcloud run services describe "$SERVICE" --region "$REGION" --format 'value(status.url)' --project "$PROJECT_ID")
echo -e "${GREEN}✓ Service URL: $SERVICE_URL${NC}"
echo ""

# Step 6: Health check
echo -e "${BLUE}🏥 Running health check...${NC}"
sleep 3
HEALTH=$(curl -s "$SERVICE_URL/health" 2>&1)
if echo "$HEALTH" | grep -q "healthy"; then
    echo -e "${GREEN}✓ Health check passed:${NC}"
    echo "$HEALTH" | head -5
else
    echo -e "${RED}⚠️  Health check returned:${NC}"
    echo "$HEALTH"
fi
echo ""

# Step 7: Show logs
echo -e "${BLUE}📋 Recent logs:${NC}"
gcloud run logs read "$SERVICE" --region "$REGION" --limit 10 --project "$PROJECT_ID"
echo ""

echo -e "${GREEN}✅ REBUILD & REDEPLOY COMPLETE${NC}"
echo "Backend URL: $SERVICE_URL"
echo "Health:      $SERVICE_URL/health"
echo "Logs:        gcloud run logs read $SERVICE --region $REGION --limit 50"
