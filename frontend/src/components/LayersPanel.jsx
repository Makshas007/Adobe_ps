import { useState, useMemo } from 'react'

const LAYER_TYPE_ICONS = {
  foreground: '◉',
  background: '▨',
  composite: '●',
  mask: '◐',
}

const LAYER_TYPE_LABELS = {
  foreground: 'Foreground',
  background: 'Background',
  composite: 'Composite',
  mask: 'Mask',
}

function getLayerIcon(layer) {
  return LAYER_TYPE_ICONS[layer.layer_type] || LAYER_TYPE_ICONS.composite
}

function getLayerTypeLabel(layer) {
  return LAYER_TYPE_LABELS[layer.layer_type] || layer.layer_type
}

export default function LayersPanel({
  layers,
  onToggle,
  onSelect,
  selectedLayerId,
  onReorder,
  onApplyChanges,
}) {
  const [expanded, setExpanded] = useState(true)

  return (
    <aside className="operations-panel">
      <div className="operations-header" onClick={() => setExpanded(!expanded)}>
        <h3>Layers</h3>
        <span className="operations-count">{layers.length}</span>
        <button className="operations-collapse">{expanded ? '▲' : '▼'}</button>
      </div>

      {expanded && (
        <div className="operations-list">
          {layers.length === 0 && (
            <div className="operations-empty">
              No layers yet. Perform an operation like "remove background" to create layers.
            </div>
          )}

          {layers.map((layer, i) => (
            <div
              key={layer.id}
              className={`operation-item ${layer.visible !== false ? 'visible' : 'hidden'} ${selectedLayerId === layer.id ? 'selected' : ''}`}
              onClick={() => onSelect && onSelect(layer.id)}
            >
              <div className="operation-index">{i + 1}</div>
              <div className="operation-thumb" style={{ background: 'repeating-conic-gradient(#ccc 0% 25%, transparent 0% 50%) 50% / 12px 12px' }}>
                {layer.image && (
                  <img
                    src={`data:image/png;base64,${layer.image}`}
                    alt=""
                    className="operation-img-thumb"
                    style={{ objectFit: 'contain' }}
                  />
                )}
              </div>
              <div className="operation-info">
                <div className="operation-name">
                  <span className="operation-icon">{getLayerIcon(layer)}</span>
                  {layer.name || getLayerTypeLabel(layer)}
                </div>
                <div className="operation-meta">
                  {getLayerTypeLabel(layer)}
                </div>
              </div>
              <button
                className={`operation-toggle ${layer.visible !== false ? 'on' : 'off'}`}
                onClick={(e) => { e.stopPropagation(); onToggle && onToggle(layer.id) }}
                title={layer.visible !== false ? 'Hide' : 'Show'}
              >
                <div className="toggle-track">
                  <div className="toggle-thumb" />
                </div>
              </button>
            </div>
          ))}
        </div>
      )}
    </aside>
  )
}
