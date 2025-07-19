#!/usr/bin/env python3
"""
Test script for Free Python Stable Diffusion Service
Verifies the service is working correctly before integration
"""

import requests
import json
import time
import base64
from PIL import Image
import io

def test_service():
    """Run comprehensive tests on the Python SD service"""
    
    base_url = "http://localhost:8080"
    print("🧪 Testing Free Python Stable Diffusion Service")
    print("=" * 50)
    
    # Test 1: Health Check
    print("1. Health Check...")
    try:
        response = requests.get(f"{base_url}/health", timeout=5)
        if response.status_code == 200:
            print("   ✅ Service is healthy")
        else:
            print(f"   ❌ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"   ❌ Cannot connect to service: {e}")
        print("   💡 Make sure to run: python app.py")
        return False
    
    # Test 2: Status Check
    print("2. Status Check...")
    try:
        response = requests.get(f"{base_url}/status", timeout=5)
        status = response.json()
        print(f"   Device: {status.get('device', 'unknown')}")
        print(f"   Model: {status.get('current_model', 'none')}")
        print(f"   CUDA Available: {status.get('cuda_available', False)}")
        if status.get('status') == 'ready':
            print("   ✅ Service is ready for generation")
        else:
            print("   ⚠️ Service not ready yet")
    except Exception as e:
        print(f"   ❌ Status check failed: {e}")
        return False
    
    # Test 3: Available Styles
    print("3. Available Styles...")
    try:
        response = requests.get(f"{base_url}/models", timeout=5)
        models = response.json()
        styles = models.get('styles', [])
        print(f"   Available styles: {', '.join(styles)}")
        print("   ✅ Styles loaded successfully")
    except Exception as e:
        print(f"   ❌ Models check failed: {e}")
        return False
    
    # Test 4: Image Generation
    print("4. Image Generation Test...")
    test_prompt = "a cute cartoon cat sitting in a garden, children's book illustration"
    
    try:
        print(f"   Generating: '{test_prompt}'")
        print("   ⏳ This may take 30-60 seconds on first run...")
        
        start_time = time.time()
        response = requests.post(f"{base_url}/generate", 
            json={
                "prompt": test_prompt,
                "style": "cartoon"
            },
            timeout=120  # 2 minute timeout
        )
        end_time = time.time()
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                generation_time = end_time - start_time
                print(f"   ✅ Image generated successfully in {generation_time:.1f}s")
                
                # Save test image
                img_data = base64.b64decode(result['image'])
                img = Image.open(io.BytesIO(img_data))
                img.save('test_output.png')
                print("   💾 Test image saved as 'test_output.png'")
                
                # Show metadata
                metadata = result.get('metadata', {})
                print(f"   Model: {metadata.get('model', 'unknown')}")
                print(f"   Steps: {metadata.get('steps', 'unknown')}")
                print(f"   Size: {metadata.get('size', 'unknown')}")
                
                return True
            else:
                print(f"   ❌ Generation failed: {result.get('error', 'unknown error')}")
                return False
        else:
            print(f"   ❌ Request failed: {response.status_code}")
            return False
            
    except requests.exceptions.Timeout:
        print("   ❌ Generation timed out (>2 minutes)")
        print("   💡 This might be normal on CPU or first run")
        return False
    except Exception as e:
        print(f"   ❌ Generation error: {e}")
        return False

def test_integration():
    """Test integration with StoryForge"""
    print("\n🔗 Testing StoryForge Integration")
    print("=" * 50)
    
    storyforge_url = "http://localhost:3001"
    
    # Test StoryForge service status
    print("1. StoryForge Service Status...")
    try:
        response = requests.get(f"{storyforge_url}/api/status/services", timeout=5)
        if response.status_code == 200:
            status = response.json()
            services = status.get('services', {})
            python_status = services.get('python', {})
            
            if python_status.get('available'):
                print("   ✅ Python SD detected by StoryForge")
                print(f"   💰 Cost per image: {status.get('cost_analysis', {}).get('python_sd', {}).get('cost_per_image', 'unknown')}")
                return True
            else:
                print("   ❌ Python SD not detected by StoryForge")
                print("   💡 Check your .env configuration")
                return False
        else:
            print(f"   ❌ StoryForge not responding: {response.status_code}")
            return False
    except Exception as e:
        print(f"   ❌ Cannot connect to StoryForge: {e}")
        print("   💡 Make sure StoryForge is running: npm start")
        return False

def main():
    """Run all tests"""
    print("🚀 Free Python Stable Diffusion Test Suite")
    print("=" * 50)
    
    # Test Python service
    service_ok = test_service()
    
    if service_ok:
        print("\n🎉 Python SD Service: ALL TESTS PASSED!")
        
        # Test integration
        integration_ok = test_integration()
        
        if integration_ok:
            print("\n🎉 COMPLETE SUCCESS!")
            print("💰 You're now generating images for FREE!")
            print("🎨 Ready to create unlimited storyboards at $0 cost!")
        else:
            print("\n⚠️ Python SD works, but StoryForge integration needs setup")
            print("📋 Follow the integration steps in SETUP_FREE_SD.md")
    else:
        print("\n❌ Python SD Service setup incomplete")
        print("📋 Follow the setup steps in SETUP_FREE_SD.md")

if __name__ == "__main__":
    main()
