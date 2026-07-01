#!/bin/bash

# QMS Setup Script for Unix/Linux/Mac
# Quality Management System - Automated Setup
# Run this script after cloning/copying the project

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Functions
print_step() {
    echo -e "\n${CYAN}${BOLD}[$1] $2${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Header
echo -e "\n${CYAN}============================================================${NC}"
echo -e "${CYAN}${BOLD}  QMS - Quality Management System Setup${NC}"
echo -e "${CYAN}============================================================${NC}\n"

# Step 1: Check Node.js
print_step "1/6" "Checking Node.js installation"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_success "Node.js $NODE_VERSION detected"
    
    MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
    if [ "$MAJOR_VERSION" -lt 18 ]; then
        print_warning "Node.js 18 or higher is recommended. Please consider upgrading."
    fi
else
    print_error "Node.js is not installed. Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

# Step 2: Install dependencies
print_step "2/6" "Installing npm dependencies"
echo "  This may take a few minutes..."
if npm install; then
    print_success "Dependencies installed successfully"
else
    print_error "Failed to install dependencies"
    exit 1
fi

# Step 3: Setup .env file
print_step "3/6" "Setting up environment variables"
if [ -f ".env" ]; then
    print_warning ".env file already exists. Skipping..."
    echo "  If you need a fresh .env file, delete the existing one and run setup again."
else
    if [ -f "env.template" ]; then
        cp env.template .env
        print_success ".env file created from template"
        echo -e "\n  ${YELLOW}⚠️  IMPORTANT: Edit .env file with your configuration:${NC}"
        echo "     - DATABASE_URL: Your PostgreSQL connection string"
        echo "     - NEXTAUTH_SECRET: Generate with 'openssl rand -base64 32'"
        echo "     - NEXTAUTH_URL: Your application URL (default: http://localhost:3000)"
    else
        print_error "env.template file not found!"
        exit 1
    fi
fi

# Step 4: Create uploads directory
print_step "4/6" "Creating uploads directory"
if [ ! -d "public/uploads" ]; then
    mkdir -p public/uploads
    print_success "Uploads directory created"
else
    print_success "Uploads directory already exists"
fi

# Create subdirectories
mkdir -p public/uploads/inspection_request
mkdir -p public/uploads/quality_check
mkdir -p public/uploads/document
print_success "Upload subdirectories created"

# Step 5: Database setup
print_step "5/6" "Database setup"
echo ""
echo "  Before proceeding, ensure:"
echo "  1. PostgreSQL is installed and running"
echo "  2. You have created a database for QMS"
echo "  3. .env file is configured with correct DATABASE_URL"
echo ""
read -p "  Do you want to initialize the database now? (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "  Initializing database schema and creating default users..."
    if npm run db:init; then
        print_success "Database initialized successfully"
        echo ""
        echo "  Default users created:"
        echo "  • Administrator: admin@qms.com / admin123"
        echo "  • Inspector: inspector@qms.com / admin123"
        echo "  • Approver: approver@qms.com / admin123"
        echo "  • Initiator: initiator@qms.com / admin123"
        print_warning "\n  SECURITY: Change these passwords immediately after first login!"
    else
        print_warning "Database initialization failed"
        echo "  You can run 'npm run db:init' later to initialize the database"
    fi
else
    print_warning "Skipping database initialization"
    echo "  You can run 'npm run db:init' later to initialize the database"
fi

# Step 6: Display next steps
print_step "6/6" "Setup Complete!"

echo -e "\n${GREEN}============================================================${NC}"
echo -e "${GREEN}${BOLD}  NEXT STEPS${NC}"
echo -e "${GREEN}============================================================${NC}\n"

echo "1. Review and update your .env file with proper configuration"
echo "   - Ensure DATABASE_URL is correct"
echo "   - Generate NEXTAUTH_SECRET: openssl rand -base64 32"
echo ""
echo "2. If you skipped database setup, run:"
echo "   npm run db:init"
echo ""
echo "3. Start the development server:"
echo "   npm run dev"
echo ""
echo "4. Open your browser and navigate to:"
echo "   http://localhost:3000"
echo ""
echo "5. Login with default credentials and change passwords"
echo ""
echo -e "${GREEN}============================================================${NC}\n"

print_success "Setup script completed successfully!"
echo "For more information, check the README.md file"
echo ""

