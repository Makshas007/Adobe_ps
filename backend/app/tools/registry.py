from __future__ import annotations

from typing import Any, Dict, List, Optional

from app.tools.base import EditingTool, ToolSpec
from app.utils.logger import get_logger

logger = get_logger(__name__)

BUILTIN_TOOL_SPECS: List[Dict[str, Any]] = [
    {
        "name": "brightness",
        "category": "adjustment",
        "purpose": "Adjust overall image brightness.",
        "description": "Increases or decreases the brightness of the entire image linearly.",
        "strengths": ["Simple", "Fast", "Non-destructive"],
        "weaknesses": ["Can clip highlights or crush shadows", "No local control"],
        "best_for": ["Underexposed images", "Quick fixes"],
        "avoid_for": ["Already well-exposed images", "High-key photography"],
        "required_inputs": ["image"],
        "outputs": ["adjusted_image"],
        "compatible_tools": ["contrast", "levels", "curves", "exposure"],
        "parameters": {
            "value": {"type": "float", "range": [-100, 100], "default": 0, "description": "Brightness adjustment (-100 to +100)"}
        },
        "gpu_cost": "none",
        "latency": "instant",
    },
    {
        "name": "contrast",
        "category": "adjustment",
        "purpose": "Adjust image contrast by stretching or compressing the tonal range.",
        "description": "Increases or decreases the difference between light and dark areas.",
        "strengths": ["Simple", "Fast", "Effective"],
        "weaknesses": ["Can cause clipping", "No local control"],
        "best_for": ["Flat images", "Improving pop"],
        "avoid_for": ["Already high-contrast images", "Noisy images"],
        "required_inputs": ["image"],
        "outputs": ["adjusted_image"],
        "compatible_tools": ["brightness", "levels", "curves"],
        "parameters": {
            "value": {"type": "float", "range": [-100, 100], "default": 0, "description": "Contrast adjustment (-100 to +100)"}
        },
        "gpu_cost": "none",
        "latency": "instant",
    },
    {
        "name": "saturation",
        "category": "adjustment",
        "purpose": "Adjust color intensity of the image.",
        "description": "Increases or decreases the vividness of all colors uniformly.",
        "strengths": ["Simple", "Fast"],
        "weaknesses": ["Can cause color clipping", "No per-channel control"],
        "best_for": ["Vibrant photos", "Faded images"],
        "avoid_for": ["Skin tones (prefer HSL)", "Already saturated images"],
        "required_inputs": ["image"],
        "outputs": ["adjusted_image"],
        "compatible_tools": ["hue", "color_grading", "levels"],
        "parameters": {
            "value": {"type": "float", "range": [-100, 100], "default": 0, "description": "Saturation adjustment (-100 to +100)"}
        },
        "gpu_cost": "none",
        "latency": "instant",
    },
    {
        "name": "hue",
        "category": "adjustment",
        "purpose": "Rotate the hue of all colors in the image.",
        "description": "Shifts the color wheel, changing every color by a fixed offset.",
        "strengths": ["Creative effect", "Fast"],
        "weaknesses": ["Can look artificial", "No per-color control"],
        "best_for": ["Creative color shifts", "Color grading"],
        "avoid_for": ["Natural look", "Portrait skin tones"],
        "required_inputs": ["image"],
        "outputs": ["adjusted_image"],
        "compatible_tools": ["saturation", "color_grading", "temperature"],
        "parameters": {
            "value": {"type": "float", "range": [-180, 180], "default": 0, "description": "Hue rotation in degrees"}
        },
        "gpu_cost": "none",
        "latency": "instant",
    },
    {
        "name": "exposure",
        "category": "adjustment",
        "purpose": "Simulate exposure compensation (EV adjustment).",
        "description": "Multiplies pixel values to simulate changing camera exposure.",
        "strengths": ["Photorealistic", "Simple"],
        "weaknesses": ["No shadow/highlight recovery"],
        "best_for": ["EV compensation", "Bracketed look"],
        "avoid_for": ["Severely clipped images"],
        "required_inputs": ["image"],
        "outputs": ["adjusted_image"],
        "compatible_tools": ["brightness", "levels", "curves"],
        "parameters": {
            "value": {"type": "float", "range": [-4.0, 4.0], "default": 0, "description": "Exposure value in stops"}
        },
        "gpu_cost": "none",
        "latency": "instant",
    },
    {
        "name": "temperature",
        "category": "adjustment",
        "purpose": "Adjust white balance temperature (warm/cool).",
        "description": "Shifts the color balance along the blue-yellow axis.",
        "strengths": ["Natural look", "Essential for white balance"],
        "weaknesses": ["Can introduce color cast"],
        "best_for": ["White balance correction", "Warming/cooling"],
        "avoid_for": ["Already balanced images (subtle only)"],
        "required_inputs": ["image"],
        "outputs": ["adjusted_image"],
        "compatible_tools": ["tint", "color_grading", "saturation"],
        "parameters": {
            "value": {"type": "float", "range": [-100, 100], "default": 0, "description": "Temperature shift (-100=cool, +100=warm)"}
        },
        "gpu_cost": "none",
        "latency": "instant",
    },
    {
        "name": "tint",
        "category": "adjustment",
        "purpose": "Adjust white balance tint (green/magenta).",
        "description": "Shifts the color balance along the green-magenta axis.",
        "strengths": ["Natural look", "Essential for white balance"],
        "weaknesses": ["Can introduce color cast"],
        "best_for": ["White balance correction", "Fixing fluorescent lighting"],
        "avoid_for": ["Already balanced images"],
        "required_inputs": ["image"],
        "outputs": ["adjusted_image"],
        "compatible_tools": ["temperature", "color_grading"],
        "parameters": {
            "value": {"type": "float", "range": [-100, 100], "default": 0, "description": "Tint shift (-100=green, +100=magenta)"}
        },
        "gpu_cost": "none",
        "latency": "instant",
    },
    {
        "name": "sharpen",
        "category": "filter",
        "purpose": "Increase local detail and edge contrast.",
        "description": "Applies unsharp mask or convolution sharpen to enhance details.",
        "strengths": ["Enhances detail", "Improves perceived resolution"],
        "weaknesses": ["Amplifies noise", "Can create halos"],
        "best_for": ["Eyes", "Hair", "Architecture", "Product photos"],
        "avoid_for": ["Noisy images", "Sky", "Skin (exaggerates pores)", "Already sharp images"],
        "required_inputs": ["image"],
        "outputs": ["sharpened_image"],
        "compatible_tools": ["denoise", "face_enhancement", "mask_refinement"],
        "parameters": {
            "amount": {"type": "float", "range": [0, 5], "default": 1.0, "description": "Sharpening strength"},
            "radius": {"type": "float", "range": [0.1, 5], "default": 1.0, "description": "Sharpening radius in pixels"},
            "threshold": {"type": "int", "range": [0, 255], "default": 0, "description": "Edge detection threshold"}
        },
        "gpu_cost": "none",
        "latency": "fast",
    },
    {
        "name": "blur",
        "category": "filter",
        "purpose": "Reduce detail and smooth the image.",
        "description": "Applies a convolution blur to reduce noise or create softness.",
        "strengths": ["Noise reduction", "Softening", "Bokeh simulation"],
        "weaknesses": ["Loses detail", "Can look artificial"],
        "best_for": ["Background softening", "Noise reduction", "Skin smoothing"],
        "avoid_for": ["Text", "Fine details", "Eyes"],
        "required_inputs": ["image"],
        "outputs": ["blurred_image"],
        "compatible_tools": ["denoise", "background_blur", "skin_smoothing"],
        "parameters": {
            "radius": {"type": "float", "range": [0.1, 50], "default": 5, "description": "Blur radius in pixels"}
        },
        "gpu_cost": "none",
        "latency": "fast",
    },
    {
        "name": "gaussian_blur",
        "category": "filter",
        "purpose": "Apply Gaussian blur for smooth, natural-looking blur.",
        "description": "Convolution with a Gaussian kernel for smooth transitions.",
        "strengths": ["Natural look", "Mathematically well-defined"],
        "weaknesses": ["Slow at large radii", "No edge awareness"],
        "best_for": ["General blur", "Depth of field simulation", "Mask feathering"],
        "avoid_for": ["Edge-preserving needs"],
        "required_inputs": ["image"],
        "outputs": ["blurred_image"],
        "compatible_tools": ["blur", "background_blur", "bokeh", "feathering"],
        "parameters": {
            "radius": {"type": "float", "range": [0.1, 100], "default": 5, "description": "Gaussian blur radius"}
        },
        "gpu_cost": "none",
        "latency": "fast",
    },
    {
        "name": "denoise",
        "category": "filter",
        "purpose": "Reduce image noise while preserving edges.",
        "description": "Applies Non-Local Means denoising or bilateral filter.",
        "strengths": ["Preserves edges", "Reduces grain"],
        "weaknesses": ["Can look plastic", "Slow at high strength"],
        "best_for": ["High-ISO photos", "Low-light images", "Skin smoothing"],
        "avoid_for": ["Already clean images", "Text and fine details"],
        "required_inputs": ["image"],
        "outputs": ["denoised_image"],
        "compatible_tools": ["sharpen", "skin_smoothing", "face_enhancement"],
        "parameters": {
            "strength": {"type": "float", "range": [1, 20], "default": 10, "description": "Denoising strength"},
            "template_size": {"type": "int", "range": [3, 15], "default": 7, "description": "Template window size"},
            "search_size": {"type": "int", "range": [5, 41], "default": 21, "description": "Search window size"}
        },
        "gpu_cost": "none",
        "latency": "medium",
    },
    {
        "name": "crop",
        "category": "transform",
        "purpose": "Remove outer regions of the image.",
        "description": "Crops the image to specified rectangle or aspect ratio.",
        "strengths": ["Simple", "Essential composition tool"],
        "weaknesses": ["Destructive", "Loses image data"],
        "best_for": ["Composition improvement", "Aspect ratio change", "Removing edges"],
        "avoid_for": ["When you need full image later"],
        "required_inputs": ["image", "bounds"],
        "outputs": ["cropped_image"],
        "compatible_tools": ["rotate", "perspective", "resize"],
        "parameters": {
            "x": {"type": "int", "range": [0, 99999], "default": 0, "description": "Left crop coordinate"},
            "y": {"type": "int", "range": [0, 99999], "default": 0, "description": "Top crop coordinate"},
            "width": {"type": "int", "range": [1, 99999], "default": 0, "description": "Crop width"},
            "height": {"type": "int", "range": [1, 99999], "default": 0, "description": "Crop height"},
            "aspect_ratio": {"type": "string", "default": "", "description": "Aspect ratio like '16:9', '4:3', '1:1'"}
        },
        "gpu_cost": "none",
        "latency": "instant",
    },
    {
        "name": "rotate",
        "category": "transform",
        "purpose": "Rotate the image by a given angle.",
        "description": "Rotates the image clockwise by specified degrees.",
        "strengths": ["Simple", "Fast"],
        "weaknesses": ["Quality loss on non-90-degree rotations"],
        "best_for": ["Straightening horizons", "Portrait/landscape switch"],
        "avoid_for": ["Text that must remain readable"],
        "required_inputs": ["image"],
        "outputs": ["rotated_image"],
        "compatible_tools": ["crop", "perspective"],
        "parameters": {
            "angle": {"type": "float", "range": [-360, 360], "default": 0, "description": "Rotation angle in degrees"},
            "expand": {"type": "bool", "default": True, "description": "Expand canvas to fit rotated image"}
        },
        "gpu_cost": "none",
        "latency": "instant",
    },
    {
        "name": "resize",
        "category": "transform",
        "purpose": "Change image dimensions.",
        "description": "Rescales the image to new width and height.",
        "strengths": ["Simple", "Fast"],
        "weaknesses": ["Quality loss on upscale", "Information loss on downscale"],
        "best_for":["Output size requirements", "Thumbnails", "Web optimization"],
        "avoid_for": ["When quality is critical (use upscale instead)"],
        "required_inputs": ["image"],
        "outputs": ["resized_image"],
        "compatible_tools": ["crop", "upscale"],
        "parameters": {
            "width": {"type": "int", "range": [1, 99999], "default": 0, "description": "Target width"},
            "height": {"type": "int", "range": [1, 99999], "default": 0, "description": "Target height"},
            "mode": {"type": "string", "default": "fit", "description": "Resize mode: fit/fill/stretch"},
            "interpolation": {"type": "string", "default": "lanczos", "description": "Interpolation method"}
        },
        "gpu_cost": "none",
        "latency": "instant",
    },
    {
        "name": "levels",
        "category": "adjustment",
        "purpose": "Adjust shadow, midtone, and highlight levels.",
        "description": "Maps black point, gamma, and white point for precise tonal control.",
        "strengths": ["Precise tonal control", "Professional standard"],
        "weaknesses": ["Requires understanding", "Can clip"],
        "best_for": ["Tonal range expansion", "Contrast enhancement", "Shadow recovery"],
        "avoid_for": ["Quick edits (use brightness/contrast instead)"],
        "required_inputs": ["image"],
        "outputs": ["adjusted_image"],
        "compatible_tools": ["curves", "brightness", "contrast", "exposure"],
        "parameters": {
            "black": {"type": "float", "range": [0, 255], "default": 0, "description": "Black point"},
            "white": {"type": "float", "range": [0, 255], "default": 255, "description": "White point"},
            "gamma": {"type": "float", "range": [0.01, 9.99], "default": 1.0, "description": "Gamma correction"}
        },
        "gpu_cost": "none",
        "latency": "instant",
    },
    {
        "name": "curves",
        "category": "adjustment",
        "purpose": "Adjust tonal curve for precise control over shadows, midtones, and highlights.",
        "description": "Apply a customizable tonal response curve with control points.",
        "strengths": ["Most precise tonal control", "Professional tool"],
        "weaknesses": ["Steep learning curve", "Can produce unnatural results"],
        "best_for": ["Fine tonal adjustments", "Color grading", "Film looks"],
        "avoid_for": ["Simple brightness fixes"],
        "required_inputs": ["image"],
        "outputs": ["adjusted_image"],
        "compatible_tools": ["levels", "brightness", "contrast", "color_grading"],
        "parameters": {
            "points": {"type": "array", "default": [], "description": "List of (x,y) control points in range [0,255]"},
            "channel": {"type": "string", "default": "rgb", "description": "Channel: rgb, red, green, blue, alpha"}
        },
        "gpu_cost": "none",
        "latency": "fast",
    },
    {
        "name": "color_grading",
        "category": "adjustment",
        "purpose": "Apply creative color grading with shadow/midtone/highlight color wheels.",
        "description": "Independent color adjustments for shadows, midtones, and highlights.",
        "strengths": ["Professional color grading", "Cinematic looks"],
        "weaknesses": ["Can look artificial", "Complex"],
        "best_for": ["Cinematic grading", "Creative looks", "Mood setting"],
        "avoid_for": ["Natural color correction (use temp/tint)"],
        "required_inputs": ["image"],
        "outputs": ["graded_image"],
        "compatible_tools": ["curves", "temperature", "tint", "saturation", "film_lut"],
        "parameters": {
            "shadows": {"type": "object", "default": {"r": 0, "g": 0, "b": 0}, "description": "Shadow color cast"},
            "midtones": {"type": "object", "default": {"r": 0, "g": 0, "b": 0}, "description": "Midtone color cast"},
            "highlights": {"type": "object", "default": {"r": 0, "g": 0, "b": 0}, "description": "Highlight color cast"}
        },
        "gpu_cost": "none",
        "latency": "fast",
    },
    {
        "name": "background_removal",
        "category": "segmentation",
        "purpose": "Remove the background, making it transparent.",
        "description": "Uses AI-based matting to separate foreground from background.",
        "strengths": ["Accurate", "Handles hair/fur", "Human-optimized"],
        "weaknesses": ["Can miss fine details", "GPU recommended for speed"],
        "best_for": ["Portraits", "Product photos", "E-commerce"],
        "avoid_for": ["Complex foregrounds", "Low contrast between FG and BG"],
        "required_inputs": ["image"],
        "outputs": ["image_with_alpha", "mask"],
        "compatible_tools": ["background_replacement", "object_removal", "mask_refinement"],
        "parameters": {
            "model": {"type": "string", "default": "auto", "description": "Model: auto/human/general"},
            "refine": {"type": "bool", "default": True, "description": "Refine edges with feathering"}
        },
        "gpu_cost": "low",
        "latency": "medium",
    },
    {
        "name": "background_replacement",
        "category": "generative",
        "purpose": "Replace the background with AI-generated content.",
        "description": "Segments the foreground and generates a new background from a text prompt.",
        "strengths": ["Creative", "Powerful"],
        "weaknesses": ["GPU heavy", "Can look artificial"],
        "best_for": ["Creative composites", "Studio look", "Location changes"],
        "avoid_for": ["When background contains important context"],
        "required_inputs": ["image", "prompt"],
        "outputs": ["edited_image", "mask"],
        "compatible_tools": ["background_removal", "generative_fill", "inpainting"],
        "parameters": {
            "prompt": {"type": "string", "default": "", "description": "Description of the new background"},
            "guidance_scale": {"type": "float", "range": [1, 20], "default": 7.5, "description": "Prompt adherence"}
        },
        "gpu_cost": "high",
        "latency": "slow",
    },
    {
        "name": "object_removal",
        "category": "generative",
        "purpose": "Remove unwanted objects from the image.",
        "description": "Uses inpainting to fill removed regions with plausible content.",
        "strengths": ["Magical results", "Clean removal"],
        "weaknesses": ["GPU heavy", "Can create artifacts"],
        "best_for": ["Removing tourists", "Removing clutter", "Cleaning scenes"],
        "avoid_for": ["Large regions (50%+ of image)", "Faces (can look uncanny)"],
        "required_inputs": ["image", "mask_or_target"],
        "outputs": ["edited_image"],
        "compatible_tools": ["segment", "generative_fill", "healing", "clone"],
        "parameters": {
            "target": {"type": "string", "default": "", "description": "Object description for automatic segmentation"},
            "prompt": {"type": "string", "default": "empty background", "description": "Fill prompt"}
        },
        "gpu_cost": "high",
        "latency": "slow",
    },
    {
        "name": "segment",
        "category": "segmentation",
        "purpose": "Segment specific objects in the image using SAM.",
        "description": "Uses SAM to generate a precise mask for a target object described in text.",
        "strengths": ["Accurate masks", "Zero-shot", "Handles novel objects"],
        "weaknesses": ["GPU recommended", "Slow on CPU"],
        "best_for": ["Object selection", "Mask creation for further editing"],
        "avoid_for": ["Very small objects", "Abstract concepts"],
        "required_inputs": ["image", "target"],
        "outputs": ["image", "mask"],
        "compatible_tools": ["object_removal", "background_replacement", "inpainting", "healing"],
        "parameters": {
            "target": {"type": "string", "default": "", "description": "Object to segment"},
            "save_mask": {"type": "bool", "default": True, "description": "Save mask to temp"}
        },
        "gpu_cost": "medium",
        "latency": "medium",
    },
    {
        "name": "upscale",
        "category": "enhancement",
        "purpose": "Increase image resolution with AI super-resolution.",
        "description": "Uses ESRGAN or similar model to upscale while adding detail.",
        "strengths": ["Increases resolution", "Adds detail"],
        "weaknesses": ["GPU heavy", "Can add artifacts", "Slow"],
        "best_for": ["Low-res photos", "Old photos", "Print output"],
        "avoid_for": ["Already sharp images", "Memes/low quality sources"],
        "required_inputs": ["image"],
        "outputs": ["upscaled_image"],
        "compatible_tools": ["sharpen", "denoise", "face_enhancement"],
        "parameters": {
            "scale": {"type": "float", "range": [2, 8], "default": 4, "description": "Upscaling factor"},
            "model": {"type": "string", "default": "esrgan", "description": "Upscaling model"}
        },
        "gpu_cost": "high",
        "latency": "slow",
    },
    {
        "name": "inpainting",
        "category": "generative",
        "purpose": "Fill a masked region with AI-generated content.",
        "description": "Generates content to fill masked areas based on a text prompt.",
        "strengths": ["Creative fill", "Seamless integration"],
        "weaknesses": ["GPU heavy", "May not match style"],
        "best_for": ["Removing objects", "Extending images", "Filling gaps"],
        "avoid_for": ["Text/logos (garbled)", "Faces (uncanny)"],
        "required_inputs": ["image", "mask", "prompt"],
        "outputs": ["edited_image"],
        "compatible_tools": ["object_removal", "generative_fill", "healing", "outpainting"],
        "parameters": {
            "prompt": {"type": "string", "default": "", "description": "Description of desired fill content"},
            "guidance_scale": {"type": "float", "range": [1, 20], "default": 7.5, "description": "Prompt adherence"},
            "strength": {"type": "float", "range": [0, 1], "default": 0.85, "description": "Denoising strength"}
        },
        "gpu_cost": "high",
        "latency": "slow",
    },
    {
        "name": "style_transfer",
        "category": "generative",
        "purpose": "Apply an artistic style or instruction-based edit to the image.",
        "description": "Uses InstructPix2Pix or similar to edit according to a text instruction.",
        "strengths": ["Creative", "Versatile", "Instruction-based"],
        "weaknesses": ["GPU heavy", "Inconsistent results", "Slow"],
        "best_for": ["Artistic styles", "Major transformations"],
        "avoid_for": ["Subtle edits (use adjustment tools instead)"],
        "required_inputs": ["image", "instruction"],
        "outputs": ["edited_image"],
        "compatible_tools": ["color_grading", "film_lut"],
        "parameters": {
            "instruction": {"type": "string", "default": "", "description": "Style instruction"},
            "guidance_scale": {"type": "float", "range": [1, 20], "default": 7.5, "description": "Guidance scale"},
            "image_guidance_scale": {"type": "float", "range": [1, 5], "default": 1.5, "description": "How much to preserve original"}
        },
        "gpu_cost": "high",
        "latency": "slow",
    },
    {
        "name": "face_enhancement",
        "category": "portrait",
        "purpose": "Enhance facial features using AI.",
        "description": "Detects faces and applies targeted enhancement (eyes, skin, symmetry).",
        "strengths": ["Natural enhancement", "Targeted"],
        "weaknesses": ["GPU heavy", "Can look artificial at high strength"],
        "best_for": ["Portraits", "Selfies", "Group photos"],
        "avoid_for": ["Non-human faces", "Profile/occluded faces"],
        "required_inputs": ["image"],
        "outputs": ["enhanced_image", "face_regions"],
        "compatible_tools": ["skin_smoothing", "eye_enhancement", "hair_enhancement"],
        "parameters": {
            "strength": {"type": "float", "range": [0, 1], "default": 0.5, "description": "Enhancement strength"}
        },
        "gpu_cost": "medium",
        "latency": "medium",
    },
    {
        "name": "skin_smoothing",
        "category": "portrait",
        "purpose": "Smooth skin while preserving texture and edges.",
        "description": "Applies adaptive blur to skin regions while preserving eyes, hair, and edges.",
        "strengths": ["Natural", "Preserves detail"],
        "weaknesses": ["Can look plastic", "Requires face detection"],
        "best_for": ["Portraits", "Beauty retouching"],
        "avoid_for": ["Already smooth subjects", "Texture-critical photos"],
        "required_inputs": ["image"],
        "outputs": ["smoothed_image"],
        "compatible_tools": ["face_enhancement", "eye_enhancement", "denoise"],
        "parameters": {
            "strength": {"type": "float", "range": [0, 1], "default": 0.5, "description": "Smoothing strength"},
            "radius": {"type": "float", "range": [1, 10], "default": 3, "description": "Smoothing radius"}
        },
        "gpu_cost": "low",
        "latency": "fast",
    },
    {
        "name": "film_lut",
        "category": "adjustment",
        "purpose": "Apply a film look-up table (LUT) for cinematic color grading.",
        "description": "Maps image colors through a predefined LUT to emulate film stock.",
        "strengths": ["Professional grade", "Film-accurate", "Fast"],
        "weaknesses": ["Limited creative control", "Can be too strong"],
        "best_for": ["Cinematic look", "Film emulation", "Consistent style"],
        "avoid_for": ["Natural/true-color output"],
        "required_inputs": ["image", "lut"],
        "outputs": ["graded_image"],
        "compatible_tools": ["color_grading", "curves", "saturation"],
        "parameters": {
            "lut_name": {"type": "string", "default": "", "description": "LUT identifier"},
            "opacity": {"type": "float", "range": [0, 1], "default": 1.0, "description": "LUT blend opacity"}
        },
        "gpu_cost": "none",
        "latency": "fast",
    },
    {
        "name": "vignette",
        "category": "effect",
        "purpose": "Darken or lighten the corners of the image.",
        "description": "Applies a radial gradient to darken or lighten image edges.",
        "strengths": ["Adds focus", "Cinematic feel"],
        "weaknesses": ["Can look cliche"],
        "best_for": ["Portraits", "Cinematic look", "Directing attention"],
        "avoid_for": ["Already dark images", "Clinical/catalog photos"],
        "required_inputs": ["image"],
        "outputs": ["edited_image"],
        "compatible_tools": ["color_grading", "exposure"],
        "parameters": {
            "strength": {"type": "float", "range": [-100, 100], "default": 30, "description": "Vignette strength (negative = lighten)"},
            "radius": {"type": "float", "range": [0, 100], "default": 70, "description": "Vignette radius percentage"},
            "feather": {"type": "float", "range": [0, 100], "default": 50, "description": "Edge feathering"}
        },
        "gpu_cost": "none",
        "latency": "instant",
    },
    {
        "name": "black_and_white",
        "category": "effect",
        "purpose": "Convert the image to black and white.",
        "description": "Desaturates with optional per-channel mixing for control over tonality.",
        "strengths": ["Classic look", "Fast"],
        "weaknesses": ["Loss of color information"],
        "best_for": ["Artistic effect", "Classic photography"],
        "avoid_for": ["Color-critical output"],
        "required_inputs": ["image"],
        "outputs": ["bw_image"],
        "compatible_tools": ["contrast", "levels", "curves"],
        "parameters": {
            "method": {"type": "string", "default": "luminosity", "description": "Conversion method: luminosity/average/luminance"},
            "red_weight": {"type": "float", "range": [0, 1], "default": 0.299, "description": "Red channel weight"},
            "green_weight": {"type": "float", "range": [0, 1], "default": 0.587, "description": "Green channel weight"},
            "blue_weight": {"type": "float", "range": [0, 1], "default": 0.114, "description": "Blue channel weight"}
        },
        "gpu_cost": "none",
        "latency": "instant",
    },
    {
        "name": "shadow_recovery",
        "category": "adjustment",
        "purpose": "Recover detail from shadow areas.",
        "description": "Lifts shadows while preserving midtones and highlights.",
        "strengths": ["Recovers lost detail", "Natural"],
        "weaknesses": ["Can introduce noise", "Limited range"],
        "best_for": ["Underexposed photos", "Backlit subjects"],
        "avoid_for": ["Noisy images (amplifies noise)"],
        "required_inputs": ["image"],
        "outputs": ["recovered_image"],
        "compatible_tools": ["highlight_recovery", "exposure", "levels", "denoise"],
        "parameters": {
            "amount": {"type": "float", "range": [0, 100], "default": 30, "description": "Shadow recovery amount"}
        },
        "gpu_cost": "none",
        "latency": "instant",
    },
    {
        "name": "highlight_recovery",
        "category": "adjustment",
        "purpose": "Recover detail from blown-out highlight areas.",
        "description": "Compresses highlights to recover detail while preserving shadows.",
        "strengths": ["Recovers overexposed areas"],
        "weaknesses": ["Limited if highlights are clipped"],
        "best_for": ["Overexposed skies", "Specular highlights"],
        "avoid_for": ["Already well-exposed images"],
        "required_inputs": ["image"],
        "outputs": ["recovered_image"],
        "compatible_tools": ["shadow_recovery", "exposure", "levels"],
        "parameters": {
            "amount": {"type": "float", "range": [0, 100], "default": 30, "description": "Highlight recovery amount"}
        },
        "gpu_cost": "none",
        "latency": "instant",
    },
    {
        "name": "healing",
        "category": "restoration",
        "purpose": "Remove small blemishes, spots, and imperfections.",
        "description": "Samples surrounding pixels to seamlessly fill damaged areas.",
        "strengths": ["Natural results", "Preserves texture"],
        "weaknesses": ["Only for small areas", "Manual input needed"],
        "best_for": ["Skin blemishes", "Dust spots", "Small scratches"],
        "avoid_for": ["Large areas (use inpainting)", "Patterned backgrounds"],
        "required_inputs": ["image", "mask_or_points"],
        "outputs": ["healed_image"],
        "compatible_tools": ["clone", "inpainting", "skin_smoothing"],
        "parameters": {
            "radius": {"type": "float", "range": [1, 50], "default": 5, "description": "Healing brush radius"}
        },
        "gpu_cost": "low",
        "latency": "fast",
    },
    {
        "name": "generative_fill",
        "category": "generative",
        "purpose": "Fill selected area with AI-generated content matching the scene.",
        "description": "Context-aware AI generation that matches lighting, perspective, and style.",
        "strengths": ["Context-aware", "Seamless", "Photoshop-style"],
        "weaknesses": ["GPU heavy", "Slow", "May need multiple attempts"],
        "best_for": ["Extending backgrounds", "Adding objects", "Removing objects"],
        "avoid_for": ["Precise edits", "Text/logos"],
        "required_inputs": ["image", "mask", "prompt"],
        "outputs": ["filled_image"],
        "compatible_tools": ["inpainting", "object_removal", "outpainting"],
        "parameters": {
            "prompt": {"type": "string", "default": "", "description": "Description of desired content"},
            "guidance_scale": {"type": "float", "range": [1, 20], "default": 7.5, "description": "Prompt adherence"}
        },
        "gpu_cost": "high",
        "latency": "slow",
    },
]


class ToolRegistry:
    _specs: dict[str, ToolSpec] = {}
    _tools: dict[str, EditingTool] = {}

    @classmethod
    def initialize(cls) -> None:
        from app.tools.base import ToolSpec
        for spec_data in BUILTIN_TOOL_SPECS:
            spec = ToolSpec(**spec_data)
            cls._specs[spec.name] = spec
        logger.info("ToolRegistry initialized with %d tools", len(cls._specs))

    @classmethod
    def get_spec(cls, name: str) -> ToolSpec | None:
        return cls._specs.get(name)

    @classmethod
    def get_all_specs(cls) -> list[ToolSpec]:
        return list(cls._specs.values())

    @classmethod
    def get_specs_by_category(cls, category: str) -> list[ToolSpec]:
        return [s for s in cls._specs.values() if s.category == category]

    @classmethod
    def get_specs_by_gpu_cost(cls, cost: str) -> list[ToolSpec]:
        return [s for s in cls._specs.values() if s.gpu_cost == cost]

    @classmethod
    def find_tools(cls, prompt: str, metadata: dict | None = None) -> list[ToolSpec]:
        prompt_lower = prompt.lower()
        scored = []
        for spec in cls._specs.values():
            score = 0
            for kw in spec.best_for:
                if kw.lower() in prompt_lower:
                    score += 3
            for kw in spec.avoid_for:
                if kw.lower() in prompt_lower:
                    score -= 2
            for kw in spec.strengths:
                if kw.lower() in prompt_lower:
                    score += 1
            if spec.name.lower() in prompt_lower:
                score += 5
            if score > 0:
                scored.append((score, spec))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [s for _, s in scored]

    @classmethod
    def get_tool_descriptions_for_prompt(cls) -> str:
        lines = []
        for spec in cls._specs.values():
            lines.append(f"- {spec.name}: {spec.purpose}")
            lines.append(f"  Best for: {', '.join(spec.best_for)}")
            lines.append(f"  Avoid for: {', '.join(spec.avoid_for)}")
            lines.append(f"  Parameters: {', '.join(spec.parameters.keys())}")
            lines.append(f"  GPU: {spec.gpu_cost}, Latency: {spec.latency}")
            lines.append("")
        return "\n".join(lines)

    @classmethod
    def register_tool(cls, name: str, tool: EditingTool) -> None:
        if name in cls._tools:
            logger.warning("Overwriting existing tool: %s", name)
        cls._tools[name] = tool
        if name not in cls._specs:
            cls._specs[name] = tool.spec
        logger.info("Registered tool: %s", name)

    @classmethod
    def get_tool(cls, name: str) -> EditingTool | None:
        return cls._tools.get(name)

    @classmethod
    def execute_tool(cls, name: str, image, params: dict, context: dict | None = None):
        tool = cls.get_tool(name)
        if tool is None:
            raise ValueError(f"Tool not registered: {name}")
        return tool.execute(image, params, context)
