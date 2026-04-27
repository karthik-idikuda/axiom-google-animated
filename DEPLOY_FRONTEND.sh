#!/bin/bash

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

PROJECT_ID="gen-lang-client-0976545577"

echo -e "${BLUE}=== AXIOM FRONTEND BUILD & DEPLOY ===${NC}"
echo ""

# Step 1: Build React app
echo -e "${BLUE}📦 Building React frontend...${NC}"
cd frontend
npm run build || {
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
}
echo -e "${GREEN}✓ Frontend built successfully${NC}"
echo ""

# Step 2: Deploy to Firebase Hosting
echo -e "${BLUE}☁️  Deploying to Firebase Hosting...${NC}"
cd ..
firebase deploy --only hosting --project "$PROJECT_ID" || {
    echo -e "${RED}❌ Firebase deployment failed${NC}"
    exit 1
}
echo -e "${GREEN}✓ Frontend deployed to Firebase${NC}"
echo ""

echo -e "${GREEN}✅ FRONTEND DEPLOYMENT COMPLETE${NC}"
echo "Frontend URL: https://${PROJECT_ID}.firebaseapp.com"
echo "Backend URL:  https://axiom-backend-x5ed5hbevq-uc.a.run.app"
