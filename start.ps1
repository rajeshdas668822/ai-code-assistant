# Start the multi-agent code assistant (Docker)
# NOTE: Run .\build.ps1 first if this is your first time or after code changes.

$ErrorActionPreference = "Stop"
$Model = if ($env:MODEL) { $env:MODEL } else { "qwen2.5-coder:7b" }

Write-Host "=== Starting Multi-Agent Code Assistant ==="

# Start containers (no rebuild)
Write-Host "[1/3] Starting Docker containers ..."
docker compose up -d

# Wait for Ollama to be ready
Write-Host "[2/3] Waiting for Ollama to be ready ..."
$MaxRetries = 30
$Retry = 0
$Ready = $false
while (-not $Ready) {
    $Retry++
    if ($Retry -ge $MaxRetries) {
        Write-Host "  ERROR: Ollama failed to start after $MaxRetries attempts."
        Write-Host "  Check logs: docker logs ollama"
        exit 1
    }
    try {
        $null = Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -Method Get -TimeoutSec 3
        $Ready = $true
    } catch {
        Start-Sleep -Seconds 2
        Write-Host "  ... waiting for Ollama (attempt $Retry/$MaxRetries)"
    }
}
Write-Host "  Ollama is ready."

# Pull model only if not already present
Write-Host "[3/3] Ensuring model '$Model' is available ..."
$tags = Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -Method Get
$modelExists = $tags.models | Where-Object { $_.name -like "$Model*" }
if (-not $modelExists) {
    Write-Host "  Pulling model '$Model' (first time only) ..."
    docker exec ollama ollama pull $Model
} else {
    Write-Host "  Model '$Model' already available."
}

Write-Host ""
Write-Host "=== All services running ==="
Write-Host "  Backend:  http://localhost:8000"
Write-Host "  Ollama:   http://localhost:11434"
Write-Host "  Health:   http://localhost:8000/health"
Write-Host ""
Write-Host "To stop: .\stop.ps1"
Write-Host "To rebuild after code changes: .\build.ps1"
