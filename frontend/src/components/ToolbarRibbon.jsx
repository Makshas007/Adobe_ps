export default function ToolbarRibbon() {
  const tools = [
    'Crop', 'Resize', 'Filter', 'Brush', 'Eraser', 'Text', 'Shape',
    'Undo', 'Redo', 'Save', 'Export',
  ]

  return (
    <header className="toolbar-ribbon">
      {tools.map((tool) => (
        <button key={tool} className="tool-btn" title={tool}>
          {tool}
        </button>
      ))}
    </header>
  )
}
