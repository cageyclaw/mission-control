#!/usr/bin/env node
/**
 * Mission Control Proxy Server
 * 
 * Provides a REST endpoint for `openclaw status --json` since the WebSocket
 * requires operator.read scope that basic tokens don't have.
 * 
 * Run: node proxy-server.mjs
 * Endpoint: http://localhost:5181/api/status
 */

import { exec } from 'child_process';
import { createServer } from 'http';
import { promisify } from 'util';

const execAsync = promisify(exec);
const PORT = 5181;

const server = createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/api/status') {
    try {
      const { stdout } = await execAsync('openclaw status --json', { timeout: 10000 });
      res.writeHead(200);
      res.end(stdout);
    } catch (error) {
      console.error('[proxy] Error:', error.message);
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to fetch status' }));
    }
    return;
  }

  if (req.url === '/api/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`[Mission Control Proxy] Running on http://localhost:${PORT}`);
  console.log(`  Status endpoint: http://localhost:${PORT}/api/status`);
  console.log(`  Health endpoint: http://localhost:${PORT}/api/health`);
});
