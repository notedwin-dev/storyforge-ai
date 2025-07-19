@echo off
echo 🎮 Activating GTX 1060 Virtual Environment and Starting Service...
echo.

REM Check if virtual environment exists
if not exist "venv\Scripts\activate.bat" (
    echo ❌ Virtual environment not found!
    echo 💡 Run setup_venv_gtx1060.bat first to create it
    pause
    exit /b 1
)

echo 🔧 Activating virtual environment...
call venv\Scripts\activate.bat

echo 📋 Virtual environment activated. Python location:
where python

echo.
echo 🧪 Quick CUDA test...
python -c "import torch; print(f'CUDA: {torch.cuda.is_available()}, GPU: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else \"None\"}')" 2>nul
if errorlevel 1 (
    echo ⚠️ Dependencies not installed. Installing now...
    pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
    pip install diffusers transformers accelerate flask flask-cors pillow requests numpy safetensors
)

echo.
echo 🚀 Starting GTX 1060 Optimized Free Stable Diffusion Service...
echo 💡 First run will download Stable Diffusion v1.5 model (~4GB)
echo ⚡ Expected speed: 10-30 seconds per image on your GTX 1060
echo.
echo Press Ctrl+C to stop the service
echo.

python app.py
