const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { requireAuth } = require('../middleware/auth');
const { saveGeneration, getUserGenerations, updateGeneration } = require('../services/supabase');

const router = express.Router();

// Save a story to user's account
router.post('/save', requireAuth, async (req, res) => {
  try {
    const { jobId, visibility, title, description } = req.body;

    if (!jobId) {
      return res.status(400).json({
        error: 'Missing jobId',
        message: 'Job ID is required to save story'
      });
    }

    // Load the job result
    const resultPath = path.join(__dirname, '../storage/results', `${jobId}.json`);
    let jobResult;
    
    try {
      const resultData = await fs.readFile(resultPath, 'utf8');
      jobResult = JSON.parse(resultData);
    } catch (error) {
      console.error('Failed to load job result:', error);
      return res.status(404).json({
        error: 'Story not found',
        message: 'Could not find the story to save'
      });
    }

    // Load the original job data to get dna_id
    const jobPath = path.join(__dirname, '../storage/jobs', `${jobId}.json`);
    let jobData;
    
    try {
      const jobFileData = await fs.readFile(jobPath, 'utf8');
      jobData = JSON.parse(jobFileData);
    } catch (error) {
      console.error('Failed to load job data:', error);
      // Continue without job data, use fallback
      jobData = {};
    }

    // Validate and get character ID - prefer UUID format
    const validateUUID = (str) => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return uuidRegex.test(str);
    };

    let characterId = 'unknown';
    if (jobData.dna_id && validateUUID(jobData.dna_id)) {
      characterId = jobData.dna_id;
      console.log(`Using valid UUID character ID: ${characterId}`);
    } else if (jobData.dna_id) {
      console.log(`Warning: dna_id "${jobData.dna_id}" is not a valid UUID, saving as text`);
      characterId = jobData.dna_id; // Keep the original value even if not UUID format
    } else {
      console.log(`Fallback: Using character name as ID: ${jobResult.metadata?.character_name}`);
      characterId = jobResult.metadata?.character_name || 'unknown';
    }

    // Prepare generation data for Supabase
    const generationData = {
      jobId: jobId,
      characterId: characterId,
      prompt: title || 'Saved Story',
      style: jobResult.metadata?.style || 'cartoon',
      genre: jobResult.metadata?.genre || 'adventure',
      status: 'completed',
      progress: 100,
      result: {
        ...jobResult,
        visibility: visibility || 'private',
        title: title || jobResult.story?.title || 'Untitled Story',
        description: description || 'AI Generated Story',
        savedAt: new Date().toISOString()
      }
    };

    // Save to Supabase
    const savedGeneration = await saveGeneration(req.user.id, generationData);
    
    if (!savedGeneration) {
      // Fallback to local storage if Supabase fails
      const savedStoriesDir = path.join(__dirname, '../storage/saved-stories');
      await fs.mkdir(savedStoriesDir, { recursive: true });
      
      const savedStoryData = {
        id: jobId,
        userId: req.user.id,
        ...generationData,
        savedAt: new Date().toISOString()
      };
      
      await fs.writeFile(
        path.join(savedStoriesDir, `${jobId}.json`),
        JSON.stringify(savedStoryData, null, 2)
      );
      
      console.log('Story saved locally as fallback');
    }

    res.json({
      success: true,
      message: `Story saved as ${visibility}`,
      storyId: jobId,
      visibility: visibility
    });

  } catch (error) {
    console.error('Save story error:', error);
    res.status(500).json({
      error: 'Failed to save story',
      message: error.message
    });
  }
});

// Get local stories (for development - no auth required)
router.get('/local', async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    // Read from local storage results directory
    const resultsDir = path.join(__dirname, '../storage/results');

    try {
      const files = await fs.readdir(resultsDir);
      const stories = [];

      for (const file of files.slice(offset, offset + limit)) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(resultsDir, file);
            const data = await fs.readFile(filePath, 'utf8');
            const result = JSON.parse(data);

            stories.push({
              id: file.replace('.json', ''),
              title: result.story?.title || 'Untitled Story',
              content: result.story?.content || result.story?.story || '',
              type: result.story?.type || 'adventure',
              estimatedDuration: result.metadata?.estimated_duration || '10-15 min',
              characters: result.story?.characters || [],
              scenes: result.story?.scenes || [],
              sceneUrls: result.story?.sceneUrls || [],
              storyboardUrls: result.storyboard_urls || [],
              videoUrl: result.video_url,
              audio_narration: result.audio_narration,
              createdAt: result.metadata?.generated_at || new Date().toISOString(),
              metadata: result.metadata
            });
          } catch (fileError) {
            console.warn(`Failed to read story file ${file}:`, fileError.message);
          }
        }
      }

      // Sort by creation date (newest first)
      stories.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      return res.json({
        success: true,
        stories: stories,
        count: stories.length,
        total: files.filter(f => f.endsWith('.json')).length
      });

    } catch (dirError) {
      console.warn('Results directory not found, returning empty stories list');
      return res.json({
        success: true,
        stories: [],
        count: 0,
        total: 0
      });
    }

  } catch (error) {
    console.error('Error fetching local stories:', error);
    res.status(500).json({
      error: 'Failed to fetch stories',
      message: error.message
    });
  }
});

// Get user's saved stories
router.get('/my-stories', requireAuth, async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    // Try to get from Supabase first
    const generations = await getUserGenerations(req.user.id, parseInt(limit), parseInt(offset));
    
    if (generations && generations.length > 0) {
      const stories = generations.map(gen => {
        // Parse result_data if it's a string
        let resultData = gen.result_data;
        if (typeof resultData === 'string') {
          try {
            resultData = JSON.parse(resultData);
          } catch (e) {
            console.warn('Failed to parse result_data for generation:', gen.id);
            resultData = {};
          }
        }

        // Extract story content from various possible locations
        const story = resultData?.story || {};
        const content = story.fullStory || story.content || story.story || gen.prompt || '';

        // Extract characters - handle various formats
        let characters = [];
        if (gen.character) {
          characters = [{
            name: gen.character.name || "Character",
            description: gen.character.description || "",
            traits: gen.character.traits || [],
            imageUrl: gen.character.thumbnail_url || gen.character.avatar_url || null
          }];
        } else if (story.characters && Array.isArray(story.characters)) {
          characters = story.characters;
        } else if (story.character) {
          characters = [{
            name: story.character.name || story.character,
            description: story.character.description || "",
            traits: story.character.traits || [],
            imageUrl: story.character.imageUrl || story.character.thumbnailUrl || null
          }];
        }

        // Handle storyboard URLs - convert objects to strings if needed
        let storyboardUrls = resultData?.storyboard_urls || [];
        if (Array.isArray(storyboardUrls)) {
          storyboardUrls = storyboardUrls.map(item => {
            if (typeof item === 'object' && item.imageUrl) {
              return item.imageUrl;
            }
            return item;
          });
        }

        return {
          id: gen.id,
          title: story.title || resultData?.title || gen.prompt || 'Untitled Story',
          description: story.description || resultData?.description || 'AI Generated Story',
          content: content,
          fullStory: story.fullStory || content,
          scenes: story.scenes || [],
          characters: characters,
          visibility: resultData?.visibility || 'private',
          createdAt: gen.created_at,
          type: gen.genre || story.type || 'adventure',
          genre: gen.genre,
          style: gen.style,
          status: gen.status,
          estimatedDuration: story.estimatedDuration ||
            (story.scenes ? `${story.scenes.length * 2}-${story.scenes.length * 3} min` : '5-10 min'),
          videoUrl: resultData?.video_url,
          storyboardUrls: storyboardUrls,
          sceneUrls: resultData?.scene_urls || storyboardUrls,
          audio_narration: resultData?.audio_narration || null,
          metadata: {
            ...resultData?.metadata,
            generatedBy: "Gemini AI",
            wordCount: content ? content.split(" ").length : 0,
            sceneCount: story.scenes ? story.scenes.length : 0,
          }
        };
      });

      return res.json({
        success: true,
        stories: stories,
        count: stories.length
      });
    }

    // Fallback to local storage
    const savedStoriesDir = path.join(__dirname, '../storage/saved-stories');
    
    try {
      const files = await fs.readdir(savedStoriesDir);
      const userStories = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const storyData = await fs.readFile(path.join(savedStoriesDir, file), 'utf8');
            const story = JSON.parse(storyData);
            
            if (story.userId === req.user.id) {
              // Extract story content from various possible locations
              const storyContent = story.result?.story || {};
              const content = storyContent.fullStory || storyContent.content || storyContent.story || story.prompt || '';

              // Extract characters - handle various formats
              let characters = [];
              if (storyContent.characters && Array.isArray(storyContent.characters)) {
                characters = storyContent.characters;
              } else if (storyContent.character) {
                characters = [{
                  name: storyContent.character.name || storyContent.character,
                  description: storyContent.character.description || "",
                  traits: storyContent.character.traits || [],
                  imageUrl: storyContent.character.imageUrl || storyContent.character.thumbnailUrl || null
                }];
              }

              // Handle storyboard URLs - convert objects to strings if needed
              let storyboardUrls = story.result?.storyboard_urls || [];
              if (Array.isArray(storyboardUrls)) {
                storyboardUrls = storyboardUrls.map(item => {
                  if (typeof item === 'object' && item.imageUrl) {
                    return item.imageUrl;
                  }
                  return item;
                });
              }

              userStories.push({
                id: story.id,
                title: storyContent.title || story.result?.title || story.prompt || 'Untitled Story',
                description: storyContent.description || story.result?.description || 'AI Generated Story',
                content: content,
                fullStory: storyContent.fullStory || content,
                scenes: storyContent.scenes || [],
                characters: characters,
                visibility: story.result?.visibility || 'private',
                createdAt: story.savedAt,
                type: story.genre || storyContent.type || 'adventure',
                genre: story.genre,
                style: story.style,
                estimatedDuration: storyContent.estimatedDuration ||
                  (storyContent.scenes ? `${storyContent.scenes.length * 2}-${storyContent.scenes.length * 3} min` : '5-10 min'),
                videoUrl: story.result?.video_url,
                storyboardUrls: storyboardUrls,
                sceneUrls: story.result?.scene_urls || storyboardUrls,
                audio_narration: story.result?.audio_narration || null,
                metadata: {
                  ...story.result?.metadata,
                  generatedBy: "Gemini AI",
                  wordCount: content ? content.split(" ").length : 0,
                  sceneCount: storyContent.scenes ? storyContent.scenes.length : 0,
                }
              });
            }
          } catch (parseError) {
            console.warn('Failed to parse story file:', file, parseError.message);
          }
        }
      }

      // Sort by creation date (newest first)
      userStories.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      // Apply pagination
      const paginatedStories = userStories.slice(offset, offset + limit);

      res.json({
        success: true,
        stories: paginatedStories,
        count: paginatedStories.length,
        total: userStories.length
      });

    } catch (dirError) {
      // Directory doesn't exist or is empty
      res.json({
        success: true,
        stories: [],
        count: 0
      });
    }

  } catch (error) {
    console.error('Get stories error:', error);
    res.status(500).json({
      error: 'Failed to retrieve stories',
      message: error.message
    });
  }
});

// Delete a saved story
router.delete('/:storyId', requireAuth, async (req, res) => {
  try {
    const { storyId } = req.params;

    // Try to delete from Supabase first
    try {
      const updated = await updateGeneration(storyId, { status: 'deleted' });
      if (updated) {
        return res.json({
          success: true,
          message: 'Story deleted successfully'
        });
      }
    } catch (supabaseError) {
      console.warn('Failed to delete from Supabase:', supabaseError.message);
    }

    // Fallback to local storage
    const savedStoriesDir = path.join(__dirname, '../storage/saved-stories');
    const storyPath = path.join(savedStoriesDir, `${storyId}.json`);
    
    try {
      // Verify the story belongs to the user
      const storyData = await fs.readFile(storyPath, 'utf8');
      const story = JSON.parse(storyData);
      
      if (story.userId !== req.user.id) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You can only delete your own stories'
        });
      }

      await fs.unlink(storyPath);
      
      res.json({
        success: true,
        message: 'Story deleted successfully'
      });
    } catch (fileError) {
      res.status(404).json({
        error: 'Story not found',
        message: 'Could not find the story to delete'
      });
    }

  } catch (error) {
    console.error('Delete story error:', error);
    res.status(500).json({
      error: 'Failed to delete story',
      message: error.message
    });
  }
});

// Start video generation for a saved story
router.post('/:storyId/generate-video', requireAuth, async (req, res) => {
  try {
    const { storyId } = req.params;

    // Load the story result
    const resultPath = path.join(__dirname, '../storage/results', `${storyId}.json`);
    
    try {
      const resultData = await fs.readFile(resultPath, 'utf8');
      const jobResult = JSON.parse(resultData);

      // Check if video already exists
      if (jobResult.video_url) {
        return res.json({
          success: true,
          message: 'Video already generated',
          videoUrl: jobResult.video_url
        });
      }

      // TODO: Implement video generation queue
      // For now, just return a placeholder response
      res.json({
        success: true,
        message: 'Video generation started',
        jobId: storyId,
        estimatedTime: '2-3 minutes'
      });

    } catch (error) {
      res.status(404).json({
        error: 'Story not found',
        message: 'Could not find the story for video generation'
      });
    }

  } catch (error) {
    console.error('Video generation error:', error);
    res.status(500).json({
      error: 'Failed to start video generation',
      message: error.message
    });
  }
});

// Get a single story by ID (for sharing) - MUST BE LAST to avoid conflicts
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // First, try to load from results directory
    const resultPath = path.join(__dirname, '../storage/results', `${id}.json`);

    try {
      const resultData = await fs.readFile(resultPath, 'utf8');
      const result = JSON.parse(resultData);

      // Extract story content from various possible locations
      const story = result.story || {};
      const content = story.fullStory || story.content || story.story || '';

      // Extract characters - handle various formats
      let characters = [];
      if (story.characters && Array.isArray(story.characters)) {
        characters = story.characters;
      } else if (story.character) {
        characters = [{
          name: story.character.name || story.character,
          description: story.character.description || "",
          traits: story.character.traits || [],
          imageUrl: story.character.imageUrl || story.character.thumbnailUrl || null
        }];
      }

      // Handle storyboard URLs - convert objects to strings if needed
      let storyboardUrls = result.storyboard_urls || [];
      if (Array.isArray(storyboardUrls)) {
        storyboardUrls = storyboardUrls.map(item => {
          if (typeof item === 'object' && item.imageUrl) {
            return item.imageUrl;
          }
          return item;
        });
      }

      return res.json({
        success: true,
        story: {
          id: id,
          title: story.title || result.title || 'Untitled Story',
          content: content,
          fullStory: story.fullStory || content,
          scenes: story.scenes || [],
          characters: characters,
          type: story.type || result.genre || 'adventure',
          estimatedDuration: story.estimatedDuration ||
            result.metadata?.estimated_duration ||
            (story.scenes ? `${story.scenes.length * 2}-${story.scenes.length * 3} min` : '5-10 min'),
          sceneUrls: result.scene_urls || storyboardUrls,
          storyboardUrls: storyboardUrls,
          videoUrl: result.video_url,
          audioUrl: result.audio_narration?.audioUrl,
          audio_narration: result.audio_narration,
          createdAt: result.metadata?.generated_at || new Date().toISOString(),
          metadata: {
            ...result.metadata,
            generatedBy: "Gemini AI",
            wordCount: content ? content.split(" ").length : 0,
            sceneCount: story.scenes ? story.scenes.length : 0,
          }
        }
      });
    } catch (fileError) {
      // If not found in results, return 404
      return res.status(404).json({
        error: 'Story not found',
        message: 'The requested story could not be found'
      });
    }

  } catch (error) {
    console.error('Error fetching story:', error);
    res.status(500).json({
      error: 'Failed to fetch story',
      message: error.message
    });
  }
});

module.exports = router;
