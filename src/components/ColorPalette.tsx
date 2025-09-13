
import React from 'react';
import { useDrawingStore } from '../store/drawingStore';
import { shallow } from 'zustand/shallow';

const ColorPalette = () => {
  const { paletteColors, currentColor, setCurrentColor } = useDrawingStore(state => ({
    paletteColors: state.paletteColors,
    currentColor: state.currentColor,
    setCurrentColor: state.setCurrentColor,
  }), shallow);

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentColor(e.target.value);
  };

  return (
    <section className="palette-bar">
      <div className="tool-group color-picker-group">
        <label htmlFor="colorPicker" className="visually-hidden">Color:</label>
        <input
          type="color"
          id="colorPicker"
          value={currentColor}
          onChange={handleColorChange}
          title="Select Color"
        />
      </div>
      {paletteColors.map((color, index) => (
        <div
          key={`${color}-${index}`}
          className="palette-swatch"
          style={{ backgroundColor: color }}
          title={`Select color ${color}`}
          onClick={() => setCurrentColor(color)}
        />
      ))}
    </section>
  );
};

export default ColorPalette;
