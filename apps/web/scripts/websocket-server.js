#!/usr/bin/env node

/**
 * WebSocket server for Yjs collaboration
 * Run with: node scripts/websocket-server.js
 *
 * For development only. In production, use AWS API Gateway WebSocket.
 */

const WebSocket = require('ws');
const http = require('http');
const Y = require('yjs');
const { setupWSConnection, setPersistence } = require('y-websocket/bin/utils');

const PORT = process.env.WEBSOCKET_PORT || 1234;

const server = http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/plain' });
  response.end('RédacNews WebSocket Server\n');
});

const wss = new WebSocket.Server({ server });

// In-memory persistence (for development only)
const docs = new Map();

const getPersistence = () => ({
  provider: 'memory',
  bindState: async (docName, ydoc) => {
    const persistedYdoc = docs.get(docName);
    if (persistedYdoc) {
      Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(persistedYdoc));
    }
    ydoc.on('update', () => {
      docs.set(docName, ydoc);
    });
  },
  writeState: async (docName, ydoc) => {
    docs.set(docName, ydoc);
  }
});

setPersistence(getPersistence());

wss.on('connection', (ws, req) => {
  console.log(`[${new Date().toISOString()}] New connection from ${req.socket.remoteAddress}`);

  setupWSConnection(ws, req, {
    docName: req.url.slice(1).split('?')[0], // Get document name from URL
  });

  ws.on('close', () => {
    console.log(`[${new Date().toISOString()}] Connection closed`);
  });
});

server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════════════╗
║                                                                      ║
║   RédacNews WebSocket Server for Yjs Collaboration                   ║
║                                                                      ║
║   Running on: ws://localhost:${PORT}                                   ║
║                                                                      ║
║   This server is for local development only.                         ║
║   In production, use AWS API Gateway WebSocket.                      ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down WebSocket server...');
  wss.close();
  server.close();
  process.exit(0);
});
