#!/bin/bash

# Build Windows Installer using Docker (cross-platform)
# This works on Mac, Linux, and Windows with Docker installed

set -e

echo "========================================"
echo "Building Windows Installer with Docker"
echo "========================================"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed!"
    echo ""
    echo "Install Docker Desktop from: https://www.docker.com/products/docker-desktop"
    echo ""
    exit 1
fi

echo "[1/4] Preparing installer files..."
node scripts/prepare-installer.js
echo ""

echo "[2/4] Building Next.js application..."
npm run build
echo ""

echo "[3/4] Installing production dependencies..."
# Create a temporary package for production deps
rm -rf dist/app/node_modules
mkdir -p dist/app
cp package.json package-lock.json dist/app/
cd dist/app
npm install --production --legacy-peer-deps
cd ../..

# Copy .next build output
cp -r .next dist/app/.next
echo "✓ Dependencies installed"
echo ""

echo "[4/4] Building installer with Docker + Inno Setup..."

# Create Dockerfile for Inno Setup
cat > Dockerfile.installer << 'EOF'
FROM amake/innosetup:latest

WORKDIR /work

# Copy all necessary files
COPY installer.iss /work/
COPY dist/ /work/dist/
COPY .next/ /work/.next/
COPY node_modules/ /work/node_modules/
COPY package.json /work/
COPY next.config.js /work/
COPY tsconfig.json /work/
COPY tailwind.config.js /work/
COPY postcss.config.js /work/
COPY .env.example /work/
COPY build/ /work/build/

# Compile installer
RUN wine "C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe" /work/installer.iss

# Output will be in /work/installer-output
EOF

# Build Docker image and compile installer
docker build -f Dockerfile.installer -t ai-services-installer .

# Extract the installer from the container
CONTAINER_ID=$(docker create ai-services-installer)
docker cp $CONTAINER_ID:/work/installer-output ./
docker rm $CONTAINER_ID

# Cleanup
rm Dockerfile.installer

echo ""
echo "========================================"
echo "SUCCESS!"
echo "========================================"
echo ""
echo "Installer created: ./installer-output/AIServices-Setup-1.0.0.exe"
echo ""
echo "You can now distribute this single .exe file to Windows users!"
echo ""
