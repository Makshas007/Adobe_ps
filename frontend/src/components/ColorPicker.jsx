import { useState } from 'react'

const PRESET_COLORS = [
  '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF',
  '#FFFF00', '#FF00FF', '#00FFFF', '#FF6600', '#9933FF',
  '#FF1E8A', '#333333', '#666666', '#999999', '#CCCCCC',
]

export default function ColorPicker({ color, onChange }) {
  const [showSwatches, setShowSwatches] = useState(false)

  return (
    <div className="color-picker">
      <button
        className="color-swatch-btn"
        style={{ backgroundColor: color }}
        onClick={() => setShowSwatches(!showSwatches)}
        title="Pick color"
      />
      {showSwatches && (
        <div className="color-swatch-panel">
          <input
            type="color"
            value={color}
            onChange={(e) => onChange(e.target.value)}
            className="color-native-input"
          />
          <div className="color-swatches">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                className={`color-swatch ${c === color ? 'active' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => { onChange(c); setShowSwatches(false) }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
