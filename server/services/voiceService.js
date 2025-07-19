const axios = require('axios');
const { uploadToStorage } = require('./storage');
const { v4: uuidv4 } = require('uuid');

const VOICE_EMOTIONS = {
  neutral: { stability: 0.5, similarity_boost: 0.5 },
  happy: { stability: 0.4, similarity_boost: 0.6 },
  sad: { stability: 0.6, similarity_boost: 0.4 },
  excited: { stability: 0.3, similarity_boost: 0.7 },
  calm: { stability: 0.7, similarity_boost: 0.3 },
  dramatic: { stability: 0.4, similarity_boost: 0.6 }
};

const DEMO_VOICES = [
  {
    voice_id: 'demo_voice_1',
    name: 'Emma',
    description: 'Warm and friendly female voice',
    language: 'en',
    gender: 'female',
    age: 'young_adult',
    emotion_range: ['happy', 'excited', 'neutral']
  },
  {
    voice_id: 'demo_voice_2',
    name: 'James',
    description: 'Clear and confident male voice',
    language: 'en',
    gender: 'male',
    age: 'adult',
    emotion_range: ['neutral', 'dramatic', 'calm']
  },
  {
    voice_id: 'demo_voice_3',
    name: 'Sophie',
    description: 'Gentle storytelling voice',
    language: 'en',
    gender: 'female',
    age: 'middle_aged',
    emotion_range: ['calm', 'neutral', 'sad']
  }
];

async function getAvailableVoices() {
  try {
    if (process.env.DEMO_MODE === 'true') {
      console.log('Using demo voices (DEMO_MODE=true)');
      return DEMO_VOICES;
    }

    console.log('Fetching ElevenLabs voices from:', process.env.ELEVENLABS_BASE_URL);
    console.log('API Key available:', process.env.ELEVENLABS_API_KEY ? 'Yes' : 'No');

    const response = await axios.get(
      `${process.env.ELEVENLABS_BASE_URL}/voices`,
      {
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY
        },
        timeout: 10000
      }
    );

    console.log('ElevenLabs API response status:', response.status);
    console.log('Number of voices received:', response.data.voices?.length || 0);

    if (!response.data.voices || !Array.isArray(response.data.voices)) {
      throw new Error('Invalid response format from ElevenLabs API');
    }

    const mappedVoices = response.data.voices.map(voice => ({
      voice_id: voice.voice_id,
      name: voice.name,
      description: voice.description || '',
      language: detectLanguage(voice.name),
      gender: voice.labels?.gender || 'unknown',
      age: voice.labels?.age || 'unknown',
      emotion_range: ['neutral', 'happy', 'sad'] // Default range
    }));

    console.log('Successfully mapped ElevenLabs voices:', mappedVoices.map(v => v.name));
    return mappedVoices;

  } catch (error) {
    console.error('Failed to get ElevenLabs voices:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });

    // Check if it's an ElevenLabs API restriction
    if (error.response?.status === 401 && error.response?.data?.detail?.status === 'detected_unusual_activity') {
      console.warn('ElevenLabs API restricted due to unusual activity. Using demo voices.');
    }

    console.warn('Falling back to demo voices');
    return DEMO_VOICES;
  }
}

async function generateVoiceNarration(text, voiceId, emotion = 'neutral', options = {}) {
  try {
    console.log(`Generating voice narration with voice: ${voiceId}, emotion: ${emotion}`);
    
    // Check if it's a demo voice ID or demo mode is enabled
    if (process.env.DEMO_MODE === 'true' || voiceId.startsWith('demo_voice_')) {
      return generateDemoVoice(text, voiceId, emotion);
    }

    const voiceSettings = {
      ...VOICE_EMOTIONS[emotion] || VOICE_EMOTIONS.neutral,
      ...options.voice_settings
    };

    const requestUrl = `${process.env.ELEVENLABS_BASE_URL}/text-to-speech/${voiceId}`;
    const requestHeaders = {
      'xi-api-key': process.env.ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg'
    };

    console.log('Making ElevenLabs request to:', requestUrl);
    console.log('Headers:', { ...requestHeaders, 'xi-api-key': requestHeaders['xi-api-key']?.substring(0, 10) + '...' });

    const response = await axios.post(
      requestUrl,
      {
        text: text,
        model_id: options.model_id || 'eleven_monolingual_v1',
        voice_settings: voiceSettings
      },
      {
        headers: requestHeaders,
        responseType: 'arraybuffer',
        timeout: 30000
      }
    );

    // Upload audio to S3
    const audioKey = `audio/narration_${uuidv4()}.mp3`;
    const audioUrl = await uploadToStorage(
      Buffer.from(response.data), 
      audioKey, 
      'audio/mpeg'
    );

    // Estimate duration (rough calculation)
    const estimatedDuration = estimateAudioDuration(text);

    return {
      audioUrl: audioUrl,
      duration: estimatedDuration,
      voice_id: voiceId,
      emotion: emotion,
      text_length: text.length,
      generated_at: new Date().toISOString()
    };

  } catch (error) {
    console.warn('Voice generation failed:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });

    // Check if it's an ElevenLabs API restriction
    if (error.response?.status === 401 && error.response?.data?.detail?.status === 'detected_unusual_activity') {
      console.warn('ElevenLabs API restricted due to unusual activity. Using demo voice.');
    }

    console.log('Falling back to demo voice generation');
    return generateDemoVoice(text, voiceId, emotion);
  }
}

async function generateStoryNarration(story, voiceId, options = {}) {
  try {
    console.log(`Generating full story narration for: ${story.title}`);
    
    const narrativeText = buildNarrativeText(story);
    const sceneNarrations = [];

    // Generate narration for each scene
    for (let i = 0; i < story.scenes.length; i++) {
      const scene = story.scenes[i];
      const sceneEmotion = detectSceneEmotion(scene);
      
      console.log(`Narrating scene ${i + 1}: ${scene.title} (${sceneEmotion})`);
      
      const sceneText = `${scene.title}. ${scene.description}`;
      const narration = await generateVoiceNarration(
        sceneText, 
        voiceId, 
        sceneEmotion, 
        options
      );
      
      sceneNarrations.push({
        scene_id: scene.id,
        scene_number: i + 1,
        audio_url: narration.audioUrl,
        duration: narration.duration,
        emotion: sceneEmotion,
        text: sceneText
      });
    }

    return {
      story_title: story.title,
      voice_id: voiceId,
      total_duration: sceneNarrations.reduce((sum, scene) => sum + scene.duration, 0),
      scenes: sceneNarrations,
      generated_at: new Date().toISOString()
    };

  } catch (error) {
    console.error('Story narration error:', error);
    throw new Error(`Failed to generate story narration: ${error.message}`);
  }
}

function buildNarrativeText(story) {
  const intro = `This is the story of ${story.character}: ${story.title}.`;
  const sceneTexts = story.scenes.map((scene, index) => 
    `Chapter ${index + 1}: ${scene.title}. ${scene.description}`
  );
  const outro = 'And so ends our tale.';
  
  return [intro, ...sceneTexts, outro].join('\n\n');
}

function detectSceneEmotion(scene) {
  const text = `${scene.title} ${scene.description}`.toLowerCase();
  
  const emotionKeywords = {
    happy: ['joy', 'celebration', 'victory', 'triumph', 'smile', 'laugh', 'cheerful'],
    sad: ['sorrow', 'loss', 'tragedy', 'tears', 'mourn', 'defeat', 'melancholy'],
    excited: ['adventure', 'discovery', 'amazing', 'incredible', 'thrilling', 'exciting'],
    dramatic: ['battle', 'conflict', 'danger', 'intense', 'struggle', 'dramatic'],
    calm: ['peaceful', 'quiet', 'serene', 'gentle', 'soft', 'tranquil']
  };

  let maxScore = 0;
  let detectedEmotion = 'neutral';

  for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
    const score = keywords.reduce((count, keyword) => {
      return count + (text.split(keyword).length - 1);
    }, 0);

    if (score > maxScore) {
      maxScore = score;
      detectedEmotion = emotion;
    }
  }

  return detectedEmotion;
}

function estimateAudioDuration(text) {
  // Rough estimation: average speaking rate is ~150 words per minute
  const wordCount = text.split(/\s+/).length;
  const durationMinutes = wordCount / 150;
  return Math.max(1, Math.round(durationMinutes * 60)); // Duration in seconds
}

function detectLanguage(voiceName) {
  // Simple heuristic based on voice name
  const languageHints = {
    'en': ['alice', 'bob', 'charlie', 'diana', 'edward', 'fiona'],
    'es': ['carlos', 'maria', 'jose', 'ana', 'luis', 'carmen'],
    'fr': ['pierre', 'marie', 'jean', 'claire', 'antoine', 'sophie'],
    'de': ['hans', 'greta', 'wolfgang', 'ingrid', 'klaus', 'heidi'],
    'jp': ['akira', 'yuki', 'hiroshi', 'sakura', 'takeshi', 'miku']
  };

  const lowerName = voiceName.toLowerCase();
  
  for (const [lang, names] of Object.entries(languageHints)) {
    if (names.some(name => lowerName.includes(name))) {
      return lang;
    }
  }
  
  return 'en'; // Default to English
}

async function generateDemoVoice(text, voiceId, emotion) {
  // Return mock audio URL for demo
  const mockAudioUrl = 'https://www.soundjay.com/misc/sounds/magic-chime-02.wav';
  
  return {
    audioUrl: mockAudioUrl,
    duration: estimateAudioDuration(text),
    voice_id: voiceId,
    emotion: emotion,
    text_length: text.length,
    generated_at: new Date().toISOString(),
    is_demo: true
  };
}

// Convert text to speech-optimized format
function optimizeTextForSpeech(text) {
  return text
    .replace(/\n+/g, '. ') // Replace line breaks with periods
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/[^\w\s.,!?;:-]/g, '') // Remove special characters
    .trim();
}

module.exports = {
  getAvailableVoices,
  generateVoiceNarration,
  generateStoryNarration,
  detectSceneEmotion,
  optimizeTextForSpeech,
  VOICE_EMOTIONS
};
