const { uploadToStorage } = require('./storage');
const path = require('path');
const fs = require('fs').promises;

async function generateVideo(sceneImages, story, options = {}) {
  try {
    console.log('Starting video generation with VEO3-Free...');
    
    const {
      duration = 4,
      width = 832,
      height = 480,
      includeAudio = true,
      motionIntensity = 'subtle'
    } = options;

    if (process.env.DEMO_MODE === 'true') {
      return generateDemoVideo(sceneImages, story, options);
    }

    // Build video prompt from story
    const videoPrompt = buildVideoPrompt(story, options);
    const negativePrompt = buildNegativePrompt(motionIntensity);
    
    console.log(`🎬 Generating video with prompt: ${videoPrompt}`);
    console.log(`📐 Resolution: ${width}x${height}, Duration: ${duration}s`);

    // Connect to VEO3-Free API using dynamic import
    const { Client } = await import('@gradio/client');
    const client = await Client.connect("ginigen/VEO3-Free");
    
    const result = await client.predict("/generate_video_with_audio", {
      prompt: videoPrompt,
      nag_negative_prompt: negativePrompt,
      nag_scale: 11,
      height: height,
      width: width,
      duration_seconds: duration,
      steps: 4,
      seed: 2025,
      randomize_seed: true,
      enable_audio: includeAudio,
      audio_negative_prompt: "music",
      audio_steps: 25,
      audio_cfg_strength: 4.5,
    });

    console.log('✅ VEO3-Free API response received');
    
    // result.data[0] contains the video file path/URL
    // result.data[1] contains the seed used
    const videoData = result.data[0];
    const usedSeed = result.data[1];
    
    // Handle the video file - VEO3 returns a file path, we need to process it
    let videoUrl;
    
    if (typeof videoData === 'string' && videoData.startsWith('http')) {
      // If it's already a URL, use it directly
      videoUrl = videoData;
    } else {
      // If it's a file path, we need to read and upload it
      const videoBuffer = await fs.readFile(videoData);
      const videoKey = `videos/veo3_${Date.now()}_story.mp4`;
      videoUrl = await uploadToStorage(videoBuffer, videoKey, 'video/mp4');
    }

    return {
      videoUrl: videoUrl,
      duration: duration,
      width: width,
      height: height,
      audio_enabled: includeAudio,
      seed_used: usedSeed,
      generated_at: new Date().toISOString(),
      model: 'VEO3-Free'
    };

  } catch (error) {
    console.error('VEO3-Free video generation failed:', error.message);
    console.warn('Falling back to demo video...');
    return generateDemoVideo(sceneImages, story, options);
  }
}

function buildVideoPrompt(story, options) {
  // Create a comprehensive video prompt from the story
  const characterInfo = story.character || 'main character';
  const storyTitle = story.title || 'story';
  const scenes = story.scenes || [];
  
  // Build a narrative prompt for video generation
  let prompt = `A ${options.style || 'cinematic'} video story: "${storyTitle}". `;
  
  if (typeof characterInfo === 'object') {
    prompt += `Featuring ${characterInfo.name || 'the main character'}`;
    if (characterInfo.description) {
      prompt += `, ${characterInfo.description}`;
    }
    prompt += '. ';
  } else {
    prompt += `Featuring ${characterInfo}. `;
  }
  
  // Add scene descriptions
  if (scenes.length > 0) {
    const sceneDescriptions = scenes.slice(0, 3).map((scene, index) => {
      return `Scene ${index + 1}: ${scene.description || scene.text || scene.content}`;
    }).join('. ');
    
    prompt += sceneDescriptions;
  }
  
  // Add style and mood
  const mood = detectMood(scenes);
  prompt += `. ${mood} mood, high quality, cinematic lighting, smooth camera movement.`;
  
  return prompt;
}

function buildNegativePrompt(motionIntensity = 'subtle') {
  const baseNegative = "Static, motionless, still, ugly, bad quality, worst quality, poorly drawn, low resolution, blurry, lack of details";
  
  if (motionIntensity === 'subtle') {
    return baseNegative + ", jerky movement, fast motion, rapid cuts";
  } else if (motionIntensity === 'dynamic') {
    return baseNegative + ", slow motion, static shots";
  }
  
  return baseNegative;
}

function generateMotionDescription(scene, intensity = 'subtle') {
  const motionEffects = {
    subtle: [
      'gentle breeze effects',
      'soft lighting changes',
      'slight camera movement',
      'ambient particle effects'
    ],
    moderate: [
      'character blinking',
      'hair movement',
      'environmental motion',
      'dynamic lighting'
    ],
    dynamic: [
      'dramatic camera moves',
      'action sequences',
      'environmental effects',
      'character gestures'
    ]
  };

  const effects = motionEffects[intensity] || motionEffects.subtle;
  
  // Analyze scene description for appropriate motion
  const sceneText = scene.description.toLowerCase();
  
  if (sceneText.includes('wind') || sceneText.includes('breeze')) {
    return 'gentle wind effects, hair and cloth movement';
  }
  if (sceneText.includes('battle') || sceneText.includes('fight')) {
    return 'dynamic action, movement, dramatic effects';
  }
  if (sceneText.includes('magic') || sceneText.includes('spell')) {
    return 'magical particle effects, glowing elements';
  }
  if (sceneText.includes('water') || sceneText.includes('ocean')) {
    return 'water movement, waves, ripples';
  }
  
  return effects[Math.floor(Math.random() * effects.length)];
}

function detectMood(scenes) {
  const moodKeywords = {
    happy: ['joy', 'celebration', 'victory', 'triumph', 'smile', 'laugh'],
    sad: ['sorrow', 'loss', 'tragedy', 'tears', 'mourn', 'defeat'],
    mysterious: ['mystery', 'secret', 'hidden', 'unknown', 'shadow', 'whisper'],
    adventurous: ['adventure', 'journey', 'explore', 'discover', 'quest', 'travel'],
    dramatic: ['conflict', 'battle', 'struggle', 'challenge', 'danger', 'intense']
  };

  const sceneText = scenes.map(scene => scene.description.toLowerCase()).join(' ');
  
  let maxScore = 0;
  let dominantMood = 'neutral';
  
  for (const [mood, keywords] of Object.entries(moodKeywords)) {
    const score = keywords.reduce((count, keyword) => {
      return count + (sceneText.split(keyword).length - 1);
    }, 0);
    
    if (score > maxScore) {
      maxScore = score;
      dominantMood = mood;
    }
  }
  
  return dominantMood;
}

async function generateDemoVideo(sceneImages, story, options) {
  // For demo, create a mock video URL
  const mockVideoUrl = 'https://sample-videos.com/zip/10/mp4/SampleVideo_640x360_1mb.mp4';
  
  // In a real demo, you might want to create an actual video from the images
  // using a simple video creation library or pre-rendered demo videos
  
  return {
    videoUrl: mockVideoUrl,
    duration: options.duration || 4,
    width: options.width || 832,
    height: options.height || 480,
    audio_enabled: options.includeAudio || true,
    generated_at: new Date().toISOString(),
    model: 'Demo',
    is_demo: true
  };
}

// Add background music to video - VEO3 handles this internally
async function addBackgroundMusic(videoUrl, moodType = 'neutral') {
  console.log(`VEO3-Free already includes audio generation based on mood: ${moodType}`);
  
  return {
    videoUrl: videoUrl,
    music_added: true,
    mood: moodType,
    note: 'Audio generated by VEO3-Free during video creation'
  };
}

// Create video thumbnail
async function generateVideoThumbnail(videoUrl, sceneImages) {
  try {
    // Use the first scene image as thumbnail
    return {
      thumbnailUrl: sceneImages[0]?.url || 'default_thumbnail.jpg',
      generated_at: new Date().toISOString()
    };
  } catch (error) {
    console.error('Thumbnail generation error:', error);
    return {
      thumbnailUrl: 'default_thumbnail.jpg',
      error: error.message
    };
  }
}

module.exports = {
  generateVideo,
  addBackgroundMusic,
  generateVideoThumbnail,
  generateMotionDescription,
  detectMood
};
