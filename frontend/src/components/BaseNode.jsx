import NodeHandle from './NodeHandle'

export default function BaseNode({ data, children, selected, inputs = 1, outputs = 1 }) {
  return (
    <div className={`base-node${selected ? ' base-node--selected' : ''}`}>
      <div className="base-node__header">
        <span className="base-node__title">{data.title}</span>
      </div>
      {children && <div className="base-node__body">{children}</div>}
      {Array.from({ length: inputs }).map((_, i) => (
        <NodeHandle key={`in-${i}`} type="target" id={`target-${i}`} />
      ))}
      {Array.from({ length: outputs }).map((_, i) => (
        <NodeHandle key={`out-${i}`} type="source" id={`source-${i}`} />
      ))}
    </div>
  )
}
