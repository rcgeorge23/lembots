import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Blockly from 'blockly';
import { registerBlocks, toolboxDefinition } from '../blocks/blocklySetup';
import { compileWorkspace } from '../blocks/compile';
import { createVm, stepVm, type VmState } from '../blocks/vm';
import { createRobotState, type RobotAction } from '../engine/robot';
import { createSimulation, stepSimulation, type SimulationState } from '../engine/sim';
import { createWorld } from '../engine/world';
import { CanvasRenderer } from '../render/CanvasRenderer';
import { loadRenderAssets } from '../render/assets';
import type { RenderAssets } from '../render/Renderer';
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
const COMPLETED_LEVELS_STORAGE_KEY = 'lembots.completedLevels';
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

const loadCompletedLevels = (): string[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  const stored = window.localStorage.getItem(COMPLETED_LEVELS_STORAGE_KEY);
  if (!stored) {
    return [];
  }

  try {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      return parsed.filter((entry): entry is string => typeof entry === 'string');
    }
  } catch (error) {
    console.warn('Unable to read completed levels from local storage.', error);
  }

  return [];
};

const App = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const blocklyRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);

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
  const [completedLevels, setCompletedLevels] = useState<string[]>(() => loadCompletedLevels());
  const [renderAssets, setRenderAssets] = useState<RenderAssets | null>(null);

  const completedLevelSet = useMemo(() => new Set(completedLevels), [completedLevels]);

  const simulationRef = useRef(simulation);
  const vmRef = useRef(vmState);
  const traceRef = useRef<RobotAction[]>([]);
  const replayIndexRef = useRef(0);
  const lastRunRef = useRef<RobotAction[]>([]);
  const currentActionRef = useRef<RobotAction | null>(null);

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

  useEffect(() => {
    currentActionRef.current = currentAction;
  }, [currentAction]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(
      COMPLETED_LEVELS_STORAGE_KEY,
      JSON.stringify(completedLevels),
    );
  }, [completedLevels]);

  useEffect(() => {
    if (simulation.status !== 'won' || isReplaying) {
      return;
    }

    const currentLevelId = levels[levelIndex]?.id;
    if (!currentLevelId) {
      return;
    }

    if (!completedLevelSet.has(currentLevelId)) {
      setCompletedLevels((prev) =>
        prev.includes(currentLevelId) ? prev : [...prev, currentLevelId],
      );
    }
  }, [completedLevelSet, isReplaying, levelIndex, simulation.status]);

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
    let isMounted = true;
    loadRenderAssets()
      .then((assets) => {
        if (isMounted) {
          setRenderAssets(assets);
        }
      })
      .catch((error) => {
        console.error('Unable to load render assets.', error);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !renderAssets) {
      return;
    }

    const renderer = rendererRef.current ?? new CanvasRenderer(TILE_SIZE);
    renderer.init(canvas, renderAssets);
    rendererRef.current = renderer;
  }, [renderAssets]);

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
    const renderer = rendererRef.current;
    if (!renderer || !renderAssets) {
      return undefined;
    }

    let animationFrame: number;
    let lastTime = window.performance.now();

    const renderLoop = (time: number) => {
      const dt = time - lastTime;
      lastTime = time;
      renderer.render(simulationRef.current.world, simulationRef.current, dt, {
        lastAction: currentActionRef.current,
      });
      animationFrame = window.requestAnimationFrame(renderLoop);
    };

    animationFrame = window.requestAnimationFrame(renderLoop);

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [renderAssets]);

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
          <div className="levels">
            <h3>Levels</h3>
            <div className="levels__grid">
              {levels.map((level, index) => {
                const previousLevel = levels[index - 1];
                const isUnlocked =
                  index === 0 ||
                  completedLevelSet.has(level.id) ||
                  (previousLevel ? completedLevelSet.has(previousLevel.id) : false);
                const isCurrent = index === levelIndex;
                return (
                  <button
                    key={level.id}
                    type="button"
                    className={`levels__button${isCurrent ? ' is-current' : ''}`}
                    onClick={() => loadLevel(index)}
                    disabled={!isUnlocked || isBusy}
                  >
                    {index + 1}
                  </button>
                );
              })}
            </div>
            <p className="levels__hint">
              {completedLevels.length === 0
                ? 'Complete level 1 to unlock level 2.'
                : 'Complete a level to unlock the next one.'}
            </p>
          </div>
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
