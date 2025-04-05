class IsometricDrawingTool {
  constructor() {
    this.canvas = document.getElementById("isometricCanvas");
    this.ctx = this.canvas.getContext("2d");
    this.gridSize = 30; // Isometric cell height
    this.shapes = []; // Store shape objects: { points: [...], color: '#hex' }
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

    // Color Palette
    this.paletteContainer = document.getElementById("colorPaletteContainer");
    this.paletteColors = [];
    this.maxPaletteSize = 10;

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
    this.updateActiveToolButton(); // Set initial active button state
    this.renderPalette(); // Initial palette render
    this.redrawAll();
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
    this.editToolBtn.addEventListener("click", () => this.setActiveTool("edit")); // Listener for Edit button

    document
      .getElementById("exportBtn")
      .addEventListener("click", () => this.exportSVG());
    document
      .getElementById("clearBtn")
      .addEventListener("click", () => this.clearCanvas());
    document
      .getElementById("undoBtn")
      .addEventListener("click", () => this.undoLastShape());
    // Import listeners
    this.importBtn.addEventListener("click", () => this.svgFileInput.click());
    this.svgFileInput.addEventListener("change", (e) => this.handleFileImport(e));
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
        points.forEach(point => {
          this.ctx.save();
          this.ctx.beginPath();
          this.ctx.arc(point.x, point.y, this.dragPointRadius / 2, 0, Math.PI * 2);
          this.ctx.fillStyle = "#ffffff"; // White fill
          this.ctx.strokeStyle = "#007aff"; // Blue border
          this.ctx.lineWidth = 1.5;
          this.ctx.fill();
          this.ctx.stroke();
          this.ctx.restore();
        });
      });
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
            this.canvas.style.cursor = "grabbing"; // Indicate dragging
            console.log(`Dragging shape ${i}, point ${j}`);
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
      for (let i = this.shapes.length - 1; i >= 0; i--) {
        const shape = this.shapes[i];
        if (this.isPointInPolygon({ x: canvasX, y: canvasY }, shape.points)) { // Use scaled coordinates
          this.shapes.splice(i, 1); // Remove the clicked shape
          deleted = true;
          this.redrawAll();
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
          // Update the color of the clicked shape
          shape.color = this.currentColor;
          this.addPaletteColor(this.currentColor);
          filled = true;
          this.redrawAll();
          break; // Stop after filling the first shape found under the click
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
      } else {
        const startPoint = this.currentShapePoints[0];
        const lastPoint =
          this.currentShapePoints[this.currentShapePoints.length - 1];
        const dx = clickedScreenPos.x - startPoint.x;
        const dy = clickedScreenPos.y - startPoint.y;
        const isClosing =
          dx * dx + dy * dy < 25 && this.currentShapePoints.length >= 3;

        if (isClosing) {
          // Finalize shape with current color
          this.shapes.push({
            points: [...this.currentShapePoints],
            color: this.currentColor,
          });
          this.addPaletteColor(this.currentColor);
          this.isDrawing = false;
          this.currentShapePoints = [];
          this.snapPoint = null;
        } else {
          if (
            clickedScreenPos.x !== lastPoint.x ||
            clickedScreenPos.y !== lastPoint.y
          ) {
            this.currentShapePoints.push(clickedScreenPos);
            this.snapPoint = clickedScreenPos;
          }
        }
      }
      this.redrawAll();
    }
  }

  handleMouseMove(e) {
    const { x: canvasX, y: canvasY } = this.getCanvasCoordinates(e); // Use scaled coordinates

    if (this.isDragging && this.isEditMode) {
      // --- Edit Mode: Dragging Point --- //
      if (this.selectedShapeIndex !== -1 && this.selectedPointIndex !== -1) {
        const gridPos = this.screenToNearestGridPoint(canvasX, canvasY);
        const snappedScreenPos = this.gridToScreen(gridPos.x, gridPos.y);

        // Update the point's position in the shape data
        this.shapes[this.selectedShapeIndex].points[this.selectedPointIndex] = snappedScreenPos;
        this.redrawAll();
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
        if (this.isPointInPolygon({ x: canvasX, y: canvasY }, this.shapes[i].points)) {
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
    this.isDragging = false; // Stop dragging if mouse leaves canvas

    if (!this.isFillMode && !this.isDeleteMode && !this.isEditMode && this.isDrawing) {
      this.cancelDrawing();
    }
    if (!this.isFillMode && !this.isDeleteMode && !this.isEditMode) {
      this.snapPoint = null;
      this.redrawAll();
    }
  }

  // Add MouseUp handler to stop dragging
  handleMouseUp(e) {
      if (e.button !== 0) return;
      if (this.isDragging && this.isEditMode) {
          console.log(`Finished dragging shape ${this.selectedShapeIndex}, point ${this.selectedPointIndex}`);
          this.isDragging = false;
          this.selectedShapeIndex = -1;
          this.selectedPointIndex = -1;
          this.updateCursor(); // Reset cursor after drag
          this.redrawAll(); // Final redraw after drag
      }
  }

  handleKeyDown(e) {
    if (e.key === "Escape") {
      if (this.isDrawing) {
        this.cancelDrawing();
      } else if (this.isFillMode) {
        this.setActiveTool("draw"); // Escape from Fill goes back to Draw
      } else if (this.isDeleteMode) {
        this.setActiveTool("draw"); // Escape from Delete goes back to Draw
      } else if (this.isEditMode) {
        this.setActiveTool("draw"); // Escape from Edit goes back to Draw
      }
    }
  }

  cancelDrawing() {
    console.log("Drawing cancelled");
    this.isDrawing = false;
    this.currentShapePoints = [];
    this.snapPoint = null;
    this.redrawAll();
  }

  clearCanvas() {
    this.shapes = [];
    this.cancelDrawing();
    this.setActiveTool("draw"); // Reset to draw tool on clear
    this.redrawAll();
  }

  undoLastShape() {
    if (this.isDrawing) {
      this.cancelDrawing(); // Cancel current drawing first
    } else if (this.shapes.length > 0) {
      this.shapes.pop();
      this.redrawAll();
    }
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
    } else if (toolName === "edit") { // Handle edit mode activation
      this.isEditMode = true;
    } else {
      // Default to draw mode (isDrawing is handled by clicks)
    }

    // Trigger redraw if entering or leaving edit mode
    if (this.isEditMode || wasEditMode) {
      this.redrawAll();
    }

    // If cancelling a drawing was needed (e.g., switching tool mid-draw)
    if (this.currentShapePoints.length > 0 && toolName !== "draw") {
      this.currentShapePoints = [];
      this.snapPoint = null;
      this.redrawAll(); // Redraw to remove preview
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
    this.paletteContainer.innerHTML = ''; // Clear existing swatches
    this.paletteColors.forEach(color => {
      const swatch = document.createElement('div');
      swatch.classList.add('palette-swatch');
      swatch.style.backgroundColor = color;
      swatch.title = `Select color ${color}`;
      swatch.addEventListener('click', () => {
        this.colorPicker.value = color;
        this.currentColor = color;
        // Optionally switch back to draw tool when selecting a color?
        // this.setActiveTool('draw');
      });
      this.paletteContainer.appendChild(swatch);
    });
  }

  // --- SVG Import --- //
  handleFileImport(event) {
    const file = event.target.files[0];
    if (!file || !file.type.includes('svg')) {
      console.error("Invalid file selected. Please select an SVG file.");
      this.svgFileInput.value = ''; // Reset file input
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const svgContent = e.target.result;
      try {
        this.parseAndLoadSVG(svgContent);
      } catch (error) {
        console.error("Error parsing SVG:", error);
        alert("Failed to parse the SVG file. It might be invalid or not generated by this tool.");
      }
      this.svgFileInput.value = ''; // Reset file input after processing
    };
    reader.onerror = (error) => {
      console.error("Error reading file:", error);
      alert("Failed to read the SVG file.");
      this.svgFileInput.value = ''; // Reset file input
    };
    reader.readAsText(file);
  }

  parseAndLoadSVG(svgContent) {
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgContent, "image/svg+xml");

    const shapesGroup = svgDoc.getElementById('shapes');
    if (!shapesGroup) {
      console.warn("Could not find the 'shapes' group in the SVG. Is this SVG from this tool?");
      // Optionally, try finding any polygon/polyline?
      // For now, we'll assume the structure is correct.
      return;
    }

    const importedRawShapes = [];
    const shapeElements = shapesGroup ? shapesGroup.querySelectorAll('polygon, polyline') : svgDoc.querySelectorAll('polygon, polyline');

    if (shapeElements.length === 0) {
      console.log("No shapes found in the SVG.");
      return;
    }

    shapeElements.forEach(el => {
      const pointsString = el.getAttribute('points').trim();
      const color = el.getAttribute('fill') || el.getAttribute('stroke') || '#000000'; // Fallback color
      const points = pointsString.split(/\s+/).map(pair => {
        const [xStr, yStr] = pair.split(',');
        const x = parseFloat(xStr);
        const y = parseFloat(yStr);
        if (!isNaN(x) && !isNaN(y)) {
           return { x, y };
        } else {
           console.warn(`Invalid point data found: ${pair}`);
           return null; // Skip invalid points
        }
      }).filter(p => p !== null);

      if (points.length > 1) { // Need at least 2 points for a line/shape
          importedRawShapes.push({ points: points, color: color });
      }
    });

    if (importedRawShapes.length === 0) {
      console.log("No valid shapes could be parsed from the SVG.");
      return;
    }

    // Snap each point individually and add to main shapes array
    importedRawShapes.forEach(rawShape => {
      const finalPoints = rawShape.points.map(p => {
          const gridPos = this.screenToNearestGridPoint(p.x, p.y);
          return this.gridToScreen(gridPos.x, gridPos.y);
      });

      if (finalPoints.length > 1) { // Ensure we still have enough points after potential filtering
          this.shapes.push({ points: finalPoints, color: rawShape.color });
          // Add color to palette
          this.addPaletteColor(rawShape.color);
      } else {
          console.warn("Shape discarded during import snapping due to insufficient points.");
      }
    });

    console.log(`Imported and snapped ${this.shapes.length} shapes.`);
    this.redrawAll();
  }
}

// Initialize the drawing tool when the page loads
window.addEventListener("load", () => {
  new IsometricDrawingTool();
});
