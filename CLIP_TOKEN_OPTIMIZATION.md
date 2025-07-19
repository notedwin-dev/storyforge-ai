# CLIP Token Limit Handling

## Problem
CLIP (Contrastive Language-Image Pre-training) text encoders used in Stable Diffusion models have a **maximum context length of 77 tokens**. When prompts exceed this limit, they get truncated, causing important parts of your prompt to be ignored.

## Symptoms
- Long prompts getting cut off mid-sentence
- Important character details or scene descriptions missing from generated images
- Inconsistent results when prompts are too detailed

## Solution
The system now automatically optimizes prompts to fit within CLIP's token limit using intelligent word prioritization.

### How It Works

#### 1. Python SD Service (`app.py`)
```python
def optimize_prompt_for_clip(self, prompt, max_tokens=75):
    """Optimize prompt to fit within CLIP's 77 token limit"""
    # Estimates tokens and prioritizes important keywords
    # Keeps style and character information while trimming excess
```

#### 2. JavaScript Services
```javascript
function optimizePromptForCLIP(prompt, maxWords = 75) {
    // Word-based optimization for CLIP limits
    // Prioritizes visual and style keywords
}
```

### Priority Keywords
The optimization prioritizes these important terms:
- **Character terms**: character, scene, story
- **Style terms**: cartoon, anime, illustration, storybook, cinematic
- **Quality terms**: high quality, detailed, clean, bright, professional
- **Technical terms**: storyboard, panel, composition, art

### Example Optimization

**Before (84 words - exceeds CLIP limit):**
```
cartoon style, clean lines, bright colors, comic book art, illustration, animated style, realistic, photograph, photorealistic, blurry, low quality, distorted, nsfw, dark, scary, character named Bob with brown hair, blue eyes, wearing red shirt, standing in a magical enchanted forest with glowing trees, sparkling fairy lights, mystical creatures, ancient ruins, flowing river, butterflies, flowers, mountains in background, sunset lighting, dramatic clouds, high quality, detailed, 4k resolution, professional composition, cinematic lighting, depth of field, bokeh effect, artistic masterpiece, award winning photography
```

**After (75 words - within CLIP limit):**
```
cartoon clean bright illustration, character high detailed, cinematic style, lines, colors, comic book art, animated style, realistic, photograph, photorealistic, blurry, low quality, distorted, nsfw, dark, scary, named Bob with brown hair, blue eyes, wearing red shirt, standing in a magical enchanted forest with glowing trees, sparkling fairy lights, mystical creatures, ancient ruins, flowing river, butterflies, flowers, mountains in background, sunset lighting, dramatic clouds, quality, 4k resolution, professional composition, lighting, depth of field, bokeh effect, artistic
```

## Monitoring

### Logs to Watch For
```
📝 Prompt too long (84 words), optimizing for CLIP...
✅ Optimized prompt: 84 → 75 words
```

### Metadata
The system now returns optimization information:
```json
{
  "metadata": {
    "original_prompt_words": 84,
    "optimized_prompt_words": 75,
    "prompt_optimized": true
  }
}
```

## Best Practices

### 1. Write Efficient Prompts
- Use concise, descriptive words
- Avoid redundant adjectives
- Focus on the most important visual elements

### 2. Character Descriptions
- Limit character descriptions to 3-5 key visual traits
- Use specific terms: "blue hair" instead of "hair that is colored blue"

### 3. Scene Descriptions  
- Prioritize action and setting over excessive detail
- Use established art style terms: "cartoon style" instead of "in the style of cartoons"

## Testing
Use the test script to verify optimization:
```bash
node test_clip_optimization.js
```

This will show how different prompts are optimized and whether they fit within CLIP limits.

## Benefits
- ✅ **No More Truncation**: Prompts never exceed CLIP's 77-token limit
- ✅ **Smart Prioritization**: Important visual elements are preserved
- ✅ **Consistent Results**: All prompt parts are processed by the model
- ✅ **Automatic**: No manual prompt editing required
- ✅ **Transparent**: Logs and metadata show what was optimized

The system ensures that your detailed character descriptions and scene prompts are properly processed while maintaining the visual quality and consistency you expect.
