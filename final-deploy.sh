#!/usr/bin/env bash
set -e

echo "▶ Setting up clean deployment directory to bypass NPM permission and space path bugs..."
mkdir -p ~/axiom-deploy/public
cp -r "/Users/karthik/Downloads/All Projects/Google /axiom/frontend/build/"* ~/axiom-deploy/public/

cat << 'EOF' > ~/axiom-deploy/firebase.json
{
  "hosting": {
    "public": "public",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{"source": "**", "destination": "/index.html"}]
  }
}
EOF

cd ~/axiom-deploy

echo "▶ Installing local Firebase CLI..."
npm install firebase-tools

echo "▶ Deploying to Firebase Hosting..."
/opt/homebrew/bin/node ./node_modules/firebase-tools/lib/bin/firebase.js deploy --only hosting --project "gen-lang-client-0976545577"

echo "✅ Deployment Complete! Live at: https://gen-lang-client-0976545577.web.app"
