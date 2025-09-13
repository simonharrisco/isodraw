
import React, { useRef } from 'react';
import { useDrawingStore } from '../store/drawingStore';
import { shallow } from 'zustand/shallow';
import { CanvasEngine } from '../engine/CanvasEngine';

interface ToolbarProps {
  engineRef: React.RefObject<CanvasEngine | null>;
}

const Toolbar = ({ engineRef }: ToolbarProps) => {
  const { 
    activeTool, 
    setActiveTool, 
    undo, 
    redo, 
    clearCanvas, 
    undoStack, 
    redoStack 
  } = useDrawingStore(state => ({
    activeTool: state.activeTool,
    setActiveTool: state.setActiveTool,
    undo: state.undo,
    redo: state.redo,
    clearCanvas: state.clearCanvas,
    undoStack: state.undoStack,
    redoStack: state.redoStack,
  }), shallow);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && engineRef.current) {
      engineRef.current.importFromSVG(file);
    }
    if (e.target) {
        e.target.value = ""; // Reset file input
    }
  };

  const handleExportClick = () => {
    if (engineRef.current) {
      engineRef.current.exportToSVG();
    }
  };

  return (
    <section className="toolbar-container">
      <div className="tool-group actions">
        <button onClick={undo} disabled={undoStack.length === 0} title="Undo">Undo</button>
        <button onClick={redo} disabled={redoStack.length === 0} title="Redo">Redo</button>
        <button onClick={clearCanvas} title="Clear Canvas">Clear</button>
        <button onClick={handleImportClick} title="Import SVG">Import</button>
        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".svg" style={{ display: 'none' }} />
        <button onClick={handleExportClick} title="Export SVG">Export</button>
      </div>
      <div className="tool-group tools">
        <button 
          className={`tool-button ${activeTool === 'draw' ? 'active' : ''}`}
          onClick={() => setActiveTool('draw')} 
          title="Draw Tool"
        >
          Draw
        </button>
        <button 
          className={`tool-button ${activeTool === 'fill' ? 'active' : ''}`}
          onClick={() => setActiveTool('fill')} 
          title="Fill Tool"
        >
          Fill
        </button>
        <button 
          className={`tool-button ${activeTool === 'edit' ? 'active' : ''}`}
          onClick={() => setActiveTool('edit')} 
          title="Edit Shape Points"
        >
          Edit
        </button>
        <button 
          className={`tool-button ${activeTool === 'delete' ? 'active' : ''}`}
          onClick={() => setActiveTool('delete')} 
          title="Delete Tool"
        >
          Delete
        </button>
      </div>
    </section>
  );
};

export default Toolbar;
