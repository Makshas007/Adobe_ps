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
} from "lucide-react";

export default function ToolbarRibbon({ onUpload, onUndo, onRedo, canUndo, canRedo, redoOptions = [] }) {
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

  const tools = [
    { label: "Crop", icon: Scissors },
    { label: "Resize", icon: MoveHorizontal },
    { label: "Filter", icon: Sparkles },
    { label: "Brush", icon: Brush },
    { label: "Eraser", icon: Eraser },
    { label: "Select", icon: MousePointer },
    { label: "Text", icon: Type },
    { label: "Shape", icon: Square },
    { label: "Undo", icon: Undo2 },
    { label: "Redo", icon: Redo2 },
    { label: "Save", icon: Save },
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
      <button className="tool-btn" onClick={handleUploadClick} title="Upload">
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
        let onClick = undefined;
        let disabled = false;

        if (tool.label === "Undo") {
          onClick = onUndo;
          disabled = !canUndo;
        } else if (tool.label === "Redo") {
          onClick = onRedo;
          disabled = !canRedo;
        }

        if (tool.label === "Redo") {
          const handleRedoClick = () => {
            if (redoOptions.length === 1) {
              onRedo(redoOptions[0].id);
            } else if (redoOptions.length > 1) {
              setRedoDropdownOpen(!redoDropdownOpen);
            }
          };

          return (
            <div key={tool.label} className="redo-container">
              <button 
                className="tool-btn" 
                title={tool.label}
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
            key={tool.label} 
            className="tool-btn" 
            title={tool.label}
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
