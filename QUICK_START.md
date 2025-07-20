# 🚀 TaleCraft AI - Quick Start Guide

> Get TaleCraft AI running in **5 minutes** with this step-by-step guide. Perfect for hackathon demos and immediate testing!

## 📋 Prerequisites

- **Node.js 18+** ([Download here](https://nodejs.org/))
- **Python 3.10+** ([Download here](https://www.python.org/downloads/))
- **Git** ([Download here](https://git-scm.com/downloads))

## ⚡ 5-Minute Setup

### 1. Clone and Install (2 minutes)

```bash
# Clone repository
git clone https://github.com/notedwin-dev/storyforge-ai.git
cd storyforge-ai

# Install all dependencies (Node.js + Python)
npm run install:all
```

### 2. Set Up Python Stable Diffusion Service (1 minute)

```bash
# Navigate to Python service
cd python-sd-service

# Install Python dependencies
pip install -r requirements.txt

# Start the Python SD service (separate terminal)
python app.py
```

> 💡 **Keep this terminal open** - The Python service runs on `http://localhost:8080`

### 3. Configure Environment (1 minute)

```bash
# Return to project root
cd ..

# Copy environment template
cp server/.env.example server/.env
```

**Edit `server/.env` with your API keys:**
```env
# Required for story generation
GEMINI_API_KEY=your_gemini_api_key_here

# Python SD Service (for free local image generation)
USE_PYTHON_SD=true
PYTHON_SD_URL=http://127.0.0.1:8080
PREFER_PYTHON_SD=true

# Optional: Cloud fallback
HUGGING_FACE_TOKEN=your_hf_token_here

# Optional: Voice narration
ELEVENLABS_API_KEY=your_elevenlabs_key_here

# Optional: File storage
AWS_ACCESS_KEY_ID=your_aws_key_here
AWS_SECRET_ACCESS_KEY=your_aws_secret_here
AWS_S3_BUCKET=your_bucket_name
```

### 4. Start TaleCraft AI (1 minute)

```bash
# Start both frontend and backend
npm run dev
```

**🎉 Done!** Open http://localhost:5173 in your browser.

## 🎯 First Demo (4 minutes)

### Quick Demo Flow:
1. **Character Upload** (30s) - Use demo characters or upload your own
2. **Story Creation** (30s) - Choose genre, tone, enter prompt
3. **AI Generation** (2-3 min) - Watch real-time progress
4. **Export & Share** (30s) - Download PDF/video or share link

### Demo Characters
Try these pre-loaded characters for instant testing:
- 🦸 **Hero** - Adventure stories
- 🧙 **Wizard** - Fantasy tales  
- 🤖 **Robot** - Sci-fi narratives
- 🕵️ **Detective** - Mystery plots

## 🔧 Alternative Setups

### Option A: Python SD Service (Recommended - FREE!)
```bash
# Benefits: $0 cost, faster, private, no API limits
cd python-sd-service
python app.py
```

### Option B: Cloud APIs Only
```bash
# In server/.env:
USE_PYTHON_SD=false
HUGGING_FACE_TOKEN=your_token_here
```

### Option C: Hybrid Setup (Best Performance)
```bash
# In server/.env:
USE_PYTHON_SD=true
ENABLE_CLOUD_FALLBACK=true
HUGGING_FACE_TOKEN=your_token_here
```

## 📁 Project Structure

```
storyforge-ai/
├── client/                 # React frontend (port 5173)
├── server/                 # Node.js backend (port 3001)
├── python-sd-service/      # Python Stable Diffusion (port 8080)
├── QUICK_START.md         # This guide
├── DOCUMENTATION.md       # Full technical docs
└── README.md              # Project overview
```

## 🛠️ Available Scripts

```bash
# Development
npm run dev              # Start both frontend + backend
npm run client:dev       # Frontend only (port 5173)
npm run server:dev       # Backend only (port 3001)

# Installation
npm run install:all      # Install all dependencies
npm install              # Root dependencies only

# Production
npm run build           # Build for production
npm start              # Start production server

# Python Service
cd python-sd-service
python app.py          # Start Python SD service
python test_service.py # Test Python SD service
```

## 🔍 Troubleshooting

### Python Service Issues
```bash
# Check if Python service is running
curl http://localhost:8080/health

# If connection fails:
cd python-sd-service
pip install -r requirements.txt
python app.py
```

### Frontend Build Issues
```bash
# Clear cache and reinstall
rm -rf node_modules client/node_modules server/node_modules
npm run install:all
```

### Port Conflicts
```bash
# Check what's using ports
netstat -ano | findstr :5173  # Frontend
netstat -ano | findstr :3001  # Backend  
netstat -ano | findstr :8080  # Python SD
```

### API Key Issues
```bash
# Test Gemini API
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://generativelanguage.googleapis.com/v1/models

# Test Hugging Face API
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://api-inference.huggingface.co/models/runwayml/stable-diffusion-v1-5
```

## 🎨 Demo Tips

### For Hackathon Presentations:
1. **Pre-load demo**: Use built-in characters for instant start
2. **Show real-time**: WebSocket progress is impressive
3. **Multiple exports**: Demonstrate PDF, video, and web sharing
4. **Mobile demo**: Show responsive design on phone/tablet
5. **Dark mode**: Toggle for visual appeal

### Best Demo Prompts:
- "What if [character] discovered a magical portal?"
- "How does [character] save the day during a storm?"
- "What happens when [character] meets their biggest fear?"
- "How does [character] solve an impossible puzzle?"

## 🚀 Production Deployment

### Environment Variables for Production:
```env
NODE_ENV=production
PORT=3001
CLIENT_URL=https://your-domain.com

# Security
JWT_SECRET=your-jwt-secret
CORS_ORIGIN=https://your-domain.com

# Performance  
ENABLE_COMPRESSION=true
ENABLE_RATE_LIMITING=true
MAX_FILE_SIZE=10485760
```

### Docker Deployment:
```bash
# Build and run with Docker
docker-compose up --build

# Or individual services
docker build -t storyforge-client ./client
docker build -t storyforge-server ./server
docker build -t storyforge-python ./python-sd-service
```

## 🌟 Feature Highlights

### Character DNA Technology
- AI-powered character analysis using CLIP embeddings
- Visual consistency across all generated scenes
- Support for any art style (realistic, cartoon, anime, etc.)

### Multi-AI Orchestration
- **Story**: Google Gemini AI for narrative generation
- **Images**: Python Stable Diffusion for character-consistent visuals
- **Voice**: ElevenLabs for professional narration
- **Video**: FFmpeg for motion effects and compilation

### Real-Time Experience
- WebSocket-powered progress tracking
- Live status updates with time estimates
- Background processing with graceful error handling

## 🎯 Next Steps

1. **Test Core Features**: Upload character → Generate story → Export results
2. **Customize Settings**: Try different genres, tones, and export options
3. **Explore API**: Check `/api/health` and other endpoints
4. **Read Full Docs**: See [DOCUMENTATION.md](./DOCUMENTATION.md) for complete architecture
5. **Deploy**: Follow production deployment guide for hosting

## 📚 Additional Resources

- 📖 **[Full Documentation](./DOCUMENTATION.md)** - Complete technical reference
- 🔧 **[API Reference](./DOCUMENTATION.md#api-documentation)** - Backend API details
- 🎨 **[UI Components](./DOCUMENTATION.md#user-interface-guide)** - Frontend component docs
- 🐍 **[Python SD Service](./python-sd-service/README.md)** - Stable Diffusion setup
- 🚢 **[Deployment Guide](./DOCUMENTATION.md#deployment-guide)** - Production hosting

## 💡 Pro Tips

- **GPU Users**: Python SD service is 10x faster with NVIDIA GPU
- **Demo Mode**: Use pre-loaded characters for instant testing
- **Offline Mode**: Python SD works without internet after initial model download
- **Mobile Testing**: StoryForge is fully responsive - test on all devices!
- **Performance**: Enable compression and caching for production use

---

**🎬 Ready to create amazing AI stories!** 

Visit http://localhost:5173 and start your storytelling journey!
