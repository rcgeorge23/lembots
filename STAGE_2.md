# LemBots — Stage 2 Plan (Frontend/UI + High-Fidelity “Amiga-era Lemmings” Look)

We have a working prototype (Blockly editor + grid sim + controls). This stage focuses on **presentation, feel, and feedback**: moving from “prototype UI” to a **high-fidelity, game-like experience** with **striking 90s Amiga-inspired visuals** and moment-to-moment clarity.

Scope: **frontend only** (no backend). We will not change core mechanics unless required to support visuals/UX.

---

## Goals for this stage
- Make the simulation area feel like a **real game scene** (tiles, sprites, animation, particles, sound hooks).
- Make the UI feel like a **polished puzzle game** (level card, win/fail screens, crisp controls).
- Improve **readability** (what the robot is doing, why it failed, where it will go).
- Keep Blockly, but integrate it into a game UI (toolbox, palette, hints) that feels intentional.

Non-goals (for this stage)
- Multiplayer, user accounts, cloud persistence
- New major mechanics (multiple robots, complex devices) beyond what’s needed for visuals
- Level editor (can be later)

---

## Visual direction (Amiga / classic Lemmings-inspired)
### Art/UX principles
- **Chunky tiles** with subtle dithering / shading.
- **High contrast edges** and readable silhouettes.
- **Limited palette vibe**, but not literally restricted (fake it).
- **Playful, slightly “toy” world**: stone, brick, slime, metal, grass.
- Robot is a **character**, not a placeholder: idle animation, walk cycle, bump, turn, celebrate.

### Resolution + scaling
- Choose a “virtual resolution” for the sim scene (e.g. 320×200 vibe) and scale up with crisp pixels.
- Render with **pixel-perfect scaling** (integer scale factors).
- Use `imageSmoothingEnabled = false` on canvas.

---

## Rendering approach (recommended)
Move from drawing rectangles to a proper 2D pipeline:

### Option A (fastest): Canvas2D sprite sheet rendering
- Sprite sheets (PNG) + tile atlas
- Manual draw calls per tile/entity
- Deterministic, simple, great for pixel look

### Option B (more scalable): PixiJS
- Handles sprite batching, animations, camera, particles
- Still allows pixel art look

**Recommendation:** start with **Canvas2D** for speed; structure the renderer so we can swap later.

---

## UX improvements (what “feels like a game”)
### Simulation panel
- A “scene” with:
  - Background layer (parallax optional)
  - Tile layer
  - Entity layer (robot)
  - FX layer (particles)
  - UI overlay (goal highlight, path preview, hints)
- Camera framing:
  - For now: fixed camera, centered on level bounds
  - Later: pan/zoom or auto-follow robot

### Controls panel
- Convert current controls into a “console-like” panel:
  - chunky buttons (Amiga-like)
  - clear state display (RUNNING / PAUSED / WON / LOST)
  - speed as discrete steps + slider optional
  - replay timeline scrub (optional, later)

### Level selector
- Replace numeric buttons with:
  - level cards with thumbnail
  - locked/unlocked states
  - stars/medals (later) for “solved with ≤N steps” etc.

### Editor panel
- Keep Blockly, but improve affordances:
  - styled toolbox categories
  - “Run” starts from editor panel too
  - highlight the currently executing block
  - show a compact “program outline” view (optional later)

---

## Simulation feedback (critical for kids)
- When robot tries to move into wall:
  - bump animation + little dust puff
  - optional sound hook
- When turning:
  - turn animation (snap is OK initially)
- When reaching goal:
  - celebration animation + sparkles
  - win overlay
- When failing (hazard / step limit):
  - clear cause shown (“Fell into hazard”, “Too many steps”, “Stuck”)
  - highlight the tile/event that caused failure

---

## Deliverables for Stage 2
1. Tile renderer using a tile atlas (no more plain rectangles).
2. Robot sprite with basic animations:
   - idle
   - walk
   - turn
   - bump
   - win
   - fail
3. Game-like UI skin:
   - layout polish
   - typography + spacing
   - consistent button style
   - “win/fail” overlays
4. Level selector upgrades:
   - thumbnails (auto-generated from level data)
   - locked/unlocked visuals
5. Execution clarity:
   - current block highlight (already exists; polish)
   - on-canvas indicator above robot (arrow / thought bubble)
   - optional path preview for next N steps (toggle)

---

## Implementation plan for Codex (next tasks)

### Task 1 — Introduce a renderer abstraction [x]
**Goal:** decouple engine state from how it is drawn.

- Create `src/render/Renderer.ts` interface:
  - `init(canvas, assets)`
  - `render(worldState, simState, dt)`
- Implement `CanvasRenderer`:
  - uses tile size (e.g., 32px or 24px)
  - supports layers: background, tiles, entities, fx, overlay

**Acceptance criteria**
- Current level renders exactly as before (even if still rectangles), but via the renderer abstraction.

---

### Task 2 — Add pixel-art pipeline (atlas + sprites) [x]
**Goal:** render tiles and robot from images with crisp scaling.

- Add asset loader:
  - `assets/tiles.png` (tile atlas)
  - `assets/robot.png` (sprite sheet)
  - `assets/ui/` (icons)
- Create an atlas mapping file `assets/atlas.json`:
  - tile id → sprite rect (x,y,w,h)
  - robot animation frames → list of rects

**Acceptance criteria**
- Walls/floor/goal/hazard draw from atlas.
- Rendering is pixel-crisp (no blur).

---

### Task 3 — Robot animation state machine (visual-only)
**Goal:** make robot feel alive without changing logic.

- Add `robotRenderState`:
  - `anim: idle|walk|turn|bump|win|fail`
  - `frameIndex`, `frameTime`
- Map engine events to animations:
  - successful move → walk
  - blocked move → bump
  - turn → turn
  - win/lose → win/fail

**Acceptance criteria**
- Robot animates visibly during run.
- Bump animation triggers when hitting wall.
- Win/fail animation plays on end state.

---

### Task 4 — UI skin pass (Amiga-ish)
**Goal:** replace “app UI” feel with “game UI” feel.

- Add a theme system:
  - CSS variables for palette
  - consistent button styles (raised / beveled)
  - panel backgrounds (subtle noise/dither via CSS)
- Replace “Controls” area with:
  - large Run/Pause/Step/Reset
  - status indicator lamp (green/yellow/red)
  - speed stepper (0.5x / 1x / 2x / 4x)

**Acceptance criteria**
- UI looks cohesive and game-like.
- Clear interaction states (hover/pressed/disabled).

---

### Task 5 — Win/Lose overlays + replay polish
**Goal:** provide satisfying end-of-level feedback.

- Add overlay on sim canvas:
  - WON: “Level Complete!” + continue button
  - LOST: “Try again” + hint line (“Robot hit hazard”)
- Improve replay:
  - “Replay” runs the last recorded action sequence (already exists) but with the new animations and overlay removed during playback.

**Acceptance criteria**
- End states are obvious and pleasant.
- Replay works and looks good.

---

### Task 6 — Level thumbnails and selection UI
**Goal:** make level selection visual.

- Generate thumbnails client-side:
  - render level grid to offscreen canvas
  - save as data URL
- Replace numeric level buttons with a grid of cards:
  - thumbnail + level number + title
  - lock icon for locked
  - completion badge for completed

**Acceptance criteria**
- Level selection is visual and readable.
- Unlock flow remains the same.

---

## Art asset strategy (so we can move fast)
- For now, use placeholder pixel art:
  - either public-domain / permissive tiles
  - or quick in-house tiles with a consistent palette
- Keep atlas format stable so assets can be swapped later without code changes.

**Folder proposal**
- `public/assets/tiles/tiles.png`
- `public/assets/tiles/atlas.json`
- `public/assets/robot/robot.png`
- `public/assets/robot/robot_atlas.json`
- `public/assets/ui/icons.png`

---

## Suggested “Amiga” palette + style notes (implementation hints)
- Use a limited palette in art; enforce via assets rather than runtime.
- Add subtle:
  - vignette
  - scanline toggle (optional)
  - dithering overlay (CSS background noise)
- Ensure all UI text remains crisp and readable.

---

## Definition of Done (Stage 2)
- Demo is shareable as a game experience:
  - It looks like a game, not a tool.
  - Robot feels animated and expressive.
  - Win/fail states are satisfying.
  - Level selection is visual.
- Engine remains deterministic and unchanged except for hooks/events to drive animation.

---

## Codex “Start Here” (first concrete work item)
**Implement Task 1 + Task 2** in one PR:
- renderer abstraction + atlas-based tiles with pixel-perfect rendering
- keep robot as a rectangle for now (robot sprite comes next)
- do not change level mechanics

This unlocks everything else.
