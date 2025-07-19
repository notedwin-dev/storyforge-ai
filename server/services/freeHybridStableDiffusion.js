const { PythonStableDiffusionService } = require('./pythonStableDiffusion');
const { StableDiffusionService } = require('./stableDiffusion');

class FreeHybridStableDiffusionService {
  constructor() {
    // Initialize services
    this.pythonSD = new PythonStableDiffusionService();
    this.cloudSD = new StableDiffusionService();
    
    // Preferences from environment
    this.preferPython = process.env.PREFER_PYTHON_SD === 'true';
    this.enableCloudFallback = process.env.ENABLE_CLOUD_FALLBACK === 'true';
    this.enablePythonSD = process.env.USE_PYTHON_SD === 'true';
    
    console.log(`🔧 Hybrid SD Service initialized:`);
    console.log(`   • Python SD: ${this.enablePythonSD ? 'ENABLED' : 'DISABLED'}`);
    console.log(`   • Prefer Python: ${this.preferPython}`);
    console.log(`   • Cloud Fallback: ${this.enableCloudFallback}`);
  }

  async getServiceStatus() {
    const status = {
      python: { available: false, cost: 'FREE', status: 'checking' },
      cloud: { available: false, cost: '$0.003-0.01 per image', status: 'checking' },
      recommendation: '',
      timestamp: new Date().toISOString()
    };

    // Check Python SD with timeout handling
    if (this.enablePythonSD) {
      try {
        console.log('🔍 Checking Python SD service...');
        const pythonCheck = await Promise.race([
          this.pythonSD.checkConnection(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Health check timeout')), 5000)
          )
        ]);
        status.python.available = pythonCheck.available;
        status.python.status = pythonCheck.status || 'unknown';
        status.python.details = pythonCheck;
        console.log(`✅ Python SD check complete: ${pythonCheck.available ? 'available' : 'unavailable'}`);
      } catch (error) {
        console.log(`⚠️ Python SD check failed: ${error.message}`);
        status.python.available = false;
        status.python.status = 'timeout';
        status.python.details = { 
          error: error.message,
          serviceUrl: this.pythonSD.serviceUrl 
        };
      }
    } else {
      status.python.status = 'disabled';
      status.python.details = { message: 'Python SD disabled in configuration' };
    }

    // Check Cloud SD
    if (this.enableCloudFallback) {
      try {
        // Simple check without actual generation
        status.cloud.available = !!process.env.HUGGING_FACE_TOKEN;
        status.cloud.status = status.cloud.available ? 'configured' : 'not_configured';
        status.cloud.details = { 
          message: status.cloud.available ? 'Hugging Face token configured' : 'No Hugging Face token configured' 
        };
      } catch (error) {
        status.cloud.available = false;
        status.cloud.status = 'error';
        status.cloud.details = { error: error.message };
      }
    } else {
      status.cloud.status = 'disabled';
      status.cloud.details = { message: 'Cloud fallback disabled in configuration' };
    }

    // Provide recommendation
    if (status.python.available) {
      status.recommendation = '🐍 Python SD is available - FREE image generation!';
      status.activeService = 'python';
    } else if (status.cloud.available) {
      status.recommendation = '☁️ Only cloud available - consider setting up Python SD for free generation';
      status.activeService = 'cloud';
    } else {
      status.recommendation = '❌ No services available - setup required';
      status.activeService = 'none';
    }

    return status;
  }

  async generateStoryboardImage(prompt, style = 'cartoon', sceneId) {
    console.log(`🎨 Hybrid generation for scene: ${sceneId}`);

    // Try Python SD first if preferred and available
    if (this.preferPython && this.enablePythonSD) {
      console.log(`🐍 Trying Python SD first (FREE)...`);
      const pythonResult = await this.pythonSD.generateStoryboardImage(prompt, style, sceneId);
      
      if (pythonResult.success) {
        console.log(`✅ Python SD generation successful - $0 cost!`);
        return pythonResult;
      } else {
        console.warn(`⚠️ Python SD failed: ${pythonResult.error}`);
      }
    }

    // Fallback to cloud if enabled
    if (this.enableCloudFallback) {
      console.log(`☁️ Falling back to cloud SD (PAID)...`);
      const cloudResult = await this.cloudSD.generateStoryboardImage(prompt, style, sceneId);
      
      if (cloudResult.success) {
        console.log(`✅ Cloud SD generation successful - ~$0.005 cost`);
        return cloudResult;
      } else {
        console.error(`❌ Cloud SD also failed: ${cloudResult.error}`);
      }
    }

    // Both failed
    return {
      success: false,
      error: 'All image generation services failed',
      sceneId,
      style,
      prompt,
      attempts: {
        python: this.enablePythonSD ? 'failed' : 'disabled',
        cloud: this.enableCloudFallback ? 'failed' : 'disabled'
      }
    };
  }

  async generateMultipleStoryboards(scenes, style = 'cartoon', characterDNA = null) {
    console.log(`🎨 Hybrid composite storyboard for ${scenes.length} scenes...`);

    // Try Python SD first if preferred and available
    if (this.preferPython && this.enablePythonSD) {
      console.log(`🐍 Trying Python SD composite (FREE)...`);
      const pythonResult = await this.pythonSD.generateMultipleStoryboards(scenes, style, characterDNA);
      
      if (pythonResult && pythonResult.length > 0) {
        console.log(`✅ Python SD composite successful - $0 cost!`);
        return pythonResult;
      } else {
        console.warn(`⚠️ Python SD composite failed`);
      }
    }

    // Fallback to cloud if enabled
    if (this.enableCloudFallback) {
      console.log(`☁️ Falling back to cloud SD composite (PAID)...`);
      const cloudResult = await this.cloudSD.generateMultipleStoryboards(scenes, style, characterDNA);
      
      if (cloudResult && cloudResult.length > 0) {
        console.log(`✅ Cloud SD composite successful - ~$0.02 cost`);
        return cloudResult;
      } else {
        console.error(`❌ Cloud SD composite also failed`);
      }
    }

    // Both failed
    console.error(`❌ All composite storyboard generation failed`);
    return [];
  }

  // Utility methods
  async getPythonServiceStatus() {
    if (!this.enablePythonSD) return { enabled: false };
    return await this.pythonSD.getServiceStatus();
  }

  async getAvailableStyles() {
    if (this.enablePythonSD) {
      return await this.pythonSD.getAvailableStyles();
    }
    // Default styles
    return { styles: ['cartoon', 'anime', 'storybook', 'realistic'] };
  }

  async switchModel(modelId) {
    if (this.enablePythonSD) {
      return await this.pythonSD.switchModel(modelId);
    }
    return { success: false, error: 'Python SD not enabled' };
  }
}

module.exports = { FreeHybridStableDiffusionService };
