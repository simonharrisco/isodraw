// --- Command Pattern ---

// Base Command (Interface concept)
class Command {
  constructor() {
    if (this.constructor === Command) {
      throw new Error("Abstract classes can't be instantiated.");
    }
  }
  execute() {
    throw new Error("Method 'execute()' must be implemented.");
  }
  undo() {
    throw new Error("Method 'undo()' must be implemented.");
  }
}

// Concrete Commands
class AddShapeCommand extends Command {
  constructor(tool, shapeData) {
    super();
    //test comment
    this.tool = tool;
    this.shapeData = shapeData; // { points: [...], color: '...', id: ... } - ID added in execute
  }

  execute() {
    // Assign unique ID if it doesn't have one (e.g., on first execution)
    if (this.shapeData.id === undefined) {
      this.shapeData.id = this.tool.getNextShapeId();
    }
    this.tool.shapes.push(this.shapeData);
    this.tool.addPaletteColor(this.shapeData.color);
  }

  undo() {
    // Find shape by ID
    const index = this.tool.shapes.findIndex(
      (shape) => shape.id === this.shapeData.id
    );
    if (index > -1) {
      this.tool.shapes.splice(index, 1);
    } else {
      console.warn(
        `AddShapeCommand undo: Shape with ID ${this.shapeData.id} not found.`
      );
    }
  }
}

class DeleteShapeCommand extends Command {
  constructor(tool, shapeIndex, deletedShape) {
    super();
    this.tool = tool;
    this.shapeIndex = shapeIndex; // Store index at time of deletion
    this.deletedShape = deletedShape; // Must include ID: { points: [...], color: '...', id: ... }
  }

  execute() {
    // Use the index determined *at the time the command was created* for execute/redo
    // We trust this index was correct relative to the state *before* execution.
    if (this.shapeIndex >= 0 && this.shapeIndex < this.tool.shapes.length) {
      // Optional: Double-check if the shape at the index has the expected ID
      if (this.tool.shapes[this.shapeIndex].id === this.deletedShape.id) {
        this.tool.shapes.splice(this.shapeIndex, 1);
        // console.log(`DeleteShapeCommand executed: Spliced shape ID ${this.deletedShape.id} at index ${this.shapeIndex}`);
      } else {
        console.warn(
          `DeleteShapeCommand execute: Shape ID mismatch at index ${
            this.shapeIndex
          }. Expected ${this.deletedShape.id}, found ${
            this.tool.shapes[this.shapeIndex]?.id
          }. Deleting based on index anyway.`
        );
        // Still attempt deletion based on original index, though state might be inconsistent
        this.tool.shapes.splice(this.shapeIndex, 1);
      }
    } else {
      console.warn(
        `DeleteShapeCommand execute: Invalid or outdated shape index ${this.shapeIndex} for shapes length ${this.tool.shapes.length}. Cannot delete.`
      );
    }
  }

  undo() {
    // Restore the shape at its original index
    this.tool.shapes.splice(this.shapeIndex, 0, this.deletedShape);
    this.tool.addPaletteColor(this.deletedShape.color);
  }
}

class FillShapeCommand extends Command {
  constructor(tool, shapeIndex, oldColor, newColor) {
    super();
    this.tool = tool;
    this.shapeIndex = shapeIndex;
    this.oldColor = oldColor;
    this.newColor = newColor;
  }

  execute() {
    if (this.tool.shapes[this.shapeIndex]) {
      this.tool.shapes[this.shapeIndex].color = this.newColor;
      this.tool.addPaletteColor(this.newColor);
    }
  }

  undo() {
    if (this.tool.shapes[this.shapeIndex]) {
      this.tool.shapes[this.shapeIndex].color = this.oldColor;
      // Again, palette undo is tricky.
    }
  }
}

class EditShapePointCommand extends Command {
  constructor(tool, shapeIndex, pointIndex, oldPoint, newPoint) {
    super();
    this.tool = tool;
    this.shapeIndex = shapeIndex;
    this.pointIndex = pointIndex;
    this.oldPoint = oldPoint; // Store the original point object {x, y}
    this.newPoint = newPoint; // Store the new point object {x, y}
  }

  execute() {
    if (
      this.tool.shapes[this.shapeIndex] &&
      this.tool.shapes[this.shapeIndex].points[this.pointIndex]
    ) {
      this.tool.shapes[this.shapeIndex].points[this.pointIndex] = this.newPoint;
    } else {
      console.warn(
        "EditShapePointCommand: Shape or point index out of bounds on execute/redo."
      );
    }
  }

  undo() {
    if (
      this.tool.shapes[this.shapeIndex] &&
      this.tool.shapes[this.shapeIndex].points[this.pointIndex]
    ) {
      // Important: Restore the *exact* old point object if possible,
      // but creating a new one with the same coords works too.
      this.tool.shapes[this.shapeIndex].points[this.pointIndex] = this.oldPoint;
    } else {
      console.warn(
        "EditShapePointCommand: Shape or point index out of bounds on undo."
      );
    }
  }
}

class ClearAllCommand extends Command {
  constructor(tool, originalShapes) {
    super();
    this.tool = tool;
    // Ensure IDs are part of the copied shapes
    this.originalShapes = originalShapes; // Already a deep copy from clearCanvas
  }

  execute() {
    this.tool.shapes = [];
    this.tool.paletteColors = []; // Assuming clear also clears palette
  }

  undo() {
    this.tool.shapes = [...this.originalShapes];
    // Restore palette?
    this.tool.paletteColors = [];
    this.originalShapes.forEach((shape) =>
      this.tool.addPaletteColor(shape.color)
    );
  }
}

class ImportShapesCommand extends Command {
  constructor(tool, importedShapesData) {
    // importedShapesData is { points, color } without IDs initially
    super();
    this.tool = tool;
    // Store the shapes *with IDs* that will be added by this command
    this.shapesToAdd = importedShapesData.map((shapeData) => ({
      ...shapeData,
      id: this.tool.getNextShapeId(), // Assign IDs immediately when command is created
    }));
  }

  execute() {
    // Add the shapes with their pre-assigned IDs
    this.shapesToAdd.forEach((shape) => {
      // Check if a shape with this ID already exists (e.g., during redo)
      const exists = this.tool.shapes.some(
        (existingShape) => existingShape.id === shape.id
      );
      if (!exists) {
        this.tool.shapes.push(shape);
        this.tool.addPaletteColor(shape.color);
        // console.log(`ImportShapesCommand executed: Added shape ID ${shape.id}`);
      } else {
        // console.log(`ImportShapesCommand executed: Shape ID ${shape.id} already exists, skipping add.`);
      }
    });
  }

  undo() {
    // Remove the shapes that were added by this command, identified by ID
    this.shapesToAdd.forEach((shape) => {
      const index = this.tool.shapes.findIndex(
        (existingShape) => existingShape.id === shape.id
      );
      if (index > -1) {
        this.tool.shapes.splice(index, 1);
        // console.log(`ImportShapesCommand undo: Removed shape ID ${shape.id}`);
      } else {
        // console.warn(`ImportShapesCommand undo: Shape ID ${shape.id} not found.`);
      }
    });
    this.tool.renderPaletteFromShapes(); // Update palette based on remaining shapes
  }
}

// Command Manager (to be integrated into IsometricDrawingTool)
class CommandManager {
  constructor(tool) {
    this.tool = tool;
    this.undoStack = [];
    this.redoStack = [];
  }

  execute(command) {
    command.execute();
    this.undoStack.push(command);
    this.redoStack = []; // Clear redo stack on new action
    // Don't redraw here, let the caller handle it if needed after saving state
    // this.tool.redrawAll();
    this.updateButtonStates(); // Update undo/redo button enable state
    this.tool.saveStateToLocalStorage(); // Save state after execution
    this.tool.redrawAll(); // Redraw AFTER saving potentially modified state
  }

  undo() {
    if (this.undoStack.length > 0) {
      const command = this.undoStack.pop();
      command.undo();
      this.redoStack.push(command);
      // this.tool.redrawAll(); // Moved after save
      this.updateButtonStates();
      this.tool.saveStateToLocalStorage(); // Save state after undo
      this.tool.redrawAll(); // Redraw AFTER saving
    } else {
      console.log("Nothing to undo.");
    }
  }

  redo() {
    if (this.redoStack.length > 0) {
      const command = this.redoStack.pop();
      command.execute(); // Re-execute the command
      this.undoStack.push(command);
      // this.tool.redrawAll(); // Moved after save
      this.updateButtonStates();
      this.tool.saveStateToLocalStorage(); // Save state after redo
      this.tool.redrawAll(); // Redraw AFTER saving
    } else {
      console.log("Nothing to redo.");
    }
  }

  // Helper to enable/disable undo/redo buttons
  updateButtonStates() {
    const undoBtn = document.getElementById("undoBtn");
    const redoBtn = document.getElementById("redoBtn"); // Assuming redoBtn exists
    if (undoBtn) undoBtn.disabled = this.undoStack.length === 0;
    if (redoBtn) redoBtn.disabled = this.redoStack.length === 0;
  }

  // Clears the history, e.g. when loading a new file without possibility of undoing the load itself
  clearHistory() {
    this.undoStack = [];
    this.redoStack = [];
    this.updateButtonStates();
    // No state change to save here directly, but clearing history often accompanies state changes (like load or clear canvas)
    // Let the calling function (e.g., clearCanvas, loadState) handle saving/clearing localStorage
  }
}

// --- End Command Pattern ---

class IsometricDrawingTool {
  constructor() {
    this.canvas = document.getElementById("isometricCanvas");
    this.ctx = this.canvas.getContext("2d");
    this.gridSize = 30; // Isometric cell height
    this.shapes = []; // Store shape objects: { points: [...], color: '#hex', id: ... }
    this.isDrawing = false;
    this.currentShapePoints = []; // Points for the shape being drawn
    this.snapPoint = null;
    this.colorPicker = document.getElementById("colorPicker");
    this.fillToggleBtn = document.getElementById("fillToggleBtn");
    this.deleteToggleBtn = document.getElementById("deleteToggleBtn"); // Get delete button
    this.drawToolBtn = document.getElementById("drawToolBtn"); // Get Draw button
    this.editToolBtn = document.getElementById("editToolBtn"); // Get Edit button
    this.importBtn = document.getElementById("importBtn"); // Get Import button
    this.svgFileInput = document.getElementById("svgFileInput"); // Get file input
    this.currentColor = this.colorPicker.value; // Initialize with default color
    this.isFillMode = false; // Track fill tool state
    this.isDeleteMode = false; // Track delete tool state
    this.isEditMode = false; // Track edit tool state

    // Dragging state for Edit mode
    this.isDragging = false;
    this.selectedShapeIndex = -1;
    this.selectedPointIndex = -1;
    this.dragPointRadius = 8; // Clickable radius around points in edit mode
    this.dragStartPoint = null; // Store original point position for Edit command

    // Color Palette
    this.paletteContainer = document.getElementById("colorPaletteContainer");
    this.paletteColors = [];
    this.maxPaletteSize = 10;

    // Command Manager
    this.commandManager = new CommandManager(this);

    // Shape ID Counter
    this.shapeIdCounter = 0; // Initialize counter

    // Isometric projection angles and scaling
    this.angle = Math.PI / 6; // 30 degrees
    this.scaleX = Math.cos(this.angle);
    this.scaleY = Math.sin(this.angle);
    this.isoWidth = this.gridSize * this.scaleX;
    this.isoHeight = this.gridSize * this.scaleY;

    // Set canvas size
    this.canvas.width = 800;
    this.canvas.height = 600;

    // Initialize event listeners
    this.initializeEventListeners();
    this.loadStateFromLocalStorage(); // Load saved state first
    this.updateActiveToolButton(); // Set initial active button state
    this.renderPalette(); // Initial palette render (or after loading)
    this.commandManager.updateButtonStates(); // Initialize button states (or after loading)
    this.redrawAll(); // Initial draw (or after loading)
  }

  initializeEventListeners() {
    this.canvas.addEventListener("mousedown", (e) => this.handleMouseDown(e));
    this.canvas.addEventListener("mousemove", (e) => this.handleMouseMove(e));
    this.canvas.addEventListener("mouseout", () => this.handleMouseOut());
    this.canvas.addEventListener("mouseup", (e) => this.handleMouseUp(e)); // Add mouseup listener
    document.addEventListener("keydown", (e) => this.handleKeyDown(e));

    this.colorPicker.addEventListener("input", (e) => {
      this.currentColor = e.target.value;
      // Optionally redraw previews if needed, or just update the state
    });

    this.drawToolBtn.addEventListener("click", () =>
      this.setActiveTool("draw")
    ); // Listener for Draw button
    this.fillToggleBtn.addEventListener("click", () =>
      this.setActiveTool("fill")
    );
    this.deleteToggleBtn.addEventListener("click", () =>
      this.setActiveTool("delete")
    );
    this.editToolBtn.addEventListener("click", () =>
      this.setActiveTool("edit")
    ); // Listener for Edit button

    document
      .getElementById("exportBtn")
      .addEventListener("click", () => this.exportSVG());
    document
      .getElementById("clearBtn")
      .addEventListener("click", () => this.clearCanvas());
    document
      .getElementById("undoBtn")
      .addEventListener("click", () => this.undo()); // Changed from undoLastShape
    document
      .getElementById("redoBtn") // Add listener for redo
      .addEventListener("click", () => this.redo());

    // Import listeners
    this.importBtn.addEventListener("click", () => this.svgFileInput.click());
    this.svgFileInput.addEventListener("change", (e) =>
      this.handleFileImport(e)
    );
  }

  // Helper function to get mouse coordinates relative to the canvas' internal resolution
  getCanvasCoordinates(event) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const canvasX = (event.clientX - rect.left) * scaleX;
    const canvasY = (event.clientY - rect.top) * scaleY;
    return { x: canvasX, y: canvasY };
  }

  // Convert screen coordinates (mouse position) to the nearest isometric grid point
  // Takes coordinates relative to the canvas' internal resolution (e.g., 800x600)
  screenToNearestGridPoint(canvasX, canvasY) {
    const originX = this.canvas.width / 2;
    const originY = this.canvas.height / 2; // Adjusted Y origin to canvas center

    // Relative coordinates from the origin
    const relX = canvasX - originX;
    const relY = canvasY - originY;

    // Calculate grid coordinates using inverse isometric projection
    // Derived from:
    // screenX = originX + (gridX - gridY) * isoWidth
    // screenY = originY + (gridX + gridY) * isoHeight
    const gridX = Math.round(
      (relX / this.isoWidth + relY / this.isoHeight) / 2
    );
    const gridY = Math.round(
      (relY / this.isoHeight - relX / this.isoWidth) / 2
    );

    return { x: gridX, y: gridY };
  }

  // Convert isometric grid coordinates to screen coordinates
  gridToScreen(gridX, gridY) {
    const originX = this.canvas.width / 2;
    const originY = this.canvas.height / 2; // Adjusted Y origin to canvas center

    // Standard isometric projection
    const screenX = originX + (gridX - gridY) * this.isoWidth;
    const screenY = originY + (gridX + gridY) * this.isoHeight;

    return { x: screenX, y: screenY };
  }

  redrawAll() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawGrid();
    this.drawShapes();
    this.drawCurrentShape(); // Draw the shape currently being created
    this.drawSnapPoint(); // Draw the indicator for the current snap point

    // Draw draggable points in edit mode
    if (this.isEditMode) {
      this.shapes.forEach(({ points }) => {
        points.forEach((point) => {
          this.ctx.save();
          this.ctx.beginPath();
          this.ctx.arc(
            point.x,
            point.y,
            this.dragPointRadius / 2,
            0,
            Math.PI * 2
          );
          this.ctx.fillStyle = "#ffffff"; // White fill
          this.ctx.strokeStyle = "#007aff"; // Blue border
          this.ctx.lineWidth = 1.5;
          this.ctx.fill();
          this.ctx.stroke();
          this.ctx.restore();
        });
      });
      // Highlight selected point if dragging
      if (
        this.isDragging &&
        this.selectedShapeIndex > -1 &&
        this.selectedPointIndex > -1
      ) {
        const selectedPoint =
          this.shapes[this.selectedShapeIndex].points[this.selectedPointIndex];
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.arc(
          selectedPoint.x,
          selectedPoint.y,
          this.dragPointRadius / 2 + 2,
          0,
          Math.PI * 2
        ); // Slightly larger highlight
        this.ctx.fillStyle = "rgba(0, 122, 255, 0.3)"; // Semi-transparent blue fill
        this.ctx.fill();
        this.ctx.restore();
      }
    }
  }

  drawGrid() {
    this.ctx.strokeStyle = "#eee"; // Lighter grid lines
    this.ctx.lineWidth = 0.5;
    // Extend grid drawing further out to cover potential larger scaled views
    const range = 25; // How many grid units out from the center

    // Draw lines along one isometric axis
    for (let i = -range; i <= range; i++) {
      const start = this.gridToScreen(i, -range);
      const end = this.gridToScreen(i, range);
      this.ctx.beginPath();
      this.ctx.moveTo(start.x, start.y);
      this.ctx.lineTo(end.x, end.y);
      this.ctx.stroke();
    }

    // Draw lines along the other isometric axis
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
    this.shapes.forEach(({ points, color }) => {
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
        this.ctx.closePath(); // Close path for filling
        this.ctx.fill();
      }
      this.ctx.stroke(); // Stroke outline
    });
  }

  drawCurrentShape() {
    if (this.currentShapePoints.length === 0) return; // Don't draw if no points yet

    const currentDrawColor = this.currentColor;
    this.ctx.strokeStyle = currentDrawColor;
    this.ctx.lineWidth = 1;
    this.ctx.fillStyle = currentDrawColor;

    // Draw starting point indicator differently
    const startPoint = this.currentShapePoints[0];
    this.ctx.save();
    this.ctx.fillStyle = "#f06292"; // Pinkish color for start point
    this.ctx.strokeStyle = "#c2185b";
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.arc(startPoint.x, startPoint.y, 6, 0, Math.PI * 2); // Slightly larger
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.restore();

    // Draw the segments of the current shape
    this.ctx.beginPath();
    this.ctx.moveTo(startPoint.x, startPoint.y);
    for (let i = 1; i < this.currentShapePoints.length; i++) {
      this.ctx.lineTo(
        this.currentShapePoints[i].x,
        this.currentShapePoints[i].y
      );
    }

    // Draw preview line to snap point if drawing
    const lastPoint =
      this.currentShapePoints[this.currentShapePoints.length - 1];
    if (this.isDrawing && this.snapPoint) {
      this.ctx.lineTo(this.snapPoint.x, this.snapPoint.y);
    }
    this.ctx.stroke(); // Draw the outline first

    // Preview fill if shape could be closed (more than 2 points including snap point)
    if (
      this.isDrawing &&
      this.snapPoint &&
      this.currentShapePoints.length >= 2
    ) {
      // Create a potential shape including the snap point
      const potentialShape = [...this.currentShapePoints, this.snapPoint];

      // Check if snapPoint is close to the start point (indicating closure)
      const dx = this.snapPoint.x - startPoint.x;
      const dy = this.snapPoint.y - startPoint.y;
      const distanceSq = dx * dx + dy * dy;
      const closeEnough = distanceSq < 5 * 5; // Small tolerance for closing

      // If snapPoint is near start, use the start point for the preview fill
      const shapeToFill = closeEnough
        ? this.currentShapePoints
        : potentialShape;

      if (shapeToFill.length > 2) {
        this.ctx.save();
        this.ctx.fillStyle = currentDrawColor;
        this.ctx.beginPath();
        this.ctx.moveTo(shapeToFill[0].x, shapeToFill[0].y);
        for (let i = 1; i < shapeToFill.length; i++) {
          this.ctx.lineTo(shapeToFill[i].x, shapeToFill[i].y);
        }
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.restore();
      }
    }
  }

  drawSnapPoint() {
    if (!this.snapPoint) return;

    this.ctx.fillStyle = "#FFEB3B"; // Yellow snap point indicator
    this.ctx.strokeStyle = "#FBC02D"; // Darker yellow border
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    // Slightly larger circle for visibility
    this.ctx.arc(this.snapPoint.x, this.snapPoint.y, 5, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
  }

  handleMouseDown(e) {
    if (e.button !== 0) return;
    const { x: canvasX, y: canvasY } = this.getCanvasCoordinates(e); // Use scaled coordinates

    if (this.isEditMode) {
      // --- Edit Mode: Check for point click --- //
      this.selectedShapeIndex = -1;
      this.selectedPointIndex = -1;
      this.isDragging = false;
      this.dragStartPoint = null; // Reset drag start point

      for (let i = this.shapes.length - 1; i >= 0; i--) {
        const shape = this.shapes[i];
        for (let j = 0; j < shape.points.length; j++) {
          const point = shape.points[j];
          const dx = canvasX - point.x;
          const dy = canvasY - point.y;
          if (dx * dx + dy * dy < this.dragPointRadius * this.dragPointRadius) {
            this.selectedShapeIndex = i;
            this.selectedPointIndex = j;
            this.isDragging = true;
            // Store the original position *before* snapping starts in mouseMove
            this.dragStartPoint = { ...point }; // Create a copy
            this.canvas.style.cursor = "grabbing"; // Indicate dragging
            console.log(`Start dragging shape ${i}, point ${j}`);
            this.redrawAll(); // Redraw to potentially highlight point
            return; // Found a point, stop searching
          }
        }
      }
      // If no point was clicked, do nothing else in edit mode mousedown
      return;
    } else if (this.isDeleteMode) {
      // --- Delete Logic --- //
      let deleted = false;
      // Iterate in reverse to delete topmost shape first
      for (let i = this.shapes.length - 1; i >= 0; i--) {
        const shape = this.shapes[i];
        if (this.isPointInPolygon({ x: canvasX, y: canvasY }, shape.points)) {
          // Use scaled coordinates
          const deletedShapeData = JSON.parse(JSON.stringify(shape));
          // Execute command - it will handle the actual deletion
          const command = new DeleteShapeCommand(this, i, deletedShapeData);
          this.commandManager.execute(command);
          deleted = true;
          // redrawAll is handled by commandManager
          break; // Stop after deleting the first shape found
        }
      }
      if (!deleted) {
        console.log("Click outside any shape in delete mode.");
      }
    } else if (this.isFillMode) {
      // --- Fill Logic ---
      let filled = false;
      // Iterate shapes in reverse order so top shapes are checked first
      for (let i = this.shapes.length - 1; i >= 0; i--) {
        const shape = this.shapes[i];
        if (
          shape.points.length > 2 &&
          this.isPointInPolygon({ x: canvasX, y: canvasY }, shape.points) // Use scaled coordinates
        ) {
          if (shape.color !== this.currentColor) {
            // Only execute if color changes
            const oldColor = shape.color;
            // Execute command - it will handle the color change & palette
            const command = new FillShapeCommand(
              this,
              i,
              oldColor,
              this.currentColor
            );
            this.commandManager.execute(command);
            filled = true;
            // redrawAll is handled by commandManager
          } else {
            // Color is already the target color, do nothing
            console.log("Fill skipped: Shape already has the selected color.");
            filled = true; // Treat as 'handled' to stop searching
          }
          break; // Stop after processing the first shape found under the click
        }
      }
      if (!filled) {
        console.log("Click outside any fillable shape in fill mode.");
      }
    } else {
      // --- Drawing Logic ---
      const gridPos = this.screenToNearestGridPoint(canvasX, canvasY); // Use scaled coordinates
      const clickedScreenPos = this.gridToScreen(gridPos.x, gridPos.y);

      if (!this.isDrawing) {
        this.isDrawing = true;
        this.currentShapePoints = [clickedScreenPos];
        this.snapPoint = clickedScreenPos;
        this.redrawAll(); // Redraw for drawing preview
      } else {
        const startPoint = this.currentShapePoints[0];
        const lastPoint =
          this.currentShapePoints[this.currentShapePoints.length - 1];
        const dx = clickedScreenPos.x - startPoint.x;
        const dy = clickedScreenPos.y - startPoint.y;
        // Use a slightly larger tolerance for closing click to account for snapping
        const closeToleranceSq = (this.dragPointRadius * 1.5) ** 2;
        const isClosing =
          dx * dx + dy * dy < closeToleranceSq &&
          this.currentShapePoints.length >= 3;

        if (isClosing) {
          // Finalize shape - Create command
          const shapeData = {
            points: [...this.currentShapePoints], // Create copy
            color: this.currentColor,
          };
          const command = new AddShapeCommand(this, shapeData);
          this.commandManager.execute(command); // Command handles adding shape and palette

          this.isDrawing = false;
          this.currentShapePoints = [];
          this.snapPoint = null;
          // redrawAll is handled by commandManager
        } else {
          // Add point if it's different from the last one
          if (
            clickedScreenPos.x !== lastPoint.x ||
            clickedScreenPos.y !== lastPoint.y
          ) {
            this.currentShapePoints.push(clickedScreenPos);
            this.snapPoint = clickedScreenPos; // Update snap point for preview line
            this.redrawAll(); // Redraw for drawing preview
          }
        }
      }
      // No redrawAll here unless it's starting or adding point, handled above/by command manager
    }
  }

  handleMouseMove(e) {
    const { x: canvasX, y: canvasY } = this.getCanvasCoordinates(e); // Use scaled coordinates

    if (this.isDragging && this.isEditMode) {
      // --- Edit Mode: Dragging Point --- //
      if (this.selectedShapeIndex !== -1 && this.selectedPointIndex !== -1) {
        const gridPos = this.screenToNearestGridPoint(canvasX, canvasY);
        const snappedScreenPos = this.gridToScreen(gridPos.x, gridPos.y);

        // Update the point's position *directly* for smooth visual feedback
        // The command will be created on mouseUp with the final position
        this.shapes[this.selectedShapeIndex].points[this.selectedPointIndex] =
          snappedScreenPos;
        this.redrawAll(); // Redraw frequently while dragging
      }
      return; // Don't do other mouse move logic while dragging
    }

    // --- Update Cursor and Snap Point for other modes --- //
    let cursorStyle = "default"; // Default cursor
    let shapeHovered = false;

    if (this.isEditMode) {
      // Check if hovering over a draggable point
      let pointHovered = false;
      for (const shape of this.shapes) {
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
      cursorStyle = pointHovered ? "grab" : "default";
      this.snapPoint = null; // No snapping preview in edit mode unless dragging
      this.redrawAll(); // Redraw necessary if cursor changes/highlights point maybe?
    } else if (this.isFillMode || this.isDeleteMode) {
      // Check shapes in reverse order (topmost first)
      for (let i = this.shapes.length - 1; i >= 0; i--) {
        if (
          this.isPointInPolygon(
            { x: canvasX, y: canvasY },
            this.shapes[i].points
          )
        ) {
          shapeHovered = true;
          break;
        }
      }
      if (this.isFillMode) {
        cursorStyle = shapeHovered ? "crosshair" : "pointer";
      } else if (this.isDeleteMode) {
        cursorStyle = shapeHovered ? "not-allowed" : "pointer";
      }
      this.snapPoint = null; // No snapping preview in these modes
      // No redraw needed just for hover cursor change typically
    } else {
      // --- Default Draw Mode MouseMove Logic --- //
      const gridPos = this.screenToNearestGridPoint(canvasX, canvasY);
      const snappedScreenPos = this.gridToScreen(gridPos.x, gridPos.y);
      this.snapPoint = snappedScreenPos;
      cursorStyle = "crosshair"; // Use crosshair when drawing
      this.redrawAll(); // Redraw for snap point updates in Draw mode
    }

    this.canvas.style.cursor = cursorStyle;
  }

  handleMouseOut() {
    // Reset cursor to the default for the active tool when mouse leaves
    this.updateCursor();

    if (this.isDragging && this.isEditMode) {
      // If dragging and mouse leaves, treat it like a mouseup cancel/completion
      this.handleMouseUp(null); // Pass null or a simulated event if needed
    }

    if (
      !this.isFillMode &&
      !this.isDeleteMode &&
      !this.isEditMode &&
      this.isDrawing
    ) {
      // Don't cancel drawing automatically on mouse out, user might come back in
      // this.cancelDrawing(); // Keep this commented out or remove
    }

    // Clear snap point only if NOT drawing and NOT editing (where it's irrelevant)
    if (!this.isDrawing && !this.isEditMode) {
      this.snapPoint = null;
      this.redrawAll();
    }
  }

  // Add MouseUp handler to stop dragging and create Edit command
  handleMouseUp(e) {
    // Allow triggering even if e is null (from handleMouseOut)
    if (e && e.button !== 0) return;

    if (this.isDragging && this.isEditMode) {
      if (
        this.selectedShapeIndex > -1 &&
        this.selectedPointIndex > -1 &&
        this.dragStartPoint
      ) {
        const finalPoint =
          this.shapes[this.selectedShapeIndex].points[this.selectedPointIndex];
        // Only create command if the point actually moved
        if (
          finalPoint.x !== this.dragStartPoint.x ||
          finalPoint.y !== this.dragStartPoint.y
        ) {
          const command = new EditShapePointCommand(
            this,
            this.selectedShapeIndex,
            this.selectedPointIndex,
            this.dragStartPoint, // Original position
            { ...finalPoint } // Final position (copy)
          );
          this.commandManager.execute(command); // Command manager handles redraw
          console.log(
            `Finished dragging shape ${this.selectedShapeIndex}, point ${this.selectedPointIndex}. Command created.`
          );
        } else {
          console.log("Edit drag ended, but point did not move.");
          // Redraw to remove any potential drag highlighting if needed
          this.redrawAll();
        }
      } else {
        // Drag ended unexpectedly? Just ensure state is clean.
        this.redrawAll();
      }

      // Reset dragging state regardless of whether command was created
      this.isDragging = false;
      this.selectedShapeIndex = -1;
      this.selectedPointIndex = -1;
      this.dragStartPoint = null;
      this.updateCursor(); // Reset cursor after drag
      // redrawAll is handled by commandManager or explicitly above
    }
  }

  handleKeyDown(e) {
    // Check for Ctrl/Cmd key based on platform
    const isModKey = e.ctrlKey || e.metaKey;

    if (isModKey && e.key.toLowerCase() === "z") {
      e.preventDefault(); // Prevent browser default undo
      if (e.shiftKey) {
        this.redo(); // Ctrl/Cmd + Shift + Z for redo
      } else {
        this.undo(); // Ctrl/Cmd + Z for undo
      }
    } else if (e.key === "Escape") {
      if (this.isDrawing) {
        this.cancelDrawing();
      } else if (this.isFillMode || this.isDeleteMode || this.isEditMode) {
        // Escape returns to draw tool
        this.setActiveTool("draw");
      }
    }
  }

  cancelDrawing() {
    console.log("Drawing cancelled");
    this.isDrawing = false;
    this.currentShapePoints = [];
    this.snapPoint = null;
    // No command needed, just visual state reset
    // No need to save state on cancel, only on completed actions
    this.redrawAll();
  }

  clearCanvas() {
    if (this.shapes.length > 0) {
      // Only create command if there's something to clear
      // Deep copy shapes including their IDs for the command
      const originalShapes = JSON.parse(JSON.stringify(this.shapes));
      const command = new ClearAllCommand(this, originalShapes);
      this.commandManager.execute(command); // This will save the new empty state
      this.clearLocalStorage(); // Explicitly clear storage on user clear action
      // Command handles actual clearing and redraw
    } else {
      // Even if canvas is empty, ensure storage is cleared if user clicks clear
      this.clearLocalStorage();
    }
    this.cancelDrawing(); // Also cancel any partial drawing
    this.setActiveTool("draw"); // Reset to draw tool on clear
    // Redraw is handled by execute or happens implicitly if already empty
  }

  undo() {
    if (this.isDrawing) {
      this.cancelDrawing(); // Cancel current drawing first before undoing previous action
    } else {
      this.commandManager.undo();
    }
    // Ensure tool mode is consistent after undo (e.g., if undoing a fill, stay in fill mode?)
    // This might require commands to store/restore the tool state, adding complexity.
    // For now, keep it simple: undo/redo don't change the active tool.
    this.updateCursor(); // Update cursor in case state changed
    this.redrawAll(); // Ensure redraw happens AFTER command finishes
  }

  // Add Redo method
  redo() {
    this.commandManager.redo(); // This will save state
    // Ensure tool mode is consistent after redo
    this.updateCursor();
    // redrawAll is handled by redo() now
  }

  exportSVG() {
    if (this.shapes.length === 0) {
      console.log("No shapes to export.");
      // Optionally create a small empty SVG or alert the user
      const emptySvg =
        '<svg width="10" height="10" xmlns="http://www.w3.org/2000/svg"></svg>';
      this.downloadSVG(emptySvg, "empty-drawing.svg");
      return;
    }

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    // Calculate bounding box of all points
    this.shapes.forEach(({ points }) => {
      points.forEach((point) => {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      });
    });

    const padding = 10; // Add padding around the drawing
    const viewBoxX = minX - padding;
    const viewBoxY = minY - padding;
    const viewBoxWidth = maxX - minX + padding * 2;
    const viewBoxHeight = maxY - minY + padding * 2;

    // Ensure width and height are not zero or negative
    const finalWidth = Math.max(1, viewBoxWidth);
    const finalHeight = Math.max(1, viewBoxHeight);

    let svgContent = `<svg width="${finalWidth}" height="${finalHeight}" viewBox="${viewBoxX} ${viewBoxY} ${finalWidth} ${finalHeight}" xmlns="http://www.w3.org/2000/svg">`;
    svgContent += '<g id="shapes">'; // Consider adding transform="translate(0,0)" if needed by some viewers

    this.shapes.forEach(({ points, color }) => {
      if (points.length < 2) return;
      let pointsString = points.map((p) => `${p.x},${p.y}`).join(" ");
      const fillColor = color;
      const strokeColor = color;

      if (points.length > 2) {
        svgContent += `<polygon points="${pointsString}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1"/>`;
      } else {
        svgContent += `<polyline points="${pointsString}" fill="none" stroke="${strokeColor}" stroke-width="1"/>`;
      }
    });
    svgContent += "</g></svg>";

    this.downloadSVG(svgContent, "isometric-drawing.svg");
  }

  // Helper function for SVG download
  downloadSVG(svgContent, filename) {
    const blob = new Blob([svgContent], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // --- Mode Management ---
  setActiveTool(toolName) {
    // Store previous mode to check if we exited Edit mode
    const wasEditMode = this.isEditMode;

    // Deactivate all modes first
    this.isDrawing = false; // Cancel any ongoing drawing action
    this.isFillMode = false;
    this.isDeleteMode = false;
    this.isEditMode = false; // Deactivate edit mode
    this.isDragging = false; // Ensure dragging stops when switching tools
    this.selectedShapeIndex = -1;
    this.selectedPointIndex = -1;

    // Activate the selected mode
    if (toolName === "fill") {
      this.isFillMode = true;
    } else if (toolName === "delete") {
      this.isDeleteMode = true;
    } else if (toolName === "edit") {
      // Handle edit mode activation
      this.isEditMode = true;
    } else {
      // Default to draw mode (isDrawing is handled by clicks)
    }

    // Trigger redraw if entering or leaving edit mode to show/hide handles
    if (this.isEditMode || wasEditMode) {
      this.redrawAll();
    }

    // If cancelling a drawing was needed (e.g., switching tool mid-draw)
    if (this.currentShapePoints.length > 0 && toolName !== "draw") {
      this.cancelDrawing(); // Use cancelDrawing to reset drawing state
    }

    this.updateActiveToolButton();
    this.updateCursor();
  }

  updateActiveToolButton() {
    this.drawToolBtn.classList.toggle(
      "active",
      !this.isFillMode && !this.isDeleteMode && !this.isEditMode
    );
    this.fillToggleBtn.classList.toggle("active", this.isFillMode);
    this.deleteToggleBtn.classList.toggle("active", this.isDeleteMode);
    this.editToolBtn.classList.toggle("active", this.isEditMode); // Update edit button
  }

  updateCursor() {
    if (this.isDragging) {
      this.canvas.style.cursor = "grabbing";
    } else if (this.isEditMode) {
      // In edit mode, default is 'grab' maybe, or check hover in mouseMove
      // Let mouseMove handle the specific 'grab' on point hover
      this.canvas.style.cursor = "default";
    } else if (this.isDeleteMode) {
      this.canvas.style.cursor = "not-allowed"; // Or let mouseMove handle hover state
    } else if (this.isFillMode) {
      this.canvas.style.cursor = "crosshair"; // Or let mouseMove handle hover state
    } else {
      this.canvas.style.cursor = "crosshair"; // Default for drawing is crosshair
    }
    // Note: handleMouseMove provides more specific cursor updates on hover
  }

  // --- Point in Polygon Check ---
  isPointInPolygon(point, polygon) {
    // Basic ray casting algorithm
    let x = point.x,
      y = point.y;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      let xi = polygon[i].x,
        yi = polygon[i].y;
      let xj = polygon[j].x,
        yj = polygon[j].y;
      let intersect =
        yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  // --- Palette Management ---
  addPaletteColor(color) {
    const existingIndex = this.paletteColors.indexOf(color);
    if (existingIndex !== -1) {
      // Move existing color to the end (most recent)
      this.paletteColors.splice(existingIndex, 1);
    }
    this.paletteColors.push(color);

    // Enforce max size
    if (this.paletteColors.length > this.maxPaletteSize) {
      this.paletteColors.shift(); // Remove the oldest color
    }

    this.renderPalette();
  }

  renderPalette() {
    this.paletteContainer.innerHTML = ""; // Clear existing swatches
    this.paletteColors.forEach((color) => {
      const swatch = document.createElement("div");
      swatch.classList.add("palette-swatch");
      swatch.style.backgroundColor = color;
      swatch.title = `Select color ${color}`;
      swatch.addEventListener("click", () => {
        this.colorPicker.value = color;
        this.currentColor = color;
        // Optionally switch back to draw tool when selecting a color?
        // this.setActiveTool('draw');
      });
      this.paletteContainer.appendChild(swatch);
    });
  }

  // Helper to rebuild palette based on current shapes
  renderPaletteFromShapes() {
    const uniqueColors = new Set(this.shapes.map((shape) => shape.color));
    // Optionally preserve existing order or sort? Keep simple for now.
    // Limit palette size if needed, potentially removing least frequent?
    // For simplicity, just rebuild from current shapes up to max size.
    this.paletteColors = Array.from(uniqueColors).slice(-this.maxPaletteSize);
    this.renderPalette();
  }

  // --- SVG Import --- //
  handleFileImport(event) {
    const file = event.target.files[0];
    if (!file || !file.type.includes("svg")) {
      console.error("Invalid file selected. Please select an SVG file.");
      this.svgFileInput.value = ""; // Reset file input
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const svgContent = e.target.result;
      try {
        const importedShapesData = this.parseSVGContent(svgContent); // Renamed parsing logic
        if (importedShapesData && importedShapesData.length > 0) {
          // Create command - IDs will be assigned within the command constructor
          const command = new ImportShapesCommand(this, importedShapesData);
          this.commandManager.execute(command); // This will save the new state
          // Command manager handles adding shapes, palette, redraw
          console.log(
            `Imported ${importedShapesData.length} shapes via command.`
          );
        } else {
          console.log("No valid shapes found or parsed from SVG.");
        }
      } catch (error) {
        console.error("Error parsing SVG:", error);
        alert(
          "Failed to parse the SVG file. It might be invalid or not generated by this tool."
        );
      }
      this.svgFileInput.value = ""; // Reset file input after processing
    };
    reader.onerror = (error) => {
      console.error("Error reading file:", error);
      alert("Failed to read the SVG file.");
      this.svgFileInput.value = ""; // Reset file input
    };
    reader.readAsText(file);
  }

  // Renamed and refactored parsing logic to return shape data
  parseSVGContent(svgContent) {
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgContent, "image/svg+xml");

    const shapesGroup = svgDoc.getElementById("shapes");
    // Fallback to querying all polygons/polylines if group not found
    const shapeElements = shapesGroup
      ? shapesGroup.querySelectorAll("polygon, polyline")
      : svgDoc.querySelectorAll("polygon, polyline");

    if (!shapeElements || shapeElements.length === 0) {
      console.warn(
        "No 'shapes' group or polygon/polyline elements found in the SVG."
      );
      return []; // Return empty array if nothing found
    }

    const parsedShapes = [];

    shapeElements.forEach((el) => {
      const pointsString = el.getAttribute("points")?.trim();
      if (!pointsString) {
        console.warn("Shape element missing 'points' attribute.", el);
        return; // Skip elements without points
      }
      const color =
        el.getAttribute("fill") || el.getAttribute("stroke") || "#000000"; // Fallback color
      const points = pointsString
        .split(/\s+/)
        .map((pair) => {
          const [xStr, yStr] = pair.split(",");
          const x = parseFloat(xStr);
          const y = parseFloat(yStr);
          if (!isNaN(x) && !isNaN(y)) {
            // Snap imported points to the grid immediately
            const gridPos = this.screenToNearestGridPoint(x, y);
            return this.gridToScreen(gridPos.x, gridPos.y);
          } else {
            console.warn(`Invalid point data found and skipped: ${pair}`);
            return null; // Skip invalid points
          }
        })
        .filter((p) => p !== null);

      if (points.length > 1) {
        // Need at least 2 points for a line/shape
        parsedShapes.push({ points: points, color: color });
      } else if (points.length > 0) {
        console.warn(
          "Shape discarded during import due to insufficient valid points after parsing/snapping."
        );
      }
    });

    // This function now only *parses* and *snaps*. The command handles adding to state.
    return parsedShapes;
  }

  // --- Persistence ---

  saveStateToLocalStorage() {
    try {
      const state = {
        shapes: this.shapes,
        paletteColors: this.paletteColors,
        shapeIdCounter: this.shapeIdCounter, // Save the counter
        undoStack: this.serializeCommandStack(this.commandManager.undoStack),
        redoStack: this.serializeCommandStack(this.commandManager.redoStack),
      };
      localStorage.setItem("isometricDrawingState", JSON.stringify(state));
      // console.log("State saved to localStorage.");
    } catch (error) {
      console.error("Failed to save state to localStorage:", error);
      // Handle potential errors (e.g., storage quota exceeded)
    }
  }

  loadStateFromLocalStorage() {
    try {
      const savedState = localStorage.getItem("isometricDrawingState");
      if (savedState) {
        const state = JSON.parse(savedState);

        // Basic validation
        if (
          state &&
          Array.isArray(state.shapes) &&
          Array.isArray(state.paletteColors) &&
          typeof state.shapeIdCounter === "number" &&
          Array.isArray(state.undoStack) &&
          Array.isArray(state.redoStack)
        ) {
          this.shapes = state.shapes;
          this.paletteColors = state.paletteColors;
          this.shapeIdCounter = state.shapeIdCounter; // Load the counter
          this.commandManager.undoStack = this.deserializeCommandStack(
            state.undoStack
          );
          this.commandManager.redoStack = this.deserializeCommandStack(
            state.redoStack
          );

          console.log("State loaded from localStorage.");
          this.renderPalette(); // Re-render palette with loaded colors
          this.commandManager.updateButtonStates(); // Update buttons based on loaded stacks
          this.redrawAll(); // Redraw the loaded state
        } else {
          console.warn(
            "Invalid state format found in localStorage. Starting fresh."
          );
          localStorage.removeItem("isometricDrawingState"); // Clear invalid data
        }
      } else {
        console.log("No saved state found in localStorage.");
      }
    } catch (error) {
      console.error("Failed to load state from localStorage:", error);
      localStorage.removeItem("isometricDrawingState"); // Clear potentially corrupted data
    }
  }

  clearLocalStorage() {
    try {
      localStorage.removeItem("isometricDrawingState");
      console.log("Cleared saved state from localStorage.");
    } catch (error) {
      console.error("Failed to clear localStorage:", error);
    }
  }

  // Helper to serialize commands without circular refs
  serializeCommandStack(stack) {
    return stack.map((command) => {
      const commandData = { ...command };
      delete commandData.tool; // Remove reference to the tool itself
      return {
        type: command.constructor.name,
        data: commandData,
      };
    });
  }

  // Helper to deserialize commands and re-inject the tool reference
  deserializeCommandStack(serializedStack) {
    return serializedStack
      .map((serializedCommand) => {
        const { type, data } = serializedCommand;
        let CommandClass;
        // Find the correct class constructor based on the type string
        switch (type) {
          case "AddShapeCommand":
            CommandClass = AddShapeCommand;
            break;
          case "DeleteShapeCommand":
            CommandClass = DeleteShapeCommand;
            break;
          case "FillShapeCommand":
            CommandClass = FillShapeCommand;
            break;
          case "EditShapePointCommand":
            CommandClass = EditShapePointCommand;
            break;
          case "ClearAllCommand":
            CommandClass = ClearAllCommand;
            break;
          case "ImportShapesCommand":
            CommandClass = ImportShapesCommand;
            break;
          default:
            console.error(
              `Unknown command type during deserialization: ${type}`
            );
            return null; // Or throw an error
        }

        if (CommandClass) {
          // Recreate the command instance, passing the tool and the data properties
          // Pass properties individually for robustness:
          if (type === "AddShapeCommand") {
            // shapeData should include ID from saved state
            return new AddShapeCommand(this, data.shapeData);
          } else if (type === "DeleteShapeCommand") {
            // deletedShape should include ID from saved state
            return new DeleteShapeCommand(
              this,
              data.shapeIndex,
              data.deletedShape
            );
          } else if (type === "FillShapeCommand") {
            return new FillShapeCommand(
              this,
              data.shapeIndex,
              data.oldColor,
              data.newColor
            );
          } else if (type === "EditShapePointCommand") {
            // Edit command doesn't strictly need shape ID if index is reliable, but shape ID is present in shapes array
            return new EditShapePointCommand(
              this,
              data.shapeIndex,
              data.pointIndex,
              data.oldPoint,
              data.newPoint
            );
          } else if (type === "ClearAllCommand") {
            // originalShapes should include IDs
            return new ClearAllCommand(this, data.originalShapes);
          } else if (type === "ImportShapesCommand") {
            // shapesToAdd should include IDs from saved state
            const command = new ImportShapesCommand(this, []); // Create dummy command
            command.shapesToAdd = data.shapesToAdd; // Overwrite with loaded data including IDs
            return command;
          }
        }
        return null;
      })
      .filter((command) => command !== null); // Filter out any commands that failed to deserialize
  }

  // --- End Persistence ---

  // --- Shape ID Management ---
  getNextShapeId() {
    this.shapeIdCounter += 1;
    return this.shapeIdCounter;
  }
  // --- End Shape ID Management ---
}

// Initialize the drawing tool when the page loads
window.addEventListener("load", () => {
  new IsometricDrawingTool();
});
