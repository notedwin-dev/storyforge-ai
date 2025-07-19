#!/usr/bin/env python3
"""
Test script for the new image-to-image scene generation endpoint
"""

import requests
import base64
import json
from PIL import Image
import io

def test_scene_generation():
    """Test the new /generate-scene endpoint"""
    
    # Create a simple test character image (colored rectangle)
    test_image = Image.new('RGB', (512, 512), color='lightblue')
    
    # Convert to base64
    buffer = io.BytesIO()
    test_image.save(buffer, format="PNG")
    character_image_base64 = base64.b64encode(buffer.getvalue()).decode()
    
    # Test data
    test_data = {
        "prompt": "character standing in a magical forest with glowing trees",
        "character_image": character_image_base64,
        "style": "cartoon",
        "strength": 0.7,
        "seed": 42
    }
    
    try:
        print("🧪 Testing /generate-scene endpoint...")
        print(f"📝 Prompt: {test_data['prompt']}")
        print(f"🎨 Style: {test_data['style']}")
        print(f"💪 Strength: {test_data['strength']}")
        
        response = requests.post(
            "http://localhost:7860/generate-scene",
            json=test_data,
            timeout=120  # Allow up to 2 minutes for generation
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get("success"):
                print("✅ Scene generation successful!")
                print(f"📊 Metadata: {result.get('metadata', {})}")
                
                # Save the generated image
                if result.get("image"):
                    image_data = base64.b64decode(result["image"])
                    output_image = Image.open(io.BytesIO(image_data))
                    output_image.save("test_scene_output.png")
                    print("💾 Scene image saved as 'test_scene_output.png'")
                
                return True
            else:
                print(f"❌ Generation failed: {result.get('error')}")
                return False
        else:
            print(f"❌ HTTP Error {response.status_code}: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

def test_service_status():
    """Test if the service is running"""
    try:
        response = requests.get("http://localhost:7860/status", timeout=10)
        if response.status_code == 200:
            status = response.json()
            print("✅ Service is running")
            print(f"📊 Status: {json.dumps(status, indent=2)}")
            return True
        else:
            print(f"❌ Service status error: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Cannot connect to service: {e}")
        print("💡 Make sure the Python SD service is running on port 7860")
        return False

if __name__ == "__main__":
    print("🔬 Testing Character-Consistent Scene Generation")
    print("=" * 50)
    
    # Test service status first
    if not test_service_status():
        print("\n❌ Service is not available. Please start the Python SD service first.")
        exit(1)
    
    print("\n" + "=" * 50)
    
    # Test scene generation
    success = test_scene_generation()
    
    print("\n" + "=" * 50)
    if success:
        print("🎉 All tests passed! Character-consistent scene generation is working.")
    else:
        print("❌ Tests failed. Check the service logs for details.")
