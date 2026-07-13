import { useRef } from "react";
import {
  Upload,
  Scissors,
  MoveHorizontal,
  Sparkles,
  Brush,
  Eraser,
  Type,
  Square,
  Undo2,
  Redo2,
  Download,
  MousePointer,
} from "lucide-react";

export default function ToolbarRibbon({
  onUpload, onUndo, onRedo, canUndo, canRedo,
  activeTool, setActiveTool, hasImage,
}) {
  const fileInputRef = useRef(null);

  const tools = [
    { label: "Select", icon: MousePointer, shortcut: "V" },
    { label: "Crop", icon: Scissors, shortcut: "C" },
    { label: "Resize", icon: MoveHorizontal },
    { label: "Filter", icon: Sparkles },
    { label: "Brush", icon: Brush, shortcut: "B" },
    { label: "Eraser", icon: Eraser, shortcut: "E" },
    { label: "Text", icon: Type, shortcut: "T" },
    { label: "Shape", icon: Square, shortcut: "U" },
  ];

  const actions = [
    { label: "Undo", icon: Undo2, shortcut: "Ctrl+Z" },
    { label: "Redo", icon: Redo2, shortcut: "Ctrl+Y" },
    { label: "Export", icon: Download },
  ];

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        alert("Backend returned error: " + res.statusText);
        return;
      }
      const data = await res.json();
      const localUrl = URL.createObjectURL(file);
      onUpload({ url: localUrl, filename: data.filename, file });
    } catch (err) {
      alert("Upload failed. Make sure the backend is running! Error: " + err.message);
      return;
    }
    e.target.value = "";
  };

  return (
    <header className="toolbar-ribbon">
      <button className="tool-btn" onClick={handleUploadClick} title="Upload Image">
        <Upload size={16} />
      </button>
      <span className="toolbar-separator" />
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        className="hidden-input"
        onChange={handleFileChange}
      />
      {tools.map((tool) => {
        const Icon = tool.icon;
        const isActive = activeTool === tool.label.toLowerCase() ||
          (tool.label === 'Shape' && activeTool === 'rect') ||
          (tool.label === 'Shape' && activeTool === 'circle') ||
          (tool.label === 'Shape' && activeTool === 'line');

        return (
          <button
            key={tool.label}
            className={`tool-btn ${isActive ? 'tool-btn--active' : ''}`}
            title={`${tool.label}${tool.shortcut ? ` (${tool.shortcut})` : ''}`}
            onClick={() => {
              if (tool.label === 'Select') setActiveTool('select');
              else if (tool.label === 'Brush') setActiveTool('brush');
              else if (tool.label === 'Eraser') setActiveTool('eraser');
              else if (tool.label === 'Text') setActiveTool('text');
              else if (tool.label === 'Shape') setActiveTool('rect');
              else if (tool.label === 'Crop') setActiveTool('crop');
              else if (tool.label === 'Resize') setActiveTool('resize');
              else if (tool.label === 'Filter') setActiveTool('filter');
            }}
            disabled={!hasImage && tool.label !== 'Undo' && tool.label !== 'Redo'}
          >
            <Icon size={16} />
          </button>
        );
      })}
      <span className="toolbar-separator" />
      {actions.map((action) => {
        const Icon = action.icon;
        let onClick = undefined;
        let disabled = false;

        if (action.label === "Undo") {
          onClick = onUndo;
          disabled = !canUndo;
        } else if (action.label === "Redo") {
          onClick = onRedo;
          disabled = !canRedo;
        } else if (action.label === "Export") {
          onClick = () => {
            const event = new CustomEvent('canvas-export')
            window.dispatchEvent(event)
          }
          disabled = !hasImage;
        }

        return (
          <button
            key={action.label}
            className="tool-btn"
            title={`${action.label}${action.shortcut ? ` (${action.shortcut})` : ''}`}
            onClick={onClick}
            disabled={disabled}
          >
            <Icon size={16} />
          </button>
        );
      })}
    </header>
  );
}
