#!/bin/bash
# Start the multi-agent code assistant (Docker)
# NOTE: Run ./build.sh first if this is your first time or after code changes.

set -e

MODEL="${MODEL:-qwen2.5-coder:7b}"

echo "=== Starting Multi-Agent Code Assistant ==="

# Start containers (no rebuild — use ./build.sh for that)
echo "[1/3] Starting Docker containers ..."
docker compose up -d

# Wait for Ollama to be ready (check from host, not inside container)
echo "[2/3] Waiting for Ollama to be ready ..."
MAX_RETRIES=30
RETRY=0
until curl -sf http://localhost:11434/api/tags > /dev/null 2>&1; do
    RETRY=$((RETRY + 1))
    if [ "$RETRY" -ge "$MAX_RETRIES" ]; then
        echo "  ERROR: Ollama failed to start after ${MAX_RETRIES} attempts."
        echo "  Check logs: docker logs ollama"
        exit 1
    fi
    sleep 2
    echo "  ... waiting for Ollama (attempt $RETRY/$MAX_RETRIES)"
done
echo "  Ollama is ready."

# Pull the model only if not already present
echo "[3/3] Ensuring model '$MODEL' is available ..."
if ! curl -sf http://localhost:11434/api/tags | grep -q "$MODEL"; then
    echo "  Pulling model '$MODEL' (first time only) ..."
    docker exec ollama ollama pull "$MODEL"
else
    echo "  Model '$MODEL' already available."
fi

echo ""
echo "=== All services running ==="
echo "  Backend:  http://localhost:8000"
echo "  Ollama:   http://localhost:11434"
echo "  Health:   http://localhost:8000/health"
echo ""
echo "To stop: ./stop.sh"
echo "To rebuild after code changes: ./build.sh"
