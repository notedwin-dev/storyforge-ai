const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs').promises;
const { uploadToStorage, deleteFromStorage } = require('../services/storage');
const { generateCLIPEmbedding, getDemoCharacter, getAllDemoCharacters } = require('../services/clip');
const { removeBackground } = require('../services/imageProcessing');
const { validateImageUpload } = require('../middleware/validation');
const { optionalAuth, requireAuth } = require('../middleware/auth');
const { 
  saveCharacter, 
  getUserCharacters, 
  getCharacterById, 
  updateCharacter, 
  deleteCharacter 
} = require('../services/supabase');

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = (process.env.ALLOWED_MIME_TYPES || 'image/jpeg,image/png,image/webp').split(',');
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'), false);
    }
  }
});

router.post('/', optionalAuth, upload.single('character'), validateImageUpload, async (req, res) => {
  try {
    // Check if this is a demo character request
    if (req.body.demoCharacter && !req.file) {
      console.log(`Processing demo character request: ${req.body.demoCharacter}`);
      
      const demoCharacter = getDemoCharacter(req.body.demoCharacter);
      if (!demoCharacter) {
        return res.status(404).json({
          error: 'Demo character not found',
          message: `Character '${req.body.demoCharacter}' does not exist`
        });
      }

      // Generate character DNA using the demo character's embedding
      const embedding = await generateCLIPEmbedding(null, { demoCharacter: req.body.demoCharacter });
      
      // Generate a proper UUID for demo characters
      const demoCharacterId = uuidv4();
      
      const characterData = {
        id: req.body.demoCharacter,
        name: demoCharacter.name,
        description: demoCharacter.description,
        traits: demoCharacter.traits,
        dna_id: demoCharacterId, // Use proper UUID
        embedding: embedding,
        imageUrl: `/demo/${req.body.demoCharacter}.jpg`,
        thumbnailUrl: `/demo/${req.body.demoCharacter}_thumb.jpg`,
        createdAt: new Date().toISOString(),
        is_demo: true
      };

      return res.json({
        success: true,
        message: 'Demo character DNA generated successfully',
        dna_id: characterData.dna_id,
        character: characterData
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded',
        message: 'Please upload a character image or select a demo character'
      });
    }

    const { name, tags } = req.body;
    const characterId = uuidv4();
    const timestamp = Date.now();

    console.log(`Processing character upload: ${characterId}`);

    // Step 1: Process the image
    const processedImage = await processCharacterImage(req.file.buffer);
    
    // Step 2: Remove background (optional, can be disabled for demo)
    let finalImage = processedImage;
    if (process.env.REMOVE_BACKGROUND === 'true') {
      try {
        finalImage = await removeBackground(processedImage);
      } catch (bgError) {
        console.warn('Background removal failed, using original:', bgError.message);
      }
    }

    // Step 3: Generate CLIP embedding
    const embedding = await generateCLIPEmbedding(finalImage);

    // Step 4: Upload to S3 storage
    const imageKey = `characters/${characterId}/${timestamp}_processed.png`;
    const imageUrl = await uploadToStorage(finalImage, imageKey, 'image/png');

    // Step 5: Generate thumbnail
    const thumbnail = await sharp(finalImage)
      .resize(256, 256, { fit: 'cover' })
      .png()
      .toBuffer();
    
    const thumbnailKey = `characters/${characterId}/${timestamp}_thumb.png`;
    const thumbnailUrl = await uploadToStorage(thumbnail, thumbnailKey, 'image/png');

    // Step 6: Store character DNA data
    const characterDNA = {
      id: characterId,
      name: name || `Character_${characterId.slice(0, 8)}`,
      description: req.body.description || `A character named ${name || `Character_${characterId.slice(0, 8)}`}`,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      traits: tags ? tags.split(',').map(tag => tag.trim()).slice(0, 5) : ['adventurous', 'brave'], // Use tags as traits, limit to 5
      embedding: embedding,
      imageUrl: imageUrl,
      thumbnailUrl: thumbnailUrl,
      createdAt: new Date().toISOString(),
      originalFilename: req.file.originalname,
      processedAt: timestamp
    };

    // Save to Supabase if user is authenticated, otherwise save locally
    if (req.user) {
      try {
        const savedCharacter = await saveCharacter(req.user.id, {
          id: characterId,
          name: characterDNA.name,
          description: req.body.description || null,
          tags: characterDNA.tags,
          image_url: imageUrl,
          thumbnail_url: thumbnailUrl,
          dna_data: {
            embedding: embedding,
            originalFilename: req.file.originalname,
            processedAt: timestamp
          }
        });
        
        console.log(`Character saved to Supabase for user ${req.user.id}: ${characterId}`);
      } catch (supabaseError) {
        console.warn('Failed to save to Supabase, falling back to local storage:', supabaseError.message);
        // Fall back to local storage if Supabase fails
        const storageDir = path.join(__dirname, '../storage/characters');
        await fs.mkdir(storageDir, { recursive: true });
        await fs.writeFile(
          path.join(storageDir, `${characterId}.json`),
          JSON.stringify(characterDNA, null, 2)
        );
      }
    } else {
      // Save to local storage for anonymous users
      const storageDir = path.join(__dirname, '../storage/characters');
      await fs.mkdir(storageDir, { recursive: true });
      await fs.writeFile(
        path.join(storageDir, `${characterId}.json`),
        JSON.stringify(characterDNA, null, 2)
      );
    }

    console.log(`Character DNA created successfully: ${characterId}`);

    res.json({
      success: true,
      dna_id: characterId,
      character: {
        id: characterId,
        name: characterDNA.name,
        tags: characterDNA.tags,
        thumbnailUrl: thumbnailUrl,
        createdAt: characterDNA.createdAt
      },
      message: 'Character DNA generated successfully'
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      error: 'Upload failed',
      message: error.message
    });
  }
});

// Demo character endpoints (MUST be before /:id route)
router.get('/demo-characters', (req, res) => {
  try {
    const demoCharacters = getAllDemoCharacters();
    res.json({
      success: true,
      characters: demoCharacters
    });
  } catch (error) {
    console.error('Error fetching demo characters:', error);
    res.status(500).json({
      error: 'Failed to fetch demo characters',
      message: error.message
    });
  }
});

router.post('/demo-character', async (req, res) => {
  try {
    const { characterId } = req.body;
    
    if (!characterId) {
      return res.status(400).json({
        error: 'Character ID required',
        message: 'Please provide a valid demo character ID'
      });
    }

    const demoCharacter = getDemoCharacter(characterId);
    if (!demoCharacter) {
      return res.status(404).json({
        error: 'Demo character not found',
        message: `Character '${characterId}' does not exist`
      });
    }

    // Generate character DNA using the demo character's embedding
    const embedding = await generateCLIPEmbedding(null, { demoCharacter: characterId });
    
    // Generate a proper UUID for demo characters
    const demoCharacterDnaId = uuidv4();
    
    const characterData = {
      id: characterId,
      name: demoCharacter.name,
      description: demoCharacter.description,
      traits: demoCharacter.traits,
      dna_id: demoCharacterDnaId, // Use proper UUID
      embedding: embedding,
      imageUrl: `/demo/${characterId}.jpg`,
      thumbnailUrl: `/demo/${characterId}_thumb.jpg`,
      createdAt: new Date().toISOString(),
      is_demo: true
    };

    res.json({
      success: true,
      message: 'Demo character selected successfully',
      character: characterData
    });

  } catch (error) {
    console.error('Error selecting demo character:', error);
    res.status(500).json({
      error: 'Failed to select demo character',
      message: error.message
    });
  }
});

// Get character by ID
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Try to get from Supabase first if user is authenticated
    if (req.user) {
      try {
        const character = await getCharacterById(id, req.user.id);
        if (character) {
          return res.json({
            success: true,
            character: {
              id: character.id,
              name: character.name,
              description: character.description,
              tags: character.tags,
              thumbnailUrl: character.thumbnail_url,
              imageUrl: character.image_url,
              createdAt: character.created_at,
              isOwner: true
            }
          });
        }
      } catch (supabaseError) {
        console.warn('Supabase lookup failed, trying local storage:', supabaseError.message);
      }
    }
    
    // Fall back to local storage
    const characterPath = path.join(__dirname, '../storage/characters', `${id}.json`);
    
    try {
      const characterData = await fs.readFile(characterPath, 'utf8');
      const character = JSON.parse(characterData);
      
      res.json({
        success: true,
        character: {
          id: character.id,
          name: character.name,
          tags: character.tags,
          thumbnailUrl: character.thumbnailUrl,
          createdAt: character.createdAt,
          isOwner: false
        }
      });
    } catch (fileError) {
      res.status(404).json({
        error: 'Character not found',
        message: `Character with ID ${id} does not exist`
      });
    }
  } catch (error) {
    console.error('Get character error:', error);
    res.status(500).json({
      error: 'Failed to retrieve character',
      message: error.message
    });
  }
});

// Get user's characters (authenticated)
router.get('/my/characters', requireAuth, async (req, res) => {
  try {
    const characters = await getUserCharacters(req.user.id);
    
    // Filter out any characters that might not belong to the user
    const userOwnedCharacters = characters.filter(char => {
      return char.user_id === req.user.id && // Ensure user_id matches
             char.id &&                      // Must have valid ID
             char.name                       // Must have name
    });
    
    res.json({
      success: true,
      characters: userOwnedCharacters.map(char => ({
        id: char.id,
        dna_id: char.id, // Include dna_id for compatibility  
        name: char.name,
        description: char.description,
        tags: char.tags,
        thumbnailUrl: char.thumbnail_url,
        imageUrl: char.image_url,
        createdAt: char.created_at,
        isOwned: true // Explicitly mark as owned
      })),
      count: userOwnedCharacters.length
    });
  } catch (error) {
    console.error('Get user characters error:', error);
    res.status(500).json({
      error: 'Failed to retrieve characters',
      message: error.message
    });
  }
});

// Update character (authenticated)
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, tags } = req.body;
    
    const character = await updateCharacter(id, req.user.id, {
      name,
      description,
      tags: Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()) : [])
    });
    
    if (!character) {
      return res.status(404).json({
        error: 'Character not found',
        message: 'Character does not exist or you do not have permission to update it'
      });
    }
    
    res.json({
      success: true,
      character: {
        id: character.id,
        name: character.name,
        description: character.description,
        tags: character.tags,
        thumbnailUrl: character.thumbnail_url,
        imageUrl: character.image_url,
        createdAt: character.created_at
      },
      message: 'Character updated successfully'
    });
  } catch (error) {
    console.error('Update character error:', error);
    res.status(500).json({
      error: 'Failed to update character',
      message: error.message
    });
  }
});

// Delete character (authenticated)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const success = await deleteCharacter(id, req.user.id);
    
    if (!success) {
      return res.status(404).json({
        error: 'Character not found',
        message: 'Character does not exist or you do not have permission to delete it'
      });
    }
    
    res.json({
      success: true,
      message: 'Character deleted successfully'
    });
  } catch (error) {
    console.error('Delete character error:', error);
    res.status(500).json({
      error: 'Failed to delete character',
      message: error.message
    });
  }
});

// List all characters (combines public and user characters)
router.get('/', optionalAuth, async (req, res) => {
  try {
    let allCharacters = [];
    
    // Get user's characters from Supabase if authenticated
    if (req.user) {
      try {
        const userCharacters = await getUserCharacters(req.user.id);
        allCharacters = userCharacters.map(char => ({
          id: char.id,
          dna_id: char.id, // Include dna_id for compatibility
          name: char.name,
          description: char.description,
          tags: char.tags,
          thumbnailUrl: char.thumbnail_url,
          createdAt: char.created_at,
          isOwner: true,
          source: 'supabase'
        }));
      } catch (supabaseError) {
        console.warn('Failed to fetch user characters from Supabase:', supabaseError.message);
      }
    }
    
    // Get local characters (public/demo characters)
    try {
      const storageDir = path.join(__dirname, '../storage/characters');
      console.log(`Looking for local characters in: ${storageDir}`);
      
      const files = await fs.readdir(storageDir);
      console.log(`Found ${files.length} files in storage directory:`, files);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const characterData = await fs.readFile(path.join(storageDir, file), 'utf8');
            const character = JSON.parse(characterData);
            console.log(`Loaded local character: ${character.name} (${character.id})`);
            
            allCharacters.push({
              id: character.id,
              dna_id: character.id, // Include dna_id for compatibility
              name: character.name,
              description: character.description,
              tags: character.tags,
              thumbnailUrl: character.thumbnailUrl,
              imageUrl: character.imageUrl,
              createdAt: character.createdAt,
              isOwner: false,
              source: 'local'
            });
          } catch (parseError) {
            console.warn(`Failed to parse character file ${file}:`, parseError.message);
          }
        }
      }
    } catch (dirError) {
      console.warn('No local characters directory found or error reading:', dirError.message);
    }
    
    // Sort by creation date (newest first)
    allCharacters.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    console.log(`Returning ${allCharacters.length} total characters (${allCharacters.filter(c => c.source === 'local').length} local, ${allCharacters.filter(c => c.source === 'supabase').length} from Supabase)`);
    
    res.json({
      success: true,
      characters: allCharacters,
      count: allCharacters.length,
      userCharacterCount: allCharacters.filter(c => c.isOwner).length,
      publicCharacterCount: allCharacters.filter(c => !c.isOwner).length
    });
  } catch (error) {
    console.error('List characters error:', error);
    res.status(500).json({
      error: 'Failed to list characters',
      message: error.message
    });
  }
});

async function processCharacterImage(buffer) {
  try {
    // Auto-crop and standardize the image
    return await sharp(buffer)
      .resize(512, 512, { 
        fit: 'cover',
        position: 'center'
      })
      .png()
      .toBuffer();
  } catch (error) {
    throw new Error(`Image processing failed: ${error.message}`);
  }
}

module.exports = router;
