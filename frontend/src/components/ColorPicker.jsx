import { useState, useRef, useEffect } from 'react'

const PRESET_COLORS = [
  '#000000', '#434343', '#666666', '#999999', '#B7B7B7', '#CCCCCC', '#D9D9D9', '#EFEFEF', '#F3F3F3', '#FFFFFF',
  '#980000', '#FF0000', '#FF9900', '#FFFF00', '#00FF00', '#00FFFF', '#4A86E8', '#0000FF', '#9900FF', '#FF00FF',
  '#E6B8AF', '#F4CCCC', '#FCE5CD', '#FFF2CC', '#D9EAD3', '#D0E0E3', '#C9DAF8', '#CFE2F3', '#D9D2E9', '#EAD1DC',
  '#DD7E6B', '#EA9999', '#F9CB9C', '#FFE599', '#B6D7A8', '#A2C4C9', '#A4C2F4', '#9FC5E8', '#B4A7D6', '#D5A6BD',
  '#CC4125', '#E06666', '#F6B26B', '#FFD966', '#93C47D', '#76A5AF', '#6D9EEB', '#6FA8DC', '#8E7CC3', '#C27BA0',
  '#A61C00', '#CC0000', '#E69138', '#F1C232', '#6AA84F', '#45818E', '#3C78D8', '#3D85C6', '#674EA7', '#A64D79',
  '#85200C', '#990000', '#B45F06', '#BF9000', '#38761D', '#134F5C', '#1155CC', '#0B5394', '#351C75', '#741B47',
  '#5B0F00', '#660000', '#783F04', '#7F6000', '#274E13', '#0C343D', '#1C4587', '#073763', '#20124D', '#4C1130',
]

export default function ColorPicker({ color, onChange }) {
  const [open, setOpen] = useState(false)
  const [hexInput, setHexInput] = useState(color)
  const panelRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    setHexInput(color)
  }, [color])

  useEffect(() => {
    if (!open) return
    const handleOutsideClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [open])

  const handleHexSubmit = () => {
    const val = hexInput.trim()
    if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(val)) {
      const full = val.length === 4
        ? '#' + val[1] + val[1] + val[2] + val[2] + val[3] + val[3]
        : val
      onChange(full.toUpperCase())
    } else {
      setHexInput(color)
    }
  }

  return (
    <div className="color-picker" ref={panelRef}>
      <button
        className="color-swatch-btn"
        onClick={() => setOpen(!open)}
        title="Pick color"
      >
        <span className="color-swatch-btn__fill" style={{ backgroundColor: color }} />
        <span className="color-swatch-btn__border" />
      </button>

      {open && (
        <div className="color-panel">
          <div className="color-panel__header">
            <div className="color-panel__preview">
              <span className="color-panel__preview-swatch" style={{ backgroundColor: color }} />
              <span className="color-panel__preview-hex">{color}</span>
            </div>
            <label className="color-panel__custom-btn" title="System color picker">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
              </svg>
              <input
                type="color"
                value={color}
                onChange={(e) => {
                  onChange(e.target.value)
                  setHexInput(e.target.value)
                }}
                className="color-panel__native-input"
              />
            </label>
          </div>

          <div className="color-panel__hex-row">
            <span className="color-panel__hex-prefix">#</span>
            <input
              ref={inputRef}
              type="text"
              className="color-panel__hex-input"
              value={hexInput.replace('#', '')}
              onChange={(e) => {
                const val = '#' + e.target.value.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6)
                setHexInput(val)
              }}
              onBlur={handleHexSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleHexSubmit()
                  inputRef.current?.blur()
                }
                if (e.key === 'Escape') {
                  setHexInput(color)
                  inputRef.current?.blur()
                }
              }}
              maxLength={6}
              spellCheck="false"
            />
          </div>

          <div className="color-panel__swatches">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                className={`color-swatch ${c.toUpperCase() === color.toUpperCase() ? 'color-swatch--active' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => {
                  onChange(c)
                  setHexInput(c)
                  setOpen(false)
                }}
                title={c}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
