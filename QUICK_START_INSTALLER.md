# 🚀 Quick Start: Build Windows Installer on Mac

## The Easiest Way (Docker - Recommended)

```bash
# 1. Install Docker Desktop
# Download from: https://www.docker.com/products/docker-desktop

# 2. Install dependencies
npm install

# 3. Build the installer (one command!)
npm run installer:build:docker
```

**Done!** Your installer is at: `./installer-output/AIServices-Setup-1.0.0.exe`

---

## What This Does

Creates a **single `.exe` file** that:
- ✅ Bundles Node.js (portable, no system install)
- ✅ Includes all dependencies (pre-installed)
- ✅ Contains your built Next.js app
- ✅ Creates desktop shortcut automatically
- ✅ Configures API keys during installation
- ✅ Includes uninstaller

## User Experience

**Before (Old Way):**
1. Download ZIP from GitHub
2. Extract files
3. Run SETUP_AND_BUILD.bat
4. Wait 10+ minutes
5. Configure manually

**After (New Way):**
1. Download `.exe` file
2. Double-click to install
3. Enter API keys in wizard
4. Done in 2 minutes! 🎉

## Distribute Your Installer

Upload the `.exe` file to:
- Your website
- GitHub Releases
- Google Drive / Dropbox
- Any file hosting service

Users download and run - that's it!

---

## Alternative Methods

### Method 2: Wine on Mac

```bash
# Install Wine
brew install --cask wine-stable

# Download Inno Setup
# https://jrsoftware.org/isdl.php

# Install Inno Setup in Wine
wine innosetup-6.x.x.exe

# Build installer
npm run installer:build:mac
```

### Method 3: GitHub Actions (Automated)

```bash
# Push to GitHub
git add .
git commit -m "Add installer build"
git push

# Create release tag
git tag v1.0.0
git push origin v1.0.0

# GitHub automatically builds installer
# Download from Releases page
```

---

## Troubleshooting

**Docker not found?**
```bash
# Install Docker Desktop first
open https://www.docker.com/products/docker-desktop
```

**Build fails?**
```bash
# Make sure Docker is running
docker ps

# Try building Next.js first
npm run build
```

**Need to customize?**
- Edit `installer.iss` for app name, version, icon
- Add your icon at `build/icon.ico`
- See `BUILD_INSTALLER.md` for full guide

---

## File Size

Final installer: **~300-600 MB**

Large but includes EVERYTHING - users don't need to install Node.js or anything else!

---

For detailed documentation, see `BUILD_INSTALLER.md`
