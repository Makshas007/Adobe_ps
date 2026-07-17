export default function StatusBar({ zoom, imageDimensions, cursorPos, activeTool, objectCount }) {
  return (
    <footer className="status-bar">
      <span>{activeTool ? `Tool: ${activeTool.charAt(0).toUpperCase() + activeTool.slice(1)}` : 'Tool: Select'}</span>
      <span>Zoom: {zoom ?? 100}%</span>
      <span>
        Dimensions: {imageDimensions ? `${imageDimensions.width} x ${imageDimensions.height}` : 'No image'}
      </span>
      {cursorPos && <span>X: {cursorPos.x} Y: {cursorPos.y}</span>}
      <span>Objects: {objectCount ?? 0}</span>
    </footer>
  )
}
