import NodeHandle from './NodeHandle'

export default function BaseNode({ data, children, selected, currId, inputs = 1, outputs = 1 }) {
  return (
    <div className={`base-node${selected ? ' base-node--selected' : ''}`}>
      <div className="base-node__header">
        <span className="base-node__title" style={{color:data?.id===currId?'lime':'white', textDecoration:data?.id===currId?'underline':'none', fontSize:data?.id===currId?'20px':'14px', transition:'0.2s all'}}>{data.title}</span>
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
