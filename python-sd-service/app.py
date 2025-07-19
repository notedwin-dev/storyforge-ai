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

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

class LocalSDService:
    def __init__(self):
        self.pipeline = None
        self.current_model = None
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.models_cache = {}
        
        # Style configurations optimized for GTX 1060 (6GB VRAM)
        self.style_configs = {
            "cartoon": {
                "model_id": "runwayml/stable-diffusion-v1-5",  # Smaller model for 6GB VRAM
                "positive_prompt": "cartoon style, clean lines, bright colors, comic book art, illustration, animated style",
                "negative_prompt": "realistic, photograph, photorealistic, blurry, low quality, distorted, nsfw, dark, scary",
                "steps": 20,
                "guidance_scale": 7.0,
                "width": 512,  # Reduced from 768 for GTX 1060
                "height": 512
            },
            "anime": {
                "model_id": "runwayml/stable-diffusion-v1-5",
                "positive_prompt": "anime style, cel shaded, detailed character design, manga art, japanese animation",
                "negative_prompt": "realistic, photograph, 3d render, blurry, low quality, distorted, nsfw, western style",
                "steps": 25,
                "guidance_scale": 8.0,
                "width": 512,
                "height": 512
            },
            "storybook": {
                "model_id": "runwayml/stable-diffusion-v1-5",
                "positive_prompt": "children's book illustration, watercolor style, soft colors, storybook art, whimsical, friendly",
                "negative_prompt": "dark, scary, realistic, photograph, blurry, low quality, nsfw, violent",
                "steps": 30,
                "guidance_scale": 7.5,
                "width": 512,
                "height": 512
            },
            "realistic": {
                "model_id": "runwayml/stable-diffusion-v1-5",
                "positive_prompt": "photorealistic, cinematic lighting, professional photography, detailed, high quality",
                "negative_prompt": "cartoon, anime, artistic, painting, blurry, low quality, distorted, nsfw",
                "steps": 35,
                "guidance_scale": 6.0,
                "width": 512,
                "height": 512
            }
        }
        
        # Initialize with GTX 1060 optimized model
        self.load_model("runwayml/stable-diffusion-v1-5")
    
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
                # Load model optimized for GTX 1060
                from diffusers import StableDiffusionPipeline, DPMSolverMultistepScheduler
                self.pipeline = StableDiffusionPipeline.from_pretrained(
                    model_id,
                    torch_dtype=torch.float16 if self.device == "cuda" else torch.float32,
                    safety_checker=None,  # Disable safety checker to save VRAM
                    requires_safety_checker=False
                )
                
                # Optimize for speed and memory (GTX 1060 specific)
                self.pipeline.scheduler = DPMSolverMultistepScheduler.from_config(
                    self.pipeline.scheduler.config
                )
                
                if self.device == "cuda":
                    # GTX 1060 optimizations
                    logger.info("Applying GTX 1060 optimizations...")
                    self.pipeline.enable_model_cpu_offload()  # Critical for 6GB VRAM
                    self.pipeline.enable_attention_slicing()  # Reduces VRAM usage
                    
                    # Skip xformers for GTX 1060 compatibility
                    logger.info("Skipping xformers for GTX 1060 compatibility")
                else:
                    logger.info("Running on CPU - xformers disabled for compatibility")
                
                self.pipeline = self.pipeline.to(self.device)
                
                # Cache only 1 model for GTX 1060 memory constraints
                if len(self.models_cache) < 1:
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
            
            # Set seed for reproducibility
            if seed is not None:
                generator = torch.Generator(device=self.device).manual_seed(seed)
            else:
                generator = None
            
            logger.info(f"Generating image with style: {style} (GTX 1060 optimized)")
            logger.info(f"Prompt: {full_prompt[:100]}...")
            logger.info("⏳ GTX 1060: This should take 10-30 seconds...")
            
            # Generate image
            with torch.inference_mode():
                result = self.pipeline(
                    prompt=full_prompt,
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
                    "size": f"{config['width']}x{config['height']}"
                }
            }
            
        except Exception as e:
            logger.error(f"Image generation failed: {str(e)}")
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
        port=int(os.environ.get('PORT', 8080)),
        debug=False,
        threaded=True
    )
