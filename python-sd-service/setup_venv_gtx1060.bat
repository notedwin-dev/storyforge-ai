@echo off
echo 🎮 GTX 1060 Virtual Environment Setup
echo =====================================
echo.
echo This will create a clean Python virtual environment for your GTX 1060
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python not found! Please install Python 3.8+ from python.org
    pause
    exit /b 1
)

echo 🔍 Python version detected:
python --version

echo.
echo 📁 Creating virtual environment...
if exist "venv" (
    echo ⚠️ Virtual environment already exists. Removing old one...
    rmdir /s /q venv
)

python -m venv venv
if errorlevel 1 (
    echo ❌ Failed to create virtual environment!
    pause
    exit /b 1
)

echo ✅ Virtual environment created successfully!

echo.
echo 🔧 Activating virtual environment...
call venv\Scripts\activate.bat

echo.
echo 📦 Upgrading pip...
python -m pip install --upgrade pip

echo.
echo 🎮 Installing CUDA 11.8 PyTorch for GTX 1060...
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118

echo.
echo 📦 Installing AI dependencies...
pip install diffusers>=0.21.0 transformers>=4.30.0 accelerate>=0.20.0

echo.
echo 🌐 Installing web dependencies...
pip install flask>=2.3.0 flask-cors>=4.0.0

echo.
echo 🖼️ Installing image dependencies...
pip install pillow>=10.0.0 requests>=2.31.0 numpy>=1.24.0 safetensors>=0.3.0

echo.
echo 🧪 Testing CUDA installation...
python -c "import torch; print(f'✅ PyTorch version: {torch.__version__}'); print(f'✅ CUDA available: {torch.cuda.is_available()}'); print(f'✅ GPU detected: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else \"❌ No GPU\"}')"

if errorlevel 1 (
    echo ❌ CUDA test failed!
    echo 💡 Try restarting your computer and running this script again
    pause
    exit /b 1
)

echo.
echo 🎉 SUCCESS! Your GTX 1060 virtual environment is ready!
echo.
echo 📋 To use this environment:
echo    1. Run: venv\Scripts\activate.bat
echo    2. Run: python app.py
echo.
echo 🚀 Quick start:
echo    activate_and_run.bat
echo.
pause
