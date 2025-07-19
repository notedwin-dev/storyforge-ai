#!/usr/bin/env python3
"""
Free Local Stable Diffusion Service for StoryForge AI
Provides cost-free image generation using Hugging Face Diffusers
"""

import os
import sys
import logging
import traceback
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import torch
from PIL import Image
import io
import base64
import hashlib
from datetime import datetime
import json
import re

# Set Hugging Face cache to D drive to avoid filling C drive
os.environ['HF_HOME'] = 'D:/HuggingFaceCache'
os.environ['HUGGINGFACE_HUB_CACHE'] = 'D:/HuggingFaceCache/hub'
os.environ['TRANSFORMERS_CACHE'] = 'D:/HuggingFaceCache/transformers'

# Set PyTorch cache to D drive as well
os.environ['TORCH_HOME'] = 'D:/PyTorchCache'

# Create cache directories on D drive
cache_dirs = [
    'D:/HuggingFaceCache',
    'D:/HuggingFaceCache/hub',
    'D:/HuggingFaceCache/transformers',
    'D:/PyTorchCache'
]

for cache_dir in cache_dirs:
    os.makedirs(cache_dir, exist_ok=True)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Log cache location
logger.info(f"📁 Models will be cached on D drive: {os.environ['HF_HOME']}")
logger.info(f"🔥 PyTorch cache on D drive: {os.environ['TORCH_HOME']}")
logger.info(f"💾 This saves C drive space and uses your larger D drive storage")

app = Flask(__name__)
CORS(app)

class LocalSDService:
    def __init__(self):
        self.pipeline = None
        self.img2img_pipeline = None  # For character-consistent scene generation
        self.current_model = None
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.models_cache = {}
        
        # Style configurations optimized for various GPUs
        self.style_configs = {
            "cartoon": {
                "model_id": "stabilityai/stable-diffusion-xl-base-1.0",
                "positive_prompt": "cartoon style, clean lines, bright colors, comic book art, illustration, animated style",
                "negative_prompt": "realistic, photograph, photorealistic, blurry, low quality, distorted, nsfw, dark, scary",
                "steps": 20,
                "guidance_scale": 7.0,
                "width": 512,
                "height": 512
            },
            "anime": {
                "model_id": "stabilityai/stable-diffusion-xl-base-1.0",
                "positive_prompt": "anime style, cel shaded, detailed character design, manga art, japanese animation",
                "negative_prompt": "realistic, photograph, 3d render, blurry, low quality, distorted, nsfw, western style",
                "steps": 25,
                "guidance_scale": 8.0,
                "width": 512,
                "height": 512
            },
            "storybook": {
                "model_id": "stabilityai/stable-diffusion-xl-base-1.0",
                "positive_prompt": "children's book illustration, watercolor style, soft colors, storybook art, whimsical, friendly",
                "negative_prompt": "dark, scary, realistic, photograph, blurry, low quality, nsfw, violent",
                "steps": 30,
                "guidance_scale": 7.5,
                "width": 512,
                "height": 512
            },
            "realistic": {
                "model_id": "stabilityai/stable-diffusion-xl-base-1.0",
                "positive_prompt": "photorealistic, cinematic lighting, professional photography, detailed, high quality",
                "negative_prompt": "cartoon, anime, artistic, painting, blurry, low quality, distorted, nsfw",
                "steps": 35,
                "guidance_scale": 6.0,
                "width": 512,
                "height": 512
            }
        }
        
        # Initialize with optimized model
        self.load_model("stabilityai/stable-diffusion-xl-base-1.0")
    
    def optimize_prompt_for_clip(self, prompt, max_tokens=75):
        """Optimize prompt to fit within CLIP's 77 token limit (keeping 2 tokens for special tokens)"""
        try:
            # Simple token estimation: roughly 1 token per 4 characters, but be conservative
            # This is an approximation since we don't have the actual tokenizer here
            estimated_tokens = len(prompt.split())  # Word-based estimation
            
            if estimated_tokens <= max_tokens:
                return prompt
            
            logger.info(f"📝 Prompt too long ({estimated_tokens} words), optimizing for CLIP...")
            
            # Priority keywords for story generation
            priority_keywords = [
                'character', 'scene', 'story', 'adventure', 'cartoon', 'anime', 'illustration',
                'high quality', 'detailed', 'clean lines', 'bright colors', 'friendly',
                'storybook', 'children', 'whimsical', 'magical', 'fantasy'
            ]
            
            # Split prompt into parts
            parts = prompt.split(', ')
            
            # Separate style prompts from content prompts
            style_parts = []
            content_parts = []
            
            for part in parts:
                part = part.strip()
                if any(keyword in part.lower() for keyword in priority_keywords):
                    style_parts.append(part)
                else:
                    content_parts.append(part)
            
            # Reconstruct prompt with priorities
            optimized_parts = []
            
            # Add essential style parts first
            for part in style_parts[:5]:  # Limit to top 5 style elements
                optimized_parts.append(part)
            
            # Add content parts with word limit
            remaining_words = max_tokens - len(' '.join(optimized_parts).split())
            
            for part in content_parts:
                part_words = len(part.split())
                if remaining_words - part_words > 0:
                    optimized_parts.append(part)
                    remaining_words -= part_words
                else:
                    # Truncate this part to fit
                    if remaining_words > 3:  # Only add if we have meaningful space
                        truncated = ' '.join(part.split()[:remaining_words])
                        optimized_parts.append(truncated)
                    break
            
            optimized_prompt = ', '.join(optimized_parts)
            
            logger.info(f"✅ Optimized prompt: {len(optimized_prompt.split())} words")
            logger.info(f"📝 Final prompt: {optimized_prompt[:150]}...")
            
            return optimized_prompt
            
        except Exception as e:
            logger.warning(f"⚠️ Prompt optimization failed: {e}, using truncated original")
            # Fallback: simple truncation
            words = prompt.split()
            if len(words) > max_tokens:
                return ' '.join(words[:max_tokens])
            return prompt
    
    def load_model(self, model_id):
        """Load or switch to a different model"""
        try:
            if self.current_model == model_id and self.pipeline is not None:
                logger.info(f"Model {model_id} already loaded")
                return True
            
            logger.info(f"Loading model: {model_id}")
            
            # Check if model is cached
            if model_id in self.models_cache:
                self.pipeline = self.models_cache[model_id]
                logger.info(f"Loaded model from cache: {model_id}")
            else:
                # Load model with GPU optimizations
                from diffusers import StableDiffusionPipeline, DPMSolverMultistepScheduler
                self.pipeline = StableDiffusionPipeline.from_pretrained(
                    model_id,
                    torch_dtype=torch.float16 if self.device == "cuda" else torch.float32,
                    safety_checker=None,  # Disable safety checker to save VRAM
                    requires_safety_checker=False
                )
                
                # Optimize for speed and memory
                self.pipeline.scheduler = DPMSolverMultistepScheduler.from_config(
                    self.pipeline.scheduler.config
                )
                
                if self.device == "cuda":
                    # GPU optimizations for better memory management
                    logger.info("Applying GPU optimizations...")
                    self.pipeline.enable_model_cpu_offload()  # Efficient VRAM usage
                    self.pipeline.enable_attention_slicing()  # Reduces VRAM usage
                    
                    # Skip xformers for compatibility across different GPUs
                    logger.info("Skipping xformers for broader GPU compatibility")
                else:
                    logger.info("Running on CPU - optimizations disabled")
                
                self.pipeline = self.pipeline.to(self.device)
                
                # Cache models based on available memory
                max_cached_models = 2 if self.device == "cuda" else 1
                if len(self.models_cache) < max_cached_models:
                    self.models_cache[model_id] = self.pipeline
            
            self.current_model = model_id
            logger.info(f"Successfully loaded model: {model_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load model {model_id}: {str(e)}")
            return False
    
    def generate_image(self, prompt, style="cartoon", seed=None):
        """Generate image using the loaded model"""
        try:
            if self.pipeline is None:
                return {"success": False, "error": "No model loaded"}
            
            config = self.style_configs.get(style, self.style_configs["cartoon"])
            
            # Enhance prompt with style
            full_prompt = f"{config['positive_prompt']}, {prompt}"
            
            # Optimize prompt for CLIP token limit
            optimized_prompt = self.optimize_prompt_for_clip(full_prompt)
            
            # Set seed for reproducibility
            if seed is not None:
                generator = torch.Generator(device=self.device).manual_seed(seed)
            else:
                generator = None
            
            logger.info(f"Generating image with style: {style} (GPU optimized)")
            logger.info(f"Original prompt length: {len(full_prompt.split())} words")
            logger.info(f"Optimized prompt: {optimized_prompt[:100]}...")
            logger.info("⏳ This should take 10-30 seconds on modern GPUs...")
            
            # Generate image
            with torch.inference_mode():
                result = self.pipeline(
                    prompt=optimized_prompt,
                    negative_prompt=config["negative_prompt"],
                    num_inference_steps=config["steps"],
                    guidance_scale=config["guidance_scale"],
                    width=config["width"],
                    height=config["height"],
                    generator=generator
                )
            
            image = result.images[0]
            
            # Convert to base64
            buffer = io.BytesIO()
            image.save(buffer, format="PNG")
            img_str = base64.b64encode(buffer.getvalue()).decode()
            
            return {
                "success": True,
                "image": img_str,
                "format": "png",
                "metadata": {
                    "model": self.current_model,
                    "style": style,
                    "steps": config["steps"],
                    "guidance_scale": config["guidance_scale"],
                    "size": f"{config['width']}x{config['height']}",
                    "original_prompt_words": len(full_prompt.split()),
                    "optimized_prompt_words": len(optimized_prompt.split()),
                    "prompt_optimized": len(full_prompt.split()) > len(optimized_prompt.split())
                }
            }
            
        except Exception as e:
            logger.error(f"Image generation failed: {str(e)}")
            traceback.print_exc()
            return {"success": False, "error": str(e)}
    
    def generate_image_from_character(self, prompt, character_image_base64, style="cartoon", seed=None, strength=0.7):
        """Generate scene image using character image as base for consistency"""
        try:
            # Initialize img2img pipeline if not loaded
            if not hasattr(self, 'img2img_pipeline') or self.img2img_pipeline is None:
                logger.info("Loading img2img pipeline...")
                from diffusers import StableDiffusionImg2ImgPipeline
                
                # Use the same model but for img2img
                self.img2img_pipeline = StableDiffusionImg2ImgPipeline.from_pretrained(
                    self.current_model,
                    torch_dtype=torch.float16 if self.device == "cuda" else torch.float32,
                    safety_checker=None,
                    requires_safety_checker=False
                ).to(self.device)
                
                # Enable memory efficient attention
                if hasattr(self.img2img_pipeline, "enable_xformers_memory_efficient_attention"):
                    try:
                        self.img2img_pipeline.enable_xformers_memory_efficient_attention()
                    except:
                        pass
                
                # Enable CPU offload for better memory management
                if self.device == "cuda":
                    self.img2img_pipeline.enable_sequential_cpu_offload()
                
                logger.info("Img2img pipeline loaded successfully")
            
            # Decode base64 character image
            character_image_data = base64.b64decode(character_image_base64)
            character_image = Image.open(io.BytesIO(character_image_data)).convert("RGB")
            
            config = self.style_configs.get(style, self.style_configs["cartoon"])
            
            # Create scene prompt that focuses on the scene while maintaining character
            scene_prompt = f"{config['positive_prompt']}, {prompt}, same character, consistent art style"
            
            # Optimize prompt for CLIP token limit
            optimized_scene_prompt = self.optimize_prompt_for_clip(scene_prompt)
            
            # Set seed for reproducibility
            if seed is not None:
                generator = torch.Generator(device=self.device).manual_seed(seed)
            else:
                generator = None
            
            logger.info(f"Generating scene with character consistency, style: {style}")
            logger.info(f"Original scene prompt length: {len(scene_prompt.split())} words")
            logger.info(f"Optimized scene prompt: {optimized_scene_prompt[:100]}...")
            logger.info(f"Strength: {strength} (higher = more scene variation)")
            logger.info("⏳ This should take 15-40 seconds on modern GPUs...")
            
            # Generate scene image based on character
            with torch.inference_mode():
                result = self.img2img_pipeline(
                    prompt=optimized_scene_prompt,
                    image=character_image,
                    strength=strength,  # How much to change from original (0.7 = good balance)
                    negative_prompt=config["negative_prompt"],
                    num_inference_steps=max(15, int(config["steps"] * 0.8)),  # Fewer steps for img2img
                    guidance_scale=config["guidance_scale"],
                    generator=generator
                )
            
            scene_image = result.images[0]
            
            # Convert to base64
            buffer = io.BytesIO()
            scene_image.save(buffer, format="PNG")
            img_str = base64.b64encode(buffer.getvalue()).decode()
            
            return {
                "success": True,
                "image": img_str,
                "format": "png",
                "metadata": {
                    "model": self.current_model,
                    "style": style,
                    "type": "scene_generation",
                    "strength": strength,
                    "steps": max(15, int(config["steps"] * 0.8)),
                    "guidance_scale": config["guidance_scale"],
                    "character_based": True,
                    "original_prompt_words": len(scene_prompt.split()),
                    "optimized_prompt_words": len(optimized_scene_prompt.split()),
                    "prompt_optimized": len(scene_prompt.split()) > len(optimized_scene_prompt.split())
                }
            }
            
        except Exception as e:
            logger.error(f"Character-based scene generation failed: {str(e)}")
            traceback.print_exc()
            return {"success": False, "error": str(e)}
    
    def get_status(self):
        """Get service status"""
        return {
            "status": "ready" if self.pipeline else "not_ready",
            "device": self.device,
            "current_model": self.current_model,
            "cuda_available": torch.cuda.is_available(),
            "memory_usage": self.get_memory_usage()
        }
    
    def get_memory_usage(self):
        """Get current memory usage"""
        if torch.cuda.is_available():
            return {
                "gpu_memory_allocated": torch.cuda.memory_allocated() / 1024**3,  # GB
                "gpu_memory_reserved": torch.cuda.memory_reserved() / 1024**3     # GB
            }
        return {"gpu_memory": "N/A - CPU only"}

# Initialize service
sd_service = LocalSDService()

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "timestamp": datetime.now().isoformat()})

@app.route('/status', methods=['GET'])
def status():
    """Get service status"""
    return jsonify(sd_service.get_status())

@app.route('/generate', methods=['POST'])
def generate():
    """Generate image endpoint"""
    try:
        data = request.json
        prompt = data.get('prompt', '')
        style = data.get('style', 'cartoon')
        seed = data.get('seed')
        
        if not prompt:
            return jsonify({"success": False, "error": "Prompt is required"}), 400
        
        result = sd_service.generate_image(prompt, style, seed)
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Generate endpoint error: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/generate-scene', methods=['POST'])
def generate_scene_with_character():
    """Generate scene image using character image for consistency"""
    try:
        data = request.json
        prompt = data.get('prompt', '')
        character_image = data.get('character_image', '')
        style = data.get('style', 'cartoon')
        seed = data.get('seed')
        strength = data.get('strength', 0.7)  # How much to vary from character image
        
        if not prompt:
            return jsonify({"success": False, "error": "Prompt is required"}), 400
        
        if not character_image:
            return jsonify({"success": False, "error": "Character image (base64) is required"}), 400
        
        # Validate strength parameter
        if not (0.1 <= strength <= 1.0):
            return jsonify({"success": False, "error": "Strength must be between 0.1 and 1.0"}), 400
        
        result = sd_service.generate_image_from_character(
            prompt=prompt,
            character_image_base64=character_image,
            style=style,
            seed=seed,
            strength=strength
        )
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Generate scene endpoint error: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/models', methods=['GET'])
def get_models():
    """Get available models/styles"""
    return jsonify({
        "styles": list(sd_service.style_configs.keys()),
        "current_model": sd_service.current_model,
        "cached_models": list(sd_service.models_cache.keys())
    })

@app.route('/switch-model', methods=['POST'])
def switch_model():
    """Switch to a different model"""
    try:
        data = request.json
        model_id = data.get('model_id')
        
        if not model_id:
            return jsonify({"success": False, "error": "model_id is required"}), 400
        
        success = sd_service.load_model(model_id)
        
        if success:
            return jsonify({"success": True, "message": f"Switched to model: {model_id}"})
        else:
            return jsonify({"success": False, "error": f"Failed to load model: {model_id}"}), 500
            
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == '__main__':
    logger.info("=" * 50)
    logger.info("� Starting Free Local Stable Diffusion Service (GTX 1060 Optimized)")
    logger.info("=" * 50)
    logger.info(f"Device: {sd_service.device}")
    logger.info(f"CUDA Available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        logger.info(f"GPU: {torch.cuda.get_device_name()}")
        logger.info(f"GPU Memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB")
        logger.info("🎯 GTX 1060 Optimizations: CPU Offloading + Attention Slicing")
        logger.info("📏 Image Size: 512x512 (perfect for 6GB VRAM)")
        logger.info("⚡ Expected Speed: 10-30 seconds per image")
    logger.info("=" * 50)
    
    # Run Flask app
    app.run(
        host='0.0.0.0',
        port=int(os.environ.get('PORT', 7860)),  # Use 7860 to match the enhanced service
        debug=False,
        threaded=True
    )
