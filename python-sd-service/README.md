# Free Python Stable Diffusion Setup

## Quick Start (5 minutes)

### 1. Install Python Dependencies
```bash
cd python-sd-service
pip install -r requirements.txt
```

### 2. Start the Python Service
```bash
python app.py
```

### 3. Configure StoryForge
```bash
# In your .env file:
USE_PYTHON_SD=true
PYTHON_SD_URL=http://127.0.0.1:8080
PREFER_PYTHON_SD=true
ENABLE_CLOUD_FALLBACK=true
```

### 4. Start StoryForge
```bash
npm start
```

## Benefits

✅ **$0 cost** - No API fees, ever!
✅ **Faster** - No network latency
✅ **Private** - Images never leave your computer
✅ **Customizable** - Easy to modify styles
✅ **Reliable** - No API rate limits

## System Requirements

### Minimum (CPU only)
- **RAM**: 8GB+ system RAM
- **Storage**: 10GB+ free space
- **Speed**: ~60 seconds per image

### Recommended (GPU)
- **GPU**: NVIDIA RTX 3060+ with 6GB+ VRAM
- **RAM**: 16GB+ system RAM  
- **Storage**: 20GB+ free space
- **Speed**: ~5-15 seconds per image

### Optimal (High-end GPU)
- **GPU**: RTX 4070+ with 12GB+ VRAM
- **RAM**: 32GB+ system RAM
- **Speed**: ~2-5 seconds per image

## Troubleshooting

### "ModuleNotFoundError: No module named 'torch'"
```bash
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118
```

### "CUDA out of memory"
The service will automatically fall back to CPU mode.

### "Cannot connect to Python SD service"
```bash
# Check if service is running:
curl http://localhost:8080/health

# If not, start it:
cd python-sd-service
python app.py
```

### Slow generation on CPU
This is normal. Consider:
1. Using a GPU
2. Reducing image resolution in `app.py`
3. Reducing inference steps

## Advanced Configuration

### Custom Models
Edit `app.py` to add more models:
```python
"my_style": {
    "model_id": "runwayml/stable-diffusion-v1-5",
    "positive_prompt": "my custom style prompt",
    # ... other settings
}
```

### GPU Memory Optimization
For lower VRAM cards, edit `app.py`:
```python
# Enable CPU offloading
self.pipeline.enable_model_cpu_offload()

# Enable sequential CPU offload for very low VRAM
self.pipeline.enable_sequential_cpu_offload()
```

### Multiple GPU Support
```python
# In app.py, specify GPU
self.device = "cuda:0"  # or "cuda:1", etc.
```

## Performance Comparison

| Method | Cost/Image | Speed | Setup Time | Quality |
|--------|------------|-------|------------|---------|
| **Python SD (GPU)** | $0 | 5-15s | 5 min | High |
| **Python SD (CPU)** | $0 | 30-60s | 5 min | High |
| Cloud SD | $0.005 | 3-10s | 1 min | High |
| Automatic1111 | $0 | 5-15s | 30 min | High |

## Production Tips

### Docker Deployment
```dockerfile
FROM python:3.10-slim

# Install dependencies
COPY requirements.txt .
RUN pip install -r requirements.txt

# Copy service
COPY app.py .

# Run service
CMD ["python", "app.py"]
```

### Load Balancing
Run multiple Python services on different ports:
```bash
PORT=8080 python app.py &
PORT=8081 python app.py &
PORT=8082 python app.py &
```

### Monitoring
Check service status:
```bash
curl http://localhost:8080/status
```

## Why This Approach?

1. **Cost Effective**: Save $12-40/month vs cloud APIs
2. **Python Ecosystem**: Better AI/ML library support
3. **Flexibility**: Easy to modify and extend
4. **Performance**: Direct model access without API overhead
5. **Privacy**: Your data stays local

## Next Steps

Once running, you can:
1. Add custom models
2. Implement image variations
3. Add image upscaling
4. Create custom styles
5. Optimize for your specific use case

**Happy free generating! 🐍🎨**
