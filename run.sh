#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

# Colors
G='\033[0;32m' B='\033[0;34m' Y='\033[1;33m' NC='\033[0m'
ok() { echo -e "${G}✅ $1${NC}"; }
info() { echo -e "${B}ℹ️  $1${NC}"; }
warn() { echo -e "${Y}⚠️  $1${NC}"; }

# ─── Activate venv ────────────────────────────────────────────────────────────
if [ ! -d .venv ]; then
  info "Creating Python venv..."
  python3 -m venv .venv
fi
source .venv/bin/activate
ok "Python venv activated ($(python3 --version))"

# ─── Install deps only if missing ────────────────────────────────────────────
install_python() {
  if python3 -c "import langgraph, fastapi, firebase_admin" 2>/dev/null; then
    ok "Python deps already installed — skipping pip"
  else
    info "Installing Python dependencies..."
    pip install -q -r requirements.txt
    ok "Python deps installed"
  fi
}

install_node() {
  if [ -d frontend/node_modules ]; then
    ok "Node deps already installed"
  else
    info "Installing Node dependencies..."
    (cd frontend && bun install)
    ok "Node deps installed"
  fi
}

# ─── Start Backend ────────────────────────────────────────────────────────────
start_backend() {
  local PORT="${API_PORT:-8000}"
  # Try to kill existing
  info "Cleaning up port ${PORT}..."
  lsof -ti:${PORT} | xargs kill -9 2>/dev/null || true
  sleep 1
  
  info "Starting backend on port ${PORT}..."
  # Start backend in background and log to a file
  python3 -m uvicorn backend.main:app --host 127.0.0.1 --port "${PORT}" > backend.log 2>&1 &
  BACKEND_PID=$!
  
  # Wait for health
  info "Waiting for health check..."
  for i in $(seq 1 10); do
    if curl -sf "http://localhost:${PORT}/health" > /dev/null 2>&1; then
      ok "Backend running on http://localhost:${PORT}"
      return 0
    fi
    sleep 1
  done
  warn "Backend health check timed out. Check backend.log for errors."
  cat backend.log
}

# ─── Start Frontend ──────────────────────────────────────────────────────────
start_frontend() {
  install_node
  local PORT="${FRONTEND_PORT:-3000}"
  # Try to kill existing
  info "Cleaning up port ${PORT}..."
  lsof -ti:${PORT} | xargs kill -9 2>/dev/null || true
  
  info "Starting frontend on http://localhost:${PORT} ..."
  (cd frontend && PORT=${PORT} HOST=0.0.0.0 BROWSER=none bun run start > ../frontend.log 2>&1) &
  FRONTEND_PID=$!
  sleep 2
  ok "Frontend starting in background. Check frontend.log if it fails."
}

# ─── Main ─────────────────────────────────────────────────────────────────────
case "${1:-all}" in
  backend)
    install_python
    start_backend
    wait
    ;;
  frontend)
    start_frontend
    wait
    ;;
  all|"")
    install_python
    start_backend
    start_frontend
    echo ""
    ok "AXIOM is running!"
    echo "  Backend:  http://localhost:${API_PORT:-8000}"
    echo "  Frontend: http://localhost:${FRONTEND_PORT:-3000}"
    echo ""
    echo "  Logs: tail -f backend.log frontend.log"
    echo "  Press Ctrl+C to stop."
    wait
    ;;
  *)
    echo "Usage: $0 [backend|frontend|all]"
    ;;
esac
