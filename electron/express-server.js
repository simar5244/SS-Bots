const express = require('express');
const path = require('path');
const fs = require('fs');

let server = null;

function startExpressServer() {
  const app = express();
  
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Mount API routes from Next.js app
  const apiPath = path.join(__dirname, '../app/api');
  
  // Simple health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', electron: true });
  });

  // Start server
  const PORT = 3001;
  server = app.listen(PORT, () => {
    console.log(`Express server running on http://localhost:${PORT}`);
  });

  return server;
}

function stopExpressServer() {
  if (server) {
    server.close();
    server = null;
  }
}

module.exports = { startExpressServer, stopExpressServer };
