# GitHub Setup Instructions

Your local repository is ready! To enable GitHub Actions to build the installer automatically, follow these steps:

## Step 1: Create GitHub Repository

1. Go to https://github.com/new
2. Create a new repository (name it whatever you want, e.g., "ss-bots")
3. **Do NOT initialize with README** (we already have files)
4. Click "Create repository"

## Step 2: Connect Local Repository to GitHub

Copy the commands GitHub shows you, or use these (replace YOUR_USERNAME and YOUR_REPO):

```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

## Step 3: Trigger Installer Build

Once pushed, create a release tag to trigger the GitHub Actions workflow:

```bash
git tag v1.0.0
git push origin v1.0.0
```

## Step 4: Download Installer

1. Go to your GitHub repository
2. Click "Actions" tab
3. Wait for the build to complete (~5-10 minutes)
4. Go to "Releases" tab
5. Download `SSBots-Setup-1.0.0.exe`

---

## What Happens Automatically

When you push a tag (e.g., `v1.0.0`), GitHub Actions will:

1. ✅ Checkout your code
2. ✅ Install Node.js and dependencies
3. ✅ Download portable Node.js for Windows
4. ✅ Build your Next.js app
5. ✅ Install production dependencies
6. ✅ Install Inno Setup on Windows runner
7. ✅ Compile the installer
8. ✅ Create a GitHub Release
9. ✅ Upload the `.exe` file to the release

Total time: ~5-10 minutes

---

## Manual Build (Without GitHub)

If you prefer to build locally on Mac:

```bash
# Using Docker (recommended)
npm run installer:build:docker

# Using Wine
npm run installer:build:mac
```

---

## Next Steps

After you've set up GitHub and pushed your code, just provide me with:
- Your GitHub username
- Your repository name

And I can help you push and create the first release!
