const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class PythonStableDiffusionService {
  constructor() {
    // Python service endpoint
    this.serviceUrl = process.env.PYTHON_SD_URL || 'http://127.0.0.1:8080';
    this.enabled = process.env.USE_PYTHON_SD === 'true';
    
    // Timeout settings - reduced for faster failures
    this.healthTimeout = 3000;      // 3 seconds for health checks
    this.generateTimeout = 120000;  // 2 minutes for generation
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

  enhancePromptForStoryboard(prompt, style) {
    const baseEnhancement = 'high quality, detailed, professional storyboard panel, clear composition, sequential art';
    return `${prompt}, ${baseEnhancement}`;
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
