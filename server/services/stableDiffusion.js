const { InferenceClient } = require('@huggingface/inference');
const fs = require('fs').promises;
const path = require('path');

class StableDiffusionService {
  constructor() {
    const token = process.env.HUGGING_FACE_TOKEN;
    
    if (!token) {
      console.warn('HUGGING_FACE_TOKEN not found, Stable Diffusion service may not work properly');
      this.hf = null;
    } else {
      this.hf = new InferenceClient({
        accessToken: token
      });
    }
    
    // Alternative models for different styles
    this.models = {
      cartoon: 'stabilityai/stable-diffusion-xl-base-1.0',
      anime: 'stabilityai/stable-diffusion-xl-base-1.0',
      realistic: 'stabilityai/stable-diffusion-xl-base-1.0',
      storybook: 'stabilityai/stable-diffusion-xl-base-1.0'
    };
  }

  async generateStoryboardImage(prompt, style = 'cartoon', sceneId) {
    try {
      console.log(`Generating storyboard image for scene: ${sceneId}`);
      
      if (!this.hf) {
        console.warn('Hugging Face client not initialized, using demo image');
        return this.getDemoImagePath();
      }
      
      const modelName = this.models[style] || this.models.cartoon;
      const enhancedPrompt = this.enhancePromptForStoryboard(prompt, style);
      
      console.log(`Using model: ${modelName}`);
      console.log(`Enhanced prompt: ${enhancedPrompt}`);
      
      // Use Hugging Face inference package
      const imageBlob = await this.hf.textToImage({
        model: modelName,
        inputs: enhancedPrompt,
        parameters: {
          negative_prompt: 'blurry, low quality, distorted, nsfw, inappropriate',
          num_inference_steps: 30,
          guidance_scale: 7.5,
          width: 768,
          height: 432 // 16:9 aspect ratio for storyboards
        }
      });
      
      const imageBuffer = Buffer.from(await imageBlob.arrayBuffer());
      const imageUrl = await this.saveImage(imageBuffer, sceneId, style);
      
      return {
        success: true,
        imageUrl,
        sceneId,
        style,
        prompt: enhancedPrompt
      };
    } catch (error) {
      console.error('Stable Diffusion generation error:', error);
      
      // Handle model loading errors
      if (error.message.includes('loading') || error.message.includes('503')) {
        console.log('Model is loading, will retry later...');
        return {
          success: false,
          error: 'Model is currently loading, please try again in a moment',
          sceneId,
          style,
          prompt,
          retryable: true
        };
      }
      
      return {
        success: false,
        error: error.message,
        sceneId,
        style,
        prompt
      };
    }
  }

  enhancePromptForStoryboard(prompt, style) {
    const styleEnhancements = {
      cartoon: 'cartoon style, clean lines, bright colors, comic book storyboard,',
      anime: 'anime style, cel shaded, detailed character design, manga storyboard,',
      realistic: 'photorealistic, cinematic lighting, movie storyboard panels,',
      storybook: 'children\'s book illustration, warm colors, storybook panels,'
    };

    const baseEnhancement = 'high quality, detailed, professional storyboard layout, multiple panels in a grid, comic book style layout, clear composition, white borders between panels, sequential art';
    const stylePrefix = styleEnhancements[style] || styleEnhancements.cartoon;
    
    return `${stylePrefix} ${prompt}, ${baseEnhancement}`;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async generateMultipleStoryboards(scenes, style = 'cartoon', characterDNA = null) {
    try {
      console.log(`Creating composite storyboard for ${scenes.length} scenes...`);
      
      // Create character description for consistency
      let characterPrompt = '';
      if (characterDNA) {
        characterPrompt = `Main character: ${characterDNA.name}, ${characterDNA.description || characterDNA.personality || 'friendly character'}. `;
        if (characterDNA.traits && characterDNA.traits.length > 0) {
          characterPrompt += `Character traits: ${characterDNA.traits.slice(0, 3).join(', ')}. `;
        }
        if (characterDNA.appearance) {
          characterPrompt += `Appearance: ${characterDNA.appearance}. `;
        }
        console.log(`🎭 Using character consistency prompt: ${characterPrompt}`);
      }
      
      // Create a single comprehensive prompt for all scenes with camera angles
      const allSceneDescriptions = scenes.map((scene, index) => {
        const cameraAngle = scene.camera || 'Medium shot';
        
        // Use dedicated storyboard prompt if available, otherwise use content
        const sceneDescription = scene.storyboardPrompt || 
                                scene.description || 
                                scene.text || 
                                scene.content;
        
        return `Panel ${index + 1}: ${cameraAngle} - ${characterPrompt}${sceneDescription}`;
      }).join('\n');
      
      const compositePrompt = `${allSceneDescriptions}`;
      
      console.log(`Generating single storyboard with ${scenes.length} panels featuring consistent character`);
      
      const result = await this.generateStoryboardImage(
        compositePrompt,
        style,
        'storyboard_composite'
      );
      
      if (result.success) {
        console.log(`✅ Composite storyboard generated successfully with character consistency`);
        return [result.imageUrl];
      } else {
        console.warn(`⚠️ Failed to generate composite storyboard:`, result.error);
        return [];
      }
      
    } catch (error) {
      console.error('Error in generateMultipleStoryboards:', error);
      return [];
    }
  }

  async saveImage(imageBuffer, sceneId, style) {
    try {
      const imagesDir = path.join(__dirname, '../uploads/storyboards');
      
      // Ensure directory exists
      await fs.mkdir(imagesDir, { recursive: true });
      
      const filename = `${sceneId}_${style}_${Date.now()}.png`;
      const filepath = path.join(imagesDir, filename);
      
      await fs.writeFile(filepath, imageBuffer);
      
      // Return URL path for serving
      return `/uploads/storyboards/${filename}`;
    } catch (error) {
      console.error('Error saving storyboard image:', error);
      throw new Error('Failed to save storyboard image');
    }
  }

  // Check model status using HF inference package
  async getModelStatus(style = 'cartoon') {
    try {
      const modelName = this.models[style] || this.models.cartoon;
      
      // Try a quick test inference to check model status
      await this.hf.textToImage({
        model: modelName,
        inputs: 'test',
        parameters: {
          num_inference_steps: 1 // Minimal steps for status check
        }
      });
      
      return { status: 'ready' };
    } catch (error) {
      if (error.message.includes('loading') || error.message.includes('503')) {
        // Extract estimated time if available, otherwise default to 20 seconds
        const estimatedTime = 20;
        return { 
          status: 'loading', 
          estimatedTime 
        };
      }
      return { status: 'error', error: error.message };
    }
  }

  getDemoImagePath() {
    // Return path to a demo storyboard image
    return '/api/uploads/demo/storyboard.png';
  }

  // Test connection to Hugging Face
  async testConnection() {
    if (!this.hf) {
      return { 
        success: false, 
        error: 'Hugging Face client not initialized',
        modelReady: false
      };
    }
    
    try {
      // Test with a simple text-to-image call
      const testBlob = await this.hf.textToImage({
        model: 'stabilityai/stable-diffusion-2-1',
        inputs: 'a simple test image',
        parameters: {
          num_inference_steps: 1
        }
      });
      
      return { 
        success: true, 
        message: 'Hugging Face connection successful',
        modelReady: true
      };
    } catch (error) {
      return { 
        success: false, 
        error: error.message,
        modelReady: false
      };
    }
  }
}

module.exports = { StableDiffusionService };
