export const FONT_FAMILIES = [
  { value: 'Inter, sans-serif', label: 'Inter' },
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'Roboto, sans-serif', label: 'Roboto' },
  { value: 'Open Sans, sans-serif', label: 'Open Sans' },
  { value: 'Montserrat, sans-serif', label: 'Montserrat' },
  { value: 'Lato, sans-serif', label: 'Lato' },
  { value: 'Poppins, sans-serif', label: 'Poppins' },
  { value: 'Raleway, sans-serif', label: 'Raleway' },
  { value: 'Oswald, sans-serif', label: 'Oswald' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'Times New Roman, serif', label: 'Times New Roman' },
  { value: 'Merriweather, serif', label: 'Merriweather' },
  { value: 'Playfair Display, serif', label: 'Playfair Display' },
  { value: 'Courier New, monospace', label: 'Courier New' },
  { value: 'Fira Code, monospace', label: 'Fira Code' },
  { value: 'Impact, sans-serif', label: 'Impact' },
  { value: 'Comic Sans MS, cursive', label: 'Comic Sans MS' },
]

export default function CanvasToolbar({
  optionsOpen,
  activeTool,
  brushColor, setBrushColor,
  textFontFamily, setTextFontFamily,
  textFontSize, setTextFontSize,
  textIsBold, setTextIsBold,
  textIsItalic, setTextIsItalic,
  textIsUnderline, setTextIsUnderline,
  selectedObject,
  onUpdateSelectedObject,
  onBringForward,
  onSendBackward,
  onBringToFront,
  onSendToBack,
  onFlipHorizontal,
  onFlipVertical,
  onDuplicate,
  onToggleLock,
  onDeleteObject,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  zoom,
  hasImage,
}) {
  const isTextActive = activeTool === 'text'
  const isTextSelected = selectedObject?.type === 'i-text'
  const hasSelection = !!selectedObject
  const isLocked = selectedObject?.lockMovementX

  const showTextFormatting = isTextActive || isTextSelected
  const showObjectActions = hasSelection && selectedObject.type !== 'activeSelection'

  if (!showTextFormatting && !hasSelection && !hasImage) return null

  const handleFontFamily = (e) => {
    const val = e.target.value
    if (isTextSelected) onUpdateSelectedObject({ fontFamily: val })
    else setTextFontFamily(val)
  }

  const handleFontSize = (e) => {
    const val = Number(e.target.value)
    if (isTextSelected) onUpdateSelectedObject({ fontSize: val })
    else setTextFontSize(val)
  }

  const toggleBold = () => {
    if (isTextSelected) {
      onUpdateSelectedObject({ fontWeight: selectedObject.fontWeight === 'bold' ? 'normal' : 'bold' })
    } else {
      setTextIsBold(!textIsBold)
    }
  }

  const toggleItalic = () => {
    if (isTextSelected) {
      onUpdateSelectedObject({ fontStyle: selectedObject.fontStyle === 'italic' ? 'normal' : 'italic' })
    } else {
      setTextIsItalic(!textIsItalic)
    }
  }

  const toggleUnderline = () => {
    if (isTextSelected) onUpdateSelectedObject({ underline: !selectedObject.underline })
    else setTextIsUnderline(!textIsUnderline)
  }

  const setAlignment = (align) => {
    if (isTextSelected) onUpdateSelectedObject({ textAlign: align })
  }

  const getFontFamily = () => {
    if (isTextSelected) return selectedObject.fontFamily || 'Inter, sans-serif'
    return textFontFamily
  }

  const getFontSize = () => {
    if (isTextSelected) return selectedObject.fontSize || 32
    return textFontSize
  }

  const getIsBold = () => {
    if (isTextSelected) return selectedObject.fontWeight === 'bold'
    return textIsBold
  }

  const getIsItalic = () => {
    if (isTextSelected) return selectedObject.fontStyle === 'italic'
    return textIsItalic
  }

  const getIsUnderline = () => {
    if (isTextSelected) return !!selectedObject.underline
    return textIsUnderline
  }

  const getTextAlign = () => {
    if (isTextSelected) return selectedObject.textAlign || 'left'
    return 'left'
  }

  return (
    <div className="canvas-toolbar" style={optionsOpen ? { paddingLeft: 280 } : undefined}>
      {showTextFormatting && (
        <>
          <div className="canvas-toolbar-group">
            <select
              className="canvas-toolbar-select"
              value={getFontFamily()}
              onChange={handleFontFamily}
              style={{ fontFamily: getFontFamily() }}
            >
              {FONT_FAMILIES.map(f => (
                <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          <div className="canvas-toolbar-divider" />

          <div className="canvas-toolbar-group">
            <input
              type="number"
              className="canvas-toolbar-number"
              value={getFontSize()}
              onChange={handleFontSize}
              min="1"
              max="999"
            />
          </div>

          <div className="canvas-toolbar-divider" />

          <div className="canvas-toolbar-group">
            <button className={`canvas-toolbar-btn ${getIsBold() ? 'active' : ''}`} onClick={toggleBold} title="Bold">
              <strong>B</strong>
            </button>
            <button className={`canvas-toolbar-btn ${getIsItalic() ? 'active' : ''}`} onClick={toggleItalic} title="Italic">
              <em>I</em>
            </button>
            <button className={`canvas-toolbar-btn ${getIsUnderline() ? 'active' : ''}`} onClick={toggleUnderline} title="Underline">
              <span style={{ textDecoration: 'underline' }}>U</span>
            </button>
          </div>

          <div className="canvas-toolbar-divider" />

          <div className="canvas-toolbar-group">
            {['left', 'center', 'right'].map(align => (
              <button
                key={align}
                className={`canvas-toolbar-btn ${getTextAlign() === align ? 'active' : ''}`}
                onClick={() => setAlignment(align)}
                title={align.charAt(0).toUpperCase() + align.slice(1)}
              >
                {align === 'left' ? '\u2190' : align === 'center' ? '\u2194' : '\u2192'}
              </button>
            ))}
          </div>

          <div className="canvas-toolbar-divider" />

          <div className="canvas-toolbar-group">
            <input
              type="color"
              className="canvas-toolbar-color"
              value={brushColor}
              onChange={(e) => {
                const val = e.target.value
                if (isTextSelected) onUpdateSelectedObject({ fill: val })
                else setBrushColor(val)
              }}
              title="Text Color"
            />
          </div>

          <div className="canvas-toolbar-divider" />
        </>
      )}

      {showObjectActions && (
        <>
          <div className="canvas-toolbar-group">
            <button className="canvas-toolbar-btn" onClick={onBringToFront} title="Bring to Front">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><rect x="7" y="7" width="10" height="10" rx="1"/></svg>
            </button>
            <button className="canvas-toolbar-btn" onClick={onBringForward} title="Bring Forward">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="8" y="8" width="10" height="10" rx="1"/><path d="M4 14v-2a2 2 0 0 1 2-2h2"/><path d="M14 4h2a2 2 0 0 1 2 2v2"/></svg>
            </button>
            <button className="canvas-toolbar-btn" onClick={onSendBackward} title="Send Backward">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="6" width="10" height="10" rx="1"/><path d="M20 10v2a2 2 0 0 1-2 2h-2"/><path d="M10 20H8a2 2 0 0 1-2-2v-2"/></svg>
            </button>
            <button className="canvas-toolbar-btn" onClick={onSendToBack} title="Send to Back">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="5" width="10" height="10" rx="1"/><path d="M19 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 19H5a2 2 0 0 1-2-2v-2"/><path d="M15 5h2a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>

          <div className="canvas-toolbar-divider" />

          <div className="canvas-toolbar-group">
            <button className="canvas-toolbar-btn" onClick={onFlipHorizontal} title="Flip Horizontal">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18"/><path d="m7 8-4 4 4 4"/><path d="m17 8 4 4-4 4"/></svg>
            </button>
            <button className="canvas-toolbar-btn" onClick={onFlipVertical} title="Flip Vertical">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v18"/><path d="m8 7-4 4 4 4"/><path d="m16 7 4 4-4 4"/></svg>
            </button>
          </div>

          <div className="canvas-toolbar-divider" />

          <div className="canvas-toolbar-group">
            <button className="canvas-toolbar-btn" onClick={onDuplicate} title="Duplicate">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
            <button className={`canvas-toolbar-btn ${isLocked ? 'active' : ''}`} onClick={onToggleLock} title={isLocked ? 'Unlock' : 'Lock'}>
              {isLocked ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
              )}
            </button>
            <button className="canvas-toolbar-btn" onClick={onDeleteObject} title="Delete">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>

          <div className="canvas-toolbar-divider" />
        </>
      )}

      <div className="canvas-toolbar-group" style={{ marginLeft: 'auto' }}>
        <button className="canvas-toolbar-btn" onClick={onZoomOut} title="Zoom Out">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="M8 11h6"/></svg>
        </button>
        <span className="canvas-toolbar-zoom-label">{Math.round(zoom || 100)}%</span>
        <button className="canvas-toolbar-btn" onClick={onZoomIn} title="Zoom In">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="M11 8v6"/><path d="M8 11h6"/></svg>
        </button>
        <button className="canvas-toolbar-btn" onClick={onZoomReset} title="Reset Zoom">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
        </button>
      </div>
    </div>
  )
}
