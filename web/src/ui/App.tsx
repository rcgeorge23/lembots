import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Blockly from 'blockly';
import { registerBlocks, toolboxDefinition } from '../blocks/blocklySetup';
import { compileWorkspace } from '../blocks/compile';
import { createVm, stepVm, type VmState } from '../blocks/vm';
import { createRobotState, type RobotAction } from '../engine/robot';
import { createSimulation, stepSimulation, type SimulationState } from '../engine/sim';
import { TileType, createWorld } from '../engine/world';
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
const speedOptions = [
  { label: '0.5x', value: 2000 },
  { label: '1x', value: 1000 },
  { label: '2x', value: 500 },
  { label: '4x', value: 250 },
];
const actionLabels: Record<RobotAction, string> = {
  MOVE_FORWARD: 'Move Forward',
  TURN_LEFT: 'Turn Left',
  TURN_RIGHT: 'Turn Right',
  WAIT: 'Wait',
};
const tileKeyByType: Record<TileType, string> = {
  [TileType.Empty]: 'floor',
  [TileType.Wall]: 'wall',
  [TileType.Goal]: 'goal',
  [TileType.Hazard]: 'hazard',
};
const thumbnailTileSize = 12;

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
  const traceLogRef = useRef<HTMLDivElement | null>(null);

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
  const [speedMs, setSpeedMs] = useState(1000);
  const [completedLevels, setCompletedLevels] = useState<string[]>(() => loadCompletedLevels());
  const [renderAssets, setRenderAssets] = useState<RenderAssets | null>(null);
  const [levelThumbnails, setLevelThumbnails] = useState<Record<string, string>>({});
  const [failReason, setFailReason] = useState<'hazard' | 'step_limit' | 'unknown' | null>(null);

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
      setFailReason(null);
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

    if (nextSimulation.status === 'lost') {
      const reachedLimit =
        vmResult.state.status === 'step_limit' ||
        nextSimulation.stepCount >= nextSimulation.maxSteps;
      if (reachedLimit) {
        setFailReason('step_limit');
      } else if (!nextSimulation.robot.alive) {
        setFailReason('hazard');
      } else {
        setFailReason('unknown');
      }
    } else if (nextSimulation.status === 'won') {
      setFailReason(null);
    }

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
    setFailReason(null);
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
    setFailReason(null);
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
    if (!renderAssets || typeof document === 'undefined') {
      return;
    }

    const thumbnails: Record<string, string> = {};
    levels.forEach((level) => {
      const world = createWorld(level.grid);
      const canvas = document.createElement('canvas');
      canvas.width = world.width * thumbnailTileSize;
      canvas.height = world.height * thumbnailTileSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return;
      }
      ctx.imageSmoothingEnabled = false;
      const scale = thumbnailTileSize / renderAssets.tilesAtlas.tileSize;
      for (let row = 0; row < world.height; row += 1) {
        for (let col = 0; col < world.width; col += 1) {
          const tile = world.grid[row][col];
          const tileKey = tileKeyByType[tile] ?? 'floor';
          const sprite = renderAssets.tilesAtlas.tiles[tileKey];
          if (!sprite) {
            continue;
          }
          ctx.drawImage(
            renderAssets.tilesImage,
            sprite.x,
            sprite.y,
            sprite.w,
            sprite.h,
            col * thumbnailTileSize,
            row * thumbnailTileSize,
            sprite.w * scale,
            sprite.h * scale,
          );
        }
      }
      thumbnails[level.id] = canvas.toDataURL('image/png');
    });
    setLevelThumbnails(thumbnails);
  }, [renderAssets]);

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

    const blocklyTheme = Blockly.Theme.defineTheme('lembots-dark', {
      name: 'lembots-dark',
      base: Blockly.Themes.Classic,
      componentStyles: {
        workspaceBackgroundColour: '#0f172a',
        toolboxBackgroundColour: '#111827',
        toolboxForegroundColour: '#e2e8f0',
        flyoutBackgroundColour: '#111827',
        flyoutForegroundColour: '#e2e8f0',
        flyoutOpacity: 0.95,
        scrollbarColour: '#334155',
        scrollbarOpacity: 0.9,
        insertionMarkerColour: '#6366f1',
        insertionMarkerOpacity: 0.6,
        cursorColour: '#818cf8',
        selectedGlowColour: '#6366f1',
      },
    });

    const workspace = Blockly.inject(blocklyDiv, {
      toolbox: toolboxDefinition,
      grid: {
        spacing: 20,
        length: 3,
        colour: '#334155',
        snap: true,
      },
      renderer: 'thrasos',
      theme: blocklyTheme,
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

  useEffect(() => {
    if (!traceLogRef.current) {
      return;
    }

    traceLogRef.current.scrollTop = traceLogRef.current.scrollHeight;
  }, [actionTrace.length]);

  const isBusy = isRunning || isReplaying;
  const hasReplay = lastRunActions.length > 0;
  const currentLevel = levels[levelIndex];
  const hasNextLevel = levelIndex + 1 < levels.length;
  const activeSpeedOption = speedOptions.find((option) => option.value === speedMs);
  const showOverlay = (simulation.status === 'won' || simulation.status === 'lost') && !isReplaying;
  const failMessage =
    failReason === 'hazard'
      ? 'Robot hit a hazard.'
      : failReason === 'step_limit'
        ? 'Too many steps without reaching the goal.'
        : 'Program failed.';

  const statusTone =
    simulation.status === 'won'
      ? 'success'
      : simulation.status === 'lost'
        ? 'danger'
        : isRunning || isReplaying
          ? 'warning'
          : 'idle';
  const statusLabel =
    simulation.status === 'won'
      ? hasNextLevel
        ? 'Level Complete'
        : 'All Levels Complete'
      : simulation.status === 'lost'
        ? 'Robot Lost'
        : isRunning
          ? 'Running'
          : isReplaying
            ? 'Replaying'
            : 'Ready';

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <p className="app__tag">Retro Puzzle Lab</p>
          <h1>LemBots</h1>
        </div>
        <div className="app__meta">
          <p>
            Level {levelIndex + 1}: <strong>{currentLevel.name}</strong>
          </p>
          <p className="app__subtitle">Program. Run. Watch the bot learn.</p>
        </div>
      </header>
      <main className="app__main">
        <section className="panel panel--sim">
          <h2>Simulation</h2>
          <div className="sim-surface">
            <canvas
              ref={canvasRef}
              width={simulation.world.width * TILE_SIZE}
              height={simulation.world.height * TILE_SIZE}
            />
            {showOverlay ? (
              <div className={`sim-overlay sim-overlay--${simulation.status}`}>
                <div className="sim-overlay__card">
                  <p className="sim-overlay__eyebrow">
                    {simulation.status === 'won' ? 'Level Complete' : 'Try Again'}
                  </p>
                  <h3>
                    {simulation.status === 'won'
                      ? 'Robot reached the goal!'
                      : 'Robot lost in the maze.'}
                  </h3>
                  <p className="sim-overlay__hint">
                    {simulation.status === 'won' ? 'Great job! Ready for the next challenge?' : failMessage}
                  </p>
                  <div className="sim-overlay__actions">
                    {simulation.status === 'won' && hasNextLevel ? (
                      <button type="button" onClick={() => loadLevel(levelIndex + 1)}>
                        Next Level
                      </button>
                    ) : (
                      <button type="button" onClick={handleReset}>
                        Reset
                      </button>
                    )}
                    {hasReplay ? (
                      <button type="button" onClick={handleReplay}>
                        Replay
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </section>
        <section className="panel panel--editor">
          <h2>Block Editor</h2>
          <div className="blockly-host" ref={blocklyRef} />
        </section>
        <section className="panel panel--controls">
          <h2>Command Console</h2>
          <div className="console">
            <div className="console__controls">
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
            <div className="console__speed">
              <p>Speed</p>
              <div className="speed-toggle" role="group" aria-label="Simulation speed">
                {speedOptions.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    className={option.value === speedMs ? 'is-active' : undefined}
                    onClick={() => setSpeedMs(option.value)}
                    disabled={isReplaying}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="console__status">
              <div className="status-card">
                <span className={`status-lamp status-lamp--${statusTone}`} aria-hidden="true" />
                <div>
                  <p className="status-card__label">Status</p>
                  <p className="status-card__value">{statusLabel}</p>
                </div>
              </div>
              <div className="status-card">
                <p className="status-card__label">Speed</p>
                <p className="status-card__value">{activeSpeedOption?.label ?? '—'}</p>
              </div>
              <div className="status-card">
                <p className="status-card__label">Steps</p>
                <p className="status-card__value">{simulation.stepCount}</p>
              </div>
              <div className="status-card">
                <p className="status-card__label">VM</p>
                <p className="status-card__value">{vmState?.status ?? 'idle'}</p>
              </div>
              <div className="status-card">
                <p className="status-card__label">Current</p>
                <p className="status-card__value">
                  {currentAction ? actionLabels[currentAction] : '—'}
                </p>
              </div>
            </div>
          </div>
          <div className="controls__trace">
            <h3>Trace</h3>
            <div className="controls__trace-log" aria-live="polite" ref={traceLogRef}>
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
          </div>
        </section>
      </main>
      <section className="levels-strip" aria-label="Level selection">
        <div className="levels-strip__header">
          <h3>Levels</h3>
          <p className="levels__hint">
            {completedLevels.length === 0
              ? 'Complete level 1 to unlock level 2.'
              : 'Complete a level to unlock the next one.'}
          </p>
        </div>
        <div className="levels__grid">
          {levels.map((level, index) => {
            const previousLevel = levels[index - 1];
            const isUnlocked =
              index === 0 ||
              completedLevelSet.has(level.id) ||
              (previousLevel ? completedLevelSet.has(previousLevel.id) : false);
            const isCurrent = index === levelIndex;
            const isCompleted = completedLevelSet.has(level.id);
            const thumbnail = levelThumbnails[level.id];
            return (
              <button
                key={level.id}
                type="button"
                className={`level-card${isCurrent ? ' is-current' : ''}${
                  isCompleted ? ' is-complete' : ''
                }`}
                onClick={() => loadLevel(index)}
                disabled={!isUnlocked || isBusy}
              >
                <div className="level-card__thumb">
                  {thumbnail ? (
                    <img src={thumbnail} alt={`Level ${index + 1} preview`} />
                  ) : (
                    <div className="level-card__placeholder" aria-hidden="true" />
                  )}
                  {!isUnlocked ? <div className="level-card__lock">Locked</div> : null}
                  {isCompleted ? (
                    <div className="level-card__badge" aria-label="Completed">
                      ✓
                    </div>
                  ) : null}
                </div>
                <div className="level-card__info">
                  <p className="level-card__number">Level {index + 1}</p>
                  <p className="level-card__name">{level.name}</p>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default App;
