# Character-Consistent Scene Generation

This enhancement adds image-to-image functionality to StoryForge AI for maintaining character consistency across all story scenes.

## Features

### 🎭 Character Consistency
- **Character Portraits**: Generate a master character image used as reference for all scenes
- **Scene Generation**: Use the character portrait as a base image for each scene
- **Visual Continuity**: Maintain consistent character appearance across the entire story

### 🔧 Technical Implementation

#### Python SD Service (`python-sd-service/app.py`)
- **New Endpoint**: `/generate-scene` - Image-to-image generation using character reference
- **Enhanced Pipeline**: `StableDiffusionImg2ImgPipeline` for character-based scene creation
- **Strength Control**: Adjustable parameter (0.1-1.0) to balance character consistency vs scene variety

#### Server Integration (`server/services/pythonStableDiffusion.js`)
- **Character Portrait Generation**: Create and cache reference character images
- **Character-Consistent Scenes**: Generate scenes using character image as base
- **Automatic Fallback**: Gracefully fall back to standard generation if img2img fails

#### Main Image Service (`server/services/imageGeneration.js`)
- **New Function**: `generateCharacterConsistentScenes()` - High-level interface for consistent story generation
- **Intelligent Workflow**: Character portrait → multiple consistent scenes
- **Error Handling**: Robust fallback to standard generation when needed

## Usage

### API Options
```javascript
// Enable character consistency (default: true)
{
  "options": {
    "characterConsistency": true  // Use img2img for character consistency
  }
}
```

### Direct Python Service Usage
```python
# Character-Consistent Story Scene Generation Demo
from character_consistent_demo import CharacterConsistentSceneGenerator

generator = CharacterConsistentSceneGenerator()

# Generate story with consistent character
story_images = generator.generate_story_scenes(
    character_description="young wizard boy with brown hair, blue robes",
    scenes=[
        "character studying magic spells in a library",
        "character practicing magic in a forest",
        "character facing a dragon in a cave",
        "character celebrating victory in a castle"
    ],
    style="cartoon",
    base_seed=12345
)
```

### Testing
```bash
# Test the new endpoint
cd python-sd-service
python test_img2img.py

# Run character consistency demo
python character_consistent_demo.py
```

## Configuration

### Environment Variables
```bash
# Python SD Service URL (updated default port)
PYTHON_SD_URL=http://127.0.0.1:7860

# Enable Python SD service
USE_PYTHON_SD=true

# Prefer Python SD over cloud services
PREFER_PYTHON_SD=true
```

### Image-to-Image Parameters
- **Strength**: `0.7` (recommended) - Balance between character consistency and scene variety
  - Lower values (0.3-0.5): More character consistency, less scene variation
  - Higher values (0.8-0.9): More scene variation, less character consistency
- **Steps**: Reduced to ~80% of text-to-image steps for efficiency
- **Character Caching**: Character portraits are cached per character ID and style

## Workflow

1. **Character Analysis**: Extract visual features from character DNA/description
2. **Portrait Generation**: Create a reference character image using text-to-image
3. **Character Caching**: Store the character image for reuse across scenes
4. **Scene Generation**: Use img2img with character image + scene prompt for each scene
5. **Fallback Handling**: Automatically fall back to standard generation if issues occur

## Benefits

- ✅ **Visual Consistency**: Characters look the same across all scenes
- ✅ **Story Coherence**: Maintains visual narrative continuity
- ✅ **Flexible Control**: Adjustable strength parameter for desired consistency level
- ✅ **Robust Fallback**: Never fails completely, always produces images
- ✅ **Performance Optimized**: Character portrait generated once, reused for all scenes
- ✅ **GTX 1060 Optimized**: Efficient memory usage and reasonable generation times

## File Structure

```
python-sd-service/
├── app.py                          # Enhanced with img2img endpoint
├── test_img2img.py                 # Test script for new functionality
└── character_consistent_demo.py    # Complete demo workflow

server/services/
├── pythonStableDiffusion.js        # Enhanced with character methods
└── imageGeneration.js              # New character-consistent function

server/routes/
└── generate.js                     # Updated to use character consistency
```

## Example Output

When character consistency is enabled, you'll see logs like:
```
🎭 Using character-consistent scene generation...
📸 Character portrait not cached, generating...
✅ Character portrait generated successfully for: Wizard Boy
🎬 Generating scene 1/4: character studying magic spells...
✅ Character-consistent scene generated successfully
📊 Results: 4/4 scenes with character consistency
```

This ensures that your story characters maintain their visual identity throughout the entire narrative, creating a more professional and cohesive storytelling experience.
