# Riker Review Notes — OCC Mission Control Technical Manual

## Summary of changes made
- Rewrote the manual to match the current codebase instead of the older proxy-era mental model.
- Corrected the Phase 7 architecture description: OCC now uses the native gateway WebSocket client directly; the proxy is removed and only survives as a stub plus some legacy Electron startup scaffolding.
- Corrected the metrics sidecar source path. The live dev source is `/Users/maccagey/.openclaw/workspace/system-metrics-server/server.mjs`, not `projects/mission-control/system-metrics-server/server.mjs`.
- Documented the actual Electron preload API surface and BrowserWindow security settings.
- Replaced vague store descriptions with precise responsibilities for `sessionsStore`, `crewRegistryStore`, `chatStore`, `toolStore`, `systemStore`, `hostMetricsStore`, `activityFeedStore`, and the legacy `gateway.ts` compatibility layer.
- Tightened session-to-crew attribution rules to reflect real lookup order and failure behavior.
- Documented the actual chat session switcher data flow, including how store changes drive transcript reset and history reload.
- Clarified what is and is not secure, including plaintext credential storage and the unauthenticated sidecar.
- Expanded troubleshooting with concrete checks tied to the current implementation.

## Ambiguities resolved

### 1. Phase 7 architecture
Resolved:
- `proxy-server.mjs` is not an active server. It is a stub that exits with an error.
- OCC’s real backend path is renderer → native gateway client → OpenClaw Gateway.
- The metrics sidecar remains real and is still used for host metrics and spawn bridge polling.
- Electron main still contains legacy proxy startup and wait logic, but that is dead compatibility baggage.

### 2. Session → crew attribution
Resolved:
- Q is mapped via the configured `isMainSession` crew member and non-subagent main-session key matching.
- Subagents are attributed first through `crewRegistryStore` registrations.
- If no registration exists, subagents can still be auto-registered only when `parentSessionKey` exists and `session.label` exactly matches a crew id or crew name after normalization.
- Unknown subagents are intentionally left unattributed.

### 3. Chat session switcher flow
Resolved:
- The selector writes to `sessionsStore.selectSession()`.
- `chatStore` subscribes to `selectedSessionKey ?? mainSessionKey` and performs the actual session switch.
- Switching is complete only when `chatStore.sessionKey` matches the selected key.
- History reload is token-guarded to avoid stale async state overwriting the active transcript.

### 4. Store boundaries
Resolved:
- `sessionsStore` is the authoritative renderer session model.
- `crewRegistryStore` owns explicit crew/session registration and spawn bridge state.
- `chatStore` owns active session transcript and stream state, but derives the selected session from `sessionsStore`.
- `toolStore` tracks tool activity per chat session using gateway events.
- `systemStore` is gateway health/status only.
- `hostMetricsStore` is host CPU/memory/disk only.
- `activityFeedStore` is projection-only.
- `gateway.ts` still exists, but it is effectively a compatibility/UI aggregation layer, not the best source of truth for current Phase 7 session behavior.

### 5. Security wording
Resolved:
- `settings.json` should be described as plaintext-sensitive, not merely “sensitive.”
- The sidecar should not be described as loopback-only, because the code does not explicitly bind it to `127.0.0.1`.
- Sidecar endpoints are unauthenticated and CORS-permissive.
- OCC does not add encryption for transcripts or in-memory session/chat state.

### 6. Troubleshooting
Resolved:
- Added actionable checks tied to actual store fields, RPC calls, and sidecar behavior.
- Added guidance for selector desync, wrong main session selection, attribution failures, metrics fallback ports, and expected proxy warnings in packaged builds.

## Any open questions that still need user input
1. **Do you want the manual to describe `gateway.ts` as legacy/compatibility only, or should that store be actively retired and then removed from the manual later?** Right now I documented it honestly as a compatibility layer because that matches the code.
2. **Do you want the manual to include a hardening TODO section with concrete remediation steps and owners?** I kept security guidance technical and factual, but not project-manager-ish.
3. **Should the manual call out the sidecar bind-address issue as a bug requiring immediate fix, or just as a current limitation?** I treated it as a current limitation because that is the safest verified statement.
4. **Do you want a separate appendix that maps specific UI panels/components to their backing stores?** The current manual covers the flow, but a strict component→store matrix could help future maintenance.
5. **Barclay’s configured default model is still `openai-codex/gpt-5.2` in `crew-config.json`.** If that is no longer desired for Art/UX work, that is a product/config decision rather than a documentation correction.
