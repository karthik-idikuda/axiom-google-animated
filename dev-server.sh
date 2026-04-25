#!/bin/bash
# AXIOM Development Server Launcher
# Starts backend (port 8000) and frontend (port 3000)

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

echo "🚀 AXIOM Development Server"
echo "================================"
echo ""

# Check if .venv exists
if [ ! -d ".venv" ]; then
    echo "❌ Virtual environment not found. Run: python -m venv .venv"
    exit 1
fi

# Activate virtual environment
source .venv/bin/activate

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Creating from .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✅ Created .env (update with your GCP credentials)"
    else
        echo "❌ .env.example not found"
        exit 1
    fi
fi

echo ""
echo "📦 Backend (port 8000):"
echo "   Running: uvicorn backend.main:app --reload --port 8000"
echo ""

# Start backend in background
uvicorn backend.main:app --reload --port 8000 &
BACKEND_PID=$!

echo "✅ Backend started (PID: $BACKEND_PID)"
echo ""

# Wait a moment for backend to start
sleep 2

# Check if backend is running
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "❌ Backend failed to start"
    exit 1
fi

echo "📦 Frontend (port 3000):"
echo "   Running: npm start"
echo ""

# Start frontend
cd frontend
npm start

# Cleanup: Kill backend when frontend exits
kill $BACKEND_PID 2>/dev/null || true

echo ""
echo "🛑 Development server stopped"
