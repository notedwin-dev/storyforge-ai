const express = require('express');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs').promises;
const { generateStory } = require('../services/storyEngine');
const { generateSceneImages, generateCharacterConsistentScenes } = require('../services/imageGeneration');
const { generateVideo } = require('../services/videoGeneration');
const { getDemoCharacter } = require('../services/clip');
const { validateGenerationRequest } = require('../middleware/validation');
const { broadcastProgress } = require('../services/websocket');
const { GeminiStoryGenerator } = require('../services/geminiAI');
const { FreeHybridStableDiffusionService } = require('../services/freeHybridStableDiffusion');
const { generateStoryNarration } = require('../services/voiceService');

const router = express.Router();

// In-memory job storage (use Redis in production)
const jobs = new Map();

// Job health monitoring
setInterval(() => {
  const activeJobs = Array.from(jobs.values()).filter(job => 
    job.status === 'processing' || job.status === 'initializing'
  );
  
  if (activeJobs.length > 0) {
    console.log(`🔍 Job Health Check: ${activeJobs.length} active jobs, ${jobs.size} total jobs`);
    activeJobs.forEach(job => {
      const elapsed = Math.floor((Date.now() - new Date(job.createdAt).getTime()) / 1000);
      console.log(`  - Job ${job.id}: ${job.status} (${job.progress}%) - ${elapsed}s elapsed`);
    });
  }
}, 30000); // Check every 30 seconds

// Recovery function to restart processing jobs on server startup
async function recoverProcessingJobs() {
  try {
    const jobsDir = path.join(__dirname, '../storage/jobs');
    
    // Check if jobs directory exists
    try {
      await fs.access(jobsDir);
    } catch {
      console.log('📁 No jobs directory found, skipping recovery');
      return;
    }

    const jobFiles = await fs.readdir(jobsDir);
    console.log(`🔍 Found ${jobFiles.length} job files, checking for processing jobs...`);

    for (const jobFile of jobFiles) {
      if (!jobFile.endsWith('.json')) continue;
      
      try {
        const jobPath = path.join(jobsDir, jobFile);
        const jobData = JSON.parse(await fs.readFile(jobPath, 'utf8'));
        
        if (jobData.status === 'processing' || jobData.status === 'initializing') {
          console.log(`🔄 Recovering processing job: ${jobData.id}`);
          
          // Restore job to memory
          jobs.set(jobData.id, jobData);
          
          // Restart the generation process
          console.log(`🚀 Restarting generation for job: ${jobData.id}`);
          generateStoryAsync(jobData.id);
        }
      } catch (error) {
        console.error(`❌ Failed to recover job from ${jobFile}:`, error);
      }
    }
    
    console.log(`✅ Job recovery completed. ${jobs.size} jobs in memory.`);
  } catch (error) {
    console.error('❌ Failed to recover processing jobs:', error);
  }
}

// Initialize AI services
const geminiGenerator = new GeminiStoryGenerator();
const stableDiffusion = new FreeHybridStableDiffusionService();

// Global error handlers to prevent job loss
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error(`Jobs in memory: ${jobs.size}`);
  // Don't exit - keep jobs alive
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  console.error(`Jobs in memory: ${jobs.size}`);
  // Don't exit - keep jobs alive
});

// Calculate estimated duration based on options
function calculateEstimatedDuration(options) {
  let baseTime = 120; // 2 minutes base
  
  if (options.includeVideo) baseTime += 90; // +1.5 minutes for video
  if (options.includeVoice) baseTime += 30; // +30 seconds for voice
  if (options.length === 'long') baseTime += 60; // +1 minute for long stories
  if (options.length === 'short') baseTime -= 30; // -30 seconds for short stories
  
  return baseTime;
}

// Save job to disk for persistence
async function saveJobToDisk(jobId, job) {
  try {
    const jobsDir = path.join(__dirname, '../storage/jobs');
    await fs.mkdir(jobsDir, { recursive: true });
    const jobPath = path.join(jobsDir, `${jobId}.json`);
    await fs.writeFile(jobPath, JSON.stringify(job, null, 2));
    console.log(`💾 Job ${jobId} saved to disk`);
  } catch (error) {
    console.error(`Failed to save job ${jobId} to disk:`, error);
  }
}

// Load job from disk
async function loadJobFromDisk(jobId) {
  try {
    const jobPath = path.join(__dirname, '../storage/jobs', `${jobId}.json`);
    const jobData = await fs.readFile(jobPath, 'utf8');
    return JSON.parse(jobData);
  } catch (error) {
    console.error(`Failed to load job ${jobId} from disk:`, error);
    return null;
  }
}

router.post('/', validateGenerationRequest, async (req, res) => {
  try {
    const { prompt, dna_id, style = 'cartoon', genre = 'adventure', options = {} } = req.body;
    const jobId = uuidv4();

    console.log(`Starting generation job: ${jobId}`);
    console.log(`Prompt: ${prompt}`);
    console.log(`Character DNA: ${dna_id}`);
    console.log(`Style: ${style}, Genre: ${genre}`);

    // Initialize job with time estimates
    const now = new Date();
    const job = {
      id: jobId,
      status: 'initializing',
      prompt,
      dna_id,
      style,
      genre,
      options,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      startTime: now.getTime(), // Add start time for elapsed calculation
      progress: 0,
      estimatedDuration: calculateEstimatedDuration(options),
      steps: [
        { name: 'character_loading', status: 'pending', message: 'Loading character DNA...', estimatedTime: 5 },
        { name: 'story_generation', status: 'pending', message: 'Generating story with Gemini AI...', estimatedTime: 15 },
        { name: 'storyboard_generation', status: 'pending', message: 'Creating storyboard with character...', estimatedTime: 45 },
        ...(options?.includeVoice ? [{ name: 'voice_generation', status: 'pending', message: 'Generating voice narration...', estimatedTime: 30 }] : []),
        ...(options?.includeVideo !== false ? [{ name: 'video_generation', status: 'pending', message: 'Synthesizing video...', estimatedTime: 90 }] : []),
        { name: 'finalization', status: 'pending', message: 'Finalizing output...', estimatedTime: 10 }
      ]
    };

    jobs.set(jobId, job);
    await saveJobToDisk(jobId, job); // Persist to disk
    console.log(`Job ${jobId} created and stored. Total jobs: ${jobs.size}`);

    // Start async generation process
    console.log(`🔄 About to call generateStoryAsync for job: ${jobId}`);
    generateStoryAsync(jobId);
    console.log(`🔄 generateStoryAsync called for job: ${jobId}`);

    res.json({
      success: true,
      job_id: jobId,
      status: 'started',
      estimated_time: '90s',
      message: 'Story generation started'
    });

  } catch (error) {
    console.error('Generation start error:', error);
    res.status(500).json({
      error: 'Failed to start generation',
      message: error.message
    });
  }
});

// Debug route to list all jobs
router.get('/debug/jobs', (req, res) => {
  try {
    const jobsList = Array.from(jobs.entries()).map(([id, job]) => ({
      id,
      status: job.status,
      progress: job.progress,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt
    }));

    res.json({
      success: true,
      total_jobs: jobs.size,
      jobs: jobsList
    });
  } catch (error) {
    res.status(500).json({
      error: 'Debug failed',
      message: error.message
    });
  }
});

// Get generation status
router.get('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Status check for job: ${id}`);
    console.log(`Total jobs in memory: ${jobs.size}`);
    console.log(`Available job IDs: ${Array.from(jobs.keys()).join(', ')}`);
    
    let job = jobs.get(id);

    // If not found in memory, try loading from disk
    if (!job) {
      console.log(`Job ${id} not found in memory, trying to load from disk...`);
      job = await loadJobFromDisk(id);
      
      if (job) {
        console.log(`✅ Job ${id} loaded from disk and restored to memory`);
        jobs.set(id, job);
      }
    }

    if (!job) {
      console.error(`Job ${id} not found in memory or disk`);
      return res.status(404).json({
        error: 'Job not found',
        message: `Job with ID ${id} does not exist`,
        available_jobs: Array.from(jobs.keys()),
        total_jobs: jobs.size
      });
    }

    console.log(`Job ${id} status: ${job.status}, progress: ${job.progress}%`);

    res.json({
      success: true,
      data: {
        job_id: id,
        status: job.status,
        progress: job.progress,
        steps: job.steps,
        message: job.message || '',
        estimatedDuration: job.estimatedDuration,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        ...(job.error && { error: job.error }),
        ...(job.result && { result: job.result })
      }
    });

  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({
      error: 'Failed to check status',
      message: error.message
    });
  }
});

// Retry failed generation
router.post('/:id/retry', async (req, res) => {
  try {
    const { id } = req.params;
    const job = jobs.get(id);

    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        message: `Job with ID ${id} does not exist`
      });
    }

    if (job.status !== 'failed') {
      return res.status(400).json({
        error: 'Job cannot be retried',
        message: `Job status is '${job.status}', only failed jobs can be retried`
      });
    }

    // Reset job status and restart generation
    job.status = 'processing';
    job.progress = 0;
    job.error = null;
    job.updatedAt = new Date();
    job.retryCount = (job.retryCount || 0) + 1;

    // Reset steps
    job.steps.forEach(step => {
      if (step.status === 'failed') {
        step.status = 'pending';
        step.error = null;
      }
    });

    // Restart the generation process asynchronously
    setImmediate(() => {
      generateStoryAsync(id);
    });

    res.json({
      success: true,
      job_id: id,
      message: 'Generation retry started',
      retry_count: job.retryCount
    });

  } catch (error) {
    console.error('Retry error:', error);
    res.status(500).json({
      error: 'Failed to retry generation',
      message: error.message
    });
  }
});

// Cancel generation
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const job = jobs.get(id);

    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        message: `Job with ID ${id} does not exist`
      });
    }

    if (job.status === 'completed' || job.status === 'failed') {
      return res.status(400).json({
        error: 'Cannot cancel job',
        message: `Job is already ${job.status}`
      });
    }

    job.status = 'cancelled';
    job.updatedAt = new Date().toISOString();
    job.message = 'Generation cancelled by user';

    broadcastProgress(id, job);

    res.json({
      success: true,
      job_id: id,
      status: 'cancelled',
      message: 'Generation cancelled successfully'
    });

  } catch (error) {
    console.error('Cancel job error:', error);
    res.status(500).json({
      error: 'Failed to cancel job',
      message: error.message
    });
  }
});

async function generateStoryAsync(jobId) {
  console.log(`🔥 generateStoryAsync called with jobId: ${jobId}`);
  
  const job = jobs.get(jobId);
  if (!job) {
    console.error(`❌ Job ${jobId} not found at start of generateStoryAsync`);
    return;
  }

  console.log(`✅ Job ${jobId} found in memory, proceeding with generation...`);
  console.log(`📊 Job details:`, {
    id: job.id,
    status: job.status,
    prompt: job.prompt?.substring(0, 50) + '...',
    dna_id: job.dna_id
  });

  // Set up timeout to prevent hanging jobs
  const timeoutDuration = 10 * 60 * 1000; // 10 minutes
  const timeout = setTimeout(() => {
    console.error(`⏰ Job ${jobId} timed out after ${timeoutDuration / 1000} seconds`);
    const currentJob = jobs.get(jobId);
    if (currentJob && currentJob.status === 'processing') {
      currentJob.status = 'failed';
      currentJob.error = 'Generation timed out';
      currentJob.message = 'Story generation timed out';
      currentJob.updatedAt = new Date().toISOString();
      jobs.set(jobId, currentJob);
      
      // Try to broadcast timeout status
      try {
        broadcastProgress(jobId, currentJob);
      } catch (broadcastError) {
        console.error(`❌ Failed to broadcast timeout status for job ${jobId}:`, broadcastError.message);
      }
    }
  }, timeoutDuration);

  try {
    console.log(`🚀 Starting async generation for job: ${jobId}`);
    console.log(`📊 Total jobs in memory at start: ${jobs.size}`);

    // Ensure job is marked as processing
    job.status = 'processing';
    job.updatedAt = new Date().toISOString();
    jobs.set(jobId, job); // Ensure it's saved

    // Step 1: Load character DNA
    console.log(`👤 Starting character loading for job ${jobId}...`);
    console.log(`👤 Character DNA ID from job: ${job.dna_id}`);
    console.log(`👤 Job details: prompt="${job.prompt?.substring(0, 30)}...", genre=${job.genre}, style=${job.style}`);
    await updateJobProgress(jobId, 'character_loading', 'processing', 10);
    console.log(`👤 Character loading progress updated, now loading DNA...`);
    const characterDNA = await loadCharacterDNA(job.dna_id);
    console.log(`✅ Character DNA loaded for job ${jobId}:`, {
      id: characterDNA.id,
      name: characterDNA.name,
      is_demo: characterDNA.is_demo || false,
      has_traits: !!characterDNA.traits,
      traits_count: characterDNA.traits?.length || 0
    });
    await updateJobProgress(jobId, 'character_loading', 'completed', 20);
    console.log(`✅ Character loading step completed for job ${jobId}`);

    // Verify we're not using Astro Cat unless intentional
    if (characterDNA.name === 'Astro Cat' && job.dna_id !== 'astronaut_cat') {
      console.warn(`⚠️ WARNING: Using Astro Cat as fallback when DNA ID was: ${job.dna_id}`);
      console.warn(`⚠️ This means the uploaded character file was not found or failed to load!`);
    }

    // Step 2: Generate story with Gemini AI
    console.log(`📖 Starting story generation for job ${jobId}...`);
    await updateJobProgress(jobId, 'story_generation', 'processing', 30);
    console.log(`📖 Story generation progress updated for job ${jobId}`);
    let story;
    let generationMethod = 'fallback';
    
    try {
      console.log(`🤖 Attempting Gemini story generation for job ${jobId}...`);
      
      // Skip availability check and go straight to generation for better performance
      console.log(`🚀 Starting Gemini story generation directly for job ${jobId}...`);
      story = await geminiGenerator.generateStory(job.prompt, job.genre, characterDNA, job.options);
      console.log(`✅ Gemini generated story for job ${jobId} - processing response...`);
      console.log(`📊 Story response structure:`, {
        hasStory: !!story,
        hasStoryProperty: !!(story?.story),
        scenes: story?.story?.scenes?.length || story?.scenes?.length || 0,
        success: story?.success
      });
      generationMethod = 'gemini-ai';
      console.log(`✅ Gemini story processing completed for job ${jobId}`);

    } catch (geminiError) {
      console.warn(`❌ Gemini generation failed for job ${jobId}: ${geminiError.message}`);
      console.log(`🔄 Falling back to default story engine for job ${jobId}...`);
      
      // Update job status to show fallback
      const currentJob = jobs.get(jobId);
      if (currentJob) {
        currentJob.message = 'Gemini AI overloaded, using fallback story engine...';
        broadcastProgress(jobId, currentJob);
      }
      
      // Fallback to original story engine
      console.log(`📚 Calling fallback generateStory for job ${jobId}...`);
      story = await generateStory(job.prompt, job.genre, characterDNA);
      console.log(`✅ Fallback story generated for job ${jobId}`);
      generationMethod = 'fallback-engine';
    }
    
    console.log(`📖 Story generation completed for job ${jobId}. Method: ${generationMethod}`);
    console.log(`📖 Story structure:`, {
      hasStory: !!story,
      hasStoryProperty: !!(story?.story),
      scenes: story?.story?.scenes?.length || story?.scenes?.length || 0,
      metadata: !!story?.metadata
    });
    
    // Add generation method to story metadata
    if (story && story.metadata) {
      story.metadata.generationMethod = generationMethod;
    }
    
    console.log(`⏭️ Moving to next step after story generation for job ${jobId}...`);
    console.log(`🔄 About to update progress to story_generation completed for job ${jobId}...`);
    await updateJobProgress(jobId, 'story_generation', 'completed', 45);
    console.log(`✅ Story generation progress updated to completed for job ${jobId}`);

    // Step 3: Generate storyboard images with Stable Diffusion
    console.log(`🎨 Starting storyboard generation for job ${jobId}...`);
    console.log(`🎨 Story scenes available: ${story?.story?.scenes?.length || story?.scenes?.length || 0}`);
    await updateJobProgress(jobId, 'storyboard_generation', 'processing', 50);
    console.log(`🎨 Storyboard generation progress updated for job ${jobId}`);
    await updateJobProgress(jobId, 'storyboard_generation', 'processing', 50);
    let storyboardImages = [];
    try {
      const storyScenes = story.story?.scenes || story.scenes || [];
      console.log(`🎨 Found ${storyScenes.length} scenes for storyboard generation`);

      // Check if character consistency is enabled
      const useCharacterConsistency = job.options?.characterConsistency !== false; // Default to true

      if (useCharacterConsistency) {
        console.log(`🎭 Using character-consistent scene generation...`);

        // Try character-consistent generation first
        try {
          const consistentImages = await generateCharacterConsistentScenes(storyScenes, characterDNA, job.style);

          if (consistentImages && consistentImages.length > 0) {
            console.log(`✅ Generated ${consistentImages.length} character-consistent images`);
            storyboardImages = consistentImages.map(img => ({
              sceneId: img.scene_id,
              imageUrl: img.url,
              prompt: img.prompt,
              style: img.style,
              characterBased: img.character_based,
              metadata: img.metadata
            }));
          } else {
            throw new Error('No character-consistent images generated');
          }
        } catch (consistencyError) {
          console.warn('⚠️ Character-consistent generation failed, falling back to standard:', consistencyError.message);
          // Fallback to standard storyboard generation
          storyboardImages = await stableDiffusion.generateMultipleStoryboards(storyScenes, job.style, characterDNA);
        }
      } else {
        console.log(`🎨 Using standard storyboard generation...`);
        storyboardImages = await stableDiffusion.generateMultipleStoryboards(storyScenes, job.style, characterDNA);
      }

      console.log(`✅ Generated ${storyboardImages.length} storyboard images`);
    } catch (storyboardError) {
      console.warn('⚠️ Storyboard generation failed:', storyboardError.message);
      // Continue without storyboards
    }
    await updateJobProgress(jobId, 'storyboard_generation', 'completed', 65);

    // Step 4: Generate voice narration (optional)
    let audioResult = null;
    if (job.options?.includeVoice) {
      console.log(`🎙️ Starting voice narration generation for job ${jobId}...`);
      await updateJobProgress(jobId, 'voice_generation', 'processing', 75);
      
      try {
        // Use default voice if not specified - use first available real voice
        const voiceId = job.options?.voiceId || '9BWtsMINqrJLrRacOk9x'; // Aria voice
        const voiceEmotion = job.options?.voiceEmotion || 'neutral';
        
        console.log(`🎙️ Generating voice narration with voice: ${voiceId}, emotion: ${voiceEmotion}`);
        audioResult = await generateStoryNarration(story.story || story, voiceId, {
          emotion: voiceEmotion,
          language: job.options?.language || 'en',
          model_id: job.options?.voiceModel || 'eleven_monolingual_v1'
        });
        
        console.log(`✅ Voice narration generated for job ${jobId}:`, {
          total_duration: audioResult.total_duration,
          scenes_count: audioResult.scenes.length
        });
      } catch (voiceError) {
        console.warn('⚠️ Voice generation failed:', voiceError.message);
        // Continue without voice narration
        audioResult = null;
      }
      
      await updateJobProgress(jobId, 'voice_generation', 'completed', 80);
    } else {
      console.log(`⏭️ Skipping voice generation for job ${jobId} (disabled in options)`);
    }

    // Step 5: Generate video (optional)
    let videoResult = null;
    if (job.options?.includeVideo !== false) {
      console.log(`🎬 Starting video generation for job ${jobId}...`);
      await updateJobProgress(jobId, 'video_generation', 'processing', 85);
      
      // Merge job properties with options for video generation
      const videoOptions = {
        ...job.options,
        style: job.style,
        genre: job.genre
      };
      
      videoResult = await generateVideo([], story.story || story, videoOptions);
      console.log(`✅ Video generation completed for job ${jobId}`);
      await updateJobProgress(jobId, 'video_generation', 'completed', 95);
    } else {
      console.log(`⏭️ Skipping video generation for job ${jobId} (disabled in options)`);
      await updateJobProgress(jobId, 'video_generation', 'skipped', 95);
    }

    // Step 6: Finalize
    console.log(`🏁 Starting finalization for job ${jobId}...`);
    await updateJobProgress(jobId, 'finalization', 'processing', 98);
    
    const result = {
      story: story.story || story,
      video_url: videoResult?.videoUrl || null,
      audio_narration: audioResult || null,
      storyboard_urls: storyboardImages || [],
      duration: videoResult?.duration || 0,
      audio_duration: audioResult?.total_duration || 0,
      metadata: {
        character_name: characterDNA.name,
        style: job.style,
        genre: job.genre,
        scenes_count: (story.story?.scenes || story.scenes).length,
        storyboards_count: storyboardImages.length,
        voice_enabled: job.options?.includeVoice || false,
        audio_scenes_count: audioResult?.scenes?.length || 0,
        ai_generated: true,
        generation_method: generationMethod,
        gemini_used: generationMethod.includes('gemini'),
        generated_at: new Date().toISOString(),
        video_enabled: job.options?.includeVideo !== false
      }
    };

    // Save result
    const resultPath = path.join(__dirname, '../storage/results', `${jobId}.json`);
    await fs.mkdir(path.dirname(resultPath), { recursive: true });
    await fs.writeFile(resultPath, JSON.stringify(result, null, 2));

    job.status = 'completed';
    job.result = result;
    job.progress = 100;
    job.message = 'Story generation completed successfully!';
    job.updatedAt = new Date().toISOString();

    await updateJobProgress(jobId, 'finalization', 'completed', 100);

    console.log(`🎉 Generation completed successfully for job: ${jobId}`);
    
    // Clear timeout since job completed successfully
    clearTimeout(timeout);

  } catch (error) {
    console.error(`💥 Generation failed for job ${jobId}:`, error);
    
    // Clear timeout since job ended (with error)
    clearTimeout(timeout);
    
    // Make sure job still exists before updating it
    const currentJob = jobs.get(jobId);
    if (currentJob) {
      currentJob.status = 'failed';
      currentJob.error = error.message;
      currentJob.message = 'Story generation failed';
      currentJob.updatedAt = new Date().toISOString();

      // Mark current step as failed
      const currentStep = currentJob.steps.find(step => step.status === 'processing');
      if (currentStep) {
        currentStep.status = 'failed';
        currentStep.error = error.message;
      }

      // Ensure job is saved back to memory
      jobs.set(jobId, currentJob);
      try {
        await saveJobToDisk(jobId, currentJob);
        broadcastProgress(jobId, currentJob);
      } catch (saveError) {
        console.error(`❌ Failed to save error state for job ${jobId}:`, saveError);
      }
    } else {
      console.error(`❌ Job ${jobId} was lost during error handling!`);
    }
  }
}

async function updateJobProgress(jobId, stepName, status, progress) {
  // Use a timeout wrapper to prevent any blocking operations
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      console.error(`⏰ updateJobProgress timed out for job ${jobId} after 10 seconds`);
      resolve(); // Always resolve, never hang the caller
    }, 10000); // 10 second max timeout

    (async () => {
      try {
        console.log(`🔄 updateJobProgress called for job ${jobId}: ${stepName} -> ${status} (${progress}%)`);
        
        const job = jobs.get(jobId);
        if (!job) {
          console.error(`❌ Cannot update progress: Job ${jobId} not found in memory`);
          console.error(`Current jobs in memory: ${Array.from(jobs.keys()).join(', ')}`);
          console.error(`Total jobs: ${jobs.size}`);
          clearTimeout(timeoutId);
          resolve();
          return;
        }

        console.log(`🔄 Updating job ${jobId}: ${stepName} -> ${status} (${progress}%)`);

        const step = job.steps.find(s => s.name === stepName);
        if (step) {
          step.status = status;
          if (status === 'processing') {
            step.startedAt = new Date().toISOString();
          } else if (status === 'completed') {
            step.completedAt = new Date().toISOString();
          } else if (status === 'failed') {
            step.failedAt = new Date().toISOString();
          }
        }

        job.progress = progress;
        job.updatedAt = new Date().toISOString();
        job.status = progress === 100 ? 'completed' : 'processing';

        // Ensure job is still in memory
        jobs.set(jobId, job);
        
        // Save to disk for persistence - with timeout protection
        try {
          await Promise.race([
            saveJobToDisk(jobId, job),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Save to disk timeout')), 3000)
            )
          ]);
        } catch (saveError) {
          console.error(`⚠️ Failed to save job ${jobId} to disk (continuing anyway):`, saveError.message);
          // Don't throw - continue with the update
        }
        
        console.log(`✅ Job ${jobId} updated successfully. Status: ${job.status}, Progress: ${job.progress}%`);
        console.log(`Jobs in memory after update: ${jobs.size}`);

        // Broadcast progress update - with timeout protection
        try {
          await Promise.race([
            new Promise((resolve) => {
              broadcastProgress(jobId, job);
              console.log(`📡 Progress broadcast sent for job ${jobId}`);
              resolve();
            }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Broadcast timeout')), 2000)
            )
          ]);
        } catch (broadcastError) {
          console.error(`⚠️ Failed to broadcast progress for job ${jobId} (continuing anyway):`, broadcastError.message);
          // Don't throw - continue with the update
        }
        
        console.log(`✅ updateJobProgress completed for job ${jobId}`);
        clearTimeout(timeoutId);
        resolve();
      } catch (error) {
        console.error(`❌ Critical error in updateJobProgress for job ${jobId}:`, error);
        // Don't re-throw - just log the error to prevent cascade failures
        console.error(`⚠️ Continuing story generation despite progress update error...`);
        clearTimeout(timeoutId);
        resolve(); // Always resolve to prevent blocking
      }
    })();
  });
}

async function loadCharacterDNA(dnaId) {
  try {
    console.log(`🔍 Attempting to load character DNA for ID: ${dnaId}`);
    console.log(`📁 Character storage directory: ${path.join(__dirname, '../storage/characters')}`);
    
    // Check if it's a demo character first
    if (dnaId.includes('demo_') || ['astronaut_cat', 'dragon_knight', 'mystical_wizard', 'cyber_ninja'].includes(dnaId)) {
      console.log(`✅ Loading demo character: ${dnaId}`);
      const characterId = dnaId.replace('demo_', '').split('_')[0];
      const demoCharacter = getDemoCharacter(characterId);
      
      if (demoCharacter) {
        return {
          id: characterId,
          name: demoCharacter.name,
          description: demoCharacter.description,
          traits: demoCharacter.traits,
          embedding: demoCharacter.embedding,
          imageUrl: `/demo/${characterId}.jpg`,
          is_demo: true
        };
      }
    }

    // Try to load from Supabase first (for authenticated users)
    const { getCharacterById } = require('../services/supabase');
    try {
      console.log(`🔍 Attempting to load character from Supabase: ${dnaId}`);
      console.log(`📊 Supabase module loaded successfully`);
      // Use bypassRLS=true for story generation to access characters regardless of auth
      const supabaseCharacter = await getCharacterById(dnaId, null, true);
      console.log(`📊 Supabase query completed, result:`, !!supabaseCharacter);
      
      if (supabaseCharacter) {
        console.log(`✅ Found character in Supabase:`, {
          id: supabaseCharacter.id,
          name: supabaseCharacter.name,
          hasEmbedding: !!supabaseCharacter.embedding
        });
        
        return {
          id: supabaseCharacter.id,
          name: supabaseCharacter.name,
          description: supabaseCharacter.description,
          traits: supabaseCharacter.traits || [],
          tags: supabaseCharacter.tags || [],
          embedding: supabaseCharacter.embedding,
          imageUrl: supabaseCharacter.image_url,
          thumbnailUrl: supabaseCharacter.thumbnail_url,
          is_demo: supabaseCharacter.is_demo || false,
          metadata: supabaseCharacter.metadata || {}
        };
      } else {
        console.log(`❌ Character not found in Supabase: ${dnaId}`);
      }
    } catch (supabaseError) {
      console.warn(`⚠️ Failed to load from Supabase:`, supabaseError);
      console.warn(`⚠️ Supabase error details:`, {
        message: supabaseError.message,
        code: supabaseError.code,
        stack: supabaseError.stack?.substring(0, 200)
      });
    }

    // Try to load uploaded character from local storage
    const characterPath = path.join(__dirname, '../storage/characters', `${dnaId}.json`);
    console.log(`📁 Looking for character file at: ${characterPath}`);
    
    // Check if file exists first
    try {
      await fs.access(characterPath);
      console.log(`✅ Character file exists at: ${characterPath}`);
    } catch (accessError) {
      console.error(`❌ Character file does not exist at: ${characterPath}`);
      console.error(`Access error:`, accessError.message);
      
      // List files in the directory to see what's actually there
      try {
        const storageDir = path.join(__dirname, '../storage/characters');
        const files = await fs.readdir(storageDir);
        console.log(`📂 Files in characters directory:`, files);
        console.log(`🔍 Looking for file: ${dnaId}.json`);
        console.log(`📋 Available character files:`, files.filter(f => f.endsWith('.json')));
      } catch (dirError) {
        console.error(`❌ Cannot read characters directory:`, dirError.message);
      }
      
      throw new Error(`Character file not found: ${dnaId}.json`);
    }
    
    const characterData = await fs.readFile(characterPath, 'utf8');
    console.log(`📄 Raw character data length: ${characterData.length} chars`);
    console.log(`📄 First 200 chars of data:`, characterData.substring(0, 200));
    
    const parsedCharacter = JSON.parse(characterData);
    console.log(`✅ Successfully parsed uploaded character:`, {
      id: parsedCharacter.id,
      name: parsedCharacter.name,
      description: parsedCharacter.description?.substring(0, 50) || 'No description',
      traits: parsedCharacter.traits || 'No traits',
      tags: parsedCharacter.tags || 'No tags'
    });
    
    // Ensure uploaded character has required fields for story generation
    const characterDNA = {
      ...parsedCharacter,
      description: parsedCharacter.description || `A character named ${parsedCharacter.name}`,
      traits: parsedCharacter.traits || parsedCharacter.tags?.slice(0, 5) || ['adventurous', 'brave']
    };
    
    console.log(`🎯 Final character DNA for story generation:`, {
      id: characterDNA.id,
      name: characterDNA.name,
      description: characterDNA.description.substring(0, 50) + '...',
      traits: characterDNA.traits
    });
    
    return characterDNA;
  } catch (error) {
    console.error(`❌ Failed to load character DNA for ${dnaId}:`, error.message);
    console.error(`Error type:`, error.constructor.name);
    console.error(`Error stack:`, error.stack);
    
    // Fallback to a default demo character
    console.warn(`⚠️ Character ${dnaId} not found in Supabase or local storage. Falling back to default demo character.`);
    console.warn(`⚠️ This means the uploaded character was not properly saved or the DNA ID is incorrect.`);
    const demoCharacter = getDemoCharacter('astronaut_cat');
    if (demoCharacter) {
      console.log(`🔄 Using fallback character: ${demoCharacter.name}`);
      return {
        id: 'astronaut_cat',
        name: demoCharacter.name,
        description: demoCharacter.description,
        traits: demoCharacter.traits,
        embedding: demoCharacter.embedding,
        imageUrl: `/demo/astronaut_cat.jpg`,
        is_demo: true
      };
    }
    
    throw new Error(`Failed to load character DNA: ${error.message}`);
  }
}

// Initialize recovery on startup (after all functions are defined)
setTimeout(() => {
  recoverProcessingJobs();
}, 2000); // Wait 2 seconds after server start

module.exports = router;
