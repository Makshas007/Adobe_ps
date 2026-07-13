import ColorPicker from './ColorPicker'
import { useState, useEffect } from 'react'

const TOOL_NAMES = {
  brush: 'Brush Settings',
  eraser: 'Eraser Settings',
  text: 'Text Settings',
  rect: 'Shape Settings',
  circle: 'Shape Settings',
  line: 'Shape Settings',
  crop: 'Crop Settings',
  resize: 'Resize Settings',
  filter: 'Filter Settings',
}

const TOOLS_WITH_OPTIONS = ['brush', 'eraser', 'text', 'rect', 'circle', 'line', 'crop', 'resize', 'filter']

function CollapsibleGroup({ title, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={`tool-sidebar-group ${open ? 'open' : ''}`}>
      <button className="tool-sidebar-group-header" onClick={() => setOpen(!open)}>
        <span>{title}</span>
        <span className={`tool-sidebar-group-chevron ${open ? 'rotated' : ''}`}>&#9662;</span>
      </button>
      {open && <div className="tool-sidebar-group-content">{children}</div>}
    </div>
  )
}

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
  if (!TOOLS_WITH_OPTIONS.includes(activeTool)) return null

  return (
    <div className="tool-options-sidebar" key={activeTool}>
      <div className="tool-options-sidebar-header">
        <span>{TOOL_NAMES[activeTool] || 'Tool Settings'}</span>
      </div>
      <div className="tool-options-sidebar-content">
        {(activeTool === 'brush' || activeTool === 'eraser') && (
          <CollapsibleGroup title="Brush">
            {activeTool === 'brush' && (
              <div className="tool-sidebar-field">
                <label>Color</label>
                <ColorPicker color={brushColor} onChange={setBrushColor} />
              </div>
            )}
            <div className="tool-sidebar-field">
              <label>Size</label>
              <div className="tool-sidebar-slider-row">
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                />
                <span className="tool-option-value">{brushSize}px</span>
              </div>
            </div>
            <div className="tool-sidebar-field">
              <label>Opacity</label>
              <div className="tool-sidebar-slider-row">
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={Math.round(brushOpacity * 100)}
                  onChange={(e) => setBrushOpacity(Number(e.target.value) / 100)}
                />
                <span className="tool-option-value">{Math.round(brushOpacity * 100)}%</span>
              </div>
            </div>
          </CollapsibleGroup>
        )}

        {(activeTool === 'text' || activeTool === 'rect' || activeTool === 'circle' || activeTool === 'line') && (
          <CollapsibleGroup title="Appearance">
            <div className="tool-sidebar-field">
              <label>Color</label>
              <ColorPicker color={brushColor} onChange={setBrushColor} />
            </div>
          </CollapsibleGroup>
        )}

        {activeTool === 'crop' && (
          <CollapsibleGroup title="Crop">
            <div className="tool-sidebar-field">
              <span className="tool-option-hint">Draw a rectangle on the canvas to define the crop area.</span>
            </div>
            <div className="tool-sidebar-field">
              <button className="tool-option-btn tool-option-btn--full" onClick={onApplyCrop}>Apply Crop</button>
            </div>
          </CollapsibleGroup>
        )}

        {activeTool === 'resize' && (
          <CollapsibleGroup title="Canvas Size">
            <ResizeControls onResize={onResize} imageDimensions={imageDimensions} />
          </CollapsibleGroup>
        )}

        {activeTool === 'filter' && (
          <CollapsibleGroup title="Adjustments">
            <FilterControls values={filterValues} onChange={onFilterChange} />
          </CollapsibleGroup>
        )}
      </div>
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
    <div className="resize-controls-sidebar">
      <div className="tool-sidebar-field">
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
      <div className="tool-sidebar-field">
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
      <div className="tool-sidebar-field tool-sidebar-field--row">
        <button
          className={`lock-ratio-btn ${lockRatio ? 'locked' : ''}`}
          onClick={() => setLockRatio(!lockRatio)}
          title={lockRatio ? 'Unlock ratio' : 'Lock ratio'}
        >
          {lockRatio ? '🔗' : '🔓'}
        </button>
        <span className="tool-option-value">{lockRatio ? 'Locked' : 'Unlocked'}</span>
      </div>
      <div className="tool-sidebar-field">
        <button
          className="tool-option-btn tool-option-btn--full"
          onClick={() => {
            const w = parseInt(width)
            const h = parseInt(height)
            if (w > 0 && h > 0) onResize(w, h)
          }}
        >
          Resize
        </button>
      </div>
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
    <div className="filter-controls-sidebar">
      {filters.map((f) => (
        <div key={f.key} className="tool-sidebar-field">
          <label>{f.label}</label>
          <div className="tool-sidebar-slider-row">
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
        </div>
      ))}
    </div>
  )
}
