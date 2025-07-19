#!/usr/bin/env node
/**
 * Test script for CLIP token limit optimization
 */

function optimizePromptForCLIP(prompt, maxWords = 75) {
  // Simple word-based optimization for CLIP's ~77 token limit
  const words = prompt.split(/\s+/);
  
  if (words.length <= maxWords) {
    return { optimized: prompt, changed: false, originalWords: words.length, optimizedWords: words.length };
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
  
  return {
    optimized: optimizedPrompt,
    changed: true,
    originalWords: words.length,
    optimizedWords: optimizedWords.length,
    priorityWords: priorityWords.length,
    regularWords: regularWords.length
  };
}

// Test cases
const testPrompts = [
  // Short prompt (should not be changed)
  "cartoon style character in a forest",
  
  // Medium prompt (might be optimized)
  "cartoon style, clean lines, bright colors, comic book art, illustration, animated style, character named Alice standing in a magical enchanted forest with glowing trees and sparkling fairy lights, high quality, detailed, 4k resolution, professional, whimsical, friendly atmosphere",
  
  // Long prompt (definitely needs optimization)
  "cartoon style, clean lines, bright colors, comic book art, illustration, animated style, realistic, photograph, photorealistic, blurry, low quality, distorted, nsfw, dark, scary, character named Bob with brown hair, blue eyes, wearing red shirt, standing in a magical enchanted forest with glowing trees, sparkling fairy lights, mystical creatures, ancient ruins, flowing river, butterflies, flowers, mountains in background, sunset lighting, dramatic clouds, high quality, detailed, 4k resolution, professional composition, cinematic lighting, depth of field, bokeh effect, artistic masterpiece, award winning photography, trending on artstation, deviantart featured",
  
  // Very long story prompt
  "character named beluga, fins twitching with apprehension, scrolled through the endless stream of articles about artificial intelligence replacing workers at shipping ports, standing in industrial warehouse with massive shipping containers, cranes, dock equipment, worried expression, cartoon style, clean lines, bright colors, comic book art, illustration, animated style, high quality, detailed, professional storyboard panel, clear composition, sequential art, cinematic lighting, dramatic atmosphere, emotional storytelling, maritime setting, urban industrial background, realistic details, character development, narrative focus"
];

console.log('🧪 Testing CLIP Token Optimization');
console.log('=' * 60);

testPrompts.forEach((prompt, index) => {
  console.log(`\n📝 Test ${index + 1}:`);
  console.log(`Original: "${prompt}"`);
  console.log(`Length: ${prompt.split(' ').length} words`);
  
  const result = optimizePromptForCLIP(prompt);
  
  console.log(`\n✅ Result:`);
  console.log(`Optimized: "${result.optimized}"`);
  console.log(`📊 Stats:`);
  console.log(`  - Original words: ${result.originalWords}`);
  console.log(`  - Optimized words: ${result.optimizedWords}`);
  console.log(`  - Changed: ${result.changed ? 'Yes' : 'No'}`);
  
  if (result.changed) {
    console.log(`  - Priority words found: ${result.priorityWords}`);
    console.log(`  - Regular words: ${result.regularWords}`);
    console.log(`  - Word reduction: ${result.originalWords - result.optimizedWords} words`);
  }
  
  // Check if result is within limits
  if (result.optimizedWords <= 75) {
    console.log(`✅ Within CLIP limits (≤75 words)`);
  } else {
    console.log(`❌ Still exceeds CLIP limits (${result.optimizedWords} words)`);
  }
  
  console.log('-' * 60);
});

console.log('\n🎉 CLIP optimization test completed!');
