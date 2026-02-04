# Building Windows Installer on Mac

This guide explains how to create a single `.exe` installer file that bundles everything (Node.js, dependencies, and your app) so Windows users can install with one click.

## 🎯 Goal

Instead of users downloading a ZIP and running `SETUP_AND_BUILD.bat`, they download **one `.exe` file** and install everything automatically.

## 📋 Prerequisites

Choose **ONE** of these methods:

### Method 1: Docker (Recommended - Works on Mac/Linux/Windows)
- Install [Docker Desktop](https://www.docker.com/products/docker-desktop)
- No other dependencies needed!

### Method 2: Wine on Mac
- Install Wine: `brew install --cask wine-stable`
- Download [Inno Setup](https://jrsoftware.org/isdl.php)
- Install Inno Setup in Wine: `wine innosetup-6.x.x.exe`

### Method 3: GitHub Actions (Automated)
- Push to GitHub
- Installer builds automatically on Windows runners
- Download from GitHub Releases

## 🚀 Quick Start

### Using Docker (Easiest on Mac)

```bash
# 1. Install dependencies
npm install

# 2. Build installer using Docker
npm run installer:build:docker
```

The installer will be created at: `./installer-output/AIServices-Setup-1.0.0.exe`

### Using Wine on Mac

```bash
# 1. Install dependencies
npm install

# 2. Build installer using Wine
npm run installer:build:mac
```

### Using GitHub Actions (Automated)

1. Push your code to GitHub
2. Create a new tag: `git tag v1.0.0 && git push origin v1.0.0`
3. GitHub Actions will automatically build the installer
4. Download from the Releases page

## 📦 What Gets Bundled

The installer includes:

- ✅ **Node.js v22.12.0** (portable, no system installation needed)
- ✅ **All npm dependencies** (pre-installed)
- ✅ **Built Next.js app** (production-ready)
- ✅ **Desktop shortcut** (auto-created)
- ✅ **Start menu entry**
- ✅ **API key configuration wizard** (during installation)
- ✅ **Uninstaller**

## 🎨 Customization

### Add Your Icon

1. Create or download a `.ico` file (Windows icon format)
2. Place it at: `build/icon.ico`
3. Rebuild the installer

Convert PNG to ICO: https://convertio.co/png-ico/

### Change App Name/Version

Edit `installer.iss`:

```iss
#define MyAppName "Your App Name"
#define MyAppVersion "2.0.0"
#define MyAppPublisher "Your Company"
```

### Customize Installation Wizard

Edit the `[Code]` section in `installer.iss` to add custom pages, validation, or post-install scripts.

## 📝 Step-by-Step Build Process

### Manual Build (Understanding the Process)

```bash
# Step 1: Prepare files (downloads Node.js, creates dist folder)
npm run installer:prepare

# Step 2: Build Next.js app
npm run build

# Step 3: Install production dependencies
cd dist/app
npm install --production --legacy-peer-deps
cd ../..

# Step 4: Copy build output
cp -r .next dist/app/.next

# Step 5: Compile with Inno Setup
# Using Docker:
docker run --rm -v "$(pwd):/work" amake/innosetup installer.iss

# OR using Wine:
wine "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" installer.iss
```

## 🎯 Distribution

Once built, distribute the single `.exe` file:

1. **Upload to your website**
   ```html
   <a href="AIServices-Setup-1.0.0.exe">Download AI Services</a>
   ```

2. **GitHub Releases**
   - Create a release
   - Upload the `.exe` file
   - Users download directly

3. **Cloud Storage**
   - Upload to Google Drive, Dropbox, etc.
   - Share the download link

## 👥 User Installation Experience

When users download and run the `.exe`:

1. **Welcome screen** - Introduction
2. **License agreement** (optional)
3. **Installation directory** - Choose where to install
4. **API Configuration** - Enter API keys during setup
5. **Desktop shortcut** - Option to create shortcut
6. **Installation** - Automatic extraction and setup
7. **Launch** - Option to start app immediately

Total time: **~2 minutes** (vs 10+ minutes with manual setup)

## 🔧 Troubleshooting

### Docker build fails
```bash
# Make sure Docker is running
docker ps

# Try pulling the base image first
docker pull amake/innosetup:latest
```

### Wine installation issues
```bash
# Reinstall Wine
brew uninstall --cask wine-stable
brew install --cask wine-stable

# Initialize Wine
wine --version
```

### Missing icon error
```bash
# Create a placeholder icon
mkdir -p build
# Add your icon.ico file to build/
```

### Build files not found
```bash
# Make sure you've built the Next.js app first
npm run build

# Check if .next folder exists
ls -la .next
```

## 📊 File Sizes

- **Node.js portable**: ~50 MB
- **node_modules**: ~200-500 MB (varies by dependencies)
- **Built app**: ~10-50 MB
- **Final installer**: ~300-600 MB (compressed with LZMA2)

The installer is large but includes EVERYTHING needed to run.

## 🔄 Updating Your App

To release a new version:

1. Update version in `installer.iss`
2. Update version in `package.json`
3. Rebuild installer
4. Distribute new `.exe` file

Users can install over the old version or uninstall first.

## 🎓 Advanced: Inno Setup Features

The `installer.iss` script supports:

- **Custom pages** - Add configuration wizards
- **Registry entries** - Set Windows registry values
- **File associations** - Associate file types with your app
- **Services** - Install Windows services
- **Prerequisites** - Check for .NET, VC++ redistributables
- **Conditional installation** - Install different files based on Windows version
- **Silent installation** - `/SILENT` or `/VERYSILENT` flags
- **Custom actions** - Run scripts before/after installation

See [Inno Setup documentation](https://jrsoftware.org/ishelp/) for more.

## 📚 Files Created

- `installer.iss` - Inno Setup script (main configuration)
- `scripts/prepare-installer.js` - Downloads Node.js and prepares files
- `scripts/build-installer-mac.sh` - Build script for Mac (Wine)
- `scripts/build-installer-docker.sh` - Build script using Docker
- `.github/workflows/build-installer.yml` - GitHub Actions workflow
- `dist/` - Temporary build directory (gitignored)
- `installer-output/` - Final installer output (gitignored)

## 🎉 Success!

Your users can now:
1. Download one `.exe` file
2. Double-click to install
3. Enter API keys during setup
4. Launch from desktop shortcut
5. Start using the app immediately

No more manual setup, no more command line, no more confusion! 🚀
