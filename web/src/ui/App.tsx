import { useEffect, useRef } from 'react';

const GRID_SIZE = 10;
const TILE_SIZE = 32;

const App = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#cbd5f5';
    for (let row = 0; row < GRID_SIZE; row += 1) {
      for (let col = 0; col < GRID_SIZE; col += 1) {
        ctx.strokeRect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }

    ctx.fillStyle = '#22c55e';
    ctx.fillRect(8 * TILE_SIZE, 8 * TILE_SIZE, TILE_SIZE, TILE_SIZE);

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(1.5 * TILE_SIZE, 1.5 * TILE_SIZE, TILE_SIZE * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }, []);

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
            width={GRID_SIZE * TILE_SIZE}
            height={GRID_SIZE * TILE_SIZE}
          />
        </section>
        <section className="panel">
          <h2>Block Editor</h2>
          <div className="placeholder">Blockly workspace placeholder</div>
        </section>
        <section className="panel">
          <h2>Controls</h2>
          <div className="controls">
            <button type="button">Run</button>
            <button type="button">Step</button>
            <button type="button">Reset</button>
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;
