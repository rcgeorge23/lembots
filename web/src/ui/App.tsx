import { useEffect, useMemo, useRef, useState } from 'react';
import * as Blockly from 'blockly';
import { registerBlocks, toolboxDefinition } from '../blocks/blocklySetup';
import { compileWorkspace } from '../blocks/compile';
import { createVm, stepVm, type VmState } from '../blocks/vm';
import { createRobotState } from '../engine/robot';
import { createSimulation, stepSimulation, type SimulationState } from '../engine/sim';
import { TileType, createWorld } from '../engine/world';
import demoLevel from '../levels/builtin/demo.json';

const TILE_SIZE = 32;

const App = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const blocklyRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);

  const world = useMemo(() => createWorld(demoLevel.grid), []);
  const initialRobot = useMemo(
    () =>
      createRobotState(
        demoLevel.start.x,
        demoLevel.start.y,
        demoLevel.start.dir as 0 | 1 | 2 | 3,
      ),
    [],
  );
  const initialSimulation = useMemo(
    () => createSimulation(world, initialRobot),
    [world, initialRobot],
  );

  const [simulation, setSimulation] = useState<SimulationState>(initialSimulation);
  const [vmState, setVmState] = useState<VmState | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const simulationRef = useRef(simulation);
  const vmRef = useRef(vmState);

  useEffect(() => {
    simulationRef.current = simulation;
  }, [simulation]);

  useEffect(() => {
    vmRef.current = vmState;
  }, [vmState]);

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

    setSimulation(nextSimulation);
    setVmState(vmResult.state);

    if (
      nextSimulation.status !== 'running' ||
      vmResult.state.status !== 'running'
    ) {
      setIsRunning(false);
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
  };

  const handleReset = () => {
    setIsRunning(false);
    setSimulation(initialSimulation);
    setVmState(null);
  };

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
          ctx.fillStyle = '#22c55e';
        } else if (tile === TileType.Hazard) {
          ctx.fillStyle = '#ef4444';
        } else {
          ctx.fillStyle = '#f8fafc';
        }
        ctx.fillRect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
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
    ctx.fillStyle = robot.alive ? '#0f172a' : '#94a3b8';
    ctx.beginPath();
    ctx.arc(centerX, centerY, TILE_SIZE * 0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);

    const directionOffset = TILE_SIZE * 0.35;
    const directionVectors = [
      { x: 0, y: -directionOffset },
      { x: directionOffset, y: 0 },
      { x: 0, y: directionOffset },
      { x: -directionOffset, y: 0 },
    ];
    const vector = directionVectors[robot.direction];
    ctx.lineTo(centerX + vector.x, centerY + vector.y);
    ctx.stroke();
    ctx.lineWidth = 1;
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
    }, 500);

    return () => window.clearInterval(interval);
  }, [isRunning]);

  return (
    <div className="app">
      <header className="app__header">
        <h1>LemBots</h1>
        <p>Scratch-like blocks + robot simulation (scaffold)</p>
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
            <button type="button" onClick={handleRun} disabled={isRunning}>
              Run
            </button>
            <button type="button" onClick={handlePause} disabled={!isRunning}>
              Pause
            </button>
            <button type="button" onClick={handleStep} disabled={isRunning}>
              Step
            </button>
            <button type="button" onClick={handleReset}>
              Reset
            </button>
          </div>
          <div className="controls__status">
            <p>
              Status: {simulation.status}
              {simulation.status === 'running' && isRunning ? ' (running)' : ''}
            </p>
            <p>Steps: {simulation.stepCount}</p>
            <p>VM: {vmState?.status ?? 'idle'}</p>
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;
