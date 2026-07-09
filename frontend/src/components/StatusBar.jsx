export default function StatusBar({ dimensions, historyCount }) {
  return (
    <footer className="status-bar">
      <span>Zoom: 100%</span>
      <span>Dimensions: {dimensions ? `${dimensions.width} x ${dimensions.height}` : 'N/A'}</span>
      <span>Layer: Background</span>
      <span>History: {historyCount} operations</span>
    </footer>
  )
}
