const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class PythonStableDiffusionService {
  constructor() {
    // Python service endpoint - updated to match the enhanced service
    this.serviceUrl = process.env.PYTHON_SD_URL || 'http://127.0.0.1:8080';
    this.enabled = process.env.USE_PYTHON_SD === 'true';
    
    // Timeout settings - reduced for faster failures
    this.healthTimeout = 3000;      // 3 seconds for health checks
    this.generateTimeout = 120000;  // 2 minutes for generation

    // Character image cache for consistent generation
    this.characterImageCache = new Map();
  }

  async checkConnection() {
    if (!this.enabled) {
      return { 
        success: false, 
        error: 'Python Stable Diffusion is disabled. Set USE_PYTHON_SD=true in .env',
        available: false,
        status: 'disabled'
      };
    }

    try {
      // Use Promise.race to ensure we don't hang indefinitely
      const healthPromise = axios.get(`${this.serviceUrl}/health`, {
        timeout: this.healthTimeout
      });
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Health check timeout')), this.healthTimeout + 1000);
      });

      const response = await Promise.race([healthPromise, timeoutPromise]);
      
      // Also check status endpoint with similar timeout protection
      const statusPromise = axios.get(`${this.serviceUrl}/status`, {
        timeout: this.healthTimeout
      });
      
      const statusTimeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Status check timeout')), this.healthTimeout + 1000);
      });

      const statusResponse = await Promise.race([statusPromise, statusTimeoutPromise]);
      
      return {
        success: true,
        message: 'Python Stable Diffusion service is running',
        available: true,
        status: 'running',
        serviceUrl: this.serviceUrl,
        statusData: statusResponse.data
      };
    } catch (error) {
      let errorMessage = 'Unknown connection error';
      let status = 'error';
      
      if (error.code === 'ECONNREFUSED') {
        errorMessage = `Python SD service not running at ${this.serviceUrl}. Start it with: cd python-sd-service && python app.py`;
        status = 'not_running';
      } else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.message === 'Health check timeout' || error.message === 'Status check timeout') {
        errorMessage = `Connection timeout to Python SD service at ${this.serviceUrl}. Service may be starting up or overloaded.`;
        status = 'timeout';
      } else if (error.response) {
        errorMessage = `Python SD service error: ${error.response.status} ${error.response.statusText}`;
        status = 'service_error';
      } else {
        errorMessage = `Cannot connect to Python SD service: ${error.message}`;
        status = 'connection_error';
      }
      
      return {
        success: false,
        error: errorMessage,
        available: false,
        status: status,
        serviceUrl: this.serviceUrl
      };
    }
  }

  async generateStoryboardImage(prompt, style = 'cartoon', sceneId) {
    try {
      console.log(`🐍 Generating Python SD storyboard image for scene: ${sceneId}`);

      // Check if Python SD is available with fast timeout
      const connectionCheck = await this.checkConnection();
      if (!connectionCheck.available) {
        throw new Error(connectionCheck.error);
      }

      const enhancedPrompt = this.enhancePromptForStoryboard(prompt, style);

      const payload = {
        prompt: enhancedPrompt,
        style: style,
        seed: null // Random seed
      };

      console.log(`🔧 Generating with style: ${style}`);

      // Use Promise.race to avoid hanging requests
      const generatePromise = axios.post(`${this.serviceUrl}/generate`, payload, {
        timeout: this.generateTimeout,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Generation request timeout')), this.generateTimeout + 5000);
      });

      const response = await Promise.race([generatePromise, timeoutPromise]);

      if (!response.data.success) {
        throw new Error(response.data.error || 'Unknown Python SD generation error');
      }

      // Decode base64 image
      const base64Image = response.data.image;
      const imageBuffer = Buffer.from(base64Image, 'base64');
      
      // Save image
      const imageUrl = await this.saveImage(imageBuffer, sceneId, style);

      console.log(`✅ Python SD storyboard generated successfully for scene: ${sceneId}`);

      return {
        success: true,
        imageUrl,
        sceneId,
        style,
        prompt: enhancedPrompt,
        metadata: response.data.metadata
      };

    } catch (error) {
      console.error('Python Stable Diffusion generation error:', error);
      
      return {
        success: false,
        error: error.message,
        sceneId,
        style,
        prompt
      };
    }
  }

  async generateCharacterPortrait(characterDNA, style = 'cartoon') {
    // Generate a character portrait to use for consistent scene generation
    try {
      console.log(`🎭 Generating character portrait for: ${characterDNA.name}`);

      const connectionCheck = await this.checkConnection();
      if (!connectionCheck.available) {
        throw new Error(connectionCheck.error);
      }

      // Build character description from DNA
      const characterDescription = this.buildCharacterDescription(characterDNA);
      const portraitPrompt = `portrait of ${characterDescription}, centered, clear view, character design, full body visible`;
      const enhancedPrompt = this.enhancePromptForStoryboard(portraitPrompt, style);

      const payload = {
        prompt: enhancedPrompt,
        style: style,
        seed: characterDNA.id ? this.hashStringToSeed(characterDNA.id) : null // Consistent seed for character
      };

      console.log(`🔧 Generating character portrait with style: ${style}`);

      const generatePromise = axios.post(`${this.serviceUrl}/generate`, payload, {
        timeout: this.generateTimeout,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Character portrait generation timeout')), this.generateTimeout + 5000);
      });

      const response = await Promise.race([generatePromise, timeoutPromise]);

      if (!response.data.success) {
        throw new Error(response.data.error || 'Character portrait generation failed');
      }

      // Cache the character image
      const characterKey = `${characterDNA.id}_${style}`;
      this.characterImageCache.set(characterKey, response.data.image);

      console.log(`✅ Character portrait generated successfully for: ${characterDNA.name}`);

      return {
        success: true,
        characterImage: response.data.image,
        characterKey,
        prompt: enhancedPrompt,
        metadata: response.data.metadata
      };

    } catch (error) {
      console.error('Character portrait generation error:', error);

      return {
        success: false,
        error: error.message,
        characterId: characterDNA.id,
        characterName: characterDNA.name
      };
    }
  }

  async generateSceneWithCharacter(prompt, characterDNA, style = 'cartoon', sceneId, strength = 0.7) {
    // Generate a scene using character image for consistency
    try {
      console.log(`🎬 Generating character-consistent scene for: ${sceneId}`);

      const connectionCheck = await this.checkConnection();
      if (!connectionCheck.available) {
        throw new Error(connectionCheck.error);
      }

      // Get or generate character portrait
      const characterKey = `${characterDNA.id}_${style}`;
      let characterImage = this.characterImageCache.get(characterKey);

      if (!characterImage) {
        console.log(`📸 Character portrait not cached, generating...`);
        const portraitResult = await this.generateCharacterPortrait(characterDNA, style);

        if (!portraitResult.success) {
          throw new Error(`Failed to generate character portrait: ${portraitResult.error}`);
        }

        characterImage = portraitResult.characterImage;
      }

      // Enhance scene prompt for character consistency
      const characterDescription = this.buildCharacterDescription(characterDNA);
      const scenePrompt = `${characterDescription} ${prompt}, same character, consistent art style`;
      const enhancedPrompt = this.enhancePromptForStoryboard(scenePrompt, style);

      const payload = {
        prompt: enhancedPrompt,
        character_image: characterImage,
        style: style,
        strength: strength,
        seed: sceneId ? this.hashStringToSeed(sceneId.toString()) : null
      };

      console.log(`🔧 Generating scene with character consistency, style: ${style}, strength: ${strength}`);

      const generatePromise = axios.post(`${this.serviceUrl}/generate-scene`, payload, {
        timeout: this.generateTimeout,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Scene generation timeout')), this.generateTimeout + 5000);
      });

      const response = await Promise.race([generatePromise, timeoutPromise]);

      if (!response.data.success) {
        throw new Error(response.data.error || 'Character-consistent scene generation failed');
      }

      // Decode base64 image and save
      const base64Image = response.data.image;
      const imageBuffer = Buffer.from(base64Image, 'base64');
      const imageUrl = await this.saveImage(imageBuffer, sceneId, style);

      console.log(`✅ Character-consistent scene generated successfully for: ${sceneId}`);

      return {
        success: true,
        imageUrl,
        sceneId,
        style,
        prompt: enhancedPrompt,
        characterBased: true,
        strength,
        metadata: response.data.metadata
      };

    } catch (error) {
      console.error('Character-consistent scene generation error:', error);

      return {
        success: false,
        error: error.message,
        sceneId,
        style,
        prompt,
        characterBased: true
      };
    }
  }

  buildCharacterDescription(characterDNA) {
    // Build character description from DNA for consistent generation
    let description = characterDNA.name || 'character';

    // Add visual characteristics if available (keep it concise)
    if (characterDNA.tags && characterDNA.tags.length > 0) {
      const visualTags = characterDNA.tags.filter(tag =>
        ['hair', 'eyes', 'clothes', 'style', 'color', 'skin', 'appearance'].some(keyword =>
          tag.toLowerCase().includes(keyword)
        )
      );

      if (visualTags.length > 0) {
        // Limit to top 3 visual tags to save tokens
        description += `, ${visualTags.slice(0, 3).join(', ')}`;
      }
    }

    // Add appearance description but keep it short
    if (characterDNA.appearance) {
      // Take only first 30 words of appearance description
      const appearanceWords = characterDNA.appearance.split(' ').slice(0, 30).join(' ');
      description += `, ${appearanceWords}`;
    } else if (characterDNA.description) {
      // Extract visual elements from description (first 20 words)
      const visualKeywords = ['hair', 'eyes', 'wearing', 'dressed', 'tall', 'short', 'young', 'old'];
      const descriptionWords = characterDNA.description.toLowerCase().split(' ');
      const hasVisualDescription = visualKeywords.some(keyword =>
        descriptionWords.includes(keyword)
      );

      if (hasVisualDescription) {
        const shortDescription = characterDNA.description.split(' ').slice(0, 20).join(' ');
        description += `, ${shortDescription}`;
      }
    }

    // Optimize the character description for CLIP limits
    return this.optimizePromptForCLIP(description, 25); // Reserve 25 words for character
  } hashStringToSeed(str) {
    // Convert string to consistent numeric seed
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash) % 2147483647; // Ensure positive number within range
  }

  enhancePromptForStoryboard(prompt, style) {
    const baseEnhancement = 'high quality, detailed, professional storyboard panel, clear composition, sequential art';
    const fullPrompt = `${prompt}, ${baseEnhancement}`;

    // Optimize for CLIP token limit
    return this.optimizePromptForCLIP(fullPrompt);
  }

  optimizePromptForCLIP(prompt, maxWords = 75) {
    // Simple word-based optimization for CLIP's ~77 token limit
    const words = prompt.split(/\s+/);

    if (words.length <= maxWords) {
      return prompt;
    }

    console.log(`⚠️ Prompt too long (${words.length} words), optimizing for CLIP...`);

    // Priority keywords for story generation
    const priorityKeywords = [
      'character', 'scene', 'story', 'cartoon', 'anime', 'illustration', 'storyboard',
      'high quality', 'detailed', 'clean', 'bright', 'friendly', 'professional',
      'panel', 'composition', 'art', 'style'
    ];

    // Separate priority and regular words
    const priorityWords = [];
    const regularWords = [];

    words.forEach(word => {
      const wordLower = word.toLowerCase();
      if (priorityKeywords.some(keyword => wordLower.includes(keyword.split(' ')[0]))) {
        priorityWords.push(word);
      } else {
        regularWords.push(word);
      }
    });

    // Reconstruct with priorities first
    const optimizedWords = [];

    // Add priority words first (up to 40 words)
    const priorityLimit = Math.min(priorityWords.length, 40);
    optimizedWords.push(...priorityWords.slice(0, priorityLimit));

    // Add regular words to fill remaining space
    const remainingSpace = maxWords - optimizedWords.length;
    if (remainingSpace > 0) {
      optimizedWords.push(...regularWords.slice(0, remainingSpace));
    }

    const optimizedPrompt = optimizedWords.join(' ');
    console.log(`✅ Optimized prompt: ${words.length} → ${optimizedWords.length} words`);

    return optimizedPrompt;
  }

  async generateMultipleStoryboards(scenes, style = 'cartoon', characterDNA = null) {
    try {
      console.log(`🐍 Creating Python SD composite storyboard for ${scenes.length} scenes...`);
      
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
      }

      // Create a single comprehensive prompt for all scenes
      const allSceneDescriptions = scenes.map((scene, index) => {
        const cameraAngle = scene.camera || 'Medium shot';
        const sceneDescription = scene.storyboardPrompt || scene.description || scene.text || scene.content;
        return `Panel ${index + 1}: ${cameraAngle} - ${characterPrompt}${sceneDescription}`;
      }).join(', ');

      const compositePrompt = `4 panel storyboard layout, ${allSceneDescriptions}`;

      const result = await this.generateStoryboardImage(
        compositePrompt,
        style,
        'storyboard_composite'
      );

      if (result.success) {
        console.log(`✅ Python SD composite storyboard generated successfully`);
        return [result.imageUrl];
      } else {
        console.warn(`⚠️ Failed to generate Python SD composite storyboard:`, result.error);
        return [];
      }

    } catch (error) {
      console.error('Error in Python SD generateMultipleStoryboards:', error);
      return [];
    }
  }

  async saveImage(imageBuffer, sceneId, style) {
    try {
      const imagesDir = path.join(__dirname, '../uploads/storyboards');
      await fs.mkdir(imagesDir, { recursive: true });
      
      const filename = `python_sd_${sceneId}_${style}_${Date.now()}.png`;
      const filepath = path.join(imagesDir, filename);
      
      await fs.writeFile(filepath, imageBuffer);
      
      return `/uploads/storyboards/${filename}`;
    } catch (error) {
      console.error('Error saving Python SD storyboard image:', error);
      throw new Error('Failed to save Python SD storyboard image');
    }
  }

  // Get service status
  async getServiceStatus() {
    try {
      const response = await axios.get(`${this.serviceUrl}/status`, {
        timeout: this.healthTimeout
      });
      return response.data;
    } catch (error) {
      return { error: error.message };
    }
  }

  // Get available models/styles
  async getAvailableStyles() {
    try {
      const response = await axios.get(`${this.serviceUrl}/models`, {
        timeout: this.healthTimeout
      });
      return response.data;
    } catch (error) {
      console.error('Error getting available styles:', error);
      return { styles: ['cartoon', 'anime', 'storybook', 'realistic'] };
    }
  }

  // Switch model (if supported)
  async switchModel(modelId) {
    try {
      const response = await axios.post(`${this.serviceUrl}/switch-model`, {
        model_id: modelId
      }, {
        timeout: 30000 // Model switching can take time
      });
      return response.data;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = { PythonStableDiffusionService };
