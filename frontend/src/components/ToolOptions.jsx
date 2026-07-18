import ColorPicker from './ColorPicker'
import { useState, useEffect } from 'react'

const TOOL_NAMES = {
  brush: 'Brush Settings',
  eraser: 'Eraser Settings',
  blur: 'Blur Brush Settings',
  restore: 'Eraser Recovery Settings',
  'doodle-eraser': 'Doodle Eraser Settings',
  text: 'Text Settings',
  rect: 'Shape Settings',
  circle: 'Shape Settings',
  line: 'Shape Settings',
  crop: 'Crop Settings',
  resize: 'Resize Settings',
  filter: 'Filter Settings',
}

export const TOOLS_WITH_OPTIONS = ['brush', 'eraser', 'blur', 'restore', 'doodle-eraser', 'text', 'rect', 'circle', 'line', 'crop', 'resize', 'filter']

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
  setActiveTool,
  brushColor,
  setBrushColor,
  brushSize,
  setBrushSize,
  blurStrength,
  setBlurStrength,
  brushOpacity,
  setBrushOpacity,
  textBgColor,
  setTextBgColor,
  textFontFamily,
  setTextFontFamily,
  onApplyCrop,
  onResize,
  filterValues,
  onFilterChange,
  onFilterChangeComplete,
  imageDimensions,
  optionsOpen,
  selectedObject,
  onUpdateSelectedObject,
  onDeleteObject,
}) {
  const hasToolOptions = TOOLS_WITH_OPTIONS.includes(activeTool)
  if (!hasToolOptions && !selectedObject) return null
  if (!optionsOpen && !selectedObject) return null

  return (
    <div className="tool-options-sidebar" key={selectedObject ? 'selection' : activeTool}>
      <div className="tool-options-sidebar-header">
        <span>{selectedObject ? (TOOL_NAMES[activeTool] || 'Object Properties') : (TOOL_NAMES[activeTool] || 'Tool Settings')}</span>
      </div>
      <div className="tool-options-sidebar-content">
        {selectedObject ? (
          <>
          <CollapsibleGroup title="Position & Size">
            <div className="tool-sidebar-field tool-sidebar-field--row">
              <div className="tool-sidebar-field" style={{ flex: 1 }}>
                <label>X</label>
                <input
                  type="number"
                  className="tool-sidebar-number-input"
                  value={selectedObject.left}
                  onChange={(e) => onUpdateSelectedObject({ left: Number(e.target.value) })}
                />
              </div>
              <div className="tool-sidebar-field" style={{ flex: 1 }}>
                <label>Y</label>
                <input
                  type="number"
                  className="tool-sidebar-number-input"
                  value={selectedObject.top}
                  onChange={(e) => onUpdateSelectedObject({ top: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="tool-sidebar-field tool-sidebar-field--row">
              <div className="tool-sidebar-field" style={{ flex: 1 }}>
                <label>W</label>
                <input
                  type="number"
                  className="tool-sidebar-number-input"
                  value={selectedObject.width}
                  disabled
                />
              </div>
              <div className="tool-sidebar-field" style={{ flex: 1 }}>
                <label>H</label>
                <input
                  type="number"
                  className="tool-sidebar-number-input"
                  value={selectedObject.height}
                  disabled
                />
              </div>
            </div>
            <div className="tool-sidebar-field">
              <label>Rotation</label>
              <div className="tool-sidebar-slider-row">
                <input
                  type="range"
                  min="-180"
                  max="180"
                  value={selectedObject.angle || 0}
                  onChange={(e) => onUpdateSelectedObject({ angle: Number(e.target.value) })}
                />
                <span className="tool-option-value">{selectedObject.angle || 0}°</span>
              </div>
            </div>
          </CollapsibleGroup>
          <CollapsibleGroup title="Appearance">
            <div className="tool-sidebar-field">
              <label>Fill</label>
              <ColorPicker
                color={selectedObject.fill !== 'transparent' && selectedObject.fill ? selectedObject.fill : '#000000'}
                onChange={(c) => onUpdateSelectedObject({ fill: c })}
              />
            </div>
            {selectedObject.type === 'i-text' && (
              <div className="tool-sidebar-field">
                <label>Text BG</label>
                <ColorPicker
                  color={selectedObject.textBackgroundColor || 'transparent'}
                  onChange={(c) => onUpdateSelectedObject({ textBackgroundColor: c })}
                  showNone={true}
                />
              </div>
            )}
            <div className="tool-sidebar-field">
              <label>Stroke</label>
              <ColorPicker
                color={selectedObject.stroke || '#000000'}
                onChange={(c) => onUpdateSelectedObject({ stroke: c })}
              />
            </div>
            <div className="tool-sidebar-field">
              <label>Stroke Width</label>
              <div className="tool-sidebar-slider-row">
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={selectedObject.strokeWidth || 0}
                  onChange={(e) => onUpdateSelectedObject({ strokeWidth: Number(e.target.value) })}
                />
                <span className="tool-option-value">{selectedObject.strokeWidth || 0}px</span>
              </div>
            </div>
            <div className="tool-sidebar-field">
              <label>Opacity</label>
              <div className="tool-sidebar-slider-row">
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={Math.round((selectedObject.opacity ?? 1) * 100)}
                  onChange={(e) => onUpdateSelectedObject({ opacity: Number(e.target.value) / 100 })}
                />
                <span className="tool-option-value">{Math.round((selectedObject.opacity ?? 1) * 100)}%</span>
              </div>
            </div>
             {selectedObject.type === 'i-text' && (
               <>
               <div className="tool-sidebar-field">
                 <label>Font Family</label>
                 <select
                   className="tool-sidebar-select"
                   value={selectedObject.fontFamily || 'Inter, sans-serif'}
                   onChange={(e) => onUpdateSelectedObject({ fontFamily: e.target.value })}
                 >
                   <option value="Inter, sans-serif">Inter</option>
                   <option value="Arial, sans-serif">Arial</option>
                   <option value="Roboto, sans-serif">Roboto</option>
                   <option value="Georgia, serif">Georgia</option>
                   <option value="Times New Roman, serif">Times New Roman</option>
                   <option value="Courier New, monospace">Courier New</option>
                   <option value="Impact, sans-serif">Impact</option>
                 </select>
               </div>
               <div className="tool-sidebar-field">
                 <label>Font Size</label>
                <div className="tool-sidebar-slider-row">
                  <input
                    type="range"
                    min="8"
                    max="120"
                    value={selectedObject.fontSize || 24}
                    onChange={(e) => onUpdateSelectedObject({ fontSize: Number(e.target.value) })}
                  />
                  <span className="tool-option-value">{selectedObject.fontSize || 24}px</span>
                </div>
              </div>
              <div className="tool-sidebar-field tool-sidebar-field--row">
                <button
                  className={`tool-option-btn ${selectedObject.fontWeight === 'bold' ? 'tool-option-btn--active' : ''}`}
                  onClick={() => onUpdateSelectedObject({ fontWeight: selectedObject.fontWeight === 'bold' ? 'normal' : 'bold' })}
                >
                  B
                </button>
                {['left', 'center', 'right'].map(align => (
                  <button
                    key={align}
                    className={`tool-option-btn ${selectedObject.textAlign === align || (!selectedObject.textAlign && align === 'left') ? 'tool-option-btn--active' : ''}`}
                    onClick={() => onUpdateSelectedObject({ textAlign: align })}
                    style={{ flex: 1 }}
                  >
                    {align === 'left' ? '\u2190' : align === 'center' ? '\u2194' : '\u2192'}
                  </button>
                ))}
              </div>
              </>
            )}
          </CollapsibleGroup>
          {!selectedObject.isBgImage && (
            <div className="tool-sidebar-field">
              <button className="tool-option-btn tool-option-btn--full tool-option-btn--danger" onClick={onDeleteObject}>
                Delete
              </button>
            </div>
          )}
          </>
        ) : (
          <>

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
            {activeTool !== 'eraser' && (
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
            )}
          </CollapsibleGroup>
        )}

        {activeTool === 'blur' && (
          <CollapsibleGroup title="Blur Brush">
            <div className="tool-sidebar-field">
              <span className="tool-option-hint">Paint over areas to blur them.</span>
            </div>
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
              <label>Strength</label>
              <div className="tool-sidebar-slider-row">
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={blurStrength}
                  onChange={(e) => setBlurStrength(Number(e.target.value))}
                />
                <span className="tool-option-value">{blurStrength}</span>
              </div>
            </div>
          </CollapsibleGroup>
        )}

        {activeTool === 'restore' && (
          <CollapsibleGroup title="Restore Brush">
            <div className="tool-sidebar-field">
              <span className="tool-option-hint">Paint over erased areas to restore them.</span>
            </div>
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
          </CollapsibleGroup>
        )}

        {activeTool === 'doodle-eraser' && (
          <CollapsibleGroup title="Doodle Eraser">
            <div className="tool-sidebar-field">
              <span className="tool-option-hint">Click or paint over doodles to remove them. The background image is protected.</span>
            </div>
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
          </CollapsibleGroup>
        )}

        {(activeTool === 'rect' || activeTool === 'circle' || activeTool === 'line') && (
          <CollapsibleGroup title="Shape Type">
            <div className="tool-sidebar-field tool-sidebar-field--row">
              {['rect', 'circle', 'line'].map(type => (
                <button
                  key={type}
                  className={`tool-option-btn ${activeTool === type ? 'tool-option-btn--active' : ''}`}
                  onClick={() => setActiveTool(type)}
                >
                  {type === 'rect' ? 'Rect' : type === 'circle' ? 'Circle' : 'Line'}
                </button>
              ))}
            </div>
          </CollapsibleGroup>
        )}

        {(activeTool === 'text' || activeTool === 'rect' || activeTool === 'circle' || activeTool === 'line') && (
          <CollapsibleGroup title="Appearance">
            <div className="tool-sidebar-field">
              <label>Color</label>
              <ColorPicker color={brushColor} onChange={setBrushColor} />
            </div>
             {activeTool === 'text' && (
               <>
               <div className="tool-sidebar-field">
                 <label>Font Family</label>
                 <select
                   className="tool-sidebar-select"
                   value={textFontFamily}
                   onChange={(e) => setTextFontFamily(e.target.value)}
                 >
                   <option value="Inter, sans-serif">Inter</option>
                   <option value="Arial, sans-serif">Arial</option>
                   <option value="Roboto, sans-serif">Roboto</option>
                   <option value="Georgia, serif">Georgia</option>
                   <option value="Times New Roman, serif">Times New Roman</option>
                   <option value="Courier New, monospace">Courier New</option>
                   <option value="Impact, sans-serif">Impact</option>
                 </select>
               </div>
               <div className="tool-sidebar-field">
                 <label>Text BG</label>
                 <ColorPicker
                   color={textBgColor}
                   onChange={setTextBgColor}
                   showNone={true}
                 />
               </div>
               </>
             )}
            {activeTool !== 'text' && (
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
            )}
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
            <FilterControls values={filterValues} onChange={onFilterChange} onChangeComplete={onFilterChangeComplete} />
          </CollapsibleGroup>
        )}
          </>
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

function FilterControls({ values, onChange, onChangeComplete }) {
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
              onMouseUp={onChangeComplete}
              onTouchEnd={onChangeComplete}
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
