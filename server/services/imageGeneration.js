const { InferenceClient } = require('@huggingface/inference');
const { uploadToStorage } = require('./storage');
const { v4: uuidv4 } = require('uuid');

// Initialize Hugging Face client
const hf = new InferenceClient(process.env.HUGGING_FACE_TOKEN);

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
    const scenePrompt = `${characterDescription}, ${scene.description}, ${stylePrompt}, high quality, detailed, 4k resolution`;

    if (process.env.DEMO_MODE === 'true') {
      return generateDemoImage(scene, sceneIndex);
    }

    // Use SDXL for image generation with Hugging Face library
    const imageBlob = await hf.textToImage({
      model: 'stabilityai/stable-diffusion-xl-base-1.0',
      inputs: scenePrompt,
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
      prompt: scenePrompt
    };

  } catch (error) {
    console.warn(`Scene image generation failed for scene ${sceneIndex}, using demo:`, error.message);
    return generateDemoImage(scene, sceneIndex);
  }
}

function buildCharacterDescription(characterDNA) {
  // Extract visual features from character DNA
  // In a real implementation, this would analyze the character image
  const baseDescription = `character named ${characterDNA.name}`;
  
  // Add tags if available
  if (characterDNA.tags && characterDNA.tags.length > 0) {
    const visualTags = characterDNA.tags.filter(tag => 
      ['hair', 'eyes', 'clothes', 'style', 'color'].some(keyword => 
        tag.toLowerCase().includes(keyword)
      )
    );
    
    if (visualTags.length > 0) {
      return `${baseDescription}, ${visualTags.join(', ')}`;
    }
  }
  
  return baseDescription;
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

module.exports = {
  generateSceneImages,
  generateSingleSceneImage,
  applyStyleTransfer,
  generateBackground,
  STYLE_PRESETS
};
