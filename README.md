# Isometric Drawing Tool

A simple web-based isometric drawing tool that allows you to create drawings on an isometric grid with mouse snapping functionality.

## Features

- Isometric grid with mouse snapping
- Click and drag to draw shapes
- Edit shape points
- Fill existing shapes with selected color
- Delete shapes
- Robust Undo/Redo for all actions (Draw, Fill, Delete, Edit, Clear, Import)
- Keyboard shortcuts: Ctrl/Cmd+Z (Undo), Ctrl/Cmd+Shift+Z (Redo), Escape (Cancel Draw/Exit Tool)
- Color palette for recently used colors
- Export drawings as SVG
- Import SVG drawings (compatible with exported format)
- Clear canvas functionality
- Responsive design

## How to Use

1. Open `index.html` in a web browser
2. Select a tool:
   - **Draw:** Click to place points. Click near the start point to close the shape.
   - **Fill:** Click inside an existing shape to change its color to the selected one.
   - **Edit:** Click and drag the small handles on shape corners to move them.
   - **Delete:** Click inside a shape to remove it.
3. Use the **Color Picker** or **Palette** to select the current color.
4. Use **Undo** (Ctrl/Cmd+Z) and **Redo** (Ctrl/Cmd+Shift+Z) to step through changes.
5. Use the **Export SVG** button to download your drawing as an SVG file.
6. Use the **Import SVG** button to load a previously exported SVG (or a compatible one).
7. Use the **Clear Canvas** button to start over (this action can be undone).
8. Press **Escape** to cancel the current drawing or to switch back to the Draw tool from Fill, Delete, or Edit modes.

## Technical Details

The tool uses HTML5 Canvas for drawing and JavaScript for the drawing logic. The isometric grid is created using mathematical transformations to convert between screen coordinates and isometric grid coordinates. JavaScript for the drawing logic, implemented using the Command Pattern to manage actions and enable undo/redo.

## File Structure

- `index.html` - Main HTML file
- `styles.css` - CSS styles
- `script.js` - JavaScript drawing logic

## Browser Support

This tool works best in modern browsers that support HTML5 Canvas and modern JavaScript features.
