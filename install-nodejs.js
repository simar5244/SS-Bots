#!/usr/bin/env node

/**
 * Node.js Auto-Installer
 * Downloads and installs Node.js automatically
 * Works on Windows, Mac, and Linux
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, exec } = require('child_process');

console.log('🔧 Node.js Auto-Installer\n');

// Detect operating system
function detectOS() {
    const platform = os.platform();
    const arch = os.arch();
    
    if (platform === 'win32') {
        return {
            platform: 'win',
            arch: arch === 'x64' ? 'x64' : 'x86',
            extension: '.msi',
            execCmd: 'msiexec'
        };
    } else if (platform === 'darwin') {
        return {
            platform: 'darwin',
            arch: arch === 'arm64' ? 'arm64' : 'x64',
            extension: '.pkg',
            execCmd: 'installer'
        };
    } else if (platform === 'linux') {
        return {
            platform: 'linux',
            arch: arch === 'x64' ? 'x64' : 'arm64',
            extension: '.tar.xz',
            execCmd: 'tar'
        };
    } else {
        throw new Error(`Unsupported platform: ${platform}`);
    }
}

// Get latest Node.js LTS version
async function getLatestLTSVersion() {
    return new Promise((resolve, reject) => {
        console.log('📋 Checking latest Node.js LTS version...');
        
        const options = {
            hostname: 'nodejs.org',
            path: '/dist/index.json',
            method: 'GET'
        };
        
        const req = https.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const releases = JSON.parse(data);
                    const ltsRelease = releases.find(r => r.lts && r.version.includes('v20'));
                    resolve(ltsRelease.version);
                } catch (err) {
                    reject(err);
                }
            });
        });
        
        req.on('error', reject);
        req.end();
    });
}

// Download file
function downloadFile(url, destination) {
    return new Promise((resolve, reject) => {
        console.log(`📥 Downloading: ${path.basename(destination)}`);
        
        const file = fs.createWriteStream(destination);
        
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Download failed: ${response.statusCode}`));
                return;
            }
            
            const totalSize = parseInt(response.headers['content-length'], 10);
            let downloadedSize = 0;
            
            response.on('data', (chunk) => {
                downloadedSize += chunk.length;
                const progress = Math.round((downloadedSize / totalSize) * 100);
                process.stdout.write(`\r📊 Progress: ${progress}%`);
            });
            
            response.pipe(file);
            
            file.on('finish', () => {
                file.close();
                console.log('\n✅ Download complete!');
                resolve();
            });
            
        }).on('error', (err) => {
            fs.unlink(destination, () => {}); // Delete partial file
            reject(err);
        });
    });
}

// Install Node.js on Windows
async function installWindows(installerPath) {
    return new Promise((resolve, reject) => {
        console.log('🔧 Installing Node.js on Windows...');
        
        const installer = spawn('msiexec', [
            '/i', installerPath,
            '/quiet', 
            '/norestart'
        ]);
        
        installer.on('close', (code) => {
            if (code === 0) {
                console.log('✅ Node.js installed successfully!');
                resolve();
            } else {
                reject(new Error(`Installation failed with code: ${code}`));
            }
        });
        
        installer.on('error', reject);
    });
}

// Install Node.js on macOS
async function installMacOS(installerPath) {
    return new Promise((resolve, reject) => {
        console.log('🔧 Installing Node.js on macOS...');
        
        const installer = spawn('sudo', [
            'installer',
            '-pkg', installerPath,
            '-target', '/'
        ]);
        
        installer.on('close', (code) => {
            if (code === 0) {
                console.log('✅ Node.js installed successfully!');
                resolve();
            } else {
                reject(new Error(`Installation failed with code: ${code}`));
            }
        });
        
        installer.on('error', reject);
    });
}

// Install Node.js on Linux
async function installLinux(archivePath) {
    return new Promise((resolve, reject) => {
        console.log('🔧 Installing Node.js on Linux...');
        
        const extractPath = path.join(os.tmpdir(), 'nodejs-extract');
        
        // Extract archive
        const extract = spawn('tar', [
            '-xf', archivePath,
            '-C', extractPath
        ]);
        
        extract.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`Extraction failed with code: ${code}`));
                return;
            }
            
            // Find the extracted directory
            const files = fs.readdirSync(extractPath);
            const nodeDir = files.find(f => f.startsWith('node-'));
            
            if (!nodeDir) {
                reject(new Error('Could not find Node.js directory'));
                return;
            }
            
            const nodePath = path.join(extractPath, nodeDir, 'bin');
            
            // Add to PATH
            console.log('🔧 Adding Node.js to PATH...');
            
            const bashrc = path.join(os.homedir(), '.bashrc');
            const zshrc = path.join(os.homedir(), '.zshrc');
            
            const pathLine = `export PATH="${nodePath}:$PATH"`;
            
            // Update .bashrc
            if (fs.existsSync(bashrc)) {
                fs.appendFileSync(bashrc, `\n# Node.js\n${pathLine}\n`);
            }
            
            // Update .zshrc
            if (fs.existsSync(zshrc)) {
                fs.appendFileSync(zshrc, `\n# Node.js\n${pathLine}\n`);
            }
            
            console.log('✅ Node.js installed successfully!');
            console.log('⚠️  Please restart your terminal or run: source ~/.bashrc');
            
            resolve();
        });
        
        extract.on('error', reject);
    });
}

// Check if Node.js is already installed
function checkNodeJS() {
    return new Promise((resolve) => {
        exec('node --version', (error, stdout) => {
            if (error) {
                resolve(false);
            } else {
                console.log(`✅ Node.js is already installed: ${stdout.trim()}`);
                resolve(true);
            }
        });
    });
}

// Main installation function
async function installNodeJS() {
    try {
        // Check if already installed
        const isInstalled = await checkNodeJS();
        if (isInstalled) {
            console.log('\n🎉 Node.js is already installed!');
            return;
        }
        
        // Detect OS
        const osInfo = detectOS();
        console.log(`🖥️  Detected OS: ${osInfo.platform} (${osInfo.arch})`);
        
        // Get latest LTS version
        const version = await getLatestLTSVersion();
        console.log(`📦 Latest LTS version: ${version}`);
        
        // Construct download URL
        const filename = `node-${version}-${osInfo.platform}-${osInfo.arch}${osInfo.extension}`;
        const downloadUrl = `https://nodejs.org/dist/${version}/${filename}`;
        
        // Create temp directory
        const tempDir = os.tmpdir();
        const installerPath = path.join(tempDir, filename);
        
        // Download
        await downloadFile(downloadUrl, installerPath);
        
        // Install based on OS
        switch (osInfo.platform) {
            case 'win':
                await installWindows(installerPath);
                break;
            case 'darwin':
                await installMacOS(installerPath);
                break;
            case 'linux':
                await installLinux(installerPath);
                break;
        }
        
        // Clean up
        try {
            fs.unlinkSync(installerPath);
        } catch (err) {
            // Ignore cleanup errors
        }
        
        console.log('\n🎉 Installation complete!');
        console.log('⚠️  Please restart your terminal/command prompt');
        console.log('🔍 Verify with: node --version');
        
    } catch (error) {
        console.error('\n❌ Installation failed:', error.message);
        console.log('\n🔧 Manual installation:');
        console.log('1. Go to https://nodejs.org/');
        console.log('2. Download the LTS version');
        console.log('3. Run the installer');
        process.exit(1);
    }
}

// Run installer
if (require.main === module) {
    installNodeJS();
}

module.exports = { installNodeJS, detectOS, getLatestLTSVersion };
