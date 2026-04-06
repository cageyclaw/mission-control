# Mission Control (OCC)

OpenClaw Command Center web/Electron UI.

## Backend redesign freeze notice (Phase 0)

This repo is in OCC backend redesign mode.

- New feature work on current proxy-based backend plumbing is **frozen**.
- Current proxy/chat/session/status hybrid plumbing should be treated as **legacy**.
- See docs:
  - `docs/occ-phase0-freeze-legacy-note.md`
  - `docs/occ-phase0-baseline-snapshot.md`
  - `docs/occ-openclaw-ui-reference-paths.md`
  - `docs/occ-backend-architecture-baseline.md`

## Auto-starting the chat proxy

The chat UI needs `proxy-server.mjs` running (port `5181`).

### Dev / Vite

Use the new wrapper scripts so proxy + Vite start together:

```bash
npm run dev:with-proxy
# or
npm run preview:with-proxy
```

What this does:
- starts `proxy-server.mjs` if it is not already healthy
- starts Vite (`dev` or `preview`)
- shuts down spawned proxy when Vite exits

> Existing scripts (`npm run dev`, `npm run preview`) still work, but they do **not** auto-start the proxy.

### Production service (systemd)

A systemd unit template is included at:

`systemd/openclaw-occ-proxy.service`

Example one-time setup (Linux host):

```bash
sudo cp systemd/openclaw-occ-proxy.service /etc/systemd/system/openclaw-occ-proxy@.service
sudo systemctl daemon-reload
sudo systemctl enable --now openclaw-occ-proxy@<linux-user>
sudo systemctl status openclaw-occ-proxy@<linux-user>
```

Before enabling, edit the unit file paths if needed:
- `WorkingDirectory=/opt/mission-control`
- `ExecStart=/usr/bin/node /opt/mission-control/proxy-server.mjs`

## Quick verification

After startup, confirm proxy is live:

```bash
curl -s http://127.0.0.1:5181/api/health
```

Expected: JSON health response and OCC chat status no longer stuck on `Proxy: Connecting`.
