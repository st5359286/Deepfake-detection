# Backend setup script for Windows
# Run from Backend folder: .\setup.ps1

Write-Host "=== Backend setup script ==="

# Check Node
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error "Node.js is not installed or not in PATH. Install Node.js 18+ from https://nodejs.org/"
  exit 1
}

# Check Python
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
  Write-Error "Python is not installed or not in PATH. Install Python 3.11 from https://www.python.org/downloads/"
  exit 1
}

$py = python --version 2>&1
Write-Host "Python version: $py"
if ($py -notmatch "3\.11") {
  Write-Warning "Recommended Python 3.11. You are using: $py"
  Write-Host "Proceeding but if install fails, install Python 3.11 and re-run."
}

Write-Host "Updating pip/setuptools/wheel..."
python -m pip install --upgrade pip setuptools wheel

Write-Host "Installing Python ML backend dependencies from deepfake-detector-backend..."
python -m pip install --upgrade -r ..\deepfake-detector-backend\requirements.txt
if ($LASTEXITCODE -ne 0) {
  Write-Error "Python deps install failed. If NumPy fails for Python 3.14, switch to Python 3.11 and rerun."
  exit 1
}

Write-Host "Installing Node backend dependencies..."
npm install
if ($LASTEXITCODE -ne 0) {
  Write-Error "npm install failed."
  exit 1
}

Write-Host "✅ Setup complete. Run backend with 'npm start' and frontend with 'npm run dev' in the frontend folder."
