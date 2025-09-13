
import { useDrawingStore } from '../store/drawingStore';

export class CanvasEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = this.canvas.getContext('2d');

    // --- Configuration ---
    this.gridSize = 30;
    this.dragPointRadius = 8;
    this.angle = Math.PI / 6;
    this.scaleX = Math.cos(this.angle);
    this.scaleY = Math.sin(this.angle);
    this.isoWidth = this.gridSize * this.scaleX;
    this.isoHeight = this.gridSize * this.scaleY;

    // Set canvas size
    this.canvas.width = 800;
    this.canvas.height = 600;

    // --- Initialize ---
    this.initializeEventListeners();

    // Subscribe to store changes for redrawing
    useDrawingStore.subscribe(
      (state) => [state.shapes, state.currentDrawing, state.activeTool, state.selection, state.snapPoint],
      () => this.redrawAll(),
      { equalityFn: (a, b) => JSON.stringify(a) === JSON.stringify(b) }
    );

    // Load initial state and draw
    useDrawingStore.getState().loadStateFromLocalStorage();
    this.redrawAll();
  }

  // --- Event Listeners ---
  initializeEventListeners() {
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.canvas.addEventListener('mouseout', this.handleMouseOut.bind(this));
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
  }

  // --- Input Handlers (Dispatch actions to store) ---
  handleMouseDown(e) {
    if (e.button !== 0) return;
    const { x: canvasX, y: canvasY } = this.getCanvasCoordinates(e);
    const { activeTool, shapes, startDrawing, deleteShape, fillShape, currentColor, startDraggingPoint } = useDrawingStore.getState();

    switch (activeTool) {
      case 'draw': {
        const gridPos = this.screenToNearestGridPoint(canvasX, canvasY);
        const clickedScreenPos = this.gridToScreen(gridPos.x, gridPos.y);
        const { isDrawing, points } = useDrawingStore.getState().currentDrawing;

        if (!isDrawing) {
          startDrawing(clickedScreenPos);
        } else {
          const startPoint = points[0];
          const dx = clickedScreenPos.x - startPoint.x;
          const dy = clickedScreenPos.y - startPoint.y;
          const closeToleranceSq = (this.dragPointRadius * 1.5) ** 2;
          const isClosing = (dx * dx + dy * dy < closeToleranceSq) && points.length >= 3;

          if (isClosing) {
            useDrawingStore.getState().finishDrawing();
          } else {
            useDrawingStore.getState().addDrawingPoint(clickedScreenPos);
          }
        }
        break;
      }
      case 'fill': {
        for (let i = shapes.length - 1; i >= 0; i--) {
          const shape = shapes[i];
          if (this.isPointInPolygon({ x: canvasX, y: canvasY }, shape.points)) {
            fillShape(shape.id, currentColor);
            break;
          }
        }
        break;
      }
      case 'delete': {
        for (let i = shapes.length - 1; i >= 0; i--) {
          const shape = shapes[i];
          if (this.isPointInPolygon({ x: canvasX, y: canvasY }, shape.points)) {
            deleteShape(shape.id);
            break;
          }
        }
        break;
      }
      case 'edit': {
        for (let i = shapes.length - 1; i >= 0; i--) {
          const shape = shapes[i];
          for (let j = 0; j < shape.points.length; j++) {
            const point = shape.points[j];
            const dx = canvasX - point.x;
            const dy = canvasY - point.y;
            if (dx * dx + dy * dy < this.dragPointRadius * this.dragPointRadius) {
              startDraggingPoint(i, j, { ...point });
              this.canvas.style.cursor = 'grabbing';
              return; // Found a point, stop
            }
          }
        }
        break;
      }
    }
  }

  handleMouseMove(e) {
    const { x: canvasX, y: canvasY } = this.getCanvasCoordinates(e);
    const { activeTool, selection, shapes, dragPoint } = useDrawingStore.getState();

    if (activeTool === 'edit' && selection.isDragging) {
      const gridPos = this.screenToNearestGridPoint(canvasX, canvasY);
      const snappedScreenPos = this.gridToScreen(gridPos.x, gridPos.y);
      dragPoint(snappedScreenPos);
      return;
    }

    let cursorStyle = 'default';
    const { setSnapPoint } = useDrawingStore.getState();

    if (activeTool === 'draw') {
      const gridPos = this.screenToNearestGridPoint(canvasX, canvasY);
      const snappedScreenPos = this.gridToScreen(gridPos.x, gridPos.y);
      setSnapPoint(snappedScreenPos);
      cursorStyle = 'crosshair';
    } else if (activeTool === 'fill') {
      setSnapPoint(null);
      cursorStyle = 'crosshair';
    } else if (activeTool === 'delete') {
      setSnapPoint(null);
      cursorStyle = 'not-allowed';
    } else if (activeTool === 'edit') {
      setSnapPoint(null);
      let pointHovered = false;
      for (const shape of shapes) {
        for (const point of shape.points) {
          const dx = canvasX - point.x;
          const dy = canvasY - point.y;
          if (dx * dx + dy * dy < this.dragPointRadius * this.dragPointRadius) {
            pointHovered = true;
            break;
          }
        }
        if (pointHovered) break;
      }
      cursorStyle = pointHovered ? 'grab' : 'default';
    }
    this.canvas.style.cursor = cursorStyle;
  }

  handleMouseUp(e) {
    if (e.button !== 0) return;
    const { activeTool, selection, finishDraggingPoint } = useDrawingStore.getState();

    if (activeTool === 'edit' && selection.isDragging) {
      finishDraggingPoint();
      this.canvas.style.cursor = 'default';
    }
  }

  handleMouseOut() {
    const { activeTool, selection, finishDraggingPoint } = useDrawingStore.getState();
    if (activeTool === 'edit' && selection.isDragging) {
      finishDraggingPoint();
    }
  }

  handleKeyDown(e) {
    const { undo, redo, cancelDrawing, setActiveTool } = useDrawingStore.getState();
    const isModKey = e.ctrlKey || e.metaKey;

    if (isModKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      e.shiftKey ? redo() : undo();
    } else if (e.key === 'Escape') {
      if (useDrawingStore.getState().currentDrawing.isDrawing) {
        cancelDrawing();
      } else {
        setActiveTool('draw');
      }
    }
  }

  // --- Rendering (Read from store) ---
  redrawAll() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawGrid();
    this.drawShapes();
    this.drawCurrentShape();
    this.drawEditHandles();
    this.drawSnapPoint();
  }

  drawSnapPoint() {
    const { snapPoint } = useDrawingStore.getState();
    if (!snapPoint) return;

    this.ctx.fillStyle = '#FFEB3B'; // Yellow snap point indicator
    this.ctx.strokeStyle = '#FBC02D'; // Darker yellow border
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.arc(snapPoint.x, snapPoint.y, 5, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
  }

  drawGrid() {
    this.ctx.strokeStyle = '#eee';
    this.ctx.lineWidth = 0.5;
    const range = 25;
    for (let i = -range; i <= range; i++) {
      const start = this.gridToScreen(i, -range);
      const end = this.gridToScreen(i, range);
      this.ctx.beginPath();
      this.ctx.moveTo(start.x, start.y);
      this.ctx.lineTo(end.x, end.y);
      this.ctx.stroke();
    }
    for (let j = -range; j <= range; j++) {
      const start = this.gridToScreen(-range, j);
      const end = this.gridToScreen(range, j);
      this.ctx.beginPath();
      this.ctx.moveTo(start.x, start.y);
      this.ctx.lineTo(end.x, end.y);
      this.ctx.stroke();
    }
  }

  drawShapes() {
    const { shapes } = useDrawingStore.getState();
    shapes.forEach(({ points, color }) => {
      if (points.length < 2) return;
      this.ctx.strokeStyle = color;
      this.ctx.fillStyle = color;
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        this.ctx.lineTo(points[i].x, points[i].y);
      }
      if (points.length > 2) {
        this.ctx.closePath();
        this.ctx.fill();
      }
      this.ctx.stroke();
    });
  }

  drawCurrentShape() {
    const { currentDrawing, currentColor } = useDrawingStore.getState();
    if (!currentDrawing.isDrawing || currentDrawing.points.length === 0) return;

    const { points } = currentDrawing;
    this.ctx.strokeStyle = currentColor;
    this.ctx.lineWidth = 1;
    this.ctx.fillStyle = currentColor;

    // Draw start point
    const startPoint = points[0];
    this.ctx.save();
    this.ctx.fillStyle = '#f06292';
    this.ctx.strokeStyle = '#c2185b';
    this.ctx.beginPath();
    this.ctx.arc(startPoint.x, startPoint.y, 6, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.restore();

    // Draw lines
    this.ctx.beginPath();
    this.ctx.moveTo(startPoint.x, startPoint.y);
    for (let i = 1; i < points.length; i++) {
      this.ctx.lineTo(points[i].x, points[i].y);
    }

    // Draw preview line to snap point
    const { snapPoint } = useDrawingStore.getState();
    if (snapPoint) {
        this.ctx.lineTo(snapPoint.x, snapPoint.y);
    }

    this.ctx.stroke();
  }

  drawEditHandles() {
    const { activeTool, shapes, selection } = useDrawingStore.getState();
    if (activeTool !== 'edit') return;

    shapes.forEach(({ points }) => {
      points.forEach((point) => {
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.arc(point.x, point.y, this.dragPointRadius / 2, 0, Math.PI * 2);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.strokeStyle = '#007aff';
        this.ctx.lineWidth = 1.5;
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.restore();
      });
    });

    if (selection.isDragging) {
      const selectedPoint = shapes[selection.shapeIndex].points[selection.pointIndex];
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(selectedPoint.x, selectedPoint.y, this.dragPointRadius / 2 + 2, 0, Math.PI * 2);
      this.ctx.fillStyle = 'rgba(0, 122, 255, 0.3)';
      this.ctx.fill();
      this.ctx.restore();
    }
  }

  // --- Utility Methods ---
  getCanvasCoordinates(event) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return { x: (event.clientX - rect.left) * scaleX, y: (event.clientY - rect.top) * scaleY };
  }

  screenToNearestGridPoint(canvasX, canvasY) {
    const originX = this.canvas.width / 2;
    const originY = this.canvas.height / 2;
    const relX = canvasX - originX;
    const relY = canvasY - originY;
    const gridX = Math.round((relX / this.isoWidth + relY / this.isoHeight) / 2);
    const gridY = Math.round((relY / this.isoHeight - relX / this.isoWidth) / 2);
    return { x: gridX, y: gridY };
  }

  gridToScreen(gridX, gridY) {
    const originX = this.canvas.width / 2;
    const originY = this.canvas.height / 2;
    const screenX = originX + (gridX - gridY) * this.isoWidth;
    const screenY = originY + (gridX + gridY) * this.isoHeight;
    return { x: screenX, y: screenY };
  }

  isPointInPolygon(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      let xi = polygon[i].x, yi = polygon[i].y;
      let xj = polygon[j].x, yj = polygon[j].y;
      let intersect = (yi > point.y) !== (yj > point.y) && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }
  
  // Public method to handle file import
  importFromSVG(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const svgContent = e.target.result;
      try {
        const parsedShapes = this.parseSVGContent(svgContent);
        if (parsedShapes.length > 0) {
          useDrawingStore.getState().importShapes(parsedShapes);
        }
      } catch (error) {
        console.error("Error parsing SVG:", error);
        alert("Failed to parse SVG.");
      }
    };
    reader.readAsText(file);
  }

  parseSVGContent(svgContent) {
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgContent, "image/svg+xml");
    const shapeElements = svgDoc.querySelectorAll("polygon, polyline");
    const parsedShapes = [];
    shapeElements.forEach(el => {
      const pointsString = el.getAttribute("points")?.trim();
      if (!pointsString) return;
      const color = el.getAttribute("fill") || el.getAttribute("stroke") || "#000000";
      const points = pointsString.split(/\s+/).map(pair => {
        const [xStr, yStr] = pair.split(",");
        const x = parseFloat(xStr);
        const y = parseFloat(yStr);
        if (!isNaN(x) && !isNaN(y)) {
          const gridPos = this.screenToNearestGridPoint(x, y);
          return this.gridToScreen(gridPos.x, gridPos.y);
        }
        return null;
      }).filter(p => p !== null);

      if (points.length > 1) {
        parsedShapes.push({ points, color });
      }
    });
    return parsedShapes;
  }

  exportToSVG() {
    const { shapes } = useDrawingStore.getState();
    if (shapes.length === 0) {
      this.downloadSVG('<svg width="10" height="10" xmlns="http://www.w3.org/2000/svg"></svg>', 'empty.svg');
      return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    shapes.forEach(({ points }) => {
      points.forEach(point => {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      });
    });

    const padding = 10;
    const viewBoxX = minX - padding;
    const viewBoxY = minY - padding;
    const viewBoxWidth = maxX - minX + padding * 2;
    const viewBoxHeight = maxY - minY + padding * 2;
    const finalWidth = Math.max(1, viewBoxWidth);
    const finalHeight = Math.max(1, viewBoxHeight);

    let svgContent = `<svg width="${finalWidth}" height="${finalHeight}" viewBox="${viewBoxX} ${viewBoxY} ${finalWidth} ${finalHeight}" xmlns="http://www.w3.org/2000/svg">`;
    shapes.forEach(({ points, color }) => {
      let pointsString = points.map(p => `${p.x},${p.y}`).join(" ");
      if (points.length > 2) {
        svgContent += `<polygon points="${pointsString}" fill="${color}" stroke="${color}" stroke-width="1"/>`;
      } else {
        svgContent += `<polyline points="${pointsString}" fill="none" stroke="${color}" stroke-width="1"/>`;
      }
    });
    svgContent += `</svg>`;
    this.downloadSVG(svgContent, 'drawing.svg');
  }

  downloadSVG(svgContent, filename) {
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
