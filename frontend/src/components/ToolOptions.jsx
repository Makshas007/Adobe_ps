import ColorPicker from './ColorPicker'
import { useState, useEffect } from 'react'

export default function ToolOptions({
  activeTool,
  brushColor,
  setBrushColor,
  brushSize,
  setBrushSize,
  brushOpacity,
  setBrushOpacity,
  onApplyCrop,
  onResize,
  filterValues,
  onFilterChange,
  imageDimensions,
}) {
  if (!activeTool) return null

  return (
    <div className="tool-options-bar">
      {(activeTool === 'brush' || activeTool === 'eraser') && (
        <>
          {activeTool === 'brush' && <ColorPicker color={brushColor} onChange={setBrushColor} />}
          <div className="tool-option-group">
            <label>Size</label>
            <input
              type="range"
              min="1"
              max="100"
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
            />
            <span className="tool-option-value">{brushSize}px</span>
          </div>
          <div className="tool-option-group">
            <label>Opacity</label>
            <input
              type="range"
              min="1"
              max="100"
              value={Math.round(brushOpacity * 100)}
              onChange={(e) => setBrushOpacity(Number(e.target.value) / 100)}
            />
            <span className="tool-option-value">{Math.round(brushOpacity * 100)}%</span>
          </div>
        </>
      )}

      {(activeTool === 'text' || activeTool === 'rect' || activeTool === 'circle' || activeTool === 'line') && (
        <ColorPicker color={brushColor} onChange={setBrushColor} />
      )}

      {activeTool === 'crop' && (
        <div className="tool-option-group">
          <span className="tool-option-hint">Draw a rectangle on the canvas to crop</span>
          <button className="tool-option-btn" onClick={onApplyCrop}>Apply Crop</button>
        </div>
      )}

      {activeTool === 'resize' && (
        <ResizeControls onResize={onResize} imageDimensions={imageDimensions} />
      )}

      {activeTool === 'filter' && (
        <FilterControls values={filterValues} onChange={onFilterChange} />
      )}

      {activeTool === 'select' && (
        <span className="tool-option-hint">Click objects to select. Press Delete to remove.</span>
      )}
    </div>
  )
}

function ResizeControls({ onResize, imageDimensions }) {
  const [width, setWidth] = useState('')
  const [height, setHeight] = useState('')
  const [lockRatio, setLockRatio] = useState(true)
  const [aspectRatio, setAspectRatio] = useState(1)

  useEffect(() => {
    if (imageDimensions && imageDimensions.width && imageDimensions.height) {
      setWidth(String(imageDimensions.width))
      setHeight(String(imageDimensions.height))
      setAspectRatio(imageDimensions.width / imageDimensions.height)
    }
  }, [imageDimensions])

  const handleWidthChange = (e) => {
    const w = e.target.value
    setWidth(w)
    if (lockRatio && w && aspectRatio) {
      const parsed = parseInt(w)
      if (parsed > 0) {
        setHeight(String(Math.round(parsed / aspectRatio)))
      }
    }
  }

  const handleHeightChange = (e) => {
    const h = e.target.value
    setHeight(h)
    if (lockRatio && h && aspectRatio) {
      const parsed = parseInt(h)
      if (parsed > 0) {
        setWidth(String(Math.round(parsed * aspectRatio)))
      }
    }
  }

  return (
    <div className="resize-controls">
      <div className="tool-option-group">
        <label>Width</label>
        <input
          type="number"
          className="resize-input"
          value={width}
          onChange={handleWidthChange}
          placeholder="px"
          min="1"
        />
      </div>
      <button
        className={`lock-ratio-btn ${lockRatio ? 'locked' : ''}`}
        onClick={() => setLockRatio(!lockRatio)}
        title={lockRatio ? 'Unlock ratio' : 'Lock ratio'}
      >
        {lockRatio ? '🔗' : '🔓'}
      </button>
      <div className="tool-option-group">
        <label>Height</label>
        <input
          type="number"
          className="resize-input"
          value={height}
          onChange={handleHeightChange}
          placeholder="px"
          min="1"
        />
      </div>
      <button
        className="tool-option-btn"
        onClick={() => {
          const w = parseInt(width)
          const h = parseInt(height)
          if (w > 0 && h > 0) onResize(w, h)
        }}
      >
        Resize
      </button>
    </div>
  )
}

function FilterControls({ values, onChange }) {
  const filters = [
    { key: 'Brightness', label: 'Brightness', min: -1, max: 1, step: 0.05 },
    { key: 'Contrast', label: 'Contrast', min: -1, max: 1, step: 0.05 },
    { key: 'Saturation', label: 'Saturation', min: -1, max: 1, step: 0.05 },
    { key: 'HueRotation', label: 'Hue', min: -1, max: 1, step: 0.05 },
    { key: 'Blur', label: 'Blur', min: 0, max: 1, step: 0.01 },
  ]

  return (
    <div className="filter-controls">
      {filters.map((f) => (
        <div key={f.key} className="tool-option-group">
          <label>{f.label}</label>
          <input
            type="range"
            min={f.min}
            max={f.max}
            step={f.step}
            value={values[f.key] ?? 0}
            onChange={(e) => onChange(f.key, parseFloat(e.target.value))}
          />
          <span className="tool-option-value">
            {(values[f.key] ?? 0).toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  )
}
