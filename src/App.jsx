
import React, { useRef, useEffect } from 'react';
import { CanvasEngine } from './engine/CanvasEngine';
import Toolbar from './components/Toolbar';
import ColorPalette from './components/ColorPalette';

function App() {
  const canvasRef = useRef(null);
  const engineRef = useRef(null); // To hold the engine instance

  useEffect(() => {
    // Instantiate the engine only once
    if (canvasRef.current && !engineRef.current) {
      engineRef.current = new CanvasEngine(canvasRef.current);
    }

    // Cleanup function if needed (e.g., to remove global event listeners)
    return () => {
      // If the engine has a cleanup method, call it here
      // engineRef.current?.destroy();
    };
  }, []); // Empty dependency array ensures this runs only once

  return (
    <main className="app-container">
      <Toolbar engineRef={engineRef} />
      <ColorPalette />
      <section className="canvas-container">
        <canvas ref={canvasRef} id="isometricCanvas"></canvas>
      </section>
    </main>
  );
}

export default App;
