import { Handle, Position } from '@xyflow/react'

export default function NodeHandle({ type, ...props }) {
  const position = type === 'target' ? Position.Left : Position.Right

  return (
    <Handle
      type={type}
      position={position}
      className={`node-handle node-handle--${type}`}
      {...props}
    />
  )
}
