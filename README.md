🎨 Adobe Mock PS

<div align="center">Photoshop, but you tell it what to do.

Prompt → Plan → Segment → Edit → Explain

An AI-powered image editing environment that combines natural-language instructions, computer vision, generative image models, and a full-featured browser editor into one workflow.

<br>""React" (https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)" (https://react.dev/)
""Python" (https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)" (https://www.python.org/)
""FastAPI" (https://img.shields.io/badge/FastAPI-Backend-009688?style=for-the-badge&logo=fastapi&logoColor=white)" (https://fastapi.tiangolo.com/)
""Vite" (https://img.shields.io/badge/Vite-Frontend-646CFF?style=for-the-badge&logo=vite&logoColor=white)" (https://vitejs.dev/)
""Gemini" (https://img.shields.io/badge/Gemini-AI_Planner-4285F4?style=for-the-badge&logo=google&logoColor=white)" (https://ai.google.dev/)
""SAM" (https://img.shields.io/badge/SAM-Segmentation-FF6F00?style=for-the-badge)" (https://github.com/facebookresearch/segment-anything)

</div>---

🧠 What is Adobe Mock PS?

Adobe Mock PS is a prompt-driven image editing system designed around a simple idea:

«You shouldn't need to know which tool to use. You should only need to know what you want.»

Instead of manually selecting objects, creating masks, switching between tools, applying filters, and figuring out the correct editing pipeline, the user can simply describe the desired result.

For example:

"Remove the person on the left, replace the background with a beach,
make the lighting cinematic, and upscale the final image."

The system transforms that instruction into an executable editing pipeline:

Natural Language
       │
       ▼
   Gemini Planner
       │
       ▼
Structured Edit Plan
       │
       ├── Segment ──────► SAM
       │
       ├── Remove ───────► Inpainting
       │
       ├── Background ───► Inpainting
       │
       ├── Style ─────────► InstructPix2Pix
       │
       └── Upscale ───────► Upscaler
       │
       ▼
  Final Image
       │
       ▼
 Explanation + Execution Log

The goal is not to replace an image editor with a chatbot.

The goal is to build an editor where AI understands the user's intent and orchestrates the tools required to execute it.

---

✨ Features

💬 Natural-Language Editing

Describe edits in plain English.

"Remove the car."

"Make the image cyberpunk."

"Put the subject on a beach."

"Remove the person on the left and make it rainy at night."

"Upscale this image."

The Gemini planner decomposes complex instructions into structured operations automatically.

---

🤖 AI-Powered Editing Pipeline

The backend orchestrates multiple specialized models instead of asking one model to do everything.

Operation| Technology| Purpose
"segment"| SAM ViT-Base| Identify and isolate objects
"remove"| SD Inpainting / InstructPix2Pix| Remove selected objects
"replace_background"| SD Inpainting| Replace the background
"remove_background"| rembg| Make the background transparent
"change_style"| InstructPix2Pix| Apply artistic transformations
"style_transfer"| InstructPix2Pix| Transform visual style
"upscale"| PIL / ESRGAN| Increase image resolution

The pipeline is context-aware.

For example:

segment(person)
      │
      ▼
   SAM Mask
      │
      ▼
remove(person)
      │
      ▼
Masked Inpainting

The generated segmentation mask is passed into subsequent operations instead of blindly modifying the entire image.

That means the system knows where it should edit, not merely what it should edit.

---

🎯 Smart Mask-Aware Editing

One of the important design decisions in Adobe Mock PS is the use of segmentation masks as pipeline context.

For an instruction such as:

"Remove the person."

the system can execute:

Prompt
  ↓
Gemini
  ↓
segment → person
  ↓
SAM
  ↓
Mask
  ↓
remove
  ↓
Inpainting

The mask constrains regeneration to the relevant region.

Similarly, background replacement can invert the mask:

Subject Mask
     ↓
    INVERT
     ↓
Background Region
     ↓
Inpainting

This avoids treating the entire image as a generic img2img canvas.

---

🧩 The Editor

Adobe Mock PS isn't just an API with a textbox attached.

It includes a browser-based image editor with interactive editing tools.

Canvas capabilities

- 🖱️ Object selection
- 🖌️ Brush
- 🧽 Eraser
- 🔤 Text
- ▭ Rectangle tools
- ✂️ Crop
- 🌫️ Blur
- 🔄 Restore
- 🎨 Doodle eraser
- 🔍 Zoom
- 🎚️ Image filters
- ↩️ Undo / redo
- 💾 Export

The frontend uses Fabric.js for canvas manipulation.

---

🌳 Non-Destructive Visual History

Every editing action can become part of an image history tree.

Instead of thinking:

Image → Image → Image → Image

the application models editing as:

                 ┌── Cyberpunk
                 │
Original ────────┼── Beach
                 │
                 └── Black & White

This makes alternate edits possible without destroying previous states.

The frontend maintains image history nodes using IndexedDB, allowing edits and branches to persist locally.

---

💡 AI + Manual Editing

The project combines two editing paradigms:

Traditional editing

Select
Brush
Crop
Resize
Filters
Text
Blur
Erase

AI editing

"Remove the person."
"Make it cinematic."
"Replace the background."
"Turn this into a cyberpunk scene."

You can therefore use AI for high-level transformations while retaining precise manual control when needed.

Because apparently humans still enjoy moving sliders themselves.

---

🧾 Explainability

AI image editing should not be a black box.

Every completed edit produces an execution log describing what actually happened.

Example:

segment → person → success
remove  → person → success
change_style → cyberpunk → success
upscale → skipped

The explanation system converts this into user-facing information.

Plain English

The person was identified and removed from the image.
The remaining scene was then transformed into a cyberpunk style.
Upscaling was not performed.

Technical summary

- Person segmented using SAM.
- Object removed using masked inpainting.
- Style transformed using InstructPix2Pix.
- Upscale skipped.

---

🔍 Log Is Truth

The explanation system follows an important architectural rule:

«The execution log is the source of truth.»

The explanation generator does not simply repeat the original prompt.

Instead:

User Prompt
     │
     ▼
Execution Plan
     │
     ▼
Pipeline Execution
     │
     ▼
Execution Log
     │
     ▼
Explanation Service
     │
     ▼
User Explanation

This prevents the system from claiming that an operation succeeded when it was actually skipped or failed.

---

🧠 Explanation Architecture

The backend uses a provider-based architecture:

ExplanationService
│
├── GeminiExplanationProvider
│
└── LocalExplanationProvider

Gemini provider

Used when:

GEMINI_API_KEY

is configured.

Local provider

Used as a deterministic fallback when an API key isn't available.

This means explanations don't completely disappear just because the LLM isn't available.

---

🏗️ Architecture

┌──────────────────────────────────────────────────────────┐
│                     FRONTEND                             │
│                                                          │
│  React + Vite                                            │
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────────┐  │
│  │   Toolbar   │  │   Canvas    │  │   AI Chat      │  │
│  └─────────────┘  └─────────────┘  └────────────────┘  │
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────────┐  │
│  │   History   │  │   Library   │  │  Tool Options  │  │
│  └─────────────┘  └─────────────┘  └────────────────┘  │
│                                                          │
└────────────────────────┬─────────────────────────────────┘
                         │
                         │ REST API
                         ▼
┌──────────────────────────────────────────────────────────┐
│                     BACKEND                              │
│                                                          │
│                     FastAPI                              │
│                         │                                │
│                         ▼                                │
│                 Gemini Planner                           │
│                         │                                │
│                         ▼                                │
│                Structured Plan                           │
│                         │                                │
│             ┌───────────┼───────────┐                    │
│             ▼           ▼           ▼                    │
│            SAM     Inpainting   InstructPix2Pix          │
│             │           │           │                    │
│             └───────────┼───────────┘                    │
│                         ▼                                │
│                  Pipeline Executor                       │
│                         │                                │
│                         ▼                                │
│                  Execution Log                           │
│                         │                                │
│                         ▼                                │
│                  Explanation Service                     │
│                                                          │
└──────────────────────────────────────────────────────────┘

---

📁 Project Structure

Adobe_ps/
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── analyze.py
│   │   │   ├── edit.py
│   │   │   ├── health.py
│   │   │   └── upload.py
│   │   │
│   │   ├── critic/
│   │   ├── dispatcher/
│   │   ├── layers/
│   │   ├── masks/
│   │   ├── models/
│   │   ├── planning/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── config.py
│   │   └── main.py
│   │
│   ├── tests/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── README.md
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── CanvasEditor
│   │   │   ├── ChatWindow
│   │   │   ├── TreePanel
│   │   │   ├── ToolbarRibbon
│   │   │   ├── ToolOptions
│   │   │   └── ...
│   │   │
│   │   ├── utilities/
│   │   ├── App.jsx
│   │   └── App.css
│   │
│   ├── package.json
│   └── ...
│
├── LICENSE
├── AGENT.md
└── README.md

---

⚙️ Tech Stack

Frontend

- React 19
- Vite
- Fabric.js
- React Flow
- Dagre
- Lucide React
- IndexedDB

The frontend uses Fabric.js for the actual image-editing canvas and React Flow/Dagre for visualizing editing history.

---

Backend

- Python 3.11+
- FastAPI
- Pydantic
- PyTorch
- Pillow
- OpenCV
- Gemini
- Segment Anything
- InstructPix2Pix
- Stable Diffusion Inpainting
- rembg
- ESRGAN

---

🚀 Quick Start

1. Clone

git clone https://github.com/Makshas007/Adobe_ps.git
cd Adobe_ps

---

🐍 Backend

cd backend

python3 -m venv venv
source venv/bin/activate

pip install -r requirements.txt

Configure your environment:

cp .env.example .env

Add your Gemini API key:

GEMINI_API_KEY="your-key"

Start the server:

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

Backend:

http://localhost:8000

Swagger API documentation:

http://localhost:8000/docs

---

⚡ GPU Setup

GPU acceleration is optional but strongly recommended for generative editing.

The backend has been tested with an RTX 2050 with 4 GB VRAM.

The pipeline is designed to conserve VRAM by:

- Running SAM on CPU
- Using FP16 for diffusion models
- Unloading models between pipeline stages
- Passing masks between operations instead of regenerating entire images

For CUDA 12.4:

pip install torch==2.6.0 torchvision==0.21.0 \
  --index-url https://download.pytorch.org/whl/cu124

Verify CUDA:

python -c "import torch; print('CUDA:', torch.cuda.is_available())"

Expected:

CUDA: True

---

💻 Frontend

Open another terminal:

cd frontend

npm install
npm run dev

Then open:

http://localhost:5173

---

🔌 API

Health

GET /health

Returns server and model availability.

---

Upload

POST /upload

Example:

curl -X POST http://localhost:8000/upload \
  -F "file=@photo.jpg"

The server returns an uploaded filename that can be used for editing.

---

Edit

POST /edit

Example:

curl -X POST http://localhost:8000/edit \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "remove the person on the left and make the scene cyberpunk at night",
    "image": "upload_abc123.png"
  }'

The response contains:

- Job ID
- Pipeline steps
- Intermediate images
- Final image
- Execution log
- Explanation
- Timing information
- Errors, if any

---

Result

GET /result/{job_id}

Useful for long-running operations.

---

History

GET /history/{job_id}

Returns job metadata and progress information.

---

🎮 Editing Examples

Remove an object

"Remove the person standing on the left."

Pipeline:

segment(person)
        ↓
remove()

---

Replace background

"Put this person on a tropical beach."

Pipeline:

segment(person)
        ↓
replace_background(beach)

---

Style transformation

"Turn this into a cyberpunk movie scene."

Pipeline:

change_style(cyberpunk)

---

Multi-step edit

"Remove the car, make it rainy at night,
then give the whole scene a cinematic look."

Pipeline:

segment(car)
      ↓
remove(car)
      ↓
change_style(rainy night)
      ↓
change_style(cinematic)

---

⌨️ Keyboard Shortcuts

Key| Tool
"V"| Select
"B"| Brush
"E"| Eraser
"T"| Text
"U"| Rectangle
"C"| Crop
"L"| Blur
"R"| Restore
"D"| Doodle Eraser
"Ctrl / Cmd + Z"| Undo
"Ctrl / Cmd + Y"| Redo
"Ctrl / Cmd + S"| Save

---

🧪 Testing

Backend tests can be executed with:

cd backend

source venv/bin/activate

python -m pytest tests/ -v

The test suite covers pipeline behavior, AI services, simulation, endpoints, and explanation behavior.

Particular attention is given to ensuring that:

SUCCESS ≠ SKIPPED
SUCCESS ≠ FAILED

The explanation system must accurately reflect the execution log.

---

🔥 Why This Project Is Different

Most AI image editors follow this pattern:

Prompt
  ↓
Magic AI Button
  ↓
Image

Adobe Mock PS attempts something more structured:

                USER INTENT
                     │
                     ▼
              ┌─────────────┐
              │    GEMINI   │
              │   PLANNER   │
              └──────┬──────┘
                     │
                     ▼
             STRUCTURED PLAN
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
        SAM       INPAINT     STYLE
          │          │          │
          └──────────┼──────────┘
                     ▼
               EXECUTION LOG
                     │
          ┌──────────┴──────────┐
          ▼                     ▼
     FINAL IMAGE            EXPLANATION

The AI isn't merely generating pixels.

It is planning and orchestrating an editing workflow.

---

🧬 Design Principles

1. Intent over tools

Users describe what they want, not which Photoshop tool to use.

2. Specialized models

Different tasks should use different models.

Segmentation → SAM
Inpainting   → Diffusion
Style        → InstructPix2Pix
Upscaling    → Upscaler
Planning     → Gemini

3. Context-aware execution

Outputs from one pipeline stage become inputs to later stages.

4. Explainability

Every operation should be traceable.

5. Graceful fallback

LLM-backed features should have deterministic fallbacks where possible.

6. Non-destructive editing

Editing history should allow users to explore alternate outcomes.

---

🗺️ Roadmap

Potential future directions include:

- [ ] More advanced object-aware editing
- [ ] Improved multi-object selection
- [ ] More generative editing operations
- [ ] Better GPU memory management
- [ ] More sophisticated image restoration
- [ ] Layer-aware AI editing
- [ ] Mask visualization and manual refinement
- [ ] More advanced history branching
- [ ] Collaborative editing
- [ ] Model/plugin architecture
- [ ] Production-grade job queue
- [ ] Cloud inference
- [ ] Mobile-friendly editor

---

🏎️ Performance Notes

Image generation is computationally expensive.

For faster inference:

512 × 512

is generally a good starting resolution.

On limited VRAM hardware, the system reduces memory pressure by:

SAM → CPU
Diffusion → GPU
      ↓
Model unloaded
      ↓
Next pipeline step

This allows the pipeline to operate on hardware with relatively limited VRAM.

---

🔐 Configuration

Environment configuration is handled through ".env".

Important settings include:

Variable| Purpose
"GEMINI_API_KEY"| Gemini API authentication
"GEMINI_MODEL"| Gemini planner model
"DEVICE"| "auto", "cuda", "cpu", or "mps"
"OUTPUT_DIRECTORY"| Generated image location
"UPLOAD_DIRECTORY"| Uploaded image location

Never commit API keys to the repository.

---

🧑‍💻 Development

Frontend:

cd frontend
npm install
npm run dev

Production build:

npm run build

Backend:

cd backend
source venv/bin/activate

uvicorn app.main:app --reload

Tests:

python -m pytest tests/ -v

---

📚 Documentation

Detailed backend documentation:

backend/README.md

Frontend documentation:

frontend/README.md

---

🧠 The Big Idea

Adobe Mock PS is an experiment in AI-native creative software.

Traditional creative software asks:

«"Which tool do you want to use?"»

AI-native creative software should ask:

«"What are you trying to create?"»

That difference sounds small.

Architecturally, it changes almost everything.

Instead of exposing every operation directly to the user, Adobe Mock PS introduces an intelligent orchestration layer capable of turning high-level intent into a sequence of specialized computer-vision and generative operations.

The result is a workflow that looks less like:

User → Tool → Pixels

and more like:

User
 │
 │ "Make this look cinematic."
 ▼
AI Planner
 │
 │ structured intent
 ▼
Editing Pipeline
 │
 ├── segmentation
 ├── masking
 ├── inpainting
 ├── style transformation
 └── upscaling
 │
 ▼
Final Image
 │
 ▼
"What actually happened?"
 │
 ▼
Execution Log + Explanation

---

🏁 Final

Adobe Mock PS is built around one simple proposition:

«Image editing should be limited by imagination, not interface complexity.»

Describe the image you want.

Let the system figure out the tools.

Then show you exactly what it did.

---

<div align="center">🎨 Adobe Mock PS

Prompt it. Edit it. Branch it. Understand it.

Built with React • FastAPI • Gemini • SAM • Diffusion • Fabric.js

</div>
