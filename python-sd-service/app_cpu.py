#!/usr/bin/env python3
"""
CPU-Optimized Free Local Stable Diffusion Service for StoryForge AI
Provides cost-free image generation using Hugging Face Diffusers (CPU compatible)
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

class CPUOptimizedSDService:
    def __init__(self):
        self.pipeline = None
        self.current_model = None
        self.device = "cpu"  # Force CPU for maximum compatibility
        self.models_cache = {}
        
        # Style configurations optimized for CPU
        self.style_configs = {
            "cartoon": {
                "model_id": "runwayml/stable-diffusion-v1-5",  # Smaller, faster model
                "positive_prompt": "cartoon style, clean lines, bright colors, comic book art, illustration, animated style",
                "negative_prompt": "realistic, photograph, photorealistic, blurry, low quality, distorted, nsfw, dark, scary",
                "steps": 15,  # Reduced steps for CPU
                "guidance_scale": 7.0,
                "width": 512,  # Smaller resolution for CPU
                "height": 512
            },
            "anime": {
                "model_id": "runwayml/stable-diffusion-v1-5",
                "positive_prompt": "anime style, cel shaded, detailed character design, manga art, japanese animation",
                "negative_prompt": "realistic, photograph, 3d render, blurry, low quality, distorted, nsfw, western style",
                "steps": 20,
                "guidance_scale": 8.0,
                "width": 512,
                "height": 512
            },
            "storybook": {
                "model_id": "runwayml/stable-diffusion-v1-5",
                "positive_prompt": "children's book illustration, watercolor style, soft colors, storybook art, whimsical, friendly",
                "negative_prompt": "dark, scary, realistic, photograph, blurry, low quality, nsfw, violent",
                "steps": 25,
                "guidance_scale": 7.5,
                "width": 512,
                "height": 512
            },
            "realistic": {
                "model_id": "runwayml/stable-diffusion-v1-5",
                "positive_prompt": "photorealistic, cinematic lighting, professional photography, detailed, high quality",
                "negative_prompt": "cartoon, anime, artistic, painting, blurry, low quality, distorted, nsfw",
                "steps": 30,
                "guidance_scale": 6.0,
                "width": 512,
                "height": 512
            }
        }
        
        logger.info("🖥️ CPU-Optimized Stable Diffusion Service initialized")
        logger.info("⚡ Using smaller models and settings for CPU compatibility")
        
        # Initialize with default model
        self.load_model("runwayml/stable-diffusion-v1-5")
    
    def load_model(self, model_id):
        """Load or switch to a different model (CPU optimized)"""
        try:
            if self.current_model == model_id and self.pipeline is not None:
                logger.info(f"Model {model_id} already loaded")
                return True
            
            logger.info(f"Loading model for CPU: {model_id}")
            
            # Check if model is cached
            if model_id in self.models_cache:
                self.pipeline = self.models_cache[model_id]
                logger.info(f"Loaded model from cache: {model_id}")
            else:
                # Import diffusers components separately to avoid xformers issues
                from diffusers import StableDiffusionPipeline, DDIMScheduler
                
                # Load model with CPU-optimized settings
                self.pipeline = StableDiffusionPipeline.from_pretrained(
                    model_id,
                    torch_dtype=torch.float32,  # Use float32 for CPU
                    safety_checker=None,  # Disable safety checker for speed
                    requires_safety_checker=False
                )
                
                # Use faster scheduler for CPU
                self.pipeline.scheduler = DDIMScheduler.from_config(
                    self.pipeline.scheduler.config
                )
                
                # Move to CPU
                self.pipeline = self.pipeline.to(self.device)
                
                # CPU optimizations
                logger.info("Applying CPU optimizations...")
                
                # Cache the model (limit to 1 for CPU memory constraints)
                if len(self.models_cache) < 1:
                    self.models_cache[model_id] = self.pipeline
            
            self.current_model = model_id
            logger.info(f"✅ Successfully loaded model: {model_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load model {model_id}: {str(e)}")
            traceback.print_exc()
            return False
    
    def generate_image(self, prompt, style="cartoon", seed=None):
        """Generate image using the loaded model (CPU optimized)"""
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
            
            logger.info(f"🎨 Generating image with style: {style} (CPU mode)")
            logger.info(f"📝 Prompt: {full_prompt[:100]}...")
            logger.info("⏳ This may take 30-90 seconds on CPU...")
            
            # Generate image with CPU-optimized parameters
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
            
            logger.info("✅ Image generation completed successfully!")
            
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
                    "device": "cpu"
                }
            }
            
        except Exception as e:
            logger.error(f"❌ Image generation failed: {str(e)}")
            traceback.print_exc()
            return {"success": False, "error": str(e)}
    
    def get_status(self):
        """Get service status"""
        return {
            "status": "ready" if self.pipeline else "not_ready",
            "device": self.device,
            "current_model": self.current_model,
            "cuda_available": False,
            "cpu_optimized": True,
            "memory_usage": self.get_memory_usage()
        }
    
    def get_memory_usage(self):
        """Get current memory usage"""
        import psutil
        memory = psutil.virtual_memory()
        return {
            "cpu_memory_used_gb": memory.used / 1024**3,
            "cpu_memory_available_gb": memory.available / 1024**3,
            "cpu_memory_percent": memory.percent
        }

# Initialize service
sd_service = CPUOptimizedSDService()

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
        "cached_models": list(sd_service.models_cache.keys()),
        "device": sd_service.device
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
    logger.info("=" * 60)
    logger.info("🖥️  Starting CPU-Optimized Free Stable Diffusion Service")
    logger.info("=" * 60)
    logger.info(f"🔧 Device: {sd_service.device}")
    logger.info(f"💾 CUDA Available: {torch.cuda.is_available()}")
    logger.info(f"⚡ CPU Optimized: {sd_service.get_status()['cpu_optimized']}")
    logger.info(f"🎯 Model: Stable Diffusion v1.5 (faster on CPU)")
    logger.info(f"📏 Image Size: 512x512 (optimized for CPU)")
    logger.info(f"⏱️  Expected Speed: 30-90 seconds per image")
    logger.info("=" * 60)
    logger.info("💡 Tip: This will be slower than GPU but completely FREE!")
    logger.info("=" * 60)
    
    # Run Flask app
    app.run(
        host='0.0.0.0',
        port=int(os.environ.get('PORT', 8080)),
        debug=False,
        threaded=True
    )
