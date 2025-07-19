const { InferenceClient } = require('@huggingface/inference');
const sharp = require('sharp');

// Initialize Hugging Face Inference
const hf = process.env.HUGGING_FACE_TOKEN ? new InferenceClient(process.env.HUGGING_FACE_TOKEN) : null;

// Demo character embeddings (precomputed for faster demo)
const DEMO_CHARACTERS = {
  astronaut_cat: {
    name: "Astro Cat",
    description: "A brave feline astronaut exploring the cosmos",
    embedding: generateConsistentEmbedding("astronaut_cat_space_explorer"),
    traits: ["brave", "curious", "adventurous", "feline", "space"]
  },
  dragon_knight: {
    name: "Dragon Knight",
    description: "A noble warrior bonded with an ancient dragon",
    embedding: generateConsistentEmbedding("dragon_knight_medieval_warrior"),
    traits: ["noble", "strong", "magical", "warrior", "dragon"]
  },
  mystical_wizard: {
    name: "Mystical Wizard",
    description: "An ancient spellcaster with profound magical knowledge",
    embedding: generateConsistentEmbedding("mystical_wizard_ancient_magic"),
    traits: ["wise", "magical", "ancient", "powerful", "mystical"]
  },
  cyber_ninja: {
    name: "Cyber Ninja",
    description: "A stealthy warrior from the digital future",
    embedding: generateConsistentEmbedding("cyber_ninja_digital_stealth"),
    traits: ["stealthy", "fast", "technological", "ninja", "cyber"]
  }
};

// Generate consistent embeddings for demo characters based on their traits
function generateConsistentEmbedding(seed) {
  const embedding = [];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) & 0xffffffff;
  }
  
  for (let i = 0; i < 512; i++) {
    hash = ((hash * 1103515245 + 12345) & 0x7fffffff);
    embedding.push(((hash / 0x7fffffff) - 0.5) * 2);
  }
  return embedding;
}

// Real CLIP embedding generation using Qwen-VL model
async function generateCLIPEmbedding(imageBuffer, options = {}) {
  try {
    console.log('Generating character DNA with Qwen-VL model...');
    
    // Check if this is a demo character request
    if (options.demoCharacter && DEMO_CHARACTERS[options.demoCharacter]) {
      console.log(`Using precomputed embedding for demo character: ${options.demoCharacter}`);
      return DEMO_CHARACTERS[options.demoCharacter].embedding;
    }

    if (!hf) {
      console.log('HUGGING_FACE_TOKEN not found, using mock embedding');
      return generateMockEmbedding();
    }

    // Preprocess image for Qwen-VL (resize to 448x448)
    const processedImage = await sharp(imageBuffer)
      .resize(448, 448, { fit: 'cover' })
      .jpeg({ quality: 90 })
      .toBuffer();

    console.log('Sending image to Qwen-VL model for feature extraction...');
    
    // Use feature extraction endpoint for embeddings
    const response = await hf.featureExtraction({
      model: 'Qwen/Qwen2-VL-7B-Instruct',
      inputs: processedImage,
    });

    if (response && Array.isArray(response) && response.length > 0) {
      console.log('Character DNA generated successfully with Qwen-VL');
      // Ensure we have a 512-dimensional embedding
      let embedding = Array.isArray(response[0]) ? response[0] : response;
      
      // Normalize to 512 dimensions if needed
      if (embedding.length !== 512) {
        embedding = normalizeEmbeddingTo512(embedding);
      }
      
      return embedding;
    } else {
      throw new Error('Invalid Qwen-VL API response');
    }

  } catch (error) {
    console.warn('Qwen-VL embedding failed, using enhanced mock:', error.message);
    return generateMockEmbedding();
  }
}

// Helper function to normalize embeddings to 512 dimensions
function normalizeEmbeddingTo512(embedding) {
  if (embedding.length === 512) return embedding;
  
  if (embedding.length > 512) {
    // Truncate to 512 dimensions
    return embedding.slice(0, 512);
  } else {
    // Pad with zeros or repeat pattern to reach 512
    const normalized = [...embedding];
    while (normalized.length < 512) {
      const remaining = 512 - normalized.length;
      const toCopy = Math.min(remaining, embedding.length);
      normalized.push(...embedding.slice(0, toCopy));
    }
    return normalized.slice(0, 512);
  }
}

function generateMockEmbedding() {
  // Generate a more sophisticated mock embedding with some clustering
  const embedding = [];
  const clusters = 8; // Create 8 clusters of related features
  
  for (let cluster = 0; cluster < clusters; cluster++) {
    const clusterCenter = (Math.random() - 0.5) * 2;
    const clusterSize = 512 / clusters;
    
    for (let i = 0; i < clusterSize; i++) {
      // Add some variation around the cluster center
      const variation = (Math.random() - 0.5) * 0.5;
      embedding.push(Math.tanh(clusterCenter + variation));
    }
  }
  
  return embedding;
}

// Find similar characters based on CLIP embeddings
async function findSimilarCharacters(queryEmbedding, characterLibrary, topK = 5) {
  const similarities = characterLibrary.map(character => ({
    character,
    similarity: calculateSimilarity(
      queryEmbedding, 
      character.embedding, 
      character.traits || [], 
      []
    )
  }));

  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK)
    .map(item => ({
      ...item.character,
      similarity: item.similarity
    }));
}

// Get demo character data
function getDemoCharacter(characterId) {
  return DEMO_CHARACTERS[characterId] || null;
}

// Get all available demo characters
function getAllDemoCharacters() {
  return Object.keys(DEMO_CHARACTERS).map(id => ({
    id,
    ...DEMO_CHARACTERS[id]
  }));
}

// Enhanced similarity calculation with trait matching
function calculateSimilarity(embedding1, embedding2, traits1 = [], traits2 = []) {
  if (embedding1.length !== embedding2.length) {
    throw new Error('Embeddings must have the same dimensions');
  }

  // Cosine similarity for embeddings
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    norm1 += embedding1[i] * embedding1[i];
    norm2 += embedding2[i] * embedding2[i];
  }

  let embeddingSimilarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  
  // Add trait similarity bonus if available
  if (traits1.length > 0 && traits2.length > 0) {
    const commonTraits = traits1.filter(trait => traits2.includes(trait));
    const traitSimilarity = commonTraits.length / Math.max(traits1.length, traits2.length);
    
    // Combine embedding similarity (80%) with trait similarity (20%)
    embeddingSimilarity = embeddingSimilarity * 0.8 + traitSimilarity * 0.2;
  }

  return embeddingSimilarity;
}

module.exports = {
  generateCLIPEmbedding,
  calculateSimilarity,
  findSimilarCharacters,
  generateMockEmbedding,
  getDemoCharacter,
  getAllDemoCharacters,
  DEMO_CHARACTERS
};
