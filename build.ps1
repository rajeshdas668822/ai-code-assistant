# Build/rebuild the backend Docker image.
# Run this once initially, and again after changing backend code or requirements.

$ErrorActionPreference = "Stop"

Write-Host "=== Building Multi-Agent Code Assistant ==="
Write-Host "Building backend image ..."
docker compose build backend
Write-Host ""
Write-Host "Build complete. Run .\start.ps1 to start the services."
