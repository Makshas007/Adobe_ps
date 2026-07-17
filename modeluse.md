# Adobe Mock PS — AI Model Context

## Project Overview
Professional AI-assisted image editing system with deep image understanding, structured planning, tool reasoning, and quality critique. Migrating from a simplistic "prompt → edit" pipeline to a Photoshop-like intelligent editor.

## Current Architecture (6-layer pipeline)

```
User Prompt + Image
  → Image Understanding Engine (vision/engine.py)
    → SceneMetadata (scene, objects, colors, faces, lighting, quality)
  → Planning Agent (planning/planner.py)
    → ExecutionPlan (structured steps with tool selection)
  → Tool Dispatcher (dispatcher/dispatcher.py)
    → Routes steps to registered tools or legacy handlers
  → Editing Engine (services/model_manager.py + services/)
    → SAM, InstructPix2Pix, SD Inpainting, rembg, ESRGAN
  → Critic / QA (critic/critic.py)
    → Noise, sharpness, clipping, artifacts, halos, color shift checks
  → Response with per-step masks for toggleable layers
```

## Backend Structure (`backend/app/`)

### Core Modules (new, Phase 1)
| Module | File | Purpose |
|--------|------|---------|
| **Vision** | `vision/engine.py` | ImageUnderstandingEngine: scene, colors, brightness, contrast, sharpness, noise, faces, lighting, aesthetic score (OpenCV/PIL) |
| **Tool Registry** | `tools/registry.py` | 33 tool specs with purpose, strengths/weaknesses, best/avoid, params, GPU cost, latency |
| **Tool Base** | `tools/base.py` | `ToolSpec` and `EditingTool` plugin interfaces |
| **Planning** | `planning/planner.py` | PlanningAgent: LLM + metadata + tool registry → ExecutionPlan; heuristic fallback |
| **Strategy** | `planning/strategy.py` | `ExecutionPlan`, `PlanStep` dataclasses |
| **Dispatcher** | `dispatcher/dispatcher.py` | ToolDispatcher: routes plan steps to registered tools or legacy handlers, emits per-step masks |
| **Critic** | `critic/critic.py` | 7 quality checks (noise, sharpness, clipping, artifacts, halos, color shift, brightness); generates corrective plans |
| **Layers** | `layers/layer.py`, `stack.py` | Non-destructive layers: Image/Adjustment/Mask/Text/Effect/Smart/Group + 16 blend modes |
| **Masks** | `masks/mask.py` | First-class masks: SAM/User/Brush/Selection/Alpha/Depth/Saliency |

### API Endpoints
| Endpoint | File | Description |
|----------|------|-------------|
| `POST /edit` | `api/edit.py` | Image analysis → planning → execution → critique → response with metadata/plan/critique/per-step masks |
| `POST /analyze` | `api/analyze.py` | Pure understanding: returns SceneMetadata + suggestions |
| `POST /upload` | `api/upload.py` | File upload |
| `GET /health` | `api/health.py` | Server status |
| `GET /result/{id}` | `api/edit.py` | Job result polling |

### Response Shape (key fields)
```json
{
  "steps": [{"operation": "", "image": "<b64>", "mask": "<b64>", "duration_ms": 0}],
  "final_image": "<b64>",
  "metadata": {"scene_type": "", "brightness": 0, "contrast": 0, "has_faces": false, "lighting": "", "aesthetic_score": 0},
  "plan": {"steps": [{"tool": "", "params": {}, "reasoning": ""}], "reasoning": ""},
  "critique": {"passed": true, "score": 1.0, "issues": [], "suggestions": []},
  "execution_log": [{"operation": "", "status": "", "duration": 0}],
  "explanation": {"plain_english": "", "technical_summary": ""}
}
```

### Legacy Services (preserved, still functional)
- `services/gemini_service.py` — Gemini API wrapper
- `services/planner.py` — Legacy planner (Gemini JSON validation)
- `services/pipeline.py` — Pipeline executor with context-passing
- `services/model_manager.py` — Singleton model cache/GPU mgmt
- `services/diffusion_service.py` — InstructPix2Pix / SD Inpaint
- `services/sam_service.py` — SAM segmentation (now runs on CUDA with float16)
- `services/esrgan_service.py` — ESRGAN upscaling
- `services/explanation/` — Post-edit explanation (LLM or local fallback)

### Key Changes Made
- **SAM CUDA**: `sam_service.py` now uses passed device + float16 on CUDA (was hardcoded CPU)
- **Per-step masks**: Every pipeline/dispatcher step emits a `mask` (base64) showing changed pixels via pixel-diff thresholding
- **ToolRegistry**: Initialized on startup in `main.py` lifespan
- **Analyze endpoint**: New `POST /analyze` for pure image understanding
- **Response enriched**: Edit response now includes `metadata`, `plan`, `critique` alongside existing fields

## Frontend Structure (`frontend/src/`)

### Components
| Component | File | Purpose |
|-----------|------|---------|
| **App** | `App.jsx` | Root: state, layout, 3 views (editor/library/chats), compositing logic |
| **CanvasEditor** | `components/CanvasEditor.jsx` | Fabric.js canvas (1157 lines): tools, filters, history, layers |
| **ChatWindow** | `components/ChatWindow.jsx` | Chat sidebar, prompt → POST /edit, explanation display |
| **AiInspector** | `components/AiInspector.jsx` | Collapsible panel: scene metadata, edit strategy, quality critique |
| **OperationsPanel** | `components/OperationsPanel.jsx` | Toggleable operation layers with per-step masks + compositing |
| **TreePanel** | `components/TreePanel.jsx` | ReactFlow version tree (history navigation) |
| **ToolbarRibbon** | `components/ToolbarRibbon.jsx` | Left toolbar with tools + actions |
| **ToolOptions** | `components/ToolOptions.jsx` | Context-sensitive tool options sidebar |
| **StatusBar** | `components/StatusBar.jsx` | Bottom status bar |
| **LibraryView** | `components/LibraryView.jsx` | Saved images grid |
| **ChatHistoryView** | `components/ChatHistoryView.jsx` | Chat session list |

### Operations Panel (toggleable layers)
- Each AI edit step displays in the panel with: index, mask thumbnail, operation name, duration, toggle switch
- Toggling a step off recomposites the canvas: starts from original image, applies only visible steps (clipped by their masks using canvas `destination-in` compositing)
- Delete removes the step permanently and recomposites
- "Apply Changes" flattens visible operations into a new history node
- State reset on new chat / upload

### Data Storage
- **IndexedDB**: Images (blob), History nodes (version tree), Messages (chat)
- **localStorage**: Chat session metadata

## State Architecture (App.jsx)
- All state in `useState` hooks in App.jsx
- Passed as props to children
- Canvas methods exposed via `useImperativeHandle` ref
- Key state: `imageUrl`, `imageHistoryNode`, `head`, `activeTool`, `operationSteps[]`, `operationVisibility[]`, `originalImageUrl`, `aiMetadata`, `aiPlan`, `aiCritique`

## Tech Stack
- **Frontend**: React 19, Fabric.js 7, @xyflow/react 12, Vite 8, lucide-react
- **Backend**: Python 3.11+, FastAPI, Pillow, OpenCV, numpy, google-genai
- **Models**: SAM ViT-Base (CPU/CUDA), InstructPix2Pix (GPU), SD Inpainting (GPU), ESRGAN (GPU), rembg (CPU)

## Recent Work
1. Tool registry with 33 editing tool specs
2. Image understanding engine (OpenCV/PIL analysis)
3. Planning agent using metadata + tool registry
4. Tool dispatcher for routing plan steps
5. Critic/QA with 7 quality checks
6. Non-destructive layer + mask data models
7. AI Inspector Panel (frontend)
8. SAM moved to CUDA (was hardcoded CPU)
9. Per-step operation deltas (masks for toggleable layers)
10. Operations Panel with compositing logic (frontend)

## State: "Works" vs "Needs Work"
- ✅ Backend starts, /health, /analyze endpoints verified
- ✅ All Python modules parse and import correctly
- ✅ Frontend lints with zero errors
- ✅ SAM on CUDA with float16
- ✅ Per-step masks emitted from both pipeline and dispatcher
- ✅ Operations panel renders with toggle/delete/composite
- ⬜ Needs testing: actual GPU inference pipeline with real images
- ⬜ Needs testing: frontend compositing with real step data
- ⬜ Nice-to-have: history nodes storing full layer/mask/plan state
