const { InferenceClient } = require('@huggingface/inference');

// Initialize Hugging Face client
const hf = new InferenceClient(process.env.HUGGING_FACE_TOKEN);

const GENRE_TEMPLATES = {
  fantasy: {
    settings: ['enchanted forest', 'magical kingdom', 'ancient castle', 'mystical cave'],
    elements: ['magic spells', 'mythical creatures', 'ancient prophecy', 'magical artifacts'],
    conflicts: ['evil sorcerer', 'dragon threat', 'dark curse', 'forbidden magic']
  },
  'sci-fi': {
    settings: ['space station', 'alien planet', 'futuristic city', 'starship'],
    elements: ['advanced technology', 'alien species', 'time travel', 'robot companions'],
    conflicts: ['alien invasion', 'AI rebellion', 'space pirates', 'cosmic disaster']
  },
  adventure: {
    settings: ['tropical island', 'mountain peak', 'ancient ruins', 'hidden valley'],
    elements: ['treasure hunt', 'survival challenges', 'mysterious map', 'ancient secrets'],
    conflicts: ['natural disasters', 'rival explorers', 'dangerous wildlife', 'treacherous terrain']
  },
  mystery: {
    settings: ['old mansion', 'foggy village', 'abandoned library', 'secret laboratory'],
    elements: ['hidden clues', 'mysterious disappearance', 'coded messages', 'secret passages'],
    conflicts: ['master thief', 'unsolved case', 'hidden identity', 'dangerous conspiracy']
  }
};

async function generateStory(prompt, genre = 'adventure', characterDNA) {
  try {
    console.log(`Generating story for genre: ${genre}`);
    console.log(`Character: ${characterDNA.name}`);
    console.log(`Prompt: ${prompt}`);

    if (process.env.DEMO_MODE === 'true') {
      return generateDemoStory(prompt, genre, characterDNA);
    }

    // Use Mistral 7B for story generation
    const storyPrompt = buildStoryPrompt(prompt, genre, characterDNA);
    
    const response = await hf.textGeneration({
      model: 'mistralai/Mistral-7B-Instruct-v0.1',
      inputs: storyPrompt,
      parameters: {
        max_new_tokens: 800,
        temperature: 0.7,
        top_p: 0.9,
        repetition_penalty: 1.1,
        return_full_text: false
      }
    });

    const generatedText = response.generated_text || '';
    return parseGeneratedStory(generatedText, characterDNA);

  } catch (error) {
    console.warn('Story generation failed, using demo story:', error.message);
    return generateDemoStory(prompt, genre, characterDNA);
  }
}

function buildStoryPrompt(prompt, genre, characterDNA) {
  const template = GENRE_TEMPLATES[genre] || GENRE_TEMPLATES.adventure;
  const characterName = characterDNA.name || 'the protagonist';
  
  const cameraAngles = [
    "Wide shot", "Medium shot", "Close-up", "Extreme close-up",
    "Over-the-shoulder shot", "High angle", "Low angle", "Bird's-eye view"
  ];
  
  return `You are a professional story creator. Follow this format EXACTLY or the system will fail.

Story prompt: ${prompt}
Character: ${characterName} in ${genre} genre

CRITICAL REQUIREMENT: Create EXACTLY 4 scenes - NO MORE, NO LESS

MANDATORY FORMAT - DO NOT DEVIATE:

Scene 1: [Brief title]
Camera: Wide shot
[One simple sentence describing the visual action]

Scene 2: [Brief title]
Camera: Medium shot
[One simple sentence describing the visual action]

Scene 3: [Brief title]
Camera: Close-up
[One simple sentence describing the visual action]

Scene 4: [Brief title]
Camera: Low angle
[One simple sentence describing the visual action]

FULL STORY:
[Complete detailed narrative with dialogue, character development, and rich descriptions]

IMPORTANT REMINDERS:
- EXACTLY 4 scenes only
- Each scene must have "Scene X:", "Camera:", and description
- Use different camera angles as specified above
- Keep scene descriptions simple and visual
- Full story should be detailed and complete

EXAMPLE FORMAT:
Scene 1: The Discovery
Camera: Wide shot
${characterName} explores a mysterious space station floating in the void.

Scene 2: The Investigation  
Camera: Medium shot
${characterName} carefully examines strange alien technology inside the station.

Scene 3: The Revelation
Camera: Close-up
${characterName}'s eyes widen as they realize what has been found.

Scene 4: The Escape
Camera: Low angle
${characterName} races through corridors as alarms blare around them.

FULL STORY:
[Complete story would go here...]

NOW CREATE YOUR STORY WITH EXACTLY 4 SCENES FOLLOWING THIS EXACT FORMAT:`;
}

function parseGeneratedStory(generatedText, characterDNA) {
  try {
    const scenes = [];
    let fullStory = '';
    
    console.log('Parsing generated story...');
    
    // Extract full story section
    const fullStoryMatch = generatedText.match(/FULL STORY:\s*([\s\S]+?)$/);
    if (fullStoryMatch) {
      fullStory = fullStoryMatch[1].trim();
      console.log('Found full story section');
    } else {
      console.log('No FULL STORY section found');
    }
    
    // Extract scenes with improved regex - must have "Scene X:", "Camera:", and description
    const sceneRegex = /Scene (\d+):\s*([^\n]+)\n\s*Camera:\s*([^\n]+)\n\s*([^\n]+?)(?=\n\s*Scene \d+:|\n\s*FULL STORY:|$)/g;
    let match;

    while ((match = sceneRegex.exec(generatedText)) !== null) {
      const [, sceneNum, title, camera, description] = match;
      scenes.push({
        id: `scene_${sceneNum}`,
        number: parseInt(sceneNum),
        title: title.trim(),
        camera: camera.trim(),
        description: description.trim(),
        character: characterDNA.name
      });
      console.log(`Parsed scene ${sceneNum} with camera: ${camera.trim()}`);
    }

    // Enhanced fallback parsing with predefined camera angles
    if (scenes.length === 0) {
      console.log('Using enhanced fallback parsing for scenes');
      const cameraAngles = ["Wide shot", "Medium shot", "Close-up", "Low angle"];
      
      // Try to find scene patterns and extract content
      const sceneMatches = generatedText.match(/Scene \d+:[^\n]*\n[^S]*/g);
      if (sceneMatches) {
        for (let i = 0; i < Math.min(4, sceneMatches.length); i++) {
          const sceneText = sceneMatches[i];
          const titleMatch = sceneText.match(/Scene \d+:\s*([^\n]+)/);
          const title = titleMatch ? titleMatch[1].trim() : `Scene ${i + 1}`;
          
          // Extract the description after the title
          const lines = sceneText.split('\n').filter(line => line.trim());
          const description = lines.length > 1 ? lines[1].trim() : 'Scene description';
          
          scenes.push({
            id: `scene_${i + 1}`,
            number: i + 1,
            title: title,
            camera: cameraAngles[i],
            description: description,
            character: characterDNA.name
          });
          console.log(`Fallback scene ${i + 1} with camera: ${cameraAngles[i]}`);
        }
      } else {
        // Ultimate fallback - create exactly 4 default scenes
        console.log('Creating exactly 4 default demo scenes with camera angles');
        const cameraAngles = ["Wide shot", "Medium shot", "Close-up", "Low angle"];
        for (let i = 0; i < 4; i++) {
          scenes.push({
            id: `scene_${i + 1}`,
            number: i + 1,
            title: `Scene ${i + 1}`,
            camera: cameraAngles[i],
            description: `${characterDNA.name} in an adventure scene.`,
            character: characterDNA.name
          });
        }
      }
    }

    // CRITICAL: Ensure exactly 4 scenes - trim if more, pad if fewer
    if (scenes.length > 4) {
      console.log(`Found ${scenes.length} scenes, trimming to exactly 4 scenes`);
      scenes.splice(4); // Remove scenes beyond the 4th
    } else if (scenes.length < 4) {
      console.log(`Found ${scenes.length} scenes, padding to exactly 4 scenes`);
      const cameraAngles = ["Wide shot", "Medium shot", "Close-up", "Low angle"];
      while (scenes.length < 4) {
        const sceneNum = scenes.length + 1;
        scenes.push({
          id: `scene_${sceneNum}`,
          number: sceneNum,
          title: `Scene ${sceneNum}`,
          camera: cameraAngles[sceneNum - 1],
          description: `${characterDNA.name} continues the adventure.`,
          character: characterDNA.name
        });
      }
    }

    // If no full story was extracted, use the entire text or create a summary
    if (!fullStory) {
      if (generatedText.length > 500) {
        fullStory = generatedText;
      } else {
        fullStory = `In this ${scenes.length}-scene adventure, ${characterDNA.name} embarks on an exciting journey filled with discovery, challenges, and triumph. Each scene captures a unique moment in this thrilling tale, showcasing different perspectives through carefully chosen camera angles.`;
      }
    }

    console.log(`Successfully parsed exactly ${scenes.length} scenes with camera angles`);

    return {
      title: `${characterDNA.name}'s Adventure`,
      genre: 'adventure',
      character: characterDNA.name,
      fullStory: fullStory,
      scenes: scenes, // Always exactly 4 scenes now
      metadata: {
        generated_at: new Date().toISOString(),
        word_count: generatedText.split(' ').length,
        character_dna_id: characterDNA.id
      }
    };

  } catch (error) {
    console.error('Story parsing error:', error);
    throw new Error('Failed to parse generated story');
  }
}

function generateDemoStory(prompt, genre, characterDNA) {
  const template = GENRE_TEMPLATES[genre] || GENRE_TEMPLATES.adventure;
  const characterName = characterDNA.name;

  const cameraAngles = ["Wide shot", "Medium shot", "Close-up", "Low angle"];

  const demoScenes = [
    {
      id: 'scene_1',
      number: 1,
      title: 'The Discovery',
      camera: cameraAngles[0],
      description: `${characterName} finds a glowing artifact in ${template.settings[0]}.`,
      character: characterName
    },
    {
      id: 'scene_2',
      number: 2,
      title: 'The Challenge',
      camera: cameraAngles[1],
      description: `${characterName} battles ${template.conflicts[0]} using the artifact's power.`,
      character: characterName
    },
    {
      id: 'scene_3',
      number: 3,
      title: 'The Revelation',
      camera: cameraAngles[2],
      description: `${characterName} discovers the truth about ${template.elements[1]} hidden within ${template.settings[2]}.`,
      character: characterName
    },
    {
      id: 'scene_4',
      number: 4,
      title: 'The Triumph',
      camera: cameraAngles[3],
      description: `${characterName} emerges victorious and transformed in ${template.settings[3]}.`,
      character: characterName
    }
  ];

  const demoFullStory = `In this ${genre} tale, ${characterName} embarks on an incredible journey. The adventure begins when ${characterName} finds a glowing artifact in ${template.settings[0]}, setting off a chain of events that will test their courage and determination.

As the story unfolds, ${characterName} must battle ${template.conflicts[0]} using the artifact's mysterious power. Through trials and challenges, they discover the truth about ${template.elements[1]} hidden within ${template.settings[2]}.

In the climactic finale, ${characterName} emerges victorious and transformed in ${template.settings[3]}, having learned valuable lessons about bravery, friendship, and the power within themselves.

This generated demo story showcases the ${genre} genre with its characteristic elements of ${template.elements.slice(0, 2).join(' and ')}, creating an engaging narrative that captures the essence of classic ${genre} storytelling.`;

  return {
    title: `${characterName}'s ${genre.charAt(0).toUpperCase() + genre.slice(1)} Adventure`,
    genre: genre,
    character: characterName,
    fullStory: demoFullStory,
    scenes: demoScenes,
    metadata: {
      generated_at: new Date().toISOString(),
      word_count: demoScenes.reduce((total, scene) => total + scene.description.split(' ').length, 0),
      character_dna_id: characterDNA.id,
      is_demo: true
    }
  };
}

// Generate "What if?" variations
async function generateVariation(originalStory, whatIfPrompt) {
  try {
    console.log(`Generating variation: ${whatIfPrompt}`);
    
    const variationPrompt = `Take this story and modify it based on: "${whatIfPrompt}"

Original story:
${originalStory.scenes.map((scene, i) => `Scene ${i + 1}: ${scene.title}\n${scene.description}`).join('\n\n')}

Create a variation with the same 4-scene structure but incorporating the "what if" scenario.

Variation:`;

    if (process.env.DEMO_MODE === 'true') {
      return generateDemoVariation(originalStory, whatIfPrompt);
    }

    const response = await hf.textGeneration({
      model: 'mistralai/Mistral-7B-Instruct-v0.1',
      inputs: variationPrompt,
      parameters: {
        max_new_tokens: 600,
        temperature: 0.8,
        top_p: 0.9,
        return_full_text: false
      }
    });

    const generatedText = response.generated_text || '';
    return parseGeneratedStory(generatedText, { name: originalStory.character, id: 'variation' });

  } catch (error) {
    console.warn('Variation generation failed, using demo:', error.message);
    return generateDemoVariation(originalStory, whatIfPrompt);
  }
}

function generateDemoVariation(originalStory, whatIfPrompt) {
  const cameraAngles = ["High angle", "Extreme close-up", "Bird's-eye view", "Over-the-shoulder shot"];
  
  const scenes = originalStory.scenes.map((scene, index) => ({
    ...scene,
    camera: cameraAngles[index] || scene.camera,
    description: `${scene.description} What if ${whatIfPrompt}? This changes everything.`
  }));

  const variationFullStory = `${originalStory.fullStory || originalStory.title}

VARIATION: What if ${whatIfPrompt}?

This variation explores an alternative path where ${whatIfPrompt}, fundamentally changing the narrative trajectory. The core story elements remain, but the circumstances and outcomes shift dramatically, creating new possibilities and unexpected developments that challenge both the character and the audience's expectations.`;

  return {
    ...originalStory,
    title: `${originalStory.title} - What If Variation`,
    fullStory: variationFullStory,
    scenes: scenes,
    metadata: {
      ...originalStory.metadata,
      variation_prompt: whatIfPrompt,
      is_variation: true,
      generated_at: new Date().toISOString()
    }
  };
}

module.exports = {
  generateStory,
  generateVariation,
  GENRE_TEMPLATES
};
