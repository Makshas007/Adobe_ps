import { useRef } from 'react'

export default function ToolbarRibbon({ onUpload }) {
  const fileInputRef = useRef(null)

  const tools = [
    'Crop', 'Resize', 'Filter', 'Brush', 'Eraser', 'Text', 'Shape',
    'Undo', 'Redo', 'Save', 'Export',
  ]

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/upload', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) return

      const data = await res.json()
      const localUrl = URL.createObjectURL(file)
      onUpload({ url: localUrl, filename: data.filename })
    } catch {
      return
    }

    e.target.value = ''
  }

  return (
    <header className="toolbar-ribbon">
      <button className="tool-btn" onClick={handleUploadClick}>Upload</button>
      <span className="toolbar-separator" />
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        className="hidden-input"
        onChange={handleFileChange}
      />
      {tools.map((tool) => (
        <button key={tool} className="tool-btn" title={tool}>
          {tool}
        </button>
      ))}
    </header>
  )
}
