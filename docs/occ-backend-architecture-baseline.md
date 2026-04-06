# OCC Backend Architecture Baseline (Phase 0)

Date: 2026-03-30
Status: Baseline established before redesign implementation

## One-Line Baseline

OCC currently runs a **hybrid backend**: partial native gateway integration plus a proxy-centric chat/session/status layer that acts as practical authority.

## Current Data/Control Shape

1. UI shell (React/Zustand) renders OCC visuals.
2. Gateway connectivity exists, but state truth is split across multiple paths.
3. Proxy chat transport and proxy websocket events drive chat runtime behavior.
4. Status polling and heuristics influence/derive session + crew truth.
5. Feed/tool activity contain inferred/synthetic logic beyond authoritative gateway events.

## Main Architectural Problems

- Multiple competing sources of truth (gateway vs status polling vs proxy events)
- Tight coupling between transport details and UI store logic
- Heuristic inference where real session/chat/tool entities should be consumed directly
- Higher fragility and debugging cost due to duplicated/normalized event pipelines

## Redesign Direction (locked)

- Keep OCC visual shell and UX language
- Replace backend plumbing with OpenClaw-native gateway client model
- Move session/chat/tool truth into dedicated normalized stores
- Treat feed as projection/view-model (not authority)
- Retire proxy/hybrid legacy path after native path is verified

## Phase 0 Exit Criteria (met)

- Freeze/legacy note documented
- Baseline snapshot documented
- OpenClaw reference code paths documented
- Architecture baseline documented in `docs/`
