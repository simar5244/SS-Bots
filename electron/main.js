const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let nextServer;

function startNextServer() {
  return new Promise((resolve) => {
    // Use npm start for production with completely hidden process
    nextServer = spawn('npm', ['start'], {
      cwd: path.join(__dirname, '..'),
      shell: true,
      windowsHide: true, // Hide console window on Windows
      detached: false, // Keep attached to parent but hidden
      stdio: ['ignore', 'pipe', 'pipe'], // Redirect output to prevent console
    });
    
    nextServer.stdout.on('data', (data) => {
      const output = data.toString();
      // Next.js production server starts with "Ready" message
      if (output.includes('Local:') || output.includes('Ready') || output.includes('started server')) {
        resolve();
      }
    });
    
    nextServer.stderr.on('data', (data) => {
      // Silently handle errors - don't show console
      const error = data.toString();
      if (error.includes('Error')) {
        console.error(`Next.js Error: ${error}`);
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
  await startNextServer();
  
  setTimeout(() => {
    createWindow();
  }, 2000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (nextServer) {
    nextServer.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (nextServer) {
    nextServer.kill();
  }
});
