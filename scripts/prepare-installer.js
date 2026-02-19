#!/usr/bin/env node

/**
 * Prepare Windows Installer
 * This script prepares all files needed for the Inno Setup installer
 * Can be run on Mac/Linux/Windows
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const NODE_VERSION = '22.12.0';
const NODE_URL = `https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-win-x64.zip`;
const DIST_DIR = path.join(__dirname, '..', 'dist');
const NODE_PORTABLE_DIR = path.join(DIST_DIR, 'node-portable');
const APP_DIR = path.join(DIST_DIR, 'app');

async function main() {
  console.log('========================================');
  console.log('Preparing Windows Installer Files');
  console.log('========================================\n');

  // Step 1: Create dist directory
  console.log('[1/6] Creating dist directory...');
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(DIST_DIR, { recursive: true });
  fs.mkdirSync(APP_DIR, { recursive: true });
  console.log('✓ Done\n');

  // Step 2: Download Node.js portable
  console.log('[2/6] Downloading Node.js portable...');
  const nodeZipPath = path.join(DIST_DIR, `node-v${NODE_VERSION}-win-x64.zip`);

  if (!fs.existsSync(nodeZipPath)) {
    console.log(`Downloading from ${NODE_URL}...`);
    await downloadFile(NODE_URL, nodeZipPath);
    console.log('✓ Download complete\n');
  } else {
    console.log('✓ Already downloaded\n');
  }

  // Step 3: Extract Node.js
  console.log('[3/6] Extracting Node.js...');
  if (!fs.existsSync(NODE_PORTABLE_DIR)) {
    try {
      // Verify zip file exists before extraction
      if (!fs.existsSync(nodeZipPath)) {
        throw new Error(`Node.js zip file not found at ${nodeZipPath}`);
      }
      
      const stats = fs.statSync(nodeZipPath);
      console.log(`  Zip file size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      
      // Use unzip on Mac/Linux, or PowerShell on Windows
      if (process.platform === 'win32') {
        execSync(`powershell -Command "Expand-Archive -Path '${nodeZipPath}' -DestinationPath '${DIST_DIR}' -Force"`, { stdio: 'inherit' });
      } else {
        execSync(`unzip -q "${nodeZipPath}" -d "${DIST_DIR}"`, { stdio: 'inherit' });
      }
      
      // Rename extracted folder
      const extractedDir = path.join(DIST_DIR, `node-v${NODE_VERSION}-win-x64`);
      fs.renameSync(extractedDir, NODE_PORTABLE_DIR);
      console.log('✓ Extracted successfully\n');
    } catch (error) {
      console.error('Error extracting Node.js:', error.message);
      process.exit(1);
    }
  } else {
    console.log('✓ Already extracted\n');
  }

  // Step 4: Copy application files
  console.log('[4/6] Copying application files...');
  const filesToCopy = [
    'app',
    'components',
    'lib',
    'models',
    'types',
    'middleware.ts',
    'next-env.d.ts',
    'public',
    'backend',
    'electron',
    'scripts',
    'test'
  ];

  filesToCopy.forEach(file => {
    const src = path.join(__dirname, '..', file);
    const dest = path.join(APP_DIR, file);
    
    if (fs.existsSync(src)) {
      copyRecursive(src, dest);
      console.log(`  ✓ Copied ${file}`);
    }
  });
  console.log('✓ Application files copied\n');

  // Step 5: Create START_APP.bat and VBS launcher
  console.log('[5/6] Creating launcher scripts...');
  
  // Main batch script (hidden by VBS)
  const launcherScript = `@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "NODE_DIR=%SCRIPT_DIR%node-portable"
set "PATH=%NODE_DIR%;%PATH%"

cd /d "%SCRIPT_DIR%"

:: Check if .env exists, if not copy from example
if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul 2>&1
    )
)

:: Start the Electron app
start "" "%SCRIPT_DIR%\\node_modules\\electron\\dist\\electron.exe" "%SCRIPT_DIR%"
`;

  fs.writeFileSync(path.join(DIST_DIR, 'START_APP.bat'), launcherScript);
  
  // VBS script to run batch file hidden
  const vbsScript = `Set WshShell = CreateObject("WScript.Shell")
WshShell.Run chr(34) & WScript.Arguments(0) & chr(34), 0
Set WshShell = Nothing
`;
  
  fs.writeFileSync(path.join(DIST_DIR, 'START_APP_HIDDEN.vbs'), vbsScript);
  console.log('✓ Launcher scripts created\n');

  // Step 6: Create icon if it doesn't exist
  console.log('[6/6] Checking icon file...');
  const iconDir = path.join(__dirname, '..', 'build');
  const iconPath = path.join(iconDir, 'icon.ico');

  if (!fs.existsSync(iconDir)) {
    fs.mkdirSync(iconDir, { recursive: true });
  }

  if (!fs.existsSync(iconPath)) {
    console.log('⚠ Warning: icon.ico not found. Please add an icon file at build/icon.ico');
    console.log('  You can convert a PNG to ICO using online tools like convertio.co\n');
  } else {
    console.log('✓ Icon file found\n');
  }

  console.log('========================================');
  console.log('SUCCESS!');
  console.log('========================================\n');
  console.log('Files prepared in ./dist directory\n');
  console.log('Next steps:');
  console.log('1. Build your Next.js app: npm run build');
  console.log('2. Install dependencies: npm install --production');
  console.log('3. Install Inno Setup on Windows (or use Wine on Mac/Linux)');
  console.log('4. Compile installer.iss with Inno Setup');
  console.log('5. Find installer in ./installer-output directory\n');
}

// Run main function
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

// Helper functions
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        downloadFile(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      
      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloaded = 0;
      
      response.on('data', (chunk) => {
        downloaded += chunk.length;
        const percent = ((downloaded / totalSize) * 100).toFixed(1);
        process.stdout.write(`\r  Progress: ${percent}% (${(downloaded / 1024 / 1024).toFixed(1)} MB / ${(totalSize / 1024 / 1024).toFixed(1)} MB)`);
      });
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log('');
        resolve();
      });
    }).on('error', (err) => {
      fs.unlinkSync(dest);
      reject(err);
    });
  });
}

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    
    const files = fs.readdirSync(src);
    files.forEach(file => {
      // Skip node_modules and .next during copy (we'll handle them separately)
      if (file === 'node_modules' || file === '.next' || file === 'dist') {
        return;
      }
      copyRecursive(path.join(src, file), path.join(dest, file));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}
