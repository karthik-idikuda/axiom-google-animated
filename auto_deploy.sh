#!/usr/bin/env bash
set -e

echo "▶ Fetching Cloud Run URL via SA Key..."
export GOOGLE_APPLICATION_CREDENTIALS="$(pwd)/axiom-sa-key.json"
# We can just hardcode the URL we know is correct to avoid gcloud issues if it's broken
BACKEND_URL="https://axiom-backend-x5ed5hbevq-uc.a.run.app"

echo "▶ Building React App with URL: $BACKEND_URL"
cd frontend
export REACT_APP_API_URL="$BACKEND_URL"
export DISABLE_ESLINT_PLUGIN=true
export GENERATE_SOURCEMAP=false
export NODE_OPTIONS="--max-old-space-size=4096"
/opt/homebrew/bin/node /opt/homebrew/bin/npm install
/opt/homebrew/bin/node node_modules/.bin/react-scripts build
cd ..

echo "▶ Preparing /tmp/axiom-deploy"
rm -rf /tmp/axiom-deploy
mkdir -p /tmp/axiom-deploy/public
cp -r frontend/build/* /tmp/axiom-deploy/public/

cat << 'JSON' > /tmp/axiom-deploy/firebase.json
{
  "hosting": {
    "public": "public",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{"source": "**", "destination": "/index.html"}]
  }
}
JSON

cat << 'JSON' > /tmp/axiom-deploy/package.json
{
  "name": "firebase-deployer",
  "version": "1.0.0"
}
JSON

echo "▶ Installing Firebase CLI"
cd /tmp/axiom-deploy
/opt/homebrew/bin/node /opt/homebrew/bin/npm install firebase-tools

echo "▶ Deploying to Firebase"
export GOOGLE_APPLICATION_CREDENTIALS="/Users/karthik/Downloads/All Projects/Google /axiom/axiom-sa-key.json"
/opt/homebrew/bin/node ./node_modules/firebase-tools/lib/bin/firebase.js deploy --only hosting --project gen-lang-client-0976545577

echo "✅ All done"
