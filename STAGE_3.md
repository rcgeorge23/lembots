# LemBots — Next Steps: From “Logo Bot” to Cooperative Lemmings-Style Robots

This plan assumes the current state is a polished single-robot Blockly/Logo puzzle game with:
- grid/tile rendering + animations
- block editor
- run/pause/step/reset/replay
- level selector + unlocks
- win/lose overlays + trace

Goal of this stage: introduce **multi-robot cooperative gameplay** with **Lemmings-like dynamics**:
- many bots running concurrently
- jams/queues matter
- save N of M (quota) instead of “reach a single goal”
- simple cooperative devices (plates/doors) that require coordination
- keep programming kid-friendly: one shared program, limited conditions/actions, strong debug visibility

Backend: not required for this stage.

---

## Guiding decisions (lock these in early)
- [ ] **One program controls all robots** (same Blockly program executed by every robot, in parallel).
- [ ] Robots have minimal per-robot state at first: position, direction, alive/saved, instruction pointer.
- [ ] Add cooperation via **environment devices** first (plates/doors) before adding robot-to-robot messaging.
- [ ] Keep engine deterministic:
  - fixed tick
  - stable update order
  - replays identical

---

## Milestone overview (PR-sized chunks)
- [x] PR-1: Multi-robot core + level schema updates
- [x] PR-2: UI/UX for multi-robot (counters + inspect/debug)
- [x] PR-3: Exit + quota win condition (save N of M)
- [x] PR-4: Collisions + queueing rules
- [x] PR-5: Pressure plates + doors (first true cooperation puzzles)
- [x] PR-6: Level pack “Co-op World 1” (6–10 levels)
- [ ] PR-7 (optional): Global signal (simple coordination primitive)

---

## PR-1 — Multi-robot engine core + level schema
### Level schema changes
Extend level JSON to support spawning and exits:

```json
{
  "id": "L2-01",
  "name": "First Crowd",
  "grid": [...],
  "spawner": { "x": 2, "y": 2, "dir": "E", "count": 8, "intervalTicks": 10 },
  "exits": [{ "x": 18, "y": 4 }],
  "requiredSaved": 5,
  "maxTicks": 2000
}
```
