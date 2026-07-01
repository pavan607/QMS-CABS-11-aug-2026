# QMS Setup Script for Windows (PowerShell)
# Quality Management System - Automated Setup
# Run this script after cloning/copying the project

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "  QMS - Quality Management System Setup (Windows)" -ForegroundColor Cyan
Write-Host "============================================================`n" -ForegroundColor Cyan

# Function to print colored messages
function Write-Step {
    param($Step, $Message)
    Write-Host "`n[$Step] $Message" -ForegroundColor Cyan -BackgroundColor Black
}

function Write-Success {
    param($Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Warning {
    param($Message)
    Write-Host "⚠ $Message" -ForegroundColor Yellow
}

function Write-Error-Custom {
    param($Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

# Step 1: Check Node.js
Write-Step "1/6" "Checking Node.js installation"
try {
    $nodeVersion = node --version
    Write-Success "Node.js $nodeVersion detected"
    
    $majorVersion = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
    if ($majorVersion -lt 18) {
        Write-Warning "Node.js 18 or higher is recommended. Please consider upgrading."
    }
} catch {
    Write-Error-Custom "Node.js is not installed. Please install Node.js 18+ from https://nodejs.org/"
    exit 1
}

# Step 2: Install dependencies
Write-Step "2/6" "Installing npm dependencies"
Write-Host "  This may take a few minutes..." -ForegroundColor Gray
try {
    npm install
    Write-Success "Dependencies installed successfully"
} catch {
    Write-Error-Custom "Failed to install dependencies"
    exit 1
}

# Step 3: Setup .env file
Write-Step "3/6" "Setting up environment variables"
if (Test-Path ".env") {
    Write-Warning ".env file already exists. Skipping..."
    Write-Host "  If you need a fresh .env file, delete the existing one and run setup again." -ForegroundColor Gray
} else {
    if (Test-Path "env.template") {
        Copy-Item "env.template" ".env"
        Write-Success ".env file created from template"
        Write-Host "`n  ⚠️  IMPORTANT: Edit .env file with your configuration:" -ForegroundColor Yellow
        Write-Host "     - DATABASE_URL: Your PostgreSQL connection string" -ForegroundColor Gray
        Write-Host "     - NEXTAUTH_SECRET: Generate with 'openssl rand -base64 32'" -ForegroundColor Gray
        Write-Host "     - NEXTAUTH_URL: Your application URL (default: http://localhost:3000)" -ForegroundColor Gray
    } else {
        Write-Error-Custom "env.template file not found!"
        exit 1
    }
}

# Step 4: Create uploads directory
Write-Step "4/6" "Creating uploads directory"
$uploadsPath = "public\uploads"
if (!(Test-Path $uploadsPath)) {
    New-Item -ItemType Directory -Path $uploadsPath -Force | Out-Null
    Write-Success "Uploads directory created"
} else {
    Write-Success "Uploads directory already exists"
}

# Create subdirectories
$subdirs = @("inspection_request", "quality_check", "document")
foreach ($dir in $subdirs) {
    $dirPath = Join-Path $uploadsPath $dir
    if (!(Test-Path $dirPath)) {
        New-Item -ItemType Directory -Path $dirPath -Force | Out-Null
    }
}
Write-Success "Upload subdirectories created"

# Step 5: Database setup
Write-Step "5/6" "Database setup"
Write-Host "`n  Before proceeding, ensure:" -ForegroundColor Gray
Write-Host "  1. PostgreSQL is installed and running" -ForegroundColor Gray
Write-Host "  2. You have created a database for QMS" -ForegroundColor Gray
Write-Host "  3. .env file is configured with correct DATABASE_URL" -ForegroundColor Gray

$response = Read-Host "`n  Do you want to initialize the database now? (y/n)"
if ($response -eq "y" -or $response -eq "yes") {
    Write-Host "`n  Initializing database schema and creating default users..." -ForegroundColor Gray
    try {
        npm run db:init
        Write-Success "Database initialized successfully"
        Write-Host "`n  Default users created:" -ForegroundColor Gray
        Write-Host "  • Administrator: admin@qms.com / admin123" -ForegroundColor Gray
        Write-Host "  • Inspector: inspector@qms.com / admin123" -ForegroundColor Gray
        Write-Host "  • Approver: approver@qms.com / admin123" -ForegroundColor Gray
        Write-Host "  • Initiator: initiator@qms.com / admin123" -ForegroundColor Gray
        Write-Warning "`n  SECURITY: Change these passwords immediately after first login!"
    } catch {
        Write-Warning "Database initialization failed"
        Write-Host "  You can run 'npm run db:init' later to initialize the database" -ForegroundColor Gray
    }
} else {
    Write-Warning "Skipping database initialization"
    Write-Host "  You can run 'npm run db:init' later to initialize the database" -ForegroundColor Gray
}

# Step 6: Display next steps
Write-Step "6/6" "Setup Complete!"

Write-Host "`n============================================================" -ForegroundColor Green
Write-Host "  NEXT STEPS" -ForegroundColor Green
Write-Host "============================================================`n" -ForegroundColor Green

Write-Host "1. Review and update your .env file with proper configuration" -ForegroundColor White
Write-Host "   - Ensure DATABASE_URL is correct" -ForegroundColor Gray
Write-Host "   - Generate NEXTAUTH_SECRET: openssl rand -base64 32`n" -ForegroundColor Gray

Write-Host "2. If you skipped database setup, run:" -ForegroundColor White
Write-Host "   npm run db:init`n" -ForegroundColor Gray

Write-Host "3. Start the development server:" -ForegroundColor White
Write-Host "   npm run dev`n" -ForegroundColor Gray

Write-Host "4. Open your browser and navigate to:" -ForegroundColor White
Write-Host "   http://localhost:3000`n" -ForegroundColor Gray

Write-Host "5. Login with default credentials and change passwords`n" -ForegroundColor White

Write-Host "============================================================`n" -ForegroundColor Green

Write-Success "Setup script completed successfully!"
Write-Host "For more information, check the README.md file`n" -ForegroundColor Gray

