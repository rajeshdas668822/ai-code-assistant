#!/bin/bash
# Build/rebuild the backend Docker image.
# Run this once initially, and again after changing backend code or requirements.

set -e

echo "=== Building Multi-Agent Code Assistant ==="
echo "Building backend image ..."
docker compose build backend
echo ""
echo "Build complete. Run ./start.sh to start the services."
