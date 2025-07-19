#!/usr/bin/env python3
"""
Install PyTorch to D drive to save C drive space
"""

import os
import subprocess
import sys

# Set environment variables to use D drive
os.environ['HF_HOME'] = 'D:/HuggingFaceCache'
os.environ['HUGGINGFACE_HUB_CACHE'] = 'D:/HuggingFaceCache/hub'
os.environ['TRANSFORMERS_CACHE'] = 'D:/HuggingFaceCache/transformers'
os.environ['TORCH_HOME'] = 'D:/PyTorchCache'

# Create cache directories
cache_dirs = [
    'D:/HuggingFaceCache',
    'D:/HuggingFaceCache/hub', 
    'D:/HuggingFaceCache/transformers',
    'D:/PyTorchCache'
]

print("📁 Creating cache directories on D drive...")
for cache_dir in cache_dirs:
    os.makedirs(cache_dir, exist_ok=True)
    print(f"  ✅ {cache_dir}")

print("\n🔥 Installing PyTorch with CUDA support...")
print("📍 Models will be cached on D drive to save C drive space")

# Install PyTorch with CUDA
cmd = [
    sys.executable, "-m", "pip", "install", 
    "torch", "torchvision", "torchaudio", 
    "--index-url", "https://download.pytorch.org/whl/cu118"
]

print(f"Running: {' '.join(cmd)}")
result = subprocess.run(cmd, capture_output=False)

if result.returncode == 0:
    print("\n✅ PyTorch installation completed!")
    print("🎯 Now installing other required packages...")
    
    # Install other packages
    other_packages = [
        "diffusers>=0.21.0",
        "transformers>=4.30.0", 
        "accelerate>=0.20.0",
        "flask>=2.3.0",
        "flask-cors>=4.0.0",
        "pillow>=10.0.0",
        "requests>=2.31.0",
        "numpy>=1.24.0",
        "safetensors>=0.3.0"
    ]
    
    for package in other_packages:
        print(f"Installing {package}...")
        subprocess.run([sys.executable, "-m", "pip", "install", package])
    
    print("\n🎉 All packages installed successfully!")
    print("💾 All model data will be stored on D drive")
    
else:
    print(f"\n❌ PyTorch installation failed with code: {result.returncode}")
