import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

// --- TYPE DEFINITIONS ---

export type Point = {
  x: number;
  y: number;
};

export type Shape = {
  id: number;
  points: Point[];
  color: string;
};

type Tool = 'draw' | 'fill' | 'delete' | 'edit';

// A more specific type for undo actions can be created if needed
type UndoAction = {
  type: string;
  payload: any;
};

interface DrawingState {
  shapes: Shape[];
  paletteColors: string[];
  shapeIdCounter: number;
  activeTool: Tool;
  currentColor: string;
  currentDrawing: {
    isDrawing: boolean;
    points: Point[];
  };
  selection: {
    shapeIndex: number;
    pointIndex: number;
    isDragging: boolean;
    dragStartPoint?: Point;
  };
  undoStack: UndoAction[];
  redoStack: UndoAction[];
  snapPoint: Point | null;
}

interface DrawingActions {
  setActiveTool: (tool: Tool) => void;
  setCurrentColor: (color: string) => void;
  addPaletteColor: (color: string) => void;
  setSnapPoint: (point: Point | null) => void;
  startDrawing: (point: Point) => void;
  addDrawingPoint: (point: Point) => void;
  finishDrawing: () => void;
  cancelDrawing: () => void;
  deleteShape: (shapeId: number) => void;
  fillShape: (shapeId: number, newColor: string) => void;
  startDraggingPoint: (shapeIndex: number, pointIndex: number, startPoint: Point) => void;
  dragPoint: (newPoint: Point) => void;
  finishDraggingPoint: () => void;
  clearCanvas: () => void;
  importShapes: (importedShapes: Omit<Shape, 'id'>[]) => void;
  undo: () => void;
  redo: () => void;
  saveStateToLocalStorage: () => void;
  loadStateFromLocalStorage: () => void;
}

type DrawingStore = DrawingState & DrawingActions;

// Helper to create a deep copy
const deepCopy = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));

export const useDrawingStore = create<DrawingStore>()(subscribeWithSelector((set, get) => ({
  // --- STATE ---
  shapes: [],
  paletteColors: ["#000000", "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF"],
  shapeIdCounter: 0,
  activeTool: 'draw',
  currentColor: '#000000',
  currentDrawing: {
    isDrawing: false,
    points: [],
  },
  selection: {
    shapeIndex: -1,
    pointIndex: -1,
    isDragging: false,
  },
  undoStack: [],
  redoStack: [],
  snapPoint: null,

  // --- ACTIONS ---

  // --- Tool and Color Management ---
  setActiveTool: (tool) => set({ activeTool: tool, selection: { shapeIndex: -1, pointIndex: -1, isDragging: false } }),
  setCurrentColor: (color) => set({ currentColor: color }),
  addPaletteColor: (color) => {
    const { paletteColors } = get();
    const newPalette = [...paletteColors];
    const existingIndex = newPalette.indexOf(color);
    if (existingIndex !== -1) {
      newPalette.splice(existingIndex, 1);
    }
    newPalette.push(color);
    if (newPalette.length > 10) {
      newPalette.shift();
    }
    set({ paletteColors: newPalette });
  },

  setSnapPoint: (point) => set({ snapPoint: point }),

  // --- Drawing Actions ---
  startDrawing: (point) => {
    set({
      currentDrawing: { isDrawing: true, points: [point] },
      activeTool: 'draw' // Ensure draw tool is active
    });
  },

  addDrawingPoint: (point) => {
    const { currentDrawing } = get();
    if (!currentDrawing.isDrawing) return;
    // Add point if it's different from the last one
    const lastPoint = currentDrawing.points[currentDrawing.points.length - 1];
    if (point.x !== lastPoint.x || point.y !== lastPoint.y) {
      set({
        currentDrawing: {
          ...currentDrawing,
          points: [...currentDrawing.points, point],
        },
      });
    }
  },

  finishDrawing: () => {
    const { currentDrawing, shapes, shapeIdCounter, currentColor, addPaletteColor } = get();
    if (!currentDrawing.isDrawing || currentDrawing.points.length < 2) {
      set({ currentDrawing: { isDrawing: false, points: [] } });
      return;
    }

    const newId = shapeIdCounter + 1;
    const newShape: Shape = {
      id: newId,
      points: deepCopy(currentDrawing.points),
      color: currentColor,
    };

    const undoAction: UndoAction = {
      type: 'DELETE_SHAPE',
      payload: { shapeId: newId },
    };

    set((state) => ({
      shapes: [...shapes, newShape],
      shapeIdCounter: newId,
      currentDrawing: { isDrawing: false, points: [] },
      undoStack: [...state.undoStack, undoAction],
      redoStack: [], // Clear redo stack on new action
    }));
    addPaletteColor(currentColor);
  },

  cancelDrawing: () => {
    set({ currentDrawing: { isDrawing: false, points: [] } });
  },

  // --- Shape Manipulation Actions ---
  deleteShape: (shapeId) => {
    const { shapes } = get();
    const shapeToDelete = shapes.find(s => s.id === shapeId);
    if (!shapeToDelete) return;

    const undoAction: UndoAction = {
      type: 'ADD_SHAPE',
      payload: { shape: deepCopy(shapeToDelete) },
    };

    set((state) => ({
      shapes: shapes.filter(s => s.id !== shapeId),
      undoStack: [...state.undoStack, undoAction],
      redoStack: [],
    }));
  },

  fillShape: (shapeId, newColor) => {
    const { shapes, addPaletteColor } = get();
    const shapeToFill = shapes.find(s => s.id === shapeId);
    if (!shapeToFill || shapeToFill.color === newColor) return;

    const oldColor = shapeToFill.color;
    const undoAction: UndoAction = {
      type: 'FILL_SHAPE',
      payload: { shapeId, color: oldColor },
    };

    set((state) => ({
      shapes: shapes.map(s => s.id === shapeId ? { ...s, color: newColor } : s),
      undoStack: [...state.undoStack, undoAction],
      redoStack: [],
    }));
    addPaletteColor(newColor);
  },

  // --- Edit Mode Actions ---
  startDraggingPoint: (shapeIndex, pointIndex, startPoint) => {
    set({ selection: { shapeIndex, pointIndex, isDragging: true, dragStartPoint: startPoint } });
  },

  dragPoint: (newPoint) => {
    const { selection, shapes } = get();
    if (!selection.isDragging) return;

    const newShapes = deepCopy(shapes);
    newShapes[selection.shapeIndex].points[selection.pointIndex] = newPoint;
    set({ shapes: newShapes });
  },

  finishDraggingPoint: () => {
    const { selection, shapes } = get();
    if (!selection.isDragging || !selection.dragStartPoint) return;

    const { shapeIndex, pointIndex, dragStartPoint } = selection;
    const finalPoint = shapes[shapeIndex].points[pointIndex];

    // Only create undo action if the point actually moved
    if (dragStartPoint.x !== finalPoint.x || dragStartPoint.y !== finalPoint.y) {
      const undoAction: UndoAction = {
        type: 'EDIT_SHAPE_POINT',
        payload: {
          shapeIndex,
          pointIndex,
          point: deepCopy(dragStartPoint),
        },
      };
      set(state => ({
        undoStack: [...state.undoStack, undoAction],
        redoStack: [],
      }));
    }
    set({ selection: { shapeIndex: -1, pointIndex: -1, isDragging: false } });
  },

  // --- Canvas-wide Actions ---
  clearCanvas: () => {
    const { shapes } = get();
    if (shapes.length === 0) return;

    const undoAction: UndoAction = {
      type: 'IMPORT_SHAPES',
      payload: { shapes: deepCopy(shapes) },
    };

    set(state => ({
      shapes: [],
      currentDrawing: { isDrawing: false, points: [] },
      undoStack: [...state.undoStack, undoAction],
      redoStack: [],
    }));
  },

  importShapes: (importedShapes) => {
    let { shapeIdCounter } = get();
    const shapesWithIds: Shape[] = importedShapes.map(shape => ({
      ...shape,
      id: ++shapeIdCounter,
    }));

    const undoAction: UndoAction = {
      type: 'DELETE_MULTIPLE_SHAPES',
      payload: { shapeIds: shapesWithIds.map((s: Shape) => s.id) },
    };

    set(state => ({
      shapes: [...state.shapes, ...shapesWithIds],
      shapeIdCounter,
      undoStack: [...state.undoStack, undoAction],
      redoStack: [],
    }));
    shapesWithIds.forEach(s => get().addPaletteColor(s.color));
  },

  // --- UNDO / REDO ---
  undo: () => {
    const { undoStack, redoStack, shapes } = get();
    if (undoStack.length === 0) return;

    const lastAction = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, -1);
    let newRedoStack = [...redoStack, lastAction];
    let newShapes = deepCopy(shapes);

    switch (lastAction.type) {
      case 'DELETE_SHAPE': {
        const { shapeId } = lastAction.payload;
        const shapeToRestore = shapes.find(s => s.id === shapeId); // Find it in the CURRENT state before filtering
        if (shapeToRestore) {
          newRedoStack[newRedoStack.length - 1] = { type: 'ADD_SHAPE', payload: { shape: deepCopy(shapeToRestore) } };
          newShapes = newShapes.filter(s => s.id !== shapeId);
        }
        break;
      }
      case 'ADD_SHAPE': {
        const { shape } = lastAction.payload;
        newShapes.push(shape);
        get().addPaletteColor(shape.color);
        break;
      }
      case 'FILL_SHAPE': {
        const { shapeId, color } = lastAction.payload;
        const shapeToUpdate = newShapes.find(s => s.id === shapeId);
        if (shapeToUpdate) {
          newRedoStack[newRedoStack.length - 1] = { type: 'FILL_SHAPE', payload: { shapeId, color: shapeToUpdate.color } };
          shapeToUpdate.color = color;
        }
        break;
      }
      case 'EDIT_SHAPE_POINT': {
        const { shapeIndex, pointIndex, point } = lastAction.payload;
        const shapeToUpdate = newShapes[shapeIndex];
        if (shapeToUpdate) {
          const oldPoint = shapeToUpdate.points[pointIndex];
          newRedoStack[newRedoStack.length - 1] = { type: 'EDIT_SHAPE_POINT', payload: { shapeIndex, pointIndex, point: deepCopy(oldPoint) } };
          shapeToUpdate.points[pointIndex] = point;
        }
        break;
      }
      case 'IMPORT_SHAPES': {
        const { shapes: shapesToRestore } = lastAction.payload;
        newRedoStack[newRedoStack.length - 1] = { type: 'DELETE_MULTIPLE_SHAPES', payload: { shapeIds: shapesToRestore.map((s: Shape) => s.id) } };
        newShapes.push(...shapesToRestore);
        shapesToRestore.forEach((s: Shape) => get().addPaletteColor(s.color));
        break;
      }
      case 'DELETE_MULTIPLE_SHAPES': {
        const { shapeIds } = lastAction.payload;
        const shapesToRestore = shapes.filter((s: Shape) => shapeIds.includes(s.id));
        newRedoStack[newRedoStack.length - 1] = { type: 'IMPORT_SHAPES', payload: { shapes: deepCopy(shapesToRestore) } };
        newShapes = newShapes.filter((s: Shape) => !shapeIds.includes(s.id));
        break;
      }
    }
    set({ shapes: newShapes, undoStack: newUndoStack, redoStack: newRedoStack });
  },

  redo: () => {
    const { redoStack, undoStack, shapes } = get();
    if (redoStack.length === 0) return;

    const lastAction = redoStack[redoStack.length - 1];
    const newRedoStack = redoStack.slice(0, -1);
    let newUndoStack = [...undoStack, lastAction];
    let newShapes = deepCopy(shapes);

    switch (lastAction.type) {
      case 'ADD_SHAPE': {
        const { shape } = lastAction.payload;
        newShapes.push(shape);
        get().addPaletteColor(shape.color);
        break;
      }
      case 'DELETE_SHAPE': {
        const { shapeId } = lastAction.payload;
        const shapeToRestore = shapes.find((s: Shape) => s.id === shapeId);
        if (shapeToRestore) {
          newUndoStack[newUndoStack.length - 1] = { type: 'ADD_SHAPE', payload: { shape: deepCopy(shapeToRestore) } };
          newShapes = newShapes.filter((s: Shape) => s.id !== shapeId);
        }
        break;
      }
      case 'FILL_SHAPE': {
        const { shapeId, color } = lastAction.payload;
        const shapeToUpdate = newShapes.find((s: Shape) => s.id === shapeId);
        if (shapeToUpdate) {
          newUndoStack[newUndoStack.length - 1] = { type: 'FILL_SHAPE', payload: { shapeId, color: shapeToUpdate.color } };
          shapeToUpdate.color = color;
        }
        break;
      }
      case 'EDIT_SHAPE_POINT': {
        const { shapeIndex, pointIndex, point } = lastAction.payload;
        const shapeToUpdate = newShapes[shapeIndex];
        if (shapeToUpdate) {
          const oldPoint = shapeToUpdate.points[pointIndex];
          newUndoStack[newUndoStack.length - 1] = { type: 'EDIT_SHAPE_POINT', payload: { shapeIndex, pointIndex, point: deepCopy(oldPoint) } };
          shapeToUpdate.points[pointIndex] = point;
        }
        break;
      }
      case 'IMPORT_SHAPES': {
        const { shapes: shapesToRestore } = lastAction.payload;
        newUndoStack[newUndoStack.length - 1] = { type: 'DELETE_MULTIPLE_SHAPES', payload: { shapeIds: shapesToRestore.map((s: Shape) => s.id) } };
        newShapes.push(...shapesToRestore);
        shapesToRestore.forEach((s: Shape) => get().addPaletteColor(s.color));
        break;
      }
      case 'DELETE_MULTIPLE_SHAPES': {
        const { shapeIds } = lastAction.payload;
        const shapesToRestore = shapes.filter((s: Shape) => shapeIds.includes(s.id));
        newUndoStack[newUndoStack.length - 1] = { type: 'IMPORT_SHAPES', payload: { shapes: deepCopy(shapesToRestore) } };
        newShapes = newShapes.filter((s: Shape) => !shapeIds.includes(s.id));
        break;
      }
    }
    set({ shapes: newShapes, undoStack: newUndoStack, redoStack: newRedoStack });
  },

  // --- Persistence ---
  saveStateToLocalStorage: () => {
    const { shapes, paletteColors, shapeIdCounter, undoStack, redoStack } = get();
    const state = { shapes, paletteColors, shapeIdCounter, undoStack, redoStack };
    localStorage.setItem('isometricDrawingState', JSON.stringify(state));
  },

  loadStateFromLocalStorage: () => {
    const savedState = localStorage.getItem('isometricDrawingState');
    if (savedState) {
      try {
        const state = JSON.parse(savedState) as DrawingState;
        if (state && state.shapes && state.paletteColors && state.shapeIdCounter) {
          set(state);
        }
      } catch (e) {
        console.error("Could not parse saved state.", e);
      }
    }
  },
})));

// Subscribe to changes and save to local storage
useDrawingStore.subscribe(
  (state: DrawingState) => [state.shapes, state.paletteColors, state.shapeIdCounter, state.undoStack, state.redoStack],
  (currentState, prevState) => {
    // A simple deep compare to avoid saving on every minor change if state is the same
    if (JSON.stringify(currentState) !== JSON.stringify(prevState)) {
      useDrawingStore.getState().saveStateToLocalStorage();
    }
  },
  { equalityFn: (a, b) => JSON.stringify(a) === JSON.stringify(b) }
);
