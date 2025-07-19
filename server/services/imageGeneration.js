const { InferenceClient } = require('@huggingface/inference');
const { uploadToStorage } = require('./storage');
const { v4: uuidv4 } = require('uuid');
const { PythonStableDiffusionService } = require('./pythonStableDiffusion');

// Initialize services
const hf = new InferenceClient(process.env.HUGGING_FACE_TOKEN);
const pythonSD = new PythonStableDiffusionService();

const STYLE_PRESETS = {
  cartoon: 'cartoon style, animated, vibrant colors, friendly, family-friendly',
  watercolor: 'watercolor painting, soft brushstrokes, artistic, dreamy, painted texture',
  cinematic: 'cinematic photography, dramatic lighting, realistic, movie scene, high quality',
  anime: 'anime style, manga art, Japanese animation, detailed characters',
  storybook: 'children\'s book illustration, whimsical, hand-drawn, colorful'
};

async function generateSceneImages(scenes, characterDNA, style = 'cartoon') {
  try {
    console.log(`Generating ${scenes.length} scene images in ${style} style`);
    
    const sceneImages = [];
    const stylePrompt = STYLE_PRESETS[style] || STYLE_PRESETS.cartoon;

    for (let i = 0; i < scenes.length; i++) {
      console.log(`Generating image for scene ${i + 1}: ${scenes[i].title}`);
      
      const imageResult = await generateSingleSceneImage(
        scenes[i], 
        characterDNA, 
        stylePrompt,
        i
      );
      
      sceneImages.push({
        scene_id: scenes[i].id,
        scene_number: i + 1,
        url: imageResult.url,
        prompt: imageResult.prompt,
        style: style
      });
    }

    return sceneImages;

  } catch (error) {
    console.error('Scene image generation error:', error);
    throw new Error(`Failed to generate scene images: ${error.message}`);
  }
}

async function generateSingleSceneImage(scene, characterDNA, stylePrompt, sceneIndex) {
  try {
    // Build comprehensive prompt for consistent character rendering
    const characterDescription = buildCharacterDescription(characterDNA);
    const fullScenePrompt = `${characterDescription}, ${scene.description}, ${stylePrompt}, high quality, detailed, 4k resolution`;

    // Optimize prompt for CLIP token limits
    const optimizedPrompt = optimizePromptForCLIP(fullScenePrompt);

    if (process.env.DEMO_MODE === 'true') {
      return generateDemoImage(scene, sceneIndex);
    }

    console.log(`🎨 Generating scene ${sceneIndex + 1} with optimized prompt (${optimizedPrompt.split(' ').length} words)`);

    // Use SDXL for image generation with Hugging Face library
    const imageBlob = await hf.textToImage({
      model: 'stabilityai/stable-diffusion-xl-base-1.0',
      inputs: optimizedPrompt,
      parameters: {
        negative_prompt: 'blurry, low quality, distorted, ugly, bad anatomy, extra limbs',
        num_inference_steps: 25,
        guidance_scale: 7.5,
        width: 768,
        height: 512
      }
    });

    // Convert blob to buffer
    const imageBuffer = Buffer.from(await imageBlob.arrayBuffer());

    // Upload generated image to S3
    const imageKey = `scenes/${characterDNA.id}/${scene.id}_${Date.now()}.png`;
    const imageUrl = await uploadToStorage(imageBuffer, imageKey, 'image/png');

    return {
      url: imageUrl,
      prompt: optimizedPrompt,
      originalPromptWords: fullScenePrompt.split(' ').length,
      optimizedPromptWords: optimizedPrompt.split(' ').length,
      promptOptimized: fullScenePrompt.split(' ').length > optimizedPrompt.split(' ').length
    };

  } catch (error) {
    console.warn(`Scene image generation failed for scene ${sceneIndex}, using demo:`, error.message);
    return generateDemoImage(scene, sceneIndex);
  }
}

function buildCharacterDescription(characterDNA) {
  // Extract visual features from character DNA (optimized for CLIP token limits)
  const baseDescription = `character named ${characterDNA.name}`;
  
  // Add tags if available (limit to top 3 visual tags)
  if (characterDNA.tags && characterDNA.tags.length > 0) {
    const visualTags = characterDNA.tags.filter(tag => 
      ['hair', 'eyes', 'clothes', 'style', 'color'].some(keyword => 
        tag.toLowerCase().includes(keyword)
      )
    );
    
    if (visualTags.length > 0) {
      // Limit to 3 most important visual tags to save tokens
      return `${baseDescription}, ${visualTags.slice(0, 3).join(', ')}`;
    }
  }
  
  return baseDescription;
}

function optimizePromptForCLIP(prompt, maxWords = 75) {
  // Simple word-based optimization for CLIP's ~77 token limit
  const words = prompt.split(/\s+/);

  if (words.length <= maxWords) {
    return prompt;
  }

  console.log(`⚠️ Prompt too long (${words.length} words), optimizing for CLIP...`);

  // Priority keywords for image generation
  const priorityKeywords = [
    'character', 'scene', 'story', 'cartoon', 'anime', 'illustration',
    'high quality', 'detailed', 'clean', 'bright', 'friendly',
    'cinematic', 'storybook', 'watercolor', 'vibrant'
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

async function generateDemoImage(scene, sceneIndex) {
  // Return placeholder images for demo
  const demoImages = [
    'https://picsum.photos/768/512?random=1',
    'https://picsum.photos/768/512?random=2',
    'https://picsum.photos/768/512?random=3',
    'https://picsum.photos/768/512?random=4'
  ];

  return {
    url: demoImages[sceneIndex % demoImages.length],
    prompt: `Demo image for ${scene.title}: ${scene.description}`
  };
}

// Apply style transfer to existing images
async function applyStyleTransfer(imageUrl, targetStyle) {
  try {
    console.log(`Applying style transfer: ${targetStyle}`);
    
    if (process.env.DEMO_MODE === 'true') {
      return {
        url: imageUrl, // Return original for demo
        style: targetStyle,
        processed_at: new Date().toISOString()
      };
    }

    // In production, use a style transfer model
    const stylePrompt = STYLE_PRESETS[targetStyle] || targetStyle;
    
    // Use Hugging Face for style transfer
    // Note: This is a conceptual implementation, as style transfer models vary
    const styledImageBlob = await hf.textToImage({
      model: 'runwayml/stable-diffusion-v1-5', // Alternative for style transfer
      inputs: `${stylePrompt}, based on reference image`,
      parameters: {
        guidance_scale: 7.5,
        num_inference_steps: 20
      }
    });

    // Convert blob to buffer and upload
    const styledBuffer = Buffer.from(await styledImageBlob.arrayBuffer());
    const imageKey = `styled/${Date.now()}_${targetStyle}.png`;
    const styledImageUrl = await uploadToStorage(styledBuffer, imageKey, 'image/png');

    return {
      url: styledImageUrl,
      style: targetStyle,
      processed_at: new Date().toISOString()
    };

  } catch (error) {
    console.error('Style transfer error:', error);
    throw new Error(`Style transfer failed: ${error.message}`);
  }
}

// Generate background for scenes
async function generateBackground(scene, environment) {
  try {
    const backgroundPrompt = `${environment}, background scene, no characters, ${scene.description}, cinematic lighting, detailed environment`;

    if (process.env.DEMO_MODE === 'true') {
      return {
        url: `https://picsum.photos/768/512?random=${Date.now()}`,
        environment: environment
      };
    }

    // Use Hugging Face library for background generation
    const backgroundBlob = await hf.textToImage({
      model: 'stabilityai/stable-diffusion-xl-base-1.0',
      inputs: backgroundPrompt,
      parameters: {
        negative_prompt: 'people, characters, faces, humans, animals',
        num_inference_steps: 20,
        guidance_scale: 7.0,
        width: 768,
        height: 512
      }
    });

    // Convert blob to buffer
    const backgroundBuffer = Buffer.from(await backgroundBlob.arrayBuffer());
    const backgroundKey = `backgrounds/${scene.id}_${Date.now()}.png`;
    const backgroundUrl = await uploadToStorage(backgroundBuffer, backgroundKey, 'image/png');

    return {
      url: backgroundUrl,
      environment: environment
    };

  } catch (error) {
    console.error('Background generation error:', error);
    throw new Error(`Background generation failed: ${error.message}`);
  }
}

async function generateCharacterConsistentScenes(scenes, characterDNA, style = 'cartoon') {
  try {
    console.log(`🎭 Generating ${scenes.length} character-consistent scenes in ${style} style`);
    console.log(`👤 Character: ${characterDNA.name}`);

    // Check if Python SD service is available
    const connectionCheck = await pythonSD.checkConnection();
    if (!connectionCheck.available) {
      console.warn('⚠️ Python SD service not available, falling back to standard generation');
      return await generateSceneImages(scenes, characterDNA, style);
    }

    const sceneImages = [];

    // Step 1: Generate character portrait for consistency
    console.log('📸 Step 1: Generating character portrait...');
    const portraitResult = await pythonSD.generateCharacterPortrait(characterDNA, style);

    if (!portraitResult.success) {
      console.warn('⚠️ Character portrait generation failed, falling back to standard generation');
      return await generateSceneImages(scenes, characterDNA, style);
    }

    console.log(`✅ Character portrait generated successfully`);

    // Step 2: Generate each scene using the character for consistency
    console.log(`🎬 Step 2: Generating ${scenes.length} scenes with character consistency...`);

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      console.log(`🎬 Generating scene ${i + 1}/${scenes.length}: ${scene.title}`);

      try {
        const sceneResult = await pythonSD.generateSceneWithCharacter(
          scene.description,
          characterDNA,
          style,
          scene.id || `scene_${i + 1}`,
          0.7 // Good balance between consistency and variety
        );

        if (sceneResult.success) {
          sceneImages.push({
            scene_id: scene.id,
            scene_number: i + 1,
            url: sceneResult.imageUrl,
            prompt: sceneResult.prompt,
            style: style,
            character_based: true,
            strength: sceneResult.strength,
            metadata: sceneResult.metadata
          });
          console.log(`✅ Scene ${i + 1} generated successfully`);
        } else {
          console.warn(`⚠️ Scene ${i + 1} failed, generating fallback...`);
          // Fallback to standard generation for this scene
          const fallbackResult = await generateSingleSceneImage(scene, characterDNA, STYLE_PRESETS[style] || STYLE_PRESETS.cartoon, i);
          sceneImages.push({
            scene_id: scene.id,
            scene_number: i + 1,
            url: fallbackResult.url,
            prompt: fallbackResult.prompt,
            style: style,
            character_based: false,
            fallback: true
          });
        }
      } catch (sceneError) {
        console.warn(`⚠️ Scene ${i + 1} generation error, using fallback:`, sceneError.message);
        // Fallback to standard generation
        const fallbackResult = await generateSingleSceneImage(scene, characterDNA, STYLE_PRESETS[style] || STYLE_PRESETS.cartoon, i);
        sceneImages.push({
          scene_id: scene.id,
          scene_number: i + 1,
          url: fallbackResult.url,
          prompt: fallbackResult.prompt,
          style: style,
          character_based: false,
          fallback: true
        });
      }
    }

    const successfulScenes = sceneImages.filter(scene => scene.character_based).length;
    const totalScenes = sceneImages.length;

    console.log(`🎉 Character-consistent generation complete!`);
    console.log(`📊 Results: ${successfulScenes}/${totalScenes} scenes with character consistency`);

    return sceneImages;

  } catch (error) {
    console.error('Character-consistent scene generation error:', error);
    console.warn('⚠️ Falling back to standard scene generation');
    // Fallback to standard generation
    return await generateSceneImages(scenes, characterDNA, style);
  }
}

module.exports = {
  generateSceneImages,
  generateSingleSceneImage,
  generateCharacterConsistentScenes, // New function for character consistency
  applyStyleTransfer,
  generateBackground,
  STYLE_PRESETS
};
