# LemBots — Level Solver (In-Browser) Plan

> **Codex checklist instruction:** As work is delivered, mark the corresponding checklist items below by changing `[ ]` to `[x]`.

This document describes a step-by-step plan to add a **fast in-browser level solver** that:
- searches for a valid program under level constraints
- runs in a Web Worker (no UI jank)
- provides **incremental, meaningful progress** back to the UI
- can preview “best-so-far” behaviour on the simulation grid without rendering every attempt

This is a solver for the game’s **block language**, not just pathfinding. It should output an AST/bytecode program that the existing VM can run.

---

## High-level approach (recommended)
Implement a **bounded best-first search (A*/beam) in program-space**:
- Build candidate programs (AST) incrementally.
- Evaluate candidates by simulating them on the level.
- Prioritize candidates using a heuristic fitness score (progress + milestones).
- Return:
  - the first solved program found within a budget, or
  - the best-so-far candidate when time runs out.

Why this approach:
- Works well for small DSLs (your blocks).
- Produces human-readable programs.
- Can be capped for responsiveness.
- Supports “hint” and “solve” modes.

---

## UX goals
- User clicks **“Find Solution”**.
- UI shows:
  - progress bar + “searching…” status
  - best-so-far score and attempt count
  - a **ghost preview** of the best-so-far run on the simulation grid (updated occasionally)
- If solved:
  - show the found program in the editor (or a separate “suggested solution” view)
  - allow user to “apply” or “step through” it
- If not solved within budget:
  - show best-so-far run + “Try again” / “Increase budget” option.

We do **not** render every attempt. We show:
- the current “champion” candidate’s robot path/positions
- and optionally the top K candidates’ final positions as faint markers.

---

## Constraints & assumptions
- Deterministic simulation (fixed tick).
- Levels may contain devices (doors/plates/water/raft). Solver must not need bespoke code per mechanic.
- Level JSON provides allowed blocks; solver only uses those.
- Candidate program size is bounded (e.g., 40 nodes for hint mode, 60 for solve mode).

---

## Step-by-step checklist

### 1) Canonical solver AST / bytecode representation
- [x] Define a minimal solver program representation that maps cleanly to Blockly blocks and the existing VM.
- [x] Implement program nodes:
  - `Seq([node...])`
  - `Act(MOVE|TURN_L|TURN_R|WAIT|SIGNAL_ON|SIGNAL_OFF|...)` (only include actions allowed in the level)
  - `If(cond, thenNode, elseNode?)`
  - `Repeat(n, body)` (optional in v1; can add later)
  - `(optional) RepeatUntil(cond, body)` (defer unless needed)
- [x] Implement conditions:
  - `AheadClear`
  - `LeftClear`
  - `RightClear`
  - `OnGoal`
  - `OnPressurePlate`
  - `OnRaft` (important for raft/water levels)
- [x] Implement boolean combinators (needed to express real logic):
  - `Not(cond)`
  - `And(condA, condB)`
  - `Or(condA, condB)`
- [x] Keep v1 small: Actions + `If` with simple conditions and `Not/And/Or`.
- [x] Defer loops until basic search works.

### 2) Simulation evaluation API (no rendering)
- [x] Add a headless evaluation function used by the solver:
  - `evaluate(program, level, options) -> EvalResult`
- [x] Ensure `EvalResult` includes:
  - `solved: boolean`
  - `score: number` (fitness)
  - `ticks: number`
  - `finalRobots: RobotState[]`
  - `bestRobots: RobotState[]` at the moment of best progress (optional)
  - `events: EventSummary` (milestones hit: door opened, crossed water, raft used, etc.)
  - `traceLite: TraceLite` (for preview playback; compressed)

### 3) TraceLite format (for incremental preview)
- [x] Implement a compact TraceLite format for previews without huge data:
  ```ts
  type TraceLite = {
    sampleEvery: number; // e.g. 5 or 10
    frames: Array<Array<{id:number,x:number,y:number,dir:number,status:string}>>;
  }
  ```
- [x] Sample positions every N ticks and store compact frames for “best-so-far” previews.

### 4) Web Worker solver loop
- [x] Run solver search in a Web Worker to avoid UI jank.
- [x] Emit progress updates (attempt count, best score, time elapsed, best candidate trace).
- [x] Support budgets (time, node count, or depth) and return best-so-far if budget expires.

### 5) Heuristics & scoring
- [x] Define a heuristic fitness score using progress + milestones.
- [x] Track milestone events (e.g., doors opened, water crossed, raft used) in `EvalResult`.
- [x] Prioritize candidates via bounded best-first search or beam search.

### 6) UI integration
- [x] Add a **“Find Solution”** button and solver status panel (progress bar, attempts, best score).
- [x] Render ghost preview for the current best candidate trace on the simulation grid.
- [x] Allow user to apply the found program or step through it.
- [x] If not solved within budget, show best-so-far run + “Try again” / “Increase budget”.

### 7) Validation & testing
- [ ] Add tests for `evaluate()` on small deterministic levels.
- [ ] Add solver tests for known levels (should find solutions within budget).
- [ ] Confirm solver does not block UI and respects time budget.
