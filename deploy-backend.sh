#!/bin/bash
set -e
source .env

VERCEL_URL="https://frontend-delta-puce-57.vercel.app"

echo "=== Deploying backend to Railway ==="
cd backend

# Initialize Railway project
railway init --name warehousevoice-backend

# Deploy
railway up

# Get the domain
BACKEND_URL=$(railway domain 2>/dev/null || echo "")
if [ -z "$BACKEND_URL" ]; then
  echo "Getting Railway domain..."
  BACKEND_URL=$(railway status --json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('deployments',[{}])[0].get('url',''))" 2>/dev/null || echo "")
fi

echo "Backend URL: https://$BACKEND_URL"

# Set env vars
railway variables set SUPABASE_URL="$SUPABASE_URL"
railway variables set SUPABASE_SERVICE_KEY="$SUPABASE_SERVICE_KEY"
railway variables set GROQ_API_KEY="$GROQ_API_KEY"
railway variables set GEMINI_API_KEY="$GEMINI_API_KEY"
railway variables set FRONTEND_URL="$VERCEL_URL"
railway variables set PORT=3001

echo ""
echo "=== Updating frontend VITE_API_URL ==="
cd ../frontend

# Update .env.production with real backend URL
sed -i '' "s|PLACEHOLDER_RAILWAY_URL|https://$BACKEND_URL|g" .env.production

# Redeploy frontend with correct API URL
npx vercel --token "$VERCEL_TOKEN" --prod --yes --scope shahedk4142-3751s-projects

echo ""
echo "=============================================================="
echo "WAREHOUSEVOICE DEPLOYMENT COMPLETE"
echo "=============================================================="
echo "Picker PWA (Vercel):     $VERCEL_URL"
echo "API Backend (Railway):   https://$BACKEND_URL"
echo "Supabase Dashboard:      https://app.supabase.com/project/njjrldbhcrbuazvmupaz"
echo "=============================================================="
