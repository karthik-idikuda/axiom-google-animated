#!/usr/bin/env bash
# Run backend and frontend locally
set -e

# backend
uvicorn backend.main:app --reload --port 8000 &
BACK_PID=$!

# frontend
(cd frontend && npm start) &
FRONT_PID=$!

trap "kill $BACK_PID $FRONT_PID" EXIT
wait
