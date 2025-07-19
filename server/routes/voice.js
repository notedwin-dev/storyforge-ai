const express = require('express');
const { getAvailableVoices, generateVoiceNarration } = require('../services/voiceService');

const router = express.Router();

// Get available voices
router.get('/', async (req, res) => {
  try {
    const voices = await getAvailableVoices();
    
    res.json({
      success: true,
      voices: voices,
      count: voices.length,
      languages: [...new Set(voices.map(v => v.language))]
    });

  } catch (error) {
    console.error('Get voices error:', error);
    res.status(500).json({
      error: 'Failed to retrieve voices',
      message: error.message
    });
  }
});

// Generate voice narration for a story
router.post('/narrate', async (req, res) => {
  try {
    const { text, voice_id, emotion = 'neutral', language = 'en', options = {} } = req.body;

    if (!text || !voice_id) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Text and voice_id are required'
      });
    }

    console.log(`Generating voice narration with voice: ${voice_id}`);

    const audioResult = await generateVoiceNarration(text, voice_id, emotion, options);

    res.json({
      success: true,
      audio_url: audioResult.audioUrl,
      duration: audioResult.duration,
      voice_id: voice_id,
      emotion: emotion,
      language: language,
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Voice narration error:', error);
    res.status(500).json({
      error: 'Voice narration failed',
      message: error.message
    });
  }
});

module.exports = router;
