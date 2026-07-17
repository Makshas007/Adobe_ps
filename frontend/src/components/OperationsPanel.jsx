import { useState, useCallback } from 'react'

const OP_ICONS = {
  segment: '◈',
  remove: '✕',
  replace_background: '☁',
  remove_background: '◌',
  change_style: '✦',
  style_transfer: '✦',
  upscale: '⊕',
  brightness: '☀',
  contrast: '◐',
  saturation: '🎨',
  sharpen: '⬢',
  blur: '◎',
  denoise: '❄',
  crop: '⊞',
  rotate: '↻',
  resize: '⇔',
  levels: '▦',
  curves: '◠',
  color_grading: '◑',
  vignette: '◎',
  default: '●',
}

function getIcon(op) {
  return OP_ICONS[op] || OP_ICONS.default
}

function getOpLabel(op, params) {
  const labels = {
    segment: `Segment: ${params?.target || 'object'}`,
    remove: 'Remove Object',
    replace_background: `Replace BG: ${params?.instruction?.slice(0, 30) || '...'}`,
    remove_background: 'Remove BG',
    change_style: `Style: ${params?.instruction?.slice(0, 30) || '...'}`,
    style_transfer: `Style: ${params?.instruction?.slice(0, 30) || '...'}`,
    upscale: 'Upscale',
    brightness: `Brightness ${params?.value > 0 ? '+' : ''}${params?.value || 0}`,
    contrast: `Contrast ${params?.value > 0 ? '+' : ''}${params?.value || 0}`,
    saturation: `Saturation ${params?.value > 0 ? '+' : ''}${params?.value || 0}`,
    sharpen: `Sharpen ${params?.amount || 1}x`,
    blur: `Blur r=${params?.radius || 5}`,
    denoise: 'Denoise',
  }
  return labels[op] || `${op}`
}

export default function OperationsPanel({
  steps,
  visibility,
  onToggle,
  onDelete,
  onReorder,
  originalImage,
  onApplyChanges,
}) {
  const [expanded, setExpanded] = useState(true)

  return (
    <aside className="operations-panel">
      <div className="operations-header" onClick={() => setExpanded(!expanded)}>
        <h3>Operations</h3>
        <span className="operations-count">{steps.length}</span>
        <button className="operations-collapse">{expanded ? '▲' : '▼'}</button>
      </div>

      {expanded && (
        <div className="operations-list">
          {steps.length === 0 && (
            <div className="operations-empty">No operations yet. Edit the image to begin.</div>
          )}

          {steps.map((step, i) => (
            <div
              key={i}
              className={`operation-item ${visibility[i] !== false ? 'visible' : 'hidden'}`}
            >
              <div className="operation-index">{i + 1}</div>
              <div className="operation-thumb">
                {step.mask ? (
                  <img
                    src={`data:image/png;base64,${step.mask}`}
                    alt=""
                    className="operation-mask-thumb"
                  />
                ) : step.image ? (
                  <img
                    src={`data:image/png;base64,${step.image}`}
                    alt=""
                    className="operation-img-thumb"
                  />
                ) : (
                  <div className="operation-no-thumb">{getIcon(step.operation || step.tool)}</div>
                )}
              </div>
              <div className="operation-info">
                <div className="operation-name">
                  <span className="operation-icon">{getIcon(step.operation || step.tool)}</span>
                  {getOpLabel(step.operation || step.tool, step.params)}
                </div>
                <div className="operation-meta">
                  {step.duration_ms && `${(step.duration_ms / 1000).toFixed(1)}s`}
                  {step.tool && ` · ${step.tool}`}
                </div>
              </div>
              <button
                className={`operation-toggle ${visibility[i] !== false ? 'on' : 'off'}`}
                onClick={() => onToggle(i)}
                title={visibility[i] !== false ? 'Disable' : 'Enable'}
              >
                <div className="toggle-track">
                  <div className="toggle-thumb" />
                </div>
              </button>
              <button
                className="operation-delete"
                onClick={() => onDelete(i)}
                title="Remove operation"
              >
                ✕
              </button>
            </div>
          ))}

          {steps.length > 0 && (
            <button className="operations-apply" onClick={onApplyChanges}>
              Apply Changes
            </button>
          )}
        </div>
      )}
    </aside>
  )
}
