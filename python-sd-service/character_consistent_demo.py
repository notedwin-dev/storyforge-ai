#!/usr/bin/env python3
"""
Character-Consistent Story Scene Generation Integration Example

This script demonstrates how to integrate the new image-to-image functionality
into the story generation workflow for consistent character representation.
"""

import requests
import base64
import json
from PIL import Image
import io

class CharacterConsistentSceneGenerator:
    """Helper class for generating scenes with character consistency"""
    
    def __init__(self, sd_service_url="http://localhost:7860"):
        self.sd_service_url = sd_service_url
        self.character_image_cache = {}
    
    def generate_character_portrait(self, character_description, style="cartoon", seed=None):
        """Generate the main character portrait that will be used for all scenes"""
        
        prompt = f"portrait of {character_description}, centered, clear view, character design"
        
        payload = {
            "prompt": prompt,
            "style": style,
            "seed": seed
        }
        
        try:
            response = requests.post(f"{self.sd_service_url}/generate", json=payload, timeout=120)
            
            if response.status_code == 200:
                result = response.json()
                if result.get("success"):
                    # Cache the character image for reuse
                    character_key = f"{character_description}_{style}_{seed}"
                    self.character_image_cache[character_key] = result["image"]
                    
                    print(f"✅ Generated character portrait: {character_description}")
                    return result["image"]
                else:
                    print(f"❌ Character generation failed: {result.get('error')}")
                    return None
            else:
                print(f"❌ HTTP Error {response.status_code}")
                return None
                
        except Exception as e:
            print(f"❌ Character generation error: {e}")
            return None
    
    def generate_scene_with_character(self, scene_description, character_image_base64, 
                                    style="cartoon", strength=0.7, seed=None):
        """Generate a scene using the character image for consistency"""
        
        payload = {
            "prompt": scene_description,
            "character_image": character_image_base64,
            "style": style,
            "strength": strength,
            "seed": seed
        }
        
        try:
            response = requests.post(f"{self.sd_service_url}/generate-scene", json=payload, timeout=120)
            
            if response.status_code == 200:
                result = response.json()
                if result.get("success"):
                    print(f"✅ Generated scene: {scene_description[:50]}...")
                    return result["image"]
                else:
                    print(f"❌ Scene generation failed: {result.get('error')}")
                    return None
            else:
                print(f"❌ HTTP Error {response.status_code}")
                return None
                
        except Exception as e:
            print(f"❌ Scene generation error: {e}")
            return None
    
    def generate_story_scenes(self, character_description, scenes, style="cartoon", base_seed=None):
        """Generate all scenes for a story with character consistency"""
        
        print(f"🎭 Starting character-consistent story generation")
        print(f"👤 Character: {character_description}")
        print(f"🎨 Style: {style}")
        print(f"📚 Scenes: {len(scenes)}")
        print("=" * 60)
        
        # Step 1: Generate the character portrait
        print("1️⃣ Generating character portrait...")
        character_image = self.generate_character_portrait(
            character_description, 
            style=style, 
            seed=base_seed
        )
        
        if not character_image:
            print("❌ Failed to generate character portrait. Aborting story generation.")
            return []
        
        # Save character portrait
        char_image_data = base64.b64decode(character_image)
        char_img = Image.open(io.BytesIO(char_image_data))
        char_img.save("character_portrait.png")
        print("💾 Character portrait saved as 'character_portrait.png'")
        
        # Step 2: Generate each scene using the character
        print(f"\n2️⃣ Generating {len(scenes)} scenes with character consistency...")
        story_images = []
        
        for i, scene in enumerate(scenes, 1):
            print(f"\n🎬 Scene {i}/{len(scenes)}: {scene[:50]}...")
            
            # Use incremental seeds for variety while maintaining consistency
            scene_seed = (base_seed + i) if base_seed else None
            
            scene_image = self.generate_scene_with_character(
                scene_description=scene,
                character_image_base64=character_image,
                style=style,
                strength=0.7,  # Good balance between character consistency and scene variety
                seed=scene_seed
            )
            
            if scene_image:
                # Save scene image
                scene_image_data = base64.b64decode(scene_image)
                scene_img = Image.open(io.BytesIO(scene_image_data))
                scene_img.save(f"scene_{i:02d}.png")
                print(f"💾 Scene {i} saved as 'scene_{i:02d}.png'")
                
                story_images.append({
                    "scene_number": i,
                    "description": scene,
                    "image": scene_image,
                    "filename": f"scene_{i:02d}.png"
                })
            else:
                print(f"❌ Failed to generate scene {i}")
        
        print(f"\n🎉 Story generation complete! Generated {len(story_images)}/{len(scenes)} scenes")
        return story_images

def demo_story_generation():
    """Demo the character-consistent story generation"""
    
    # Example story data
    character_description = "young wizard boy with brown hair, blue robes, friendly smile"
    
    scenes = [
        "character studying magic spells in a library with floating books",
        "character practicing magic in a enchanted forest clearing",
        "character facing a magical dragon in a cave with crystals",
        "character celebrating victory in a magical castle courtyard"
    ]
    
    # Initialize the generator
    generator = CharacterConsistentSceneGenerator()
    
    # Generate the story with consistent character
    story_images = generator.generate_story_scenes(
        character_description=character_description,
        scenes=scenes,
        style="cartoon",
        base_seed=12345  # For reproducible results
    )
    
    # Print summary
    print("\n" + "=" * 60)
    print("📊 GENERATION SUMMARY")
    print("=" * 60)
    print(f"Character: {character_description}")
    print(f"Scenes generated: {len(story_images)}")
    
    for img_info in story_images:
        print(f"  • Scene {img_info['scene_number']}: {img_info['filename']}")
    
    print("\n💡 All images saved to current directory")
    print("💡 Use these images in your TaleCraft AI application for consistent character representation")

if __name__ == "__main__":
    print("🚀 Character-Consistent Story Scene Generation Demo")
    print("=" * 60)
    
    # Check if service is available
    try:
        response = requests.get("http://localhost:7860/status", timeout=5)
        if response.status_code == 200:
            print("✅ Python SD Service is running")
            print("\nStarting demo story generation...")
            demo_story_generation()
        else:
            print("❌ Python SD Service is not responding correctly")
    except Exception as e:
        print(f"❌ Cannot connect to Python SD Service: {e}")
        print("💡 Please make sure the service is running on http://localhost:7860")
