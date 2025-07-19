const express = require('express');
const router = express.Router();
const { GeminiStoryGenerator } = require('../services/geminiAI');
const { StableDiffusionService } = require('../services/stableDiffusion');

// Test endpoints for AI services
router.get('/test-gemini', async (req, res) => {
  try {
    const gemini = new GeminiStoryGenerator();
    
    // First check availability
    const availability = await gemini.checkAvailability();
    
    if (!availability.available && !availability.retryable) {
      return res.status(503).json({
        success: false,
        service: 'Gemini AI',
        error: availability.error,
        retryable: false,
        message: 'Gemini AI is currently unavailable'
      });
    }
    
    const testCharacter = {
      name: 'Alex',
      traits: ['brave', 'curious']
    };
    
    const testResult = await gemini.generateStory(
      'A short adventure in a magical forest',
      'fantasy',
      testCharacter,
      { length: 'short' }
    );
    
    res.json({
      success: true,
      service: 'Gemini AI',
      test: 'Story Generation',
      availability: availability.available ? 'available' : 'retried_successfully',
      result: {
        scenesGenerated: testResult.story.scenes.length,
        title: testResult.story.title,
        firstScene: testResult.story.scenes[0]?.title || 'No scenes generated',
        generationMethod: testResult.metadata?.generatedBy || 'gemini-2.0-flash'
      }
    });
  } catch (error) {
    const isOverloaded = error.message.toLowerCase().includes('overloaded');
    
    res.status(isOverloaded ? 503 : 500).json({
      success: false,
      service: 'Gemini AI',
      error: error.message,
      retryable: isOverloaded,
      suggestion: isOverloaded 
        ? 'Gemini AI is overloaded. The system will automatically use fallback story generation.'
        : 'Check your Gemini API key configuration.'
    });
  }
});

router.get('/test-huggingface', async (req, res) => {
  try {
    const sd = new StableDiffusionService();
    
    const connectionTest = await sd.testConnection();
    
    if (!connectionTest.success) {
      throw new Error(connectionTest.error);
    }
    
    res.json({
      success: true,
      service: 'Hugging Face Stable Diffusion',
      test: 'Connection Test',
      result: connectionTest
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      service: 'Hugging Face Stable Diffusion',
      error: error.message
    });
  }
});

router.get('/test-storyboard', async (req, res) => {
  try {
    const sd = new StableDiffusionService();
    
    const testPrompt = 'A brave character standing in a magical forest, cartoon style storyboard';
    const style = req.query.style || 'cartoon';
    
    console.log('Testing storyboard generation...');
    
    const result = await sd.generateStoryboardImage(testPrompt, style, 'test_scene');
    
    res.json({
      success: result.success,
      service: 'Hugging Face Stable Diffusion',
      test: 'Storyboard Generation',
      result: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      service: 'Hugging Face Stable Diffusion',
      error: error.message
    });
  }
});

router.get('/status', (req, res) => {
  const hasGeminiKey = !!process.env.GEMINI_API_KEY;
  const hasHfToken = !!process.env.HUGGING_FACE_TOKEN;
  
  res.json({
    ai_services: {
      gemini: {
        configured: hasGeminiKey,
        status: hasGeminiKey ? 'ready' : 'missing_api_key'
      },
      hugging_face: {
        configured: hasHfToken,
        status: hasHfToken ? 'ready' : 'missing_token'
      }
    },
    endpoints: [
      'GET /api/test-ai/status - Check AI service configuration',
      'GET /api/test-ai/test-gemini - Test Gemini story generation',
      'GET /api/test-ai/test-huggingface - Test HF connection',
      'GET /api/test-ai/test-storyboard?style=cartoon - Test storyboard generation'
    ]
  });
});

module.exports = router;
