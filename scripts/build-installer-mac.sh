#!/bin/bash

# Build Windows Installer on Mac using Wine + Inno Setup
# This script automates the entire process

set -e

echo "========================================"
echo "Building Windows Installer on Mac"
echo "========================================"
echo ""

# Check if Wine is installed
if ! command -v wine &> /dev/null; then
    echo "❌ Wine is not installed!"
    echo ""
    echo "Install Wine using Homebrew:"
    echo "  brew install --cask wine-stable"
    echo ""
    exit 1
fi

# Check if Inno Setup is installed in Wine
INNO_COMPILER="$HOME/.wine/drive_c/Program Files (x86)/Inno Setup 6/ISCC.exe"
if [ ! -f "$INNO_COMPILER" ]; then
    echo "❌ Inno Setup not found in Wine!"
    echo ""
    echo "Download and install Inno Setup:"
    echo "1. Download from: https://jrsoftware.org/isdl.php"
    echo "2. Run: wine innosetup-6.x.x.exe"
    echo "3. Follow the installation wizard"
    echo ""
    exit 1
fi

echo "[1/5] Preparing installer files..."
node scripts/prepare-installer.js
echo ""

echo "[2/5] Building Next.js application..."
npm run build
echo ""

echo "[3/5] Installing production dependencies..."
# Create a temporary package for production deps
rm -rf dist/app/node_modules
cd dist/app
npm install --production --legacy-peer-deps
cd ../..
echo ""

echo "[4/5] Copying built files..."
# Copy .next build output
cp -r .next dist/app/.next
echo "✓ Build files copied"
echo ""

echo "[5/5] Compiling installer with Inno Setup..."
# Convert Windows path for Wine
SCRIPT_PATH=$(pwd)/installer.iss
wine "$INNO_COMPILER" "$SCRIPT_PATH"
echo ""

echo "========================================"
echo "SUCCESS!"
echo "========================================"
echo ""
echo "Installer created: ./installer-output/AIServices-Setup-1.0.0.exe"
echo ""
echo "You can now distribute this single .exe file to Windows users!"
echo ""
