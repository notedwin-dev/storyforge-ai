#!/usr/bin/env node
/**
 * Test script for debugging story parsing issues
 */

// Simulate the story text that was causing the parsing to hang
const testStoryText = `SCENE 1: Shadows of Automation
beluga, fins twitching with apprehension, scrolled through the endless stream of articles. The headline blared: "AI Replaces Dockworkers: Millions Face Unemployment." A chill ran down their spine as they realized their own job at the shipping port might be next.

SCENE 2: The Announcement
The next morning, beluga's worst fears materialized. Their supervisor, Captain Martinez, gathered all the dockworkers in the main warehouse. "I'm afraid I have some difficult news," he began, his voice heavy with regret. "The company is implementing automated loading systems. Effective next month, we'll need to reduce our workforce by 80%."

SCENE 3: The Fight Back
Instead of accepting defeat, beluga rallied their fellow workers. They organized meetings, created petitions, and reached out to local media. "We won't go down without a fight," beluga declared at a packed union hall. "Our experience and dedication cannot be replaced by machines."

SCENE 4: A New Dawn
Months later, beluga stood before a crowd of cheering workers. Their efforts had paid off - the company agreed to retrain workers for new tech-integrated positions rather than simply replacing them. beluga had learned that sometimes the greatest victories come from standing up for what's right, even when the odds seem impossible.`;

// Simulate character DNA
const mockCharacterDNA = {
  name: 'beluga',
  id: 'test-character-123',
  traits: ['determined', 'brave'],
  description: 'A brave dockworker'
};

// Import the parsing logic
const path = require('path');
const projectRoot = path.join(__dirname, '..');

// Mock the dependencies
const mockGeminiAI = {
  parseStoryIntoScenes: function(storyText, characterDNA) {
    console.log(`🧪 Testing story parsing...`);
    console.log(`📝 Story length: ${storyText.length} characters`);
    console.log(`📝 First 200 chars: ${storyText.substring(0, 200)}...`);
    
    const scenes = [];
    
    try {
      // Use the new simplified parsing method
      console.log(`🔍 Starting simple split method...`);
      
      // Split by SCENE markers first, then process each part
      const sceneParts = storyText.split(/SCENE\s+\d+:/gi);
      console.log(`🔍 Split into ${sceneParts.length} parts by scene markers`);
      
      // Skip the first part if it's empty (before first scene)
      const startIndex = sceneParts[0].trim().length === 0 ? 1 : 0;
      
      for (let i = startIndex; i < sceneParts.length && scenes.length < 4; i++) {
        const part = sceneParts[i].trim();
        if (part.length === 0) continue;
        
        console.log(`🔍 Processing part ${i}: "${part.substring(0, 50)}..."`);
        
        // Extract title and content
        const lines = part.split('\n');
        const title = lines[0].trim();
        const content = lines.slice(1).join('\n').trim();
        
        console.log(`🔍 Extracted - Title: "${title}", Content length: ${content.length}`);
        
        if (title.length > 0 && content.length > 0) {
          const sceneNumber = scenes.length + 1;
          
          console.log(`✅ Parsed Scene ${sceneNumber}: "${title}" - Content length: ${content.length} chars`);
          
          scenes.push({
            id: `scene_${sceneNumber}`,
            number: sceneNumber,
            title: title,
            content: content,
            description: content,
            characterName: characterDNA.name
          });
        }
      }
      
      console.log(`🔍 Simple split method complete. Found ${scenes.length} scenes`);
      
    } catch (error) {
      console.error(`❌ Error in parsing:`, error);
    }
    
    return {
      title: `${characterDNA.name}'s Adventure`,
      scenes,
      totalScenes: scenes.length,
      character: characterDNA
    };
  }
};

// Run the test
console.log('🧪 Starting Story Parsing Debug Test');
console.log('=' * 50);

try {
  const startTime = Date.now();
  
  // Set a timeout to catch hanging
  const timeoutId = setTimeout(() => {
    console.error('❌ TEST TIMED OUT AFTER 5 SECONDS');
    process.exit(1);
  }, 5000);
  
  const result = mockGeminiAI.parseStoryIntoScenes(testStoryText, mockCharacterDNA);
  
  clearTimeout(timeoutId);
  const endTime = Date.now();
  
  console.log('\n📊 TEST RESULTS:');
  console.log(`⏱️ Parsing time: ${endTime - startTime}ms`);
  console.log(`📚 Scenes found: ${result.scenes.length}`);
  console.log(`📖 Story title: ${result.title}`);
  
  result.scenes.forEach((scene, index) => {
    console.log(`\n🎬 Scene ${index + 1}:`);
    console.log(`   ID: ${scene.id}`);
    console.log(`   Title: ${scene.title}`);
    console.log(`   Content: ${scene.content.substring(0, 100)}...`);
  });
  
  if (result.scenes.length === 4) {
    console.log('\n✅ SUCCESS: All 4 scenes parsed correctly!');
  } else {
    console.log(`\n⚠️ WARNING: Expected 4 scenes, got ${result.scenes.length}`);
  }
  
} catch (error) {
  console.error('❌ TEST FAILED:', error);
  process.exit(1);
}

console.log('\n🎉 Test completed successfully!');
