const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let nextServer;

function startNextServer() {
  return new Promise((resolve, reject) => {
    // Use npm start for production with completely hidden process
    nextServer = spawn('npm', ['start'], {
      cwd: path.join(__dirname, '..'),
      shell: true,
      windowsHide: true, // Hide console window on Windows
      detached: false, // Keep attached to parent but hidden
      stdio: ['ignore', 'pipe', 'pipe'], // Redirect output to prevent console
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
