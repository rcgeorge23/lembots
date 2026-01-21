import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from 'react';
import * as Blockly from 'blockly';
import { registerBlocks, toolboxDefinition } from '../blocks/blocklySetup';
import { compileWorkspace } from '../blocks/compile';
import { createVm, stepVm, type VmState } from '../blocks/vm';
import type { ProgramNode } from '../blocks/types';
import type { Direction, RobotAction } from '../engine/robot';
import {
  createSimulation,
  isDoorOpen,
  stepSimulation,
  type SimulationState,
  type Spawner,
} from '../engine/sim';
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
import level13 from '../levels/builtin/level-13.json';
import level14 from '../levels/builtin/level-14.json';
import level15 from '../levels/builtin/level-15.json';
import level16 from '../levels/builtin/level-16.json';
import level17 from '../levels/builtin/level-17.json';
import level18 from '../levels/builtin/level-18.json';

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
  SIGNAL_ON: 'Signal On',
  SIGNAL_OFF: 'Signal Off',
};
const directionLabels: Record<Direction, string> = {
  0: 'North',
  1: 'East',
  2: 'South',
  3: 'West',
};
const tileKeyByType: Record<TileType, string> = {
  [TileType.Empty]: 'floor',
  [TileType.Wall]: 'wall',
  [TileType.Goal]: 'goal',
  [TileType.Hazard]: 'hazard',
  [TileType.PressurePlate]: 'floor',
  [TileType.Door]: 'floor',
};
const thumbnailTileSize = 12;
const thumbnailDoorFill = '#1e293b';
const thumbnailPlateFill = '#f59e0b';

const parseDirection = (direction: number | 'N' | 'E' | 'S' | 'W'): Direction => {
  if (typeof direction === 'number') {
    return direction as Direction;
  }
  switch (direction) {
    case 'N':
      return 0;
    case 'E':
      return 1;
    case 'S':
      return 2;
    case 'W':
      return 3;
    default:
      return 1;
  }
};

const drawThumbnailPlate = (
  ctx: CanvasRenderingContext2D,
  col: number,
  row: number,
  tileSize: number,
) => {
  const padding = tileSize * 0.2;
  ctx.save();
  ctx.fillStyle = thumbnailPlateFill;
  ctx.strokeStyle = '#92400e';
  ctx.lineWidth = Math.max(1, tileSize * 0.08);
  ctx.fillRect(col * tileSize + padding, row * tileSize + padding, tileSize - padding * 2, tileSize - padding * 2);
  ctx.strokeRect(
    col * tileSize + padding,
    row * tileSize + padding,
    tileSize - padding * 2,
    tileSize - padding * 2,
  );
  ctx.restore();
};

const drawThumbnailDoor = (
  ctx: CanvasRenderingContext2D,
  col: number,
  row: number,
  tileSize: number,
) => {
  const padding = tileSize * 0.12;
  ctx.save();
  ctx.fillStyle = thumbnailDoorFill;
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = Math.max(1, tileSize * 0.08);
  ctx.fillRect(col * tileSize + padding, row * tileSize + padding, tileSize - padding * 2, tileSize - padding * 2);
  ctx.strokeRect(
    col * tileSize + padding,
    row * tileSize + padding,
    tileSize - padding * 2,
    tileSize - padding * 2,
  );
  ctx.restore();
};

interface LevelDefinition {
  id: string;
  name: string;
  difficulty: number;
  grid: number[][];
  spawner?: { x: number; y: number; dir: number | 'N' | 'E' | 'S' | 'W'; count: number; intervalTicks: number };
  exits?: { x: number; y: number }[];
  requiredSaved?: number;
  maxTicks?: number;
  start?: { x: number; y: number; dir: number };
  goal?: { x: number; y: number };
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
  level13,
  level14,
  level15,
  level16,
  level17,
  level18,
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
    const fallbackStart = level.start ?? { x: 1, y: 1, dir: 1 };
    const rawSpawner =
      level.spawner ?? {
        x: fallbackStart.x,
        y: fallbackStart.y,
        dir: fallbackStart.dir,
        count: 1,
        intervalTicks: 0,
      };
    const spawner: Spawner = {
      ...rawSpawner,
      dir: parseDirection(rawSpawner.dir),
    };
    const exits = level.exits ?? (level.goal ? [level.goal] : []);
    return createSimulation({
      world,
      spawner,
      exits,
      maxSteps: level.maxTicks ?? 200,
      requiredSaved: level.requiredSaved ?? 1,
    });
  }, []);

  const [levelIndex, setLevelIndex] = useState(0);
  const [simulation, setSimulation] = useState<SimulationState>(() =>
    createSimulationForLevel(levels[0]),
  );
  const [vmState, setVmState] = useState<VmState | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isReplaying, setIsReplaying] = useState(false);
  const [replayIndex, setReplayIndex] = useState(0);
  const [lastRunActions, setLastRunActions] = useState<Array<Array<RobotAction | undefined>>>([]);
  const [actionTrace, setActionTrace] = useState<RobotAction[]>([]);
  const [currentAction, setCurrentAction] = useState<RobotAction | null>(null);
  const [speedMs, setSpeedMs] = useState(1000);
  const [completedLevels, setCompletedLevels] = useState<string[]>(() => loadCompletedLevels());
  const [unlockAllLevels, setUnlockAllLevels] = useState(false);
  const [renderAssets, setRenderAssets] = useState<RenderAssets | null>(null);
  const [levelThumbnails, setLevelThumbnails] = useState<Record<string, string>>({});
  const [failReason, setFailReason] = useState<
    'hazard' | 'step_limit' | 'quota' | 'unknown' | null
  >(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedRobotId, setSelectedRobotId] = useState<string | null>(
    () => simulation.robots[0]?.id ?? null,
  );
  const [robotBubbleId, setRobotBubbleId] = useState<string | null>(null);
  const [bubbleShift, setBubbleShift] = useState(0);

  const completedLevelSet = useMemo(() => new Set(completedLevels), [completedLevels]);

  const simulationRef = useRef(simulation);
  const vmStatesRef = useRef<Map<string, VmState>>(new Map());
  const traceRef = useRef<RobotAction[]>([]);
  const runActionsRef = useRef<Array<Array<RobotAction | undefined>>>([]);
  const replayIndexRef = useRef(0);
  const lastRunRef = useRef<Array<Array<RobotAction | undefined>>>([]);
  const currentActionRef = useRef<RobotAction | null>(null);
  const simStageRef = useRef<HTMLDivElement | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);

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
      vmStatesRef.current = new Map();
      traceRef.current = [];
      runActionsRef.current = [];
      replayIndexRef.current = 0;
    },
    [createSimulationForLevel],
  );

  useEffect(() => {
    simulationRef.current = simulation;
  }, [simulation]);

  useEffect(() => {
    const fallbackId = simulation.robots[0]?.id ?? null;
    if (selectedRobotId && simulation.robots.some((robot) => robot.id === selectedRobotId)) {
      return;
    }
    setSelectedRobotId(fallbackId);
  }, [selectedRobotId, simulation.robots]);

  useEffect(() => {
    if (!selectedRobotId) {
      const fallbackId = simulation.robots[0]?.id ?? null;
      setVmState(fallbackId ? vmStatesRef.current.get(fallbackId) ?? null : null);
      return;
    }
    setVmState(vmStatesRef.current.get(selectedRobotId) ?? null);
  }, [selectedRobotId, simulation.robots]);

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

  const compileProgram = (): ProgramNode | null => {
    const workspace = workspaceRef.current;
    if (!workspace) {
      return null;
    }
    return compileWorkspace(workspace);
  };

  const performStep = () => {
    const currentSimulation = simulationRef.current;
    if (currentSimulation.status !== 'running') {
      setIsRunning(false);
      return;
    }

    const program = compileProgram();
    if (!program) {
      setIsRunning(false);
      return;
    }

    if (currentSimulation.robots.length === 0) {
      setIsRunning(false);
      return;
    }

    const vmStates = new Map(vmStatesRef.current);
    const actions: Array<RobotAction | undefined> = [];
    const actionsByRobot = new Map<string, RobotAction>();
    let sawStepLimit = false;

    currentSimulation.robots.forEach((robot) => {
      let robotVm = vmStates.get(robot.id);
      if (!robotVm) {
        robotVm = createVm(program);
        vmStates.set(robot.id, robotVm);
      }

      if (!robot.alive || robot.reachedGoal || robotVm.status !== 'running') {
        actions.push(undefined);
        return;
      }

      const vmResult = stepVm(robotVm, {
        world: currentSimulation.world,
        robot,
        exits: currentSimulation.exits,
        globalSignal: currentSimulation.globalSignal,
      });
      vmStates.set(robot.id, vmResult.state);
      if (vmResult.action) {
        actionsByRobot.set(robot.id, vmResult.action);
        actions.push(vmResult.action);
      } else {
        actions.push(undefined);
      }

      if (vmResult.state.status === 'step_limit') {
        sawStepLimit = true;
      }
    });

    vmStatesRef.current = vmStates;
    const selectedId = selectedRobotId ?? currentSimulation.robots[0]?.id ?? null;
    const selectedVm = selectedId ? vmStates.get(selectedId) ?? null : null;
    setVmState(selectedVm);

    let nextSimulation = currentSimulation;
    if (actions.some((action) => action)) {
      nextSimulation = stepSimulation(currentSimulation, actions);
      runActionsRef.current = [...runActionsRef.current, actions];
    }

    if (sawStepLimit) {
      nextSimulation = { ...nextSimulation, status: 'lost' };
    }

    let updatedTrace = traceRef.current;
    const selectedAction =
      (selectedId ? actionsByRobot.get(selectedId) : undefined) ??
      actionsByRobot.get(currentSimulation.robots[0]?.id ?? '');
    if (selectedAction) {
      updatedTrace = [...traceRef.current, selectedAction];
      traceRef.current = updatedTrace;
      setActionTrace(updatedTrace);
      setCurrentAction(selectedAction);
    }

    setSimulation(nextSimulation);

    if (nextSimulation.status === 'lost') {
      const reachedLimit =
        sawStepLimit ||
        nextSimulation.stepCount >= nextSimulation.maxSteps;
      const savedCount = nextSimulation.robots.filter((robot) => robot.reachedGoal).length;
      const hasActiveRobot = nextSimulation.robots.some(
        (robot) => robot.alive && !robot.reachedGoal,
      );
      const remainingCount = Math.max(
        nextSimulation.spawner.count - nextSimulation.spawnedCount,
        0,
      );
      const fellShortOnQuota =
        savedCount < nextSimulation.requiredSaved && !hasActiveRobot && remainingCount === 0;
      if (reachedLimit) {
        setFailReason('step_limit');
      } else if (fellShortOnQuota) {
        setFailReason('quota');
      } else if (nextSimulation.robots.some((robot) => !robot.alive)) {
        setFailReason('hazard');
      } else {
        setFailReason('unknown');
      }
    } else if (nextSimulation.status === 'won') {
      setFailReason(null);
    }

    if (
      nextSimulation.status !== 'running' ||
      vmStatesRef.current.size === 0 ||
      Array.from(vmStatesRef.current.values()).every((state) => state.status !== 'running')
    ) {
      setIsRunning(false);
      if (runActionsRef.current.length > 0) {
        setLastRunActions([...runActionsRef.current]);
      }
    }
  };

  const handleRun = () => {
    if (simulation.status !== 'running') {
      return;
    }
    if (!isRunning && !isReplaying) {
      const vmStates = vmStatesRef.current;
      const allStopped =
        vmStates.size > 0 &&
        Array.from(vmStates.values()).every((state) => state.status !== 'running');
      if (allStopped) {
        vmStatesRef.current = new Map();
        runActionsRef.current = [];
        traceRef.current = [];
        setActionTrace([]);
        setCurrentAction(null);
        setVmState(null);
      }
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
    vmStatesRef.current = new Map();
    traceRef.current = [];
    runActionsRef.current = [];
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
    vmStatesRef.current = new Map();
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
      for (let row = 0; row < world.height; row += 1) {
        for (let col = 0; col < world.width; col += 1) {
          const tile = world.grid[row][col];
          if (tile === TileType.PressurePlate) {
            drawThumbnailPlate(ctx, col, row, thumbnailTileSize);
          } else if (tile === TileType.Door) {
            drawThumbnailDoor(ctx, col, row, thumbnailTileSize);
          }
        }
      }
      thumbnails[level.id] = canvas.toDataURL('image/png');
    });
    setLevelThumbnails(thumbnails);
  }, [renderAssets, selectedRobotId]);

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
        robotBubbleId,
        selectedRobotId,
      });
      animationFrame = window.requestAnimationFrame(renderLoop);
    };

    animationFrame = window.requestAnimationFrame(renderLoop);

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [renderAssets, robotBubbleId]);

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
      const actionSet = lastRunRef.current[index];
      if (!actionSet) {
        setIsReplaying(false);
        return;
      }

      const currentSimulation = simulationRef.current;
      const nextSimulation = stepSimulation(currentSimulation, actionSet);
      setSimulation(nextSimulation);

      const selectedId = selectedRobotId ?? currentSimulation.robots[0]?.id ?? null;
      const selectedIndex = selectedId
        ? currentSimulation.robots.findIndex((robot) => robot.id === selectedId)
        : -1;
      const selectedAction =
        (selectedIndex >= 0 ? actionSet[selectedIndex] : undefined) ?? actionSet[0];
      if (selectedAction) {
        const updatedTrace = [...traceRef.current, selectedAction];
        traceRef.current = updatedTrace;
        setActionTrace(updatedTrace);
        setCurrentAction(selectedAction);
      }

      const nextIndex = index + 1;
      setReplayIndex(nextIndex);
      replayIndexRef.current = nextIndex;

      if (nextSimulation.status !== 'running' || nextIndex >= lastRunRef.current.length) {
        setIsReplaying(false);
      }
    }, speedMs);

    return () => window.clearInterval(interval);
  }, [isReplaying, selectedRobotId, speedMs]);

  useEffect(() => {
    if (!traceLogRef.current) {
      return;
    }

    traceLogRef.current.scrollTop = traceLogRef.current.scrollHeight;
  }, [actionTrace.length]);

  const handleCanvasPointerDown = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (event.clientX - rect.left) * scaleX;
      const y = (event.clientY - rect.top) * scaleY;
      const tileX = Math.floor(x / TILE_SIZE);
      const tileY = Math.floor(y / TILE_SIZE);
      const clickedRobot = simulationRef.current.robots.find(
        (robot) => robot.x === tileX && robot.y === tileY,
      );
      if (clickedRobot) {
        setSelectedRobotId(clickedRobot.id);
        setRobotBubbleId(clickedRobot.id);
        event.preventDefault();
      }
    },
    [],
  );

  const selectedRobot = useMemo(() => {
    if (selectedRobotId) {
      const match = simulation.robots.find((robot) => robot.id === selectedRobotId);
      if (match) {
        return match;
      }
    }
    return simulation.robots[0] ?? null;
  }, [selectedRobotId, simulation.robots]);

  const isBusy = isRunning || isReplaying;
  const hasReplay = lastRunActions.length > 0;
  const currentLevel = levels[levelIndex];
  const hasNextLevel = levelIndex + 1 < levels.length;
  const activeSpeedOption = speedOptions.find((option) => option.value === speedMs);
  const showOverlay = (simulation.status === 'won' || simulation.status === 'lost') && !isReplaying;
  const failMessage =
    failReason === 'hazard'
      ? 'A robot hit a hazard.'
      : failReason === 'step_limit'
        ? 'Too many steps without saving enough robots.'
        : failReason === 'quota'
          ? 'Not enough robots made it to the exit.'
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
        ? 'Robots Lost'
        : isRunning
          ? 'Running'
          : isReplaying
            ? 'Replaying'
            : 'Ready';

  const savedCount = simulation.robots.filter((robot) => robot.reachedGoal).length;
  const lostCount = simulation.robots.filter((robot) => !robot.alive).length;
  const activeCount = simulation.robots.filter(
    (robot) => robot.alive && !robot.reachedGoal,
  ).length;
  const remainingCount = Math.max(simulation.spawner.count - simulation.spawnedCount, 0);
  const hasDoors = simulation.world.grid.some((row) => row.some((tile) => tile === TileType.Door));
  const doorStatus = hasDoors
    ? isDoorOpen(simulation.world, simulation.robots, simulation.doorUnlocked)
      ? 'Open'
      : 'Closed'
    : '—';
  const signalStatus = simulation.globalSignal ? 'On' : 'Off';
  const quotaLabel = `${savedCount} / ${simulation.requiredSaved}`;
  const selectedRobotStatus = selectedRobot
    ? selectedRobot.reachedGoal
      ? 'Saved'
      : selectedRobot.alive
        ? 'Active'
        : 'Lost'
    : '—';
  const nextSpawnMessage =
    simulation.spawnedCount >= simulation.spawner.count
      ? 'All robots deployed.'
      : simulation.nextSpawnTick === null
        ? 'Spawner idle.'
        : `Next spawn in ${Math.max(simulation.nextSpawnTick - simulation.stepCount, 0)} ticks.`;
  const bubbleRobot = robotBubbleId
    ? simulation.robots.find((robot) => robot.id === robotBubbleId) ?? null
    : null;
  const bubbleVmState = robotBubbleId
    ? vmStatesRef.current.get(robotBubbleId) ?? null
    : null;
  const bubbleStatus = bubbleRobot
    ? bubbleRobot.reachedGoal
      ? 'Saved'
      : bubbleRobot.alive
        ? 'Active'
        : 'Lost'
    : '—';
  const bubbleAction = bubbleVmState?.currentNode?.action;
  const bubbleProgramLabel = bubbleAction
    ? actionLabels[bubbleAction]
    : bubbleVmState?.status === 'done'
      ? 'Program complete'
      : 'Idle';
  const bubbleIsBelow = bubbleRobot ? bubbleRobot.y <= 1 : false;
  const bubblePosition = bubbleRobot
    ? {
        left: `${((bubbleRobot.x + 0.5) / simulation.world.width) * 100}%`,
        top: `${((bubbleRobot.y + 0.2) / simulation.world.height) * 100}%`,
      }
    : { left: '50%', top: '12%' };

  useLayoutEffect(() => {
    if (!robotBubbleId) {
      setBubbleShift(0);
      return;
    }

    const updateShift = () => {
      const bubbleEl = bubbleRef.current;
      const stageEl = simStageRef.current;
      if (!bubbleEl || !stageEl) {
        return;
      }

      const padding = 12;
      const stageRect = stageEl.getBoundingClientRect();
      const bubbleRect = bubbleEl.getBoundingClientRect();
      let shift = 0;

      if (bubbleRect.left < stageRect.left + padding) {
        shift = stageRect.left + padding - bubbleRect.left;
      } else if (bubbleRect.right > stageRect.right - padding) {
        shift = stageRect.right - padding - bubbleRect.right;
      }

      setBubbleShift(shift);
    };

    updateShift();
    window.addEventListener('resize', updateShift);
    return () => window.removeEventListener('resize', updateShift);
  }, [robotBubbleId, bubblePosition.left, bubblePosition.top]);

  return (
    <div className={`app${isEditorOpen ? ' app--editor-open' : ''}`}>
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
        <section className="sim-panel" aria-label="Simulation">
          <div className="sim-surface">
            <div
              className="sim-stage"
              style={{
                aspectRatio: `${simulation.world.width} / ${simulation.world.height}`,
              }}
              ref={simStageRef}
            >
              <canvas
                ref={canvasRef}
                width={simulation.world.width * TILE_SIZE}
                height={simulation.world.height * TILE_SIZE}
                onPointerDown={handleCanvasPointerDown}
              />
              {robotBubbleId ? (
                <div
                  className={`robot-bubble${bubbleIsBelow ? ' robot-bubble--below' : ''}`}
                  style={{
                    ...bubblePosition,
                    '--bubble-shift': `${bubbleShift}px`,
                  }}
                  ref={bubbleRef}
                >
                  <div className="robot-bubble__header">
                    <div>
                      <p className="robot-bubble__eyebrow">Robot</p>
                      <h4>{robotBubbleId}</h4>
                    </div>
                    <button
                      type="button"
                      className="robot-bubble__close"
                      onClick={() => setRobotBubbleId(null)}
                      aria-label="Close robot details"
                    >
                      ✕
                    </button>
                  </div>
                  {bubbleRobot ? (
                    <dl className="robot-bubble__details">
                      <div>
                        <dt>Status</dt>
                        <dd>{bubbleStatus}</dd>
                      </div>
                      <div>
                        <dt>Position</dt>
                        <dd>
                          ({bubbleRobot.x}, {bubbleRobot.y})
                        </dd>
                      </div>
                      <div>
                        <dt>Facing</dt>
                        <dd>{directionLabels[bubbleRobot.direction]}</dd>
                      </div>
                      <div>
                        <dt>Program</dt>
                        <dd>{bubbleProgramLabel}</dd>
                      </div>
                      <div>
                        <dt>VM</dt>
                        <dd>{bubbleVmState?.status ?? 'idle'}</dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="robot-bubble__empty">Robot not active yet.</p>
                  )}
                </div>
              ) : null}
              {showOverlay ? (
                <div className={`sim-overlay sim-overlay--${simulation.status}`}>
                  <div className="sim-overlay__card">
                    <p className="sim-overlay__eyebrow">
                      {simulation.status === 'won' ? 'Level Complete' : 'Try Again'}
                    </p>
                    <h3>
                      {simulation.status === 'won'
                        ? 'Exit reached!'
                        : 'Robots lost in the maze.'}
                    </h3>
                    <p className="sim-overlay__hint">
                      {simulation.status === 'won'
                        ? `Saved ${savedCount} of ${simulation.requiredSaved} robots.`
                        : failMessage}
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
          </div>
        </section>
        <section className="panel panel--editor" aria-label="Block editor">
          <div className="panel__header">
            <h2>Block Editor</h2>
            <button
              type="button"
              className="panel__close"
              onClick={() => setIsEditorOpen(false)}
              aria-label="Close block editor"
            >
              ✕
            </button>
          </div>
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
              <div className="status-card">
                <p className="status-card__label">Doors</p>
                <p className="status-card__value">{doorStatus}</p>
              </div>
              <div className="status-card">
                <p className="status-card__label">Signal</p>
                <p className="status-card__value">{signalStatus}</p>
              </div>
            </div>
            <div className="console__robots">
              <div className="console__robots-header">
                <div>
                  <h3>Robot Monitor</h3>
                  <p>
                    Spawned {simulation.spawnedCount} / {simulation.spawner.count}
                  </p>
                </div>
                <p className="console__robots-subtitle">{nextSpawnMessage}</p>
              </div>
              <div className="console__robots-stats">
                <div className="robot-stat">
                  <p className="robot-stat__label">Active</p>
                  <p className="robot-stat__value">{activeCount}</p>
                </div>
                <div className="robot-stat">
                  <p className="robot-stat__label">Saved</p>
                  <p className="robot-stat__value">{savedCount}</p>
                </div>
                <div className="robot-stat">
                  <p className="robot-stat__label">Quota</p>
                  <p className="robot-stat__value">{quotaLabel}</p>
                </div>
                <div className="robot-stat">
                  <p className="robot-stat__label">Lost</p>
                  <p className="robot-stat__value">{lostCount}</p>
                </div>
                <div className="robot-stat">
                  <p className="robot-stat__label">Waiting</p>
                  <p className="robot-stat__value">{remainingCount}</p>
                </div>
              </div>
              <div className="console__robots-body">
                <div className="robot-inspector">
                  <label htmlFor="robot-select">Inspect robot</label>
                  <select
                    id="robot-select"
                    value={selectedRobot?.id ?? ''}
                    onChange={(event) => setSelectedRobotId(event.target.value)}
                    disabled={simulation.robots.length === 0}
                  >
                    {simulation.robots.length === 0 ? (
                      <option value="">No robots spawned</option>
                    ) : (
                      simulation.robots.map((robot) => (
                        <option key={robot.id} value={robot.id}>
                          {robot.id}
                        </option>
                      ))
                    )}
                  </select>
                  {selectedRobot ? (
                    <dl className="robot-inspector__details">
                      <div>
                        <dt>Status</dt>
                        <dd>{selectedRobotStatus}</dd>
                      </div>
                      <div>
                        <dt>Position</dt>
                        <dd>
                          ({selectedRobot.x}, {selectedRobot.y})
                        </dd>
                      </div>
                      <div>
                        <dt>Facing</dt>
                        <dd>{directionLabels[selectedRobot.direction]}</dd>
                      </div>
                      <div>
                        <dt>Exit</dt>
                        <dd>{selectedRobot.reachedGoal ? 'Reached' : 'Not yet'}</dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="robot-inspector__empty">No robots are active yet.</p>
                  )}
                </div>
                <div className="robot-roster" role="list">
                  {simulation.robots.length === 0 ? (
                    <p className="robot-roster__empty">Spawn queue is waiting.</p>
                  ) : (
                    simulation.robots.map((robot) => {
                      const status = robot.reachedGoal
                        ? 'saved'
                        : robot.alive
                          ? 'active'
                          : 'lost';
                      const isSelected = selectedRobot?.id === robot.id;
                      return (
                        <button
                          key={robot.id}
                          type="button"
                          className={`robot-chip robot-chip--${status}${
                            isSelected ? ' is-selected' : ''
                          }`}
                          onClick={() => setSelectedRobotId(robot.id)}
                          role="listitem"
                        >
                          <span>{robot.id}</span>
                          <span className="robot-chip__status">
                            {status === 'saved' ? 'Saved' : status === 'lost' ? 'Lost' : 'Active'}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
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
      <div className="editor-backdrop" onClick={() => setIsEditorOpen(false)} aria-hidden />
      <div className="mobile-console" role="region" aria-label="Quick controls">
        <div className="mobile-console__info">
          <div>
            <span className="mobile-console__label">Status</span>
            <span className="mobile-console__value">{statusLabel}</span>
          </div>
          <div>
            <span className="mobile-console__label">Speed</span>
            <span className="mobile-console__value">{activeSpeedOption?.label ?? '—'}</span>
          </div>
          <div>
            <span className="mobile-console__label">Steps</span>
            <span className="mobile-console__value">{simulation.stepCount}</span>
          </div>
        </div>
        <div className="mobile-console__actions">
          <button type="button" onClick={handleRun} disabled={isBusy}>
            Run
          </button>
          <button type="button" onClick={handlePause} disabled={!isBusy}>
            {isReplaying ? 'Stop' : 'Pause'}
          </button>
          <button type="button" onClick={handleStep} disabled={isBusy}>
            Step
          </button>
          <button type="button" onClick={handleReset}>
            Reset
          </button>
          <button
            type="button"
            className="mobile-console__editor"
            onClick={() => setIsEditorOpen(true)}
          >
            Blocks
          </button>
        </div>
      </div>
      <section className="levels-strip" aria-label="Level selection">
        <div className="levels-strip__header">
          <h3>Levels</h3>
          <p className="levels__hint">
            {unlockAllLevels
              ? 'All levels unlocked for testing.'
              : completedLevels.length === 0
              ? 'Complete level 1 to unlock level 2.'
              : 'Complete a level to unlock the next one.'}
          </p>
          <label className="levels-strip__toggle">
            <input
              type="checkbox"
              checked={unlockAllLevels}
              onChange={(event) => setUnlockAllLevels(event.target.checked)}
            />
            Unlock all levels
          </label>
        </div>
        <div className="levels__grid">
          {levels.map((level, index) => {
            const previousLevel = levels[index - 1];
            const isUnlocked =
              index === 0 ||
              completedLevelSet.has(level.id) ||
              (previousLevel ? completedLevelSet.has(previousLevel.id) : false);
            const canSelect = unlockAllLevels || isUnlocked;
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
                disabled={!canSelect || isBusy}
              >
                <div className="level-card__thumb">
                  {thumbnail ? (
                    <img src={thumbnail} alt={`Level ${index + 1} preview`} />
                  ) : (
                    <div className="level-card__placeholder" aria-hidden="true" />
                  )}
                  {!canSelect ? <div className="level-card__lock">Locked</div> : null}
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
