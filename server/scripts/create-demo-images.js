const sharp = require('sharp');
const path = require('path');

const characters = [
  { id: 'astronaut_cat', name: 'Astro Cat', color: '#4A90E2' },
  { id: 'dragon_knight', name: 'Dragon Knight', color: '#D73502' },
  { id: 'mystical_wizard', name: 'Mystical Wizard', color: '#7B68EE' },
  { id: 'cyber_ninja', name: 'Cyber Ninja', color: '#00D4AA' }
];

async function createDemoImages() {
  const outputDir = path.join(__dirname, '..', 'public', 'demo');
  
  for (const char of characters) {
    // Create main image (512x512)
    const svg = `<svg width="512" height="512">
      <rect width="512" height="512" fill="${char.color}"/>
      <text x="256" y="200" font-family="Arial" font-size="24" fill="white" text-anchor="middle">${char.name}</text>
      <text x="256" y="280" font-family="Arial" font-size="16" fill="white" text-anchor="middle">Demo Character</text>
      <circle cx="256" cy="350" r="40" fill="rgba(255,255,255,0.3)"/>
    </svg>`;
    
    await sharp(Buffer.from(svg))
      .jpeg({ quality: 90 })
      .toFile(path.join(outputDir, `${char.id}.jpg`));
    
    // Create thumbnail (256x256)
    await sharp(Buffer.from(svg))
      .resize(256, 256)
      .jpeg({ quality: 80 })
      .toFile(path.join(outputDir, `${char.id}_thumb.jpg`));
    
    console.log(`Created demo images for ${char.name}`);
  }
  
  console.log('All demo images created successfully!');
}

createDemoImages().catch(console.error);
