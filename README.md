# Adobe Mock PS

Prompt-based image editing via natural language. Upload an image, describe the edit, and the system orchestrates AI models (Gemini, SAM, InstructPix2Pix, ESRGAN) to execute it.

## Quick Start

```bash
# Backend
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # set GEMINI_API_KEY
uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` for the editor UI.

## Repo Structure

```
Adobe_Mock_PS/
├── backend/          # FastAPI + AI models (Python)
│   ├── app/
│   │   ├── api/              # REST endpoints
│   │   ├── schemas/          # Pydantic request/response schemas
│   │   ├── services/         # Pipeline, models, planner, explanation
│   │   └── utils/            # Image helpers, GPU detection, logging
│   ├── tests/                # Pytest test suite
│   ├── uploads/              # Uploaded images
│   ├── outputs/              # Edited results
│   └── temp/                 # Intermediate masks
│
├── frontend/         # React + Vite (JavaScript)
│   └── src/
│       ├── components/       # Canvas, Chat, History Tree, Toolbar, etc.
│       └── utilities/        # IndexedDB, data URL helpers
│
└── README.md
```

See `backend/README.md` for full backend setup and API reference.
See `frontend/README.md` for full frontend development guide.
