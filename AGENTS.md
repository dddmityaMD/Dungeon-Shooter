# AGENTS.md

## Purpose
- This repo is a Vite + TypeScript + Three.js FPS prototype.
- Use this file to keep agent changes consistent and safe.

## Quick Start
- Install deps: `npm install`
- Dev server: `npm run dev` (Vite)
- Production build: `npm run build` (runs `tsc` then `vite build`)
- Preview build: `npm run preview`

## Build/Lint/Test
- Build: `npm run build`
- Type-check only: no script; use `npx tsc --noEmit` if needed.
- Lint: no lint config present (no ESLint/Prettier).
- Tests: no test runner configured.
- Single test: not available until a test runner is added.
- CI: not present; keep changes local and manual.

## Repo Structure
- `src/main.ts` hosts most game logic and UI wiring.
- `src/game/audio.ts` owns Web Audio effects.
- `src/style.css` provides HUD and overlay styling.
- `src/assets/` contains textures loaded via `new URL(..., import.meta.url)`.

## Module System
- ESM only (`"type": "module"` in `package.json`).
- Use explicit `.js` extensions for Three.js example imports (see `GLTFLoader`).
- Prefer named exports for module APIs.

## Formatting
- 2-space indentation; no tabs.
- No semicolons; rely on ASI.
- Single quotes for strings; use template literals for interpolation.
- Trailing commas in multiline objects/arrays/function params.
- Wrap long argument lists on new lines, aligned under the opening paren.
- Keep lines readable; avoid >120 chars when possible.

## Imports
- Keep side-effect imports first (e.g., CSS).
- Then third-party packages (`three`, `three/examples`).
- Then local modules (`./game/audio`).
- Group by blank lines as in `src/main.ts`.

## TypeScript Types
- Use explicit interfaces for structured data (e.g., `Enemy`, `LevelState`).
- Use `type` aliases for unions and small shapes.
- Avoid `any`; use `unknown` with runtime checks if needed.
- Prefer `const` and `readonly` data where possible.
- Non-null assertions (`!`) are acceptable for DOM when elements are guaranteed.
- Use `number | null` for optional primitive state; avoid `undefined` in state.

## Naming
- `camelCase` for variables/functions.
- `PascalCase` for classes, interfaces, types, enums.
- Enum members use `UPPER_SNAKE` or descriptive string values (existing uses `EnemyState.IDLE`).
- Booleans start with `is/has/can/should`.

## Functions & Control Flow
- Prefer small helper functions (collision, spawning, UI updates).
- Use early returns for guard clauses.
- Keep mutation localized; reuse arrays with `length = 0` when clearing.
- Favor `for` loops when mutating arrays (matches current style).
- Avoid nested ternaries; use clear `if` blocks.

## Error Handling
- Guard against null-ish values before use.
- Web Audio uses defensive checks; follow same pattern.
- Wrap unsafe stop calls in `try` when needed (see audio cleanup).
- Throw only when state truly invalid (e.g., missing `AudioContext`).

## Three.js Usage
- Reuse materials/geometry where possible to reduce GC pressure.
- Dispose geometry/materials when removing transient meshes.
- Keep helper data on `userData` for runtime calculations.
- Use `THREE.MathUtils.damp` for smooth transitions.
- Keep physics/collision in world space with simple AABB math.

## DOM/UI
- HUD elements are created in JS; follow existing pattern.
- Use `querySelector<HTML...>()!` for elements created in template strings.
- Toggle visibility via `style.display` and opacity for effects.
- Keep DOM updates in small helper functions (`updateHUD`, `updateEffects`).

## Audio
- Web Audio setup happens lazily in `initAudio`.
- Always guard against `audioContext`/`audioMasterGain` being null.
- Schedule oscillators with explicit stop times.
- Clean up intervals (`ambientChordTimer`, `ambientSchedulerTimer`) on reset.

## Assets & URLs
- Use `new URL('./path', import.meta.url).toString()` for assets.
- Provide remote fallback URLs when local textures fail.
- Keep texture settings (wrap/repeat/colorSpace) near the load.

## State & Game Flow
- Central game state lives at top-level module scope in `main.ts`.
- Update per-frame logic in `animate()` (see file for pattern).
- Avoid global timers leaking; clear intervals/timeouts on reset.
- Use `performance.now()` for input timing and delta calculations.

## CSS
- CSS lives in `src/style.css` and is imported by `main.ts`.
- Keep IDs for HUD/overlay elements in sync with JS.
- Prefer simple selectors; avoid deep nesting.

## Testing Guidance
- No tests exist today; consider adding a runner (Vitest/Jest) before writing tests.
- When adding tests, keep them close to `src` and update this file.

## Adding New Modules
- Keep new game subsystems under `src/game/`.
- Export focused APIs; avoid circular dependencies with `main.ts`.
- Keep file names lowercase with hyphens only if needed (current uses lowercase).

## Performance Notes
- Avoid per-frame allocations; reuse vectors and arrays.
- Use `for` loops with indices for hot paths.
- Cache computed values (e.g., `forward`, `right`) per frame.

## Networking / External Calls
- Avoid new network fetches inside the render loop.
- Texture downloads already use fallback URLs; keep them optional.

## Git Hygiene
- Repo is not a git repo today; if initialized, avoid committing generated assets.
- Do not commit `node_modules`.

## Generated Files
- `node_modules/` is present; treat as vendor.
- Builds output to `dist/` (generated by Vite).

## When Unsure
- Prefer minimal, targeted changes.
- Keep style consistent with `src/main.ts`.
- Ask for clarification if command usage is unclear.

## Checklist Before Final Output
- `npm run build` succeeds (optional but preferred).
- Manual smoke: `npm run dev` and load the scene.
- Ensure texture URLs resolve (local or fallback).
- Confirm no unused vars or imports.

## Notes for Agents
- This project has no lint/test scripts, so avoid inventing them.
- Do not add tooling unless requested.
- Respect the no-semicolons style.
- Maintain consistent formatting with existing files.
