# OCC Linux Standalone Packaging Checklist

Complete feature checklist for building OCC as a packaged, sellable Linux desktop application.

---

## Installer & Onboarding
- [ ] Bridge Crew onboarding wizard → creates crew-config.json
- [ ] Connection settings (gateway token, host, port, protocol)
- [ ] First launch verification (gateway connection, sidecar test, crew config validation)
- [ ] Desktop entry creation (.desktop file with icon)
- [ ] Optional: Add to PATH for CLI launch

## Distribution & Packaging
- [ ] **AppImage** (universal, portable, works everywhere)
- [ ] **deb** package (Ubuntu/Debian primary)
- [ ] **rpm** package (Fedora/RHEL/CentOS)
- [ ] Package metadata: maintainer, description, license, homepage URL
- [ ] AppStream metadata (for software centers)
- [ ] GPG sign packages (optional but recommended)
- [ ] Manual updates via package manager

## Auto-Start & Resilience
- [ ] Auto-start OCC on user login (systemd user service or XDG autostart)
- [ ] Auto-start sidecar when OCC launches
- [ ] Auto-restart sidecar if it crashes/stops (watchdog)
- [ ] Auto-restart OCC if it crashes (with exponential backoff)
- [ ] Single instance enforcement (prevent multiple windows)
- [ ] Graceful shutdown handling (save state, close connections, stop sidecar)

## User Experience
- [ ] Zero manual server/sidecar management
- [ ] System tray icon with status indicator
- [ ] Show/hide window via tray (close minimizes to tray)
- [ ] Right-click tray menu: Show/Hide, Settings, Logs, Quit
- [ ] Native notifications (Linux desktop notifications)
- [ ] Keyboard shortcuts (Ctrl+Shift+O to show/hide)

## Security & Sandboxing
- [ ] Verify sidecar binds only to localhost (not 0.0.0.0)
- [ ] Remove proxy spawn/wait legacy code
- [ ] No credentials in plaintext in packaged app
- [ ] XDG directory compliance (config in ~/.config, data in ~/.local/share)
- [ ] No write access outside user directories

## Configuration & Data
- [ ] XDG Base Directory compliance
  - Config: `~/.config/occ/`
  - Data: `~/.local/share/occ/`
  - Logs: `~/.local/state/occ/` or `~/.cache/occ/`
- [ ] Migration path for existing crew-config.json
- [ ] Backup/restore settings
- [ ] Clear all data option

## Logging & Debugging
- [ ] Structured logs to file (rotated, not spamming)
- [ ] Log viewer in app (Settings → Logs)
- [ ] Export logs for support
- [ ] Debug mode flag (`occ --debug`)
- [ ] Sidecar logs accessible from main app

## Licensing & Commercial
- [ ] License key validation (if paid)
- [ ] Trial mode support (if applicable)
- [ ] Deactivation/unbind device
- [ ] Clean uninstall removes all data (optional: keep settings)

## Testing & QA
- [ ] Test on Ubuntu LTS (primary)
- [ ] Test on Fedora (secondary)
- [ ] Test on Arch (community)
- [ ] Test AppImage on clean VM
- [ ] Verify sidecar starts without Node installed
- [ ] Verify auto-start survives reboot
- [ ] Verify single instance enforcement
- [ ] Verify graceful shutdown
- [ ] Test uninstall removes desktop entry

## Documentation
- [ ] Install instructions per distro
- [ ] Troubleshooting guide
- [ ] FAQ for common issues
- [ ] Support contact info

---

## Priority Order

1. **AppImage** first (universal, works everywhere)
2. **deb** (Ubuntu/Debian primary)
3. **rpm** (Fedora/RHEL)

## Blockers from Riker's Audit

- [ ] Fix Vite build to use relative paths (`./assets/...` not `/assets/...`)
- [ ] Fix crew-config.json loading for packaged Electron
- [ ] Remove legacy proxy startup code

## References

- [Guide to Distributing Electron Apps For Linux](https://www.beekeeperstudio.io/blog/distribute-electron-apps-for-linux)
- [Electron Builder Linux Docs](https://www.electron.build/index.html)
- [XDG Base Directory Specification](https://specifications.freedesktop.org/basedir-spec/basedir-spec-latest.html)
- [AppImage Best Practices](https://discourse.appimage.org/t/best-practice-for-appimage-distribution/314)

---

*Created: 2026-04-03*
*Status: Planning Phase*
