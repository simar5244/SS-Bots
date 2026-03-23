const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;
let nextServer;
const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
  process.exit(0);
}

function startNextServer() {
  return new Promise((resolve, reject) => {
    const isDev = !app.isPackaged;
    
    // For packaged apps, use app.getAppPath() which points to app.asar
    // But we need the unpacked directory for node_modules
    let appPath;
    if (isDev) {
      appPath = path.join(__dirname, '..');
    } else {
      // In packaged mode, app.getAppPath() returns path to app.asar
      // We need to use app.asar.unpacked for node_modules
      const asarPath = app.getAppPath();
      appPath = asarPath.replace('app.asar', 'app.asar.unpacked');
    }
    
    // In packaged mode, run bundled Electron executable in Node mode
    const nodeExecutable = isDev ? 'npm' : process.execPath;
    const nextBin = path.join(appPath, 'node_modules', 'next', 'dist', 'bin', 'next');
    const args = isDev ? ['start'] : [nextBin, 'start', '-p', '3000'];

    if (!isDev && !fs.existsSync(nextBin)) {
      reject(new Error(`Next.js executable not found: ${nextBin}`));
      return;
    }
    
    console.log('Starting Next.js server...');
    console.log('isDev:', isDev);
    console.log('App path:', appPath);
    console.log('Node executable:', nodeExecutable);
    console.log('Next bin:', nextBin);
    console.log('Next bin exists:', fs.existsSync(nextBin));
    console.log('Args:', args);
    
    nextServer = spawn(nodeExecutable, args, {
      cwd: appPath,
      shell: isDev,
      windowsHide: true,
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: '3000',
        ...(isDev ? {} : { ELECTRON_RUN_AS_NODE: '1' })
      }
    });
    
    let resolved = false;
    
    nextServer.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`Next.js: ${output}`);
      // Next.js production server starts with "Ready" message
      if (!resolved && (output.includes('Local:') || output.includes('Ready') || output.includes('started server'))) {
        resolved = true;
        resolve();
      }
    });
    
    nextServer.stderr.on('data', (data) => {
      const error = data.toString();
      console.error(`Next.js Error: ${error}`);
      // If port is busy, reject to show error
      if (error.includes('EADDRINUSE') || error.includes('port') && error.includes('already')) {
        if (!resolved) {
          resolved = true;
          reject(new Error('Port 3000 is already in use. Please close any other instances.'));
        }
      }
    });
    
    nextServer.on('error', (error) => {
      console.error('Failed to start Next.js server:', error);
      if (!resolved) {
        resolved = true;
        reject(error);
      }
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    autoHideMenuBar: true, // Hide menu bar (File, Edit, View, etc.)
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Remove menu bar completely
  mainWindow.setMenuBarVisibility(false);

  mainWindow.loadURL('http://localhost:3000');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    await startNextServer();
    
    setTimeout(() => {
      createWindow();
    }, 2000);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  } catch (error) {
    console.error('Failed to start application:', error);
    const { dialog } = require('electron');
    dialog.showErrorBox(
      'Failed to Start',
      error.message || 'Could not start the application server. Please make sure no other instance is running and try again.'
    );
    app.quit();
  }
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

function killNextServer() {
  if (nextServer) {
    console.log('Killing Next.js server...');
    // Kill the entire process tree on Windows
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', nextServer.pid, '/f', '/t'], { shell: true });
    } else {
      nextServer.kill('SIGTERM');
    }
    nextServer = null;
  }
}

app.on('window-all-closed', () => {
  killNextServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', (event) => {
  killNextServer();
});

app.on('will-quit', () => {
  killNextServer();
});
