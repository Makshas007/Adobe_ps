import { useRef, useState, useEffect } from "react";
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
  Save,
  Download,
  MousePointer,
  ChevronLeft,
  ChevronRight,
  PlusIcon,
  UserPlus,
  PlusSquareIcon,
  Droplets,
  RotateCcw,
  Trash2,
} from "lucide-react";

export default function ToolbarRibbon({
  onUpload, onUndo, onRedo, canUndo, canRedo, newChat,
  onCanvasUndo, onCanvasRedo, canCanvasUndo, canCanvasRedo,
  activeTool, setActiveTool, hasImage, redoOptions = [],
  toolOptionsOpen, setToolOptionsOpen,
}) {
  const fileInputRef = useRef(null);
  const [redoDropdownOpen, setRedoDropdownOpen] = useState(false);

  useEffect(() => {
    if (!redoDropdownOpen) return;
    const handleOutsideClick = (e) => {
      if (!e.target.closest(".redo-container")) {
        setRedoDropdownOpen(false);
      }
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, [redoDropdownOpen]);

  useEffect(() => {
    setRedoDropdownOpen(false);
  }, [redoOptions]);

  const tools = [
    { label: "Select", icon: MousePointer, shortcut: "V" },
    { label: "Crop", icon: Scissors, shortcut: "C" },
    { label: "Resize", icon: MoveHorizontal },
    { label: "Filter", icon: Sparkles },
    { label: "Brush", icon: Brush, shortcut: "B" },
    { label: "Eraser", icon: Eraser, shortcut: "E" },
    { label: "Blur", icon: Droplets, shortcut: "L" },
    { label: "Restore", icon: RotateCcw, shortcut: "R" },
    { label: "Doodle Eraser", icon: Trash2, shortcut: "D" },
    { label: "Text", icon: Type, shortcut: "T" },
    { label: "Shape", icon: Square, shortcut: "U" },
    {label: "Save", icon: Save, shortcut: "Ctrl+S"}
  ];

  const actions = [
    { label: "Undo", icon: Undo2, shortcut: "Ctrl+Z" },
    { label: "Redo", icon: Redo2, shortcut: "Ctrl+Y" },
    { label: "Previous Node", icon: ChevronLeft },
    { label: "Next Node", icon: ChevronRight },
    {label:"New Chat", icon:PlusSquareIcon},
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
          (tool.label === 'Shape' && activeTool === 'line') ||
          (tool.label === 'Doodle Eraser' && activeTool === 'doodle-eraser');

        return (
          <button
            key={tool.label}
            className={`tool-btn ${isActive ? 'tool-btn--active' : ''}`}
            title={`${tool.label}${tool.shortcut ? ` (${tool.shortcut})` : ''}`}
            onClick={() => {
              const toolValue = (() => {
                if (tool.label === 'Select') return 'select';
                if (tool.label === 'Brush') return 'brush';
                if (tool.label === 'Eraser') return 'eraser';
                if (tool.label === 'Blur') return 'blur';
                if (tool.label === 'Restore') return 'restore';
                if (tool.label === 'Doodle Eraser') return 'doodle-eraser';
                if (tool.label === 'Text') return 'text';
                if (tool.label === 'Shape') return 'rect';
                if (tool.label === 'Crop') return 'crop';
                if (tool.label === 'Resize') return 'resize';
                if (tool.label === 'Filter') return 'filter';
                return null;
              })();
              if (toolValue) {
                if (isActive) setToolOptionsOpen(!toolOptionsOpen);
                else { setActiveTool(toolValue); setToolOptionsOpen(true); }
              } else if (tool.label === 'Save') {
                window.dispatchEvent(new CustomEvent('canvas-save'));
              }
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
          onClick = onCanvasUndo;
          disabled = !canCanvasUndo;
        } else if (action.label === "Redo") {
          onClick = onCanvasRedo;
          disabled = !canCanvasRedo;
        } else if (action.label === "Previous Node") {
          onClick = onUndo;
          disabled = !canUndo;
        } else if (action.label === "Next Node") {
          onClick = onRedo;
          disabled = !canRedo;
        } else if (action.label === "New Chat") {
          onClick = newChat;
        } else if (action.label === "Export") {
          onClick = () => {
            const event = new CustomEvent('canvas-export')
            window.dispatchEvent(event)
          }
          disabled = !hasImage;
        }

        if (action.label === "Next Node") {
          const handleRedoClick = () => {
            if (redoOptions && redoOptions.length === 1) {
              onRedo(redoOptions[0].id);
            } else if (redoOptions && redoOptions.length > 1) {
              setRedoDropdownOpen(!redoDropdownOpen);
            } else {
              onRedo();
            }
          };

          return (
            <div key={action.label} className="redo-container">
              <button 
                className={`tool-btn ${redoDropdownOpen ? 'tool-btn--active' : ''}`} 
                title={action.label}
                onClick={handleRedoClick}
                disabled={!canRedo}
              >
                <Icon size={16} />
              </button>
              {redoDropdownOpen && redoOptions.length > 1 && (
                <div className="redo-dropdown">
                  {redoOptions.map((option) => (
                    <button
                      key={option.id}
                      className="redo-dropdown-item"
                      onClick={() => {
                        onRedo(option.id);
                        setRedoDropdownOpen(false);
                      }}
                    >
                      {option.imageUrl ? (
                        <img 
                          src={option.imageUrl} 
                          alt={option.label} 
                          className="redo-dropdown-thumbnail" 
                        />
                      ) : (
                        <div className="redo-dropdown-thumbnail placeholder-thumb">🎨</div>
                      )}
                      <div className="redo-dropdown-info">
                        <span className="redo-dropdown-label">{option.label}</span>
                        {option.time && (
                          <span className="redo-dropdown-time">{option.time}</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
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
