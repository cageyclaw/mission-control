# OCC Security Hardening TODO

**Status:** Pre-production checklist  
**Target:** Before first production build  
**Last updated:** 2026-04-02

---

## P0 — Blockers for Production

### 1. Encrypt gateway token storage
**Current:** `settings.json` stores `gatewayToken` in plaintext  
**Risk:** File system access = full OpenClaw access  
**Fix:** Use system keychain
- macOS: Keychain Services
- Windows: DPAPI / Credential Manager
- Linux: Secret Service API / libsecret

**Files to modify:**
- `electron/main.mjs` — settings load/save
- `electron/services/settings-store.ts` — create if doesn't exist

**Acceptance:** Token not readable in `settings.json`; retrieval requires user session unlock

---

### 2. Sidecar authentication
**Current:** `system-metrics-server` endpoints are unauthenticated  
**Risk:** Any process/user on network can query system metrics  
**Fix:** Add token-based auth or switch to Unix domain socket

**Option A (token):**
- Generate random token on first sidecar start
- Store token in settings (encrypted per #1)
- Require `Authorization: Bearer <token>` header

**Option B (socket):**
- Bind to Unix socket: `/tmp/occ-metrics.sock`
- Electron main passes socket path to renderer
- No TCP port exposed

**Files to modify:**
- `system-metrics-server/server.mjs` — auth middleware or socket binding
- `electron/main.mjs` — pass credentials to renderer
- `src/stores/hostMetricsStore.ts` — include auth header or socket path

**Acceptance:** Unauthorized requests return 401; only OCC can query metrics

---

### 3. Sidecar bind address restriction
**Current:** Sidecar binds to `0.0.0.0` (all interfaces)  
**Risk:** Exposed to LAN, potentially internet if port forwarded  
**Fix:** Explicitly bind to `127.0.0.1`

**Files to modify:**
- `system-metrics-server/server.mjs` — `server.listen(port, '127.0.0.1')`

**Acceptance:** `netstat` shows `127.0.0.1:18790`, not `0.0.0.0:18790`

---

## P1 — Important Hardening

### 4. Settings file permissions
**Current:** `settings.json` created with default umask permissions  
**Risk:** Other users on same machine may read settings  
**Fix:** Explicit `chmod 600` (owner read/write only)

**Files to modify:**
- `electron/main.mjs` — after writeFile, `fs.chmod(path, 0o600)`

**Acceptance:** File permissions `-rw-------`

---

### 5. Audit logging
**Current:** No persistent log of security-relevant events  
**Risk:** Cannot detect/diagnose breaches or misuse  
**Fix:** Append-only audit log

**Events to log:**
- Settings changes (token updates, host/port changes)
- Session switches (especially to non-main sessions)
- Crew spawns via sidecar bridge
- Failed auth attempts (after #2 implemented)

**Log format:** JSON lines, timestamped, rotated
**Location:** `userData/audit.log` or system log (syslog/Event Log)

**Files to modify:**
- New: `electron/services/audit-log.mjs`
- `electron/main.mjs` — wire to IPC handlers
- `src/stores/sessionsStore.ts` — log session switches

**Acceptance:** Log file exists, entries for each event type, old logs rotated

---

### 6. Content Security Policy
**Current:** No CSP headers for renderer  
**Risk:** XSS if untrusted content loaded  
**Fix:** Add CSP meta tag or Electron `webSecurity` config

**Policy:**
```
default-src 'self';
connect-src 'self' ws://127.0.0.1:18789 http://127.0.0.1:18790;
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
```

**Files to modify:**
- `index.html` — CSP meta tag
- `electron/main.mjs` — `webSecurity: true` (already default, verify)

**Acceptance:** DevTools console shows no CSP violations during normal use

---

## P2 — Nice to Have

### 7. Automatic security updates
**Current:** No auto-update mechanism  
**Risk:** Users run vulnerable versions  
**Fix:** Electron auto-updater (electron-updater)

**Consider:** Code signing required for macOS auto-updates

---

### 8. Settings encryption at rest
**Current:** All settings plaintext except token (after #1)  
**Risk:** Session keys, preferences exposed  
**Fix:** Encrypt entire settings blob with OS keychain

**Note:** More complex than #1; may impact performance

---

## Pre-Production Sign-off

- [ ] P0 items complete and tested
- [ ] Security review completed
- [ ] No plaintext credentials in any user-accessible file
- [ ] Sidecar not reachable from network (verify with nmap from another host)
- [ ] Audit log capturing events

---

## Notes

- **Do not implement P2 until P0 complete**
- **Test on all target platforms** (macOS primary, Linux secondary, Windows future)
- **Document breaking changes** in release notes
