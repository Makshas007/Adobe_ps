You are a senior AI software architect and full-stack engineer.

Your task is to MIGRATE the existing image editor into a professional AI-assisted image editing system, WITHOUT rewriting everything from scratch.

# Goal

The current application works as:

User Prompt
        ↓
LLM
        ↓
Image Editing Model
        ↓
Output

This architecture is too simplistic.

We are migrating to a Photoshop-like intelligent editor where the AI FIRST understands the image, then reasons about an editing strategy, then invokes specialized editing tools.

The objective is NOT simply "prompt → edit".

Instead:

Prompt
+
Deep Image Understanding
+
Editing Knowledge
+
Tool Reasoning
=
Professional Editing Strategy

The current layout, styling and user experience should remain mostly unchanged unless modifications are required to support this new workflow.

Do not redesign the application.

Instead, extend it naturally.

----------------------------------------------------
NEW SYSTEM ARCHITECTURE
----------------------------------------------------

The new pipeline should become:

User Prompt
        │
        ▼
Image Understanding Engine
        │
        ▼
Structured Scene Representation
        │
        ▼
Planning Agent
        │
        ▼
Editing Strategy
        │
        ▼
Tool Dispatcher
        │
        ▼
Editing Engine
        │
        ▼
Critic / QA
        │
        ▼
Final Image

----------------------------------------------------
IMAGE UNDERSTANDING
----------------------------------------------------

The AI should never edit blindly.

It should first understand the image.

Build an Image Understanding module.

The module should combine multiple vision models and classical CV.

Examples:

• Florence-2
• Qwen2.5-VL
• Grounding DINO
• SAM2
• Depth Anything
• OpenCV
• MediaPipe
• CLIP embeddings

Generate structured metadata such as:

- scene
- objects
- segmentation masks
- depth
- faces
- people
- pose
- image quality
- brightness
- contrast
- saturation
- weather
- lighting
- dominant colours
- background
- foreground
- sky
- water
- architecture
- text regions
- aesthetic score
- saliency map
- object relationships

This metadata becomes the AI's "knowledge" about the image.

Never ask the LLM to infer everything directly from pixels.

----------------------------------------------------
EDITING KNOWLEDGE BASE
----------------------------------------------------

Create a tool registry.

Every editing capability should describe:

- purpose
- strengths
- weaknesses
- preferred use cases
- required inputs
- output
- compatible tools
- parameters
- GPU cost
- latency

Example:

Sharpen

Purpose:
Increase local detail.

Best for:
Eyes
Hair
Architecture

Avoid:
Noise
Sky
Skin

Similarly describe:

Brightness

Contrast

Curves

Levels

Hue

Saturation

Exposure

Temperature

Tint

Crop

Rotate

Perspective

Lens correction

Blur

Gaussian blur

Background blur

Bokeh

Object removal

Background removal

Sky replacement

Generative fill

Inpainting

Outpainting

Healing

Clone

Denoise

Upscale

Shadow recovery

Highlight recovery

Colour grading

Film LUT

Black & White

Watercolour

Oil painting

Cartoon

Sketch

Face enhancement

Portrait retouch

Skin smoothing

Hair enhancement

Eye enhancement

Text removal

Text insertion

Sticker insertion

Layer blending

Mask refinement

Edge refinement

Feathering

etc.

----------------------------------------------------
PLANNING AGENT
----------------------------------------------------

The planner should receive:

User Prompt

+

Structured Image Metadata

+

Editing Knowledge

The planner should reason before editing.

Example:

User:

"Make this look cinematic."

The planner should reason:

Current lighting already warm.

Sky is bright.

Subject slightly underexposed.

Foreground noisy.

Suggested strategy:

1.
Recover highlights.

2.
Cool shadows.

3.
Increase orange highlights.

4.
Reduce green saturation.

5.
Add vignette.

6.
Sharpen subject.

7.
Do not sharpen sky.

Generate a structured execution plan.

Not natural language.

----------------------------------------------------
TOOL DISPATCHER
----------------------------------------------------

Replace direct model execution with a dispatcher.

The dispatcher maps each plan step into specialized tools.

Examples:

OpenCV

Pillow

SAM2

Grounding DINO

LaMa

SDXL

ControlNet

RealESRGAN

MediaPipe

Depth Anything

etc.

Each tool should be independent.

Adding a new tool later should require only registration.

----------------------------------------------------
ITERATIVE EXECUTION
----------------------------------------------------

Execution should be sequential.

Each tool updates:

Current Image

Current Masks

Current Metadata

History

Layers

The planner may use intermediate outputs.

----------------------------------------------------
CRITIC
----------------------------------------------------

After execution, perform QA.

Analyse:

Artifacts

Halos

Mask quality

Over sharpening

Colour clipping

Noise

Composition

Lighting consistency

Aesthetic score

If quality is poor:

Automatically generate corrective edits.

The critic should optionally loop once more.

----------------------------------------------------
LAYERS
----------------------------------------------------

The current editor is destructive.

Migrate to non-destructive editing.

Introduce Photoshop-style layers.

Support:

Image Layer

Adjustment Layer

Mask Layer

Text Layer

Effect Layer

Smart Layer

Each edit should create a layer.

Layers should support:

visibility

opacity

rename

delete

duplicate

reorder

merge

group

blend mode

Every AI edit should preserve masks whenever possible.

----------------------------------------------------
MASKS
----------------------------------------------------

Masks become first-class citizens.

Store:

SAM masks

User masks

Brush masks

Selection masks

Allow future manual editing.

----------------------------------------------------
HISTORY
----------------------------------------------------

Keep the existing version tree.

However every node now stores:

image

layers

masks

metadata

tool outputs

planner reasoning

chat context

execution plan

----------------------------------------------------
CHAT
----------------------------------------------------

The chatbot now behaves like a professional photo editor.

It has access to:

Current image

Current metadata

Current layers

Current masks

Current history

Current node

The AI understands edits already performed.

----------------------------------------------------
UI
----------------------------------------------------

Preserve the current design language.

Only extend where necessary.

Suggested additions:

Top Toolbar

- Undo
- Redo
- Save
- Export
- AI Analyze
- Compare
- Layer Visibility
- Zoom
- Fit

Left Toolbar

Selection

Brush

Erase

Crop

Move

Text

Mask

AI Object Select

Healing

Clone

Right Sidebar

Layers

Masks

Properties

Image Analysis

AI Suggestions

History Tree

Bottom

Status

GPU

Inference

Progress

Maintain the existing layout wherever possible.

Do not redesign unnecessarily.

----------------------------------------------------
AI INSPECTOR PANEL
----------------------------------------------------

Add a collapsible sidebar showing live image understanding.

Example:

Scene

Objects

Lighting

Depth

Dominant Colours

Image Quality

Detected Faces

Detected Text

Suggestions

This helps explain why the AI chose particular edits.

----------------------------------------------------
EXPLANATION ENGINE
----------------------------------------------------

Every edit should include:

What changed

Why

Which tools were used

Confidence

Affected regions

Estimated processing time

----------------------------------------------------
CODE QUALITY
----------------------------------------------------

Refactor into modular architecture.

Separate:

Vision

Planning

Dispatcher

Tools

Execution

Layers

History

Masks

Critic

UI

Avoid giant files.

Follow clean architecture.

Use interfaces for tools.

Support future plugins.

----------------------------------------------------
IMPORTANT
----------------------------------------------------

Do NOT remove existing features unless necessary.

Preserve the existing workflow.

Migrate incrementally.

Keep commits logically separated.

Ensure the application remains functional after each migration step.

When multiple implementation choices exist, prefer the one that maximizes extensibility, modularity, and maintainability.
