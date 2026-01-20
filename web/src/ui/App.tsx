import { useCallback, useEffect, useRef, useState } from 'react';
import * as Blockly from 'blockly';
import { registerBlocks, toolboxDefinition } from '../blocks/blocklySetup';
import { compileWorkspace } from '../blocks/compile';
import { createVm, stepVm, type VmState } from '../blocks/vm';
import { createRobotState, type RobotAction } from '../engine/robot';
import { createSimulation, stepSimulation, type SimulationState } from '../engine/sim';
import { TileType, createWorld } from '../engine/world';
import level01 from '../levels/builtin/level-01.json';
import level02 from '../levels/builtin/level-02.json';
import level03 from '../levels/builtin/level-03.json';
import level04 from '../levels/builtin/level-04.json';
import level05 from '../levels/builtin/level-05.json';
import level06 from '../levels/builtin/level-06.json';
import level07 from '../levels/builtin/level-07.json';
import level08 from '../levels/builtin/level-08.json';
import level09 from '../levels/builtin/level-09.json';
import level10 from '../levels/builtin/level-10.json';
import level11 from '../levels/builtin/level-11.json';
import level12 from '../levels/builtin/level-12.json';

const TILE_SIZE = 32;
const actionLabels: Record<RobotAction, string> = {
  MOVE_FORWARD: 'Move Forward',
  TURN_LEFT: 'Turn Left',
  TURN_RIGHT: 'Turn Right',
  WAIT: 'Wait',
};

interface LevelDefinition {
  id: string;
  name: string;
  difficulty: number;
  grid: number[][];
  start: { x: number; y: number; dir: number };
  goal: { x: number; y: number };
}

const levels: LevelDefinition[] = [
  level01,
  level02,
  level03,
  level04,
  level05,
  level06,
  level07,
  level08,
  level09,
  level10,
  level11,
  level12,
];

const drawGoalIcon = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
) => {
  const centerX = x + size / 2;
  const centerY = y + size / 2;
  const outerRadius = size * 0.22;
  const innerRadius = size * 0.1;
  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    ctx.lineTo(centerX + radius * Math.cos(angle), centerY + radius * Math.sin(angle));
  }
  ctx.closePath();
  ctx.fill();
};

const drawHazardIcon = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
) => {
  ctx.fillStyle = '#fee2e2';
  ctx.beginPath();
  ctx.moveTo(x + size / 2, y + size * 0.18);
  ctx.lineTo(x + size * 0.82, y + size * 0.78);
  ctx.lineTo(x + size * 0.18, y + size * 0.78);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#ef4444';
  ctx.fillRect(x + size / 2 - 1.5, y + size * 0.34, 3, size * 0.26);
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size * 0.67, 2.5, 0, Math.PI * 2);
  ctx.fill();
};

const drawWallIcon = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
) => {
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  const brickHeight = size / 3;
  ctx.beginPath();
  ctx.moveTo(x, y + brickHeight);
  ctx.lineTo(x + size, y + brickHeight);
  ctx.moveTo(x, y + brickHeight * 2);
  ctx.lineTo(x + size, y + brickHeight * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x + size * 0.5, y);
  ctx.lineTo(x + size * 0.5, y + brickHeight);
  ctx.moveTo(x + size * 0.25, y + brickHeight);
  ctx.lineTo(x + size * 0.25, y + brickHeight * 2);
  ctx.moveTo(x + size * 0.75, y + brickHeight * 2);
  ctx.lineTo(x + size * 0.75, y + size);
  ctx.stroke();
};

const drawRobotSprite = (
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  direction: number,
  alive: boolean,
) => {
  const bodySize = TILE_SIZE * 0.55;
  const radius = 6;
  ctx.fillStyle = alive ? '#0f172a' : '#94a3b8';
  ctx.beginPath();
  ctx.moveTo(centerX - bodySize / 2 + radius, centerY - bodySize / 2);
  ctx.lineTo(centerX + bodySize / 2 - radius, centerY - bodySize / 2);
  ctx.quadraticCurveTo(
    centerX + bodySize / 2,
    centerY - bodySize / 2,
    centerX + bodySize / 2,
    centerY - bodySize / 2 + radius,
  );
  ctx.lineTo(centerX + bodySize / 2, centerY + bodySize / 2 - radius);
  ctx.quadraticCurveTo(
    centerX + bodySize / 2,
    centerY + bodySize / 2,
    centerX + bodySize / 2 - radius,
    centerY + bodySize / 2,
  );
  ctx.lineTo(centerX - bodySize / 2 + radius, centerY + bodySize / 2);
  ctx.quadraticCurveTo(
    centerX - bodySize / 2,
    centerY + bodySize / 2,
    centerX - bodySize / 2,
    centerY + bodySize / 2 - radius,
  );
  ctx.lineTo(centerX - bodySize / 2, centerY - bodySize / 2 + radius);
  ctx.quadraticCurveTo(
    centerX - bodySize / 2,
    centerY - bodySize / 2,
    centerX - bodySize / 2 + radius,
    centerY - bodySize / 2,
  );
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.arc(centerX - bodySize * 0.12, centerY - bodySize * 0.1, 3, 0, Math.PI * 2);
  ctx.arc(centerX + bodySize * 0.12, centerY - bodySize * 0.1, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#f97316';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  const directionOffset = TILE_SIZE * 0.3;
  const directionVectors = [
    { x: 0, y: -directionOffset },
    { x: directionOffset, y: 0 },
    { x: 0, y: directionOffset },
    { x: -directionOffset, y: 0 },
  ];
  const vector = directionVectors[direction];
  ctx.lineTo(centerX + vector.x, centerY + vector.y);
  ctx.stroke();
  ctx.lineWidth = 1;
};

const App = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const blocklyRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);

  const createSimulationForLevel = useCallback((level: LevelDefinition): SimulationState => {
    const world = createWorld(level.grid);
    const robot = createRobotState(level.start.x, level.start.y, level.start.dir as 0 | 1 | 2 | 3);
    return createSimulation(world, robot);
  }, []);

  const [levelIndex, setLevelIndex] = useState(0);
  const [simulation, setSimulation] = useState<SimulationState>(() =>
    createSimulationForLevel(levels[0]),
  );
  const [vmState, setVmState] = useState<VmState | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isReplaying, setIsReplaying] = useState(false);
  const [replayIndex, setReplayIndex] = useState(0);
  const [lastRunActions, setLastRunActions] = useState<RobotAction[]>([]);
  const [actionTrace, setActionTrace] = useState<RobotAction[]>([]);
  const [currentAction, setCurrentAction] = useState<RobotAction | null>(null);
  const [speedMs, setSpeedMs] = useState(500);

  const simulationRef = useRef(simulation);
  const vmRef = useRef(vmState);
  const traceRef = useRef<RobotAction[]>([]);
  const replayIndexRef = useRef(0);
  const lastRunRef = useRef<RobotAction[]>([]);

  const loadLevel = useCallback(
    (nextIndex: number) => {
      const nextLevel = levels[nextIndex];
      if (!nextLevel) {
        return;
      }

      setLevelIndex(nextIndex);
      setIsRunning(false);
      setIsReplaying(false);
      setSimulation(createSimulationForLevel(nextLevel));
      setVmState(null);
      setReplayIndex(0);
      setLastRunActions([]);
      setActionTrace([]);
      setCurrentAction(null);
      traceRef.current = [];
      replayIndexRef.current = 0;
    },
    [createSimulationForLevel],
  );

  useEffect(() => {
    simulationRef.current = simulation;
  }, [simulation]);

  useEffect(() => {
    vmRef.current = vmState;
  }, [vmState]);

  useEffect(() => {
    traceRef.current = actionTrace;
  }, [actionTrace]);

  useEffect(() => {
    replayIndexRef.current = replayIndex;
  }, [replayIndex]);

  useEffect(() => {
    lastRunRef.current = lastRunActions;
  }, [lastRunActions]);

  const compileProgram = (): VmState | null => {
    const workspace = workspaceRef.current;
    if (!workspace) {
      return null;
    }
    const program = compileWorkspace(workspace);
    return createVm(program);
  };

  const performStep = () => {
    const currentSimulation = simulationRef.current;
    if (currentSimulation.status !== 'running') {
      setIsRunning(false);
      return;
    }

    let currentVm = vmRef.current;
    if (!currentVm || currentVm.status !== 'running') {
      currentVm = compileProgram();
    }

    if (!currentVm) {
      setIsRunning(false);
      return;
    }

    const vmResult = stepVm(currentVm, {
      world: currentSimulation.world,
      robot: currentSimulation.robot,
    });

    let nextSimulation = currentSimulation;
    if (vmResult.action) {
      nextSimulation = stepSimulation(currentSimulation, vmResult.action);
    }

    if (vmResult.state.status === 'step_limit') {
      nextSimulation = { ...nextSimulation, status: 'lost' };
    }

    let updatedTrace = traceRef.current;
    if (vmResult.action) {
      updatedTrace = [...traceRef.current, vmResult.action];
      traceRef.current = updatedTrace;
      setActionTrace(updatedTrace);
      setCurrentAction(vmResult.action);
    }

    setSimulation(nextSimulation);
    setVmState(vmResult.state);

    if (
      nextSimulation.status !== 'running' ||
      vmResult.state.status !== 'running'
    ) {
      setIsRunning(false);
      if (updatedTrace.length > 0) {
        setLastRunActions(updatedTrace);
      }
    }
  };

  const handleRun = () => {
    if (simulation.status !== 'running') {
      return;
    }
    setIsRunning(true);
  };

  const handleStep = () => {
    performStep();
  };

  const handlePause = () => {
    setIsRunning(false);
    setIsReplaying(false);
  };

  const handleReset = () => {
    setIsRunning(false);
    setIsReplaying(false);
    setSimulation(createSimulationForLevel(levels[levelIndex]));
    setVmState(null);
    setActionTrace([]);
    setCurrentAction(null);
    traceRef.current = [];
  };

  const handleReplay = () => {
    if (lastRunActions.length === 0) {
      return;
    }
    setIsRunning(false);
    setIsReplaying(true);
    setSimulation(createSimulationForLevel(levels[levelIndex]));
    setVmState(null);
    setReplayIndex(0);
    replayIndexRef.current = 0;
    setActionTrace([]);
    setCurrentAction(null);
    traceRef.current = [];
  };

  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) {
      return;
    }
    const highlightedId = vmState?.currentNode?.blockId ?? null;
    workspace.highlightBlock(highlightedId);
  }, [vmState]);

  useEffect(() => {
    if (simulation.status !== 'won' || isReplaying) {
      return undefined;
    }

    const nextIndex = levelIndex + 1;
    if (nextIndex >= levels.length) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      loadLevel(nextIndex);
    }, 800);

    return () => window.clearTimeout(timeout);
  }, [simulation.status, levelIndex, isReplaying, loadLevel]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = simulation.world.width * TILE_SIZE;
    const height = simulation.world.height * TILE_SIZE;

    if (canvas.width !== width) {
      canvas.width = width;
    }
    if (canvas.height !== height) {
      canvas.height = height;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let row = 0; row < simulation.world.height; row += 1) {
      for (let col = 0; col < simulation.world.width; col += 1) {
        const tile = simulation.world.grid[row][col];
        if (tile === TileType.Wall) {
          ctx.fillStyle = '#334155';
        } else if (tile === TileType.Goal) {
          ctx.fillStyle = '#166534';
        } else if (tile === TileType.Hazard) {
          ctx.fillStyle = '#991b1b';
        } else {
          ctx.fillStyle = '#f8fafc';
        }
        ctx.fillRect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);

        if (tile === TileType.Goal) {
          drawGoalIcon(ctx, col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE);
        } else if (tile === TileType.Hazard) {
          drawHazardIcon(ctx, col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE);
        } else if (tile === TileType.Wall) {
          drawWallIcon(ctx, col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE);
        }
      }
    }

    ctx.strokeStyle = '#cbd5f5';
    for (let row = 0; row < simulation.world.height; row += 1) {
      for (let col = 0; col < simulation.world.width; col += 1) {
        ctx.strokeRect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }

    const { robot } = simulation;
    const centerX = (robot.x + 0.5) * TILE_SIZE;
    const centerY = (robot.y + 0.5) * TILE_SIZE;
    drawRobotSprite(ctx, centerX, centerY, robot.direction, robot.alive);
  }, [simulation]);

  useEffect(() => {
    const blocklyDiv = blocklyRef.current;
    if (!blocklyDiv) {
      return;
    }

    registerBlocks();

    const workspace = Blockly.inject(blocklyDiv, {
      toolbox: toolboxDefinition,
      grid: {
        spacing: 20,
        length: 3,
        colour: '#e2e8f0',
        snap: true,
      },
      renderer: 'thrasos',
    });
    workspaceRef.current = workspace;

    return () => {
      workspace.dispose();
      workspaceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isRunning) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      performStep();
    }, speedMs);

    return () => window.clearInterval(interval);
  }, [isRunning, speedMs]);

  useEffect(() => {
    if (!isReplaying) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      const index = replayIndexRef.current;
      const action = lastRunRef.current[index];
      if (!action) {
        setIsReplaying(false);
        return;
      }

      const currentSimulation = simulationRef.current;
      const nextSimulation = stepSimulation(currentSimulation, action);
      setSimulation(nextSimulation);

      const updatedTrace = [...traceRef.current, action];
      traceRef.current = updatedTrace;
      setActionTrace(updatedTrace);
      setCurrentAction(action);

      const nextIndex = index + 1;
      setReplayIndex(nextIndex);
      replayIndexRef.current = nextIndex;

      if (nextSimulation.status !== 'running' || nextIndex >= lastRunRef.current.length) {
        setIsReplaying(false);
      }
    }, speedMs);

    return () => window.clearInterval(interval);
  }, [isReplaying, speedMs]);

  const isBusy = isRunning || isReplaying;
  const hasReplay = lastRunActions.length > 0;
  const currentLevel = levels[levelIndex];
  const hasNextLevel = levelIndex + 1 < levels.length;

  return (
    <div className="app">
      <header className="app__header">
        <h1>LemBots</h1>
        <p>
          Scratch-like blocks + robot simulation (scaffold) — Level {levelIndex + 1}:{' '}
          {currentLevel.name}
        </p>
      </header>
      <main className="app__main">
        <section className="panel">
          <h2>Simulation</h2>
          <canvas
            ref={canvasRef}
            width={simulation.world.width * TILE_SIZE}
            height={simulation.world.height * TILE_SIZE}
          />
        </section>
        <section className="panel">
          <h2>Block Editor</h2>
          <div className="blockly-host" ref={blocklyRef} />
        </section>
        <section className="panel">
          <h2>Controls</h2>
          <div className="controls">
            <button type="button" onClick={handleRun} disabled={isBusy}>
              Run
            </button>
            <button type="button" onClick={handlePause} disabled={!isBusy}>
              {isReplaying ? 'Stop Replay' : 'Pause'}
            </button>
            <button type="button" onClick={handleStep} disabled={isBusy}>
              Step
            </button>
            <button type="button" onClick={handleReset}>
              Reset
            </button>
            <button type="button" onClick={handleReplay} disabled={!hasReplay || isBusy}>
              Replay
            </button>
          </div>
          <div className="controls__speed">
            <label htmlFor="speed">
              Speed: <strong>{(1000 / speedMs).toFixed(1)}x</strong>
            </label>
            <input
              id="speed"
              type="range"
              min={200}
              max={1000}
              step={100}
              value={speedMs}
              onChange={(event) => setSpeedMs(Number(event.target.value))}
              disabled={isReplaying}
            />
          </div>
          <div className="controls__status">
            <p>
              Status: {simulation.status}
              {simulation.status === 'running' && isRunning ? ' (running)' : ''}
              {simulation.status === 'running' && isReplaying ? ' (replay)' : ''}
              {simulation.status === 'won'
                ? hasNextLevel
                  ? ' (advancing...)'
                  : ' (all levels complete!)'
                : ''}
            </p>
            <p>Steps: {simulation.stepCount}</p>
            <p>VM: {vmState?.status ?? 'idle'}</p>
            <p>Current: {currentAction ? actionLabels[currentAction] : '—'}</p>
          </div>
          <div className="controls__trace">
            <h3>Trace</h3>
            {actionTrace.length === 0 ? (
              <p>Build a program and step/run to see actions here.</p>
            ) : (
              <ol>
                {actionTrace.map((action, index) => (
                  <li
                    key={`${action}-${index}`}
                    className={index === actionTrace.length - 1 ? 'is-current' : undefined}
                  >
                    {actionLabels[action]}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;
