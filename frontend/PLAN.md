# Plan: Add Working Editing Features to Frontend

## Context

The Adobe Mock PS frontend currently has **no client-side editing capabilities**. The `ImageViewer` is a plain `<img>` tag, and the toolbar icons (Crop, Brush, Eraser, Text, Shape, etc.) are all non-functional placeholders with no onClick handlers. All editing is delegated to the AI backend via chat. The user wants working, direct-manipulation editing tools in the browser.

## Approach

Add **Fabric.js** (industry-standard HTML5 canvas library) as the canvas engine and implement the core Photoshop-like tools that the toolbar already declares icons for. Replace the `<img>` ImageViewer with a Fabric.js `<canvas>` and wire up every toolbar tool to real functionality.

## Files to Modify

| File | Change |
|------|--------|
| `package.json` | Add `fabric` dependency |
| `src/components/ImageViewer.jsx` | Complete rewrite: Fabric.js canvas with zoom/pan, tool handlers |
| `src/components/ToolbarRibbon.jsx` | Wire all tool buttons to active tool state + add color/brush-size controls |
| `src/components/StatusBar.jsx` | Show real image dimensions, zoom level, cursor position, active tool |
| `src/App.jsx` | Pass active tool state, color picker state, and canvas ref between components |
| `src/App.css` | Add styles for new UI elements (tool options bar, color picker, crop overlay, etc.) |

## New Files

| File | Purpose |
|------|---------|
| `src/components/CanvasEditor.jsx` | Core Fabric.js canvas logic extracted into its own component |
| `src/components/ToolOptions.jsx` | Context-sensitive tool options bar (brush size, opacity, shape fill, etc.) |
| `src/components/ColorPicker.jsx` | Foreground color picker for brush/shape tools |

## Implementation Steps

### Step 1: Install Fabric.js
- Run `npm install fabric` in the frontend directory

### Step 2: Create `CanvasEditor.jsx`
- Initialize Fabric.js canvas on mount
- Load the `imageUrl` prop as a Fabric.js Image object on the canvas
- Expose canvas ref to parent via `forwardRef` + `useImperativeHandle`
- Implement zoom (scroll wheel) and pan (middle-click or space+drag)
- Handle window resize to keep canvas responsive
- Support loading new images when `imageUrl` changes (clear canvas, load new image)

### Step 3: Create `ColorPicker.jsx`
- Simple foreground color picker (input[type=color] + preset swatches)
- Managed state in App.jsx (`brushColor`)

### Step 4: Create `ToolOptions.jsx`
- Context-sensitive options bar shown above the canvas
- For Brush/Eraser: brush size slider, opacity slider
- For Text: font size, font family
- For Shape: fill color, stroke color, stroke width
- For Crop: aspect ratio lock, apply/cancel buttons
- For Resize: width/height inputs with lock aspect ratio toggle
- For Filter: brightness/contrast/saturation/hue sliders

### Step 5: Rewrite `ToolbarRibbon.jsx`
- Add `activeTool` state (prop from App)
- Each tool button sets itself as active
- Highlight the active tool visually
- Add onClick handlers for all tools:
  - **Select**: default mode, click/drag to move objects
  - **Brush**: enter free-draw mode
  - **Eraser**: enter eraser mode (draw with white/transparent)
  - **Text**: click canvas to place text
  - **Shape**: click+drag to draw rectangle/circle/line
  - **Crop**: enter crop mode with draggable overlay
  - **Resize**: open resize dialog
  - **Filter**: show filter controls
  - **Save/Export**: download canvas as PNG
- Undo/Redo stay as-is (history tree navigation)

### Step 6: Implement Canvas Editing Operations
- **Select tool**: Fabric.js default selection mode, move/resize/delete objects
- **Brush tool**: `canvas.freeDrawingBrush` with configurable color/width
- **Eraser tool**: Set freeDrawingBrush color to canvas background color (white)
- **Text tool**: `fabric.IText` on click position
- **Shape tool**: `fabric.Rect`, `fabric.Circle`, `fabric.Line` via click+drag
- **Crop tool**: Draw crop rectangle overlay, on apply: `canvas.toDataURL()` with crop coords, re-render
- **Resize tool**: Modal with width/height inputs, `canvas.setWidth/setHeight` + scale image
- **Filter tool**: Apply Fabric.js built-in filters (Brightness, Contrast, Saturation, HueRotation, Blur) via sliders
- **Export**: `canvas.toDataURL('image/png')` → trigger download

### Step 7: Update `StatusBar.jsx`
- Show real zoom percentage, image dimensions, cursor x/y position, active tool name

### Step 8: Update `App.jsx`
- Add state: `activeTool`, `brushColor`, `brushSize`, `brushOpacity`
- Pass state and setters to ToolbarRibbon, ToolOptions, CanvasEditor, StatusBar
- Wire up `handleEditComplete` to also work with canvas exports (not just chat edits)
- Add keyboard shortcuts: B=Brush, E=Eraser, T=Text, V=Select, R=Rect, C=Crop, etc.

### Step 9: Update Styles (`App.css`)
- Tool options bar layout (horizontal bar above canvas)
- Active tool button highlight
- Color picker styling
- Crop overlay styling
- Filter panel styling
- Resize dialog styling

## Verification
- Run `npm run lint` to check for lint errors
- Run `npm run build` to verify the project builds
- Manual testing: upload image, use each tool, verify canvas operations work
