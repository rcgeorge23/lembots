# LemBots
A web-based puzzle game (Lemmings-ish) where kids solve levels by programming one or more robots using Scratch-like blocks. Players write a small program, hit Run, and the robots execute it in a 2D grid world with obstacles, hazards, switches, and goals.

This document is a high-level project overview and a starter task list for Codex to begin implementation.

---

## Product vision
- **Audience:** kids learning basic programming concepts (sequence, loops, conditionals), plus parents/teachers.
- **Core fun:** watch your plan play out; debug; iterate; celebrate when the robots succeed.
- **Teaching goal (implicit):** decomposition + debugging mindset. No “lesson” framing in the UI.

---

## Core gameplay loop
1. Choose a level.
2. Build a program with blocks (Scratch-like).
3. Run simulation.
4. Observe failures/success (replay, step, speed).
5. Edit program and try again.
6. Earn completion and unlock next levels.

---

## MVP scope (keep it small)
### World model
- 2D **grid-based** world (tile map).
- Deterministic simulation.
- Single robot in early levels; multi-robot later (same program runs on all robots).

### Initial tile types (MVP)
- Empty floor
- Wall
- Goal tile
- Hazard tile (kills robot)
- Button / pressure plate (toggles a door)
- Door (blocks unless open)

### Initial robot capabilities (MVP)
Actions:
- `MOVE_FORWARD`
- `TURN_LEFT`
- `TURN_RIGHT`
- `WAIT`

Conditions:
- `PATH_AHEAD_CLEAR?`
- `ON_GOAL?`
- `ON_HAZARD?` (or hazard is handled automatically, but condition can exist)
- `ON_BUTTON?`

Control:
- `IF condition THEN ... ELSE ...`
- `REPEAT N ...`
- `REPEAT UNTIL condition ...` (optional for MVP; can be introduced in v1.1)

### Player tools (MVP)
- Block editor
- Run / Pause / Step / Reset
- Speed slider (e.g., 0.5x, 1x, 2x, 5x)
- Visual instruction highlighting (current block)
- Simple on-screen trace (“MOVE”, “TURN_LEFT”, etc.) for debugging

---

## Technology choices
### Frontend (primary)
- TypeScript + React (or Next.js)
- Blockly for block UI
- Canvas rendering (2D) for simulation visuals
- Deterministic simulation tick loop

### Backend (optional, when needed)
Use **Spring Boot + Postgres** if/when you need:
- user accounts / progress sync
- cloud level packs
- sharing solutions
- analytics / telemetry

For MVP, you can ship fully client-side with levels in JSON.

---

## Architecture overview

### Frontend modules
- `engine/`
  - `world.ts` (grid, tiles, entities)
  - `robot.ts` (state, orientation, actions)
  - `sim.ts` (tick loop, determinism, win/lose rules)
  - `rules.ts` (tile interactions: hazards, buttons, doors)
- `blocks/`
  - `blocklySetup.ts` (define blocks + toolbox)
  - `compile.ts` (blocks -> AST/bytecode)
  - `vm.ts` (execute AST/bytecode for each robot with step support)
- `levels/`
  - `schema.ts` (Level JSON schema + validation)
  - `builtin/` (MVP levels as JSON)
- `ui/`
  - `EditorPanel.tsx` (Blockly workspace)
  - `SimCanvas.tsx` (render)
  - `Controls.tsx` (run/pause/step/reset/speed)
  - `LevelSelect.tsx`

### Key design decisions
- **Do not execute arbitrary JS from Blockly.**
  - Compile blocks into a tiny safe **AST or bytecode** and interpret it.
  - Benefits: deterministic, replayable, safe, easier to highlight current instruction.
- **Deterministic sim**
  - Fixed tick rate; no randomness in MVP.
  - Replays should be identical for the same program+level.

---

## Data formats

### Level JSON (proposed)
- `id`, `name`, `difficulty`
- `grid`: 2D array of tile ids
- `start`: `{ x, y, dir }`
- `goal`: tile id OR coordinates
- `metadata`: allowed blocks, step limit, etc.
- `objects`: doors/buttons wiring (e.g., button A toggles door A)

Keep it simple: one button toggles one door for MVP.

### Program representation (proposed)
- AST nodes:
  - `Sequence`
  - `Action(type)`
  - `If(condition, thenBranch, elseBranch)`
  - `Repeat(count, body)`
  - `RepeatUntil(condition, body)` (optional)
- VM maintains:
  - instruction pointer stack
  - per-robot execution state
  - step/run controls and highlight info

---

## Milestones

### Milestone 0 — Repo scaffold + running dev server
- React app bootstrapped
- Canvas renders a test grid
- Minimal UI layout: level list, editor placeholder, run controls

### Milestone 1 — Simulation engine MVP
- Grid world with wall/goal/hazard
- Robot can move/turn/wait
- Win condition: robot reaches goal
- Lose condition: robot hits hazard or step limit exceeded

### Milestone 2 — Blockly MVP
- Toolbox with 4 actions + repeat + if
- Compile blocks -> AST
- VM executes AST and provides “current node” for highlighting

### Milestone 3 — First level pack (10–15 levels)
- Curated progression: straight line -> turns -> loops -> simple if -> buttons/doors
- Add pressure plate + door
- Add multi-robot in 1–2 late MVP levels (same program across all robots)

### Milestone 4 — Polish for playability
- Step mode
- Replay last run
- Better visuals (robot sprite, tile icons)
- Level completion screen

### Milestone 5 (optional) — Backend
- Store progress, share solutions, custom levels

---

## Risks & how we mitigate them
- **Kids get stuck / don’t know what to change**
  - Provide replays, step-by-step, highlighted blocks, simple trace messages.
- **Blockly integration becomes messy**
  - Keep block set small and domain-specific.
- **Simulation nondeterminism makes debugging frustrating**
  - Fixed timestep; no randomness in MVP.

---

## Initial Codex task (start here)
Goal: deliver a minimal vertical slice where a user can place a few blocks and see a robot move in a tiny grid.

### Task 1 — Create frontend scaffold + minimal engine + Blockly integration
**Acceptance criteria**
1. `pnpm dev` (or `npm run dev`) starts a web app.
2. Page shows:
   - a canvas with a small grid world (e.g., 10x10)
   - a Blockly workspace with blocks: MOVE_FORWARD, TURN_LEFT, TURN_RIGHT, WAIT, REPEAT N
   - controls: Run / Reset / Step
3. A hardcoded demo level exists:
   - start at (1,1) facing right
   - wall boundaries
   - goal tile somewhere reachable
4. When the user builds a program and hits Run:
   - program compiles to AST
   - sim ticks and robot moves accordingly
   - robot position updates on canvas
5. Determinism:
   - Reset returns to the same start state
   - Running the same program twice yields same robot path

**Implementation notes**
- Use Canvas 2D for rendering (simple rectangles is fine).
- Represent direction as 0/1/2/3 (N/E/S/W).
- Collision: MOVE_FORWARD into a wall does nothing (or causes fail) — choose one and be consistent (recommend: do nothing + show a bump animation later).
- Step limit: e.g., 200 instructions max to prevent infinite loops (enforce in VM).

**Suggested folder layout**
- `web/`
  - `src/engine/*`
  - `src/blocks/*`
  - `src/ui/*`
  - `src/levels/builtin/*`

**Deliverables**
- Running app
- `README.md` with dev instructions
- A single demo level JSON (even if embedded)
- Basic unit tests (optional but helpful) for:
  - move/turn logic
  - wall collision
  - repeat execution count

---

## Backend (defer unless needed)
If later required:
- Spring Boot service with endpoints:
  - `GET /levels` (optional if not bundled)
  - `POST /progress` / `GET /progress`
  - `POST /solutions` / `GET /solutions/:levelId`
- Postgres schema:
  - users, progress, solutions, levels (optional)

For now: ship levels as static JSON in the frontend.

---
