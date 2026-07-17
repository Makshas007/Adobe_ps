import { useState } from 'react'

function MetadataBadge({ label, value, positive }) {
  const color = positive === true ? '#4CAF50' : positive === false ? '#FF5252' : '#FF1E8A'
  return (
    <div className="inspector-badge">
      <span className="inspector-badge-label">{label}</span>
      <span className="inspector-badge-value" style={{ color }}>{value}</span>
    </div>
  )
}

function ColorSwatch({ hex }) {
  return (
    <div className="inspector-swatch" style={{ backgroundColor: hex }} title={hex}>
      <span className="inspector-swatch-hex">{hex}</span>
    </div>
  )
}

export default function AiInspector({ metadata, plan, critique, onAnalyze, analyzing, hasImage }) {
  const [collapsed, setCollapsed] = useState(false)

  if (!hasImage) {
    return (
      <aside className="ai-inspector">
        <div className="inspector-header">
          <h3>AI Inspector</h3>
        </div>
        <div className="inspector-empty">
          Upload an image to see AI analysis
        </div>
      </aside>
    )
  }

  return (
    <aside className="ai-inspector">
      <div className="inspector-header">
        <h3>AI Inspector</h3>
        <button className="inspector-collapse-btn" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? '▼' : '▲'}
        </button>
      </div>

      {!collapsed && (
        <div className="inspector-content">
          <div className="inspector-section">
            <div className="inspector-section-title">
              Image Understanding
              <button
                className="inspector-analyze-btn"
                onClick={onAnalyze}
                disabled={analyzing || !hasImage}
              >
                {analyzing ? '...' : 'Analyze'}
              </button>
            </div>

            {metadata ? (
              <div className="inspector-scene">
                <MetadataBadge label="Scene" value={metadata.scene_type} />
                <MetadataBadge
                  label="Brightness"
                  value={`${Math.round(metadata.brightness)}/255`}
                  positive={metadata.brightness > 40 && metadata.brightness < 200}
                />
                <MetadataBadge
                  label="Contrast"
                  value={metadata.contrast.toFixed(1)}
                  positive={metadata.contrast > 30}
                />
                <MetadataBadge
                  label="Sharpness"
                  value={metadata.sharpness.toFixed(0)}
                  positive={!metadata.is_blurry}
                />
                <MetadataBadge
                  label="Quality"
                  value={metadata.aesthetic_score.toFixed(1)}
                  positive={metadata.aesthetic_score >= 5}
                />
                {metadata.has_faces && (
                  <MetadataBadge label="Faces" value={`${metadata.people_count} detected`} positive />
                )}
                <MetadataBadge
                  label="Lighting"
                  value={metadata.lighting}
                />

                {metadata.dominant_colors && metadata.dominant_colors.length > 0 && (
                  <div className="inspector-colors">
                    <span className="inspector-colors-label">Colors</span>
                    <div className="inspector-colors-list">
                      {metadata.dominant_colors.slice(0, 6).map((c, i) => (
                        <ColorSwatch key={i} hex={c.hex} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="inspector-hint">Click Analyze to understand this image</div>
            )}
          </div>

          {plan && (
            <div className="inspector-section">
              <div className="inspector-section-title">Edit Strategy</div>
              {plan.steps && plan.steps.length > 0 ? (
                <div className="inspector-plan">
                  {plan.steps.map((step, i) => (
                    <div key={i} className="inspector-plan-step">
                      <span className="inspector-plan-step-num">{i + 1}</span>
                      <div className="inspector-plan-step-content">
                        <span className="inspector-plan-step-tool">{step.tool}</span>
                        {step.reasoning && (
                          <span className="inspector-plan-step-reason">{step.reasoning}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : plan.reasoning ? (
                <div className="inspector-plan-reasoning">{plan.reasoning}</div>
              ) : null}
            </div>
          )}

          {critique && (
            <div className="inspector-section">
              <div className="inspector-section-title">
                Quality Check
                <span className={`inspector-quality ${critique.passed ? 'passed' : 'failed'}`}>
                  {critique.passed ? 'PASSED' : 'ISSUES'}
                </span>
              </div>
              {critique.issues && critique.issues.length > 0 && (
                <div className="inspector-issues">
                  {critique.issues.map((issue, i) => (
                    <div key={i} className="inspector-issue">
                      <span className="inspector-issue-type">{issue.type}</span>
                      <span className="inspector-issue-desc">{issue.description}</span>
                    </div>
                  ))}
                </div>
              )}
              {critique.suggestions && critique.suggestions.length > 0 && (
                <div className="inspector-suggestions">
                  {critique.suggestions.map((s, i) => (
                    <div key={i} className="inspector-suggestion">💡 {s}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </aside>
  )
}
