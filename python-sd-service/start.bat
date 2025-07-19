@echo off
echo Starting Free Python Stable Diffusion Service (GTX 1060 Optimized)...
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python not found! Please install Python 3.8+ from python.org
    pause
    exit /b 1
)

REM Check if we're in the right directory
if not exist "app.py" (
    echo ❌ app.py not found! Make sure you're in the python-sd-service directory
    pause
    exit /b 1
)

REM Check if requirements are installed
pip show torch >nul 2>&1
if errorlevel 1 (
    echo 📦 Installing Python dependencies (GTX 1060 optimized)...
    pip install -r requirements.txt
    if errorlevel 1 (
        echo ❌ Failed to install dependencies!
        pause
        exit /b 1
    )
)

echo 🚀 Starting GTX 1060 Optimized Python Stable Diffusion service on http://localhost:8080
echo 💡 First startup will download SD v1.5 model (~4GB) - this may take a while!
echo 🎮 GTX 1060: 6GB VRAM optimizations enabled
echo ⚡ Expected speed: 10-30 seconds per 512x512 image
echo.
echo Press Ctrl+C to stop the service
echo.

python app.py
