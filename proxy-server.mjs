#!/usr/bin/env node
/**
 * Mission Control Proxy Server
 * 
 * Provides REST endpoints for OpenClaw data since WebSocket requires
 * operator.read scope that basic tokens don't have.
 * 
 * Endpoints:
 *   GET /api/status       - OpenClaw status --json
 *   GET /api/subagents    - Recent subagent runs from runs.json
 *   GET /api/health       - Health check
 * 
 * Run: node proxy-server.mjs
 */

import { exec } from 'child_process';
import { createServer } from 'http';
import { promisify } from 'util';
import { readFile, watch } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const execAsync = promisify(exec);
const PORT = 5181;

// Path to OpenClaw config
const OPENCLAW_DIR = process.env.HOME + '/.openclaw';
const RUNS_FILE = path.join(OPENCLAW_DIR, 'subagents', 'runs.json');

// Cache for subagent runs
let cachedRuns = { runs: [], lastUpdate: 0 };

/**
 * Parse runs.json and return recent subagent activity
 */
async function fetchSubagentRuns() {
  try {
    if (!existsSync(RUNS_FILE)) {
      return { runs: [], error: 'runs.json not found' };
    }

    const content = await readFile(RUNS_FILE, 'utf8');
    const data = JSON.parse(content);

    if (!data.runs) {
      return { runs: [], error: 'No runs found' };
    }

    // Convert runs object to array and sort by creation time (descending)
    const runs = Object.values(data.runs)
      .filter(run => run.childSessionKey && run.childSessionKey.includes('subagent'))
      .map(run => ({
        runId: run.runId,
        sessionKey: run.childSessionKey,
        sessionId: run.childSessionKey.split(':').pop(),
        label: run.label,
        model: run.model,
        task: run.task,
        status: run.endedAt ? (run.outcome?.status === 'ok' ? 'completed' : 'error') : 'running',
        createdAt: run.createdAt,
        startedAt: run.startedAt,
        endedAt: run.endedAt,
        durationMs: run.endedAt ? run.endedAt - run.startedAt : null,
        // Extract crew from task or label
        crewId: inferCrewFromRun(run),
      }))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 50); // Keep last 50 runs

    return { runs, count: runs.length, updatedAt: Date.now() };
  } catch (error) {
    console.error('[proxy] Error reading runs:', error.message);
    return { runs: [], error: error.message };
  }
}

/**
 * Infer crew member from run data
 */
function inferCrewFromRun(run) {
  // Check label first (explicit crew name)
  const label = run.label?.toLowerCase();
  if (label) {
    const knownCrew = ['q', 'data', 'geordi', 'spark', 'riker', 'troi', 'barclay'];
    if (knownCrew.includes(label)) return label;
  }

  // Try to infer from task
  const task = run.task?.toLowerCase() || '';
  const patterns = [
    [/\b(research|investigate|find|search|analyze data|study)\b/i, 'data'],
    [/\b(code|implement|build|develop|fix bug|refactor|program)\b/i, 'geordi'],
    [/\b(quick|fast|simple|one-liner|rapid|short)\b/i, 'spark'],
    [/\b(review|audit|qa|check|verify|test|plan|assess)\b/i, 'riker'],
    [/\b(market|write|content|blog|social|copy|promote)\b/i, 'troi'],
    [/\b(art|design|ux|ui|paint|draw|sketch|image|visual)\b/i, 'barclay'],
  ];

  for (const [pattern, crewId] of patterns) {
    if (pattern.test(task)) return crewId;
  }

  return 'unknown';
}

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
      // Suppress stderr warnings (plugin messages) by redirecting to /dev/null
      const { stdout, stderr } = await execAsync(
        'openclaw status --json 2>/dev/null',
        { timeout: 10000, shell: '/bin/bash' }
      );
      
      // Parse to validate JSON
      const status = JSON.parse(stdout);
      res.writeHead(200);
      res.end(JSON.stringify(status));
    } catch (error) {
      console.error('[proxy] Error:', error.message);
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to fetch status', details: error.message }));
    }
    return;
  }

  if (req.url === '/api/subagents') {
    // Return cached or fresh data
    const data = await fetchSubagentRuns();
    res.writeHead(200);
    res.end(JSON.stringify(data));
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
  console.log(`  Subagents endpoint: http://localhost:${PORT}/api/subagents`);
  console.log(`  Health endpoint: http://localhost:${PORT}/api/health`);
});

// Start watching runs.json for changes
async function watchRunsFile() {
  if (!existsSync(RUNS_FILE)) {
    console.log('[proxy] runs.json not found, skipping file watcher');
    return;
  }

  console.log('[proxy] Watching runs.json for changes...');
  
  const watcher = watch(RUNS_FILE);
  for await (const event of watcher) {
    if (event.eventType === 'change') {
      console.log('[proxy] runs.json changed, refreshing cache...');
      cachedRuns = await fetchSubagentRuns();
    }
  }
}

// Start file watcher
watchRunsFile().catch(err => {
  console.error('[proxy] File watcher error:', err.message);
});
