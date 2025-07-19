import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Upload, 
  Wand2, 
  Play, 
  Download,
  Share,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Clock,
  CheckCircle,
  Eye,
  EyeOff,
  Loader2
} from 'lucide-react'
import toast from 'react-hot-toast'

import CharacterUpload from '../components/create/CharacterUpload'
import StoryPrompt from '../components/create/StoryPrompt'
import StoryPreview from '../components/create/StoryPreview'
import StorySaveOptions from '../components/create/StorySaveOptions'
import GenerationProgress from '../components/create/GenerationProgress'
import { useCharacterStore, useJobStore, useUIStore } from '../lib/stores'
import { storyAPI, storySocket } from '../lib/api'

const STEPS = [
  { 
    id: 'upload', 
    title: 'Upload Character', 
    icon: Upload,
    description: 'Upload your character image to create DNA profile'
  },
  { 
    id: 'prompt', 
    title: 'Create Story', 
    icon: Wand2,
    description: 'Write your story prompt and choose style'
  },
  { 
    id: 'preview', 
    title: 'Preview & Generate', 
    icon: Play,
    description: 'Review and start video generation'
  },
  { 
    id: 'result', 
    title: 'Export & Share', 
    icon: Download,
    description: 'Download or share your story'
  }
]

export default function CreatePage() {
  const [currentStep, setCurrentStep] = useState(0)
  const [hasAutoAdvanced, setHasAutoAdvanced] = useState(false)
  const [isManualNavigation, setIsManualNavigation] = useState(false)
  const [generationInProgress, setGenerationInProgress] = useState(false)
  const [generationJobId, setGenerationJobId] = useState(null)
  const [generationComplete, setGenerationComplete] = useState(false)
  const [showStoryPreview, setShowStoryPreview] = useState(false)
  const [storySaved, setStorySaved] = useState(false)
  const [savedStoryData, setSavedStoryData] = useState({ id: null, visibility: 'private' })
  const [isCompleting, setIsCompleting] = useState(false)
  const [storyData, setStoryData] = useState({
    character: null,
    prompt: '',
    style: 'cartoon',
    genre: 'adventure',
    options: {}
  })
  
  const { selectedCharacter, selectCharacter } = useCharacterStore()
  const { createJob, updateJob, getJob, activeJob } = useJobStore()
  const { setLoading, loading } = useUIStore()

  // Mapping functions to convert StoryPrompt values to API values
  const mapStoryTypeToStyle = (storyType) => {
    const styleMap = {
      'adventure': 'cinematic',
      'fantasy': 'storybook', 
      'scifi': 'cartoon',
      'drama': 'watercolor'
    }
    return styleMap[storyType] || 'cartoon'
  }

  const mapStoryTypeToGenre = (storyType) => {
    const genreMap = {
      'adventure': 'adventure',
      'fantasy': 'fantasy',
      'scifi': 'sci-fi',
      'drama': 'mystery'
    }
    return genreMap[storyType] || 'adventure'
  }

  // Initialize WebSocket connection
  useEffect(() => {
    storySocket.connect()
    
    storySocket.on('progress', (data) => {
      if (data.job_id) {
        updateJob(data.job_id, data.data)
      }
    })

    return () => {
      storySocket.disconnect()
    }
  }, [updateJob])

  // Auto-advance to prompt step if character is already selected (only once, not when navigating back)
  useEffect(() => {
    if (selectedCharacter && currentStep === 0 && !hasAutoAdvanced && !isManualNavigation) {
      console.log('Auto-advancing to step 1') // Debug log
      setStoryData(prev => ({ ...prev, character: selectedCharacter }))
      setCurrentStep(1)
      setHasAutoAdvanced(true)
    }
  }, [selectedCharacter, currentStep, hasAutoAdvanced, isManualNavigation])

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleViewStory = () => {
    console.log('View Story clicked, activeJob:', activeJob);
    console.log('Current job data:', getJob(activeJob));
    setShowStoryPreview(true);
  }

  // Transform job data to StoryPreview expected format
  const transformJobToStory = (job) => {
    if (!job || !job.result || !job.result.story) {
      return null;
    }

    const { result, createdAt, character: jobCharacter } = job;
    const { story } = result;

    // Use the fullStory from backend response, fallback to scene concatenation if needed
    const fullContent = story.fullStory || 
      (story.scenes 
        ? story.scenes.map(scene => `**${scene.title}**\n\n${scene.description || scene.content || ''}`).join('\n\n')
        : '');

    // Extract characters - handle the new API structure
    let characters = [];
    
    // Check if we have character data from the job's character (from the original upload)
    if (jobCharacter) {
      characters = [{
        name: jobCharacter.name || story.character || 'Character',
        description: jobCharacter.description || '',
        traits: jobCharacter.traits || [],
        imageUrl: jobCharacter.imageUrl || jobCharacter.avatar_url || null
      }];
    } 
    // Fallback: if no jobCharacter, create a basic character from story.character
    else if (story.character) {
      characters = [{
        name: story.character,
        description: '',
        traits: [],
        imageUrl: null
      }];
    }
    // Final fallback: check for story.characters array (legacy)
    else if (story.characters && Array.isArray(story.characters)) {
      characters = story.characters;
    }

    return {
      id: job.id,
      title: story.title || 'Your Generated Story',
      content: fullContent, // This is for backward compatibility
      fullStory: story.fullStory, // Add the fullStory field directly
      scenes: story.scenes || [],
      characters: characters,
      type: job.genre || 'adventure',
      tone: 'engaging',
      length: 'short',
      createdAt: createdAt,
      estimatedDuration: story.scenes ? `${story.scenes.length * 2}-${story.scenes.length * 3} min` : '5-10 min',
      videoUrl: result.video_url,
      storyboardUrls: result.storyboard_urls || [],
      includeVoice: job.options?.includeVoice || false,
      includeVideo: job.options?.includeVideo !== false,
      metadata: {
        generatedBy: 'Gemini AI',
        wordCount: fullContent ? fullContent.split(' ').length : 0,
        sceneCount: story.scenes ? story.scenes.length : 0
      }
    };
  }

  const handleBack = () => {
    console.log('Back button clicked, currentStep:', currentStep) // Debug log
    if (currentStep > 0) {
      const newStep = currentStep - 1
      setIsManualNavigation(true) // Mark as manual navigation
      setCurrentStep(newStep)
      console.log('Moving to step:', newStep) // Debug log
      
      // Reset completion state when going back
      setIsCompleting(false)
      
      // Reset auto-advance flag when going back to character selection
      if (newStep === 0) {
        setHasAutoAdvanced(false)
        // Clear only the selected character from store, but keep story data character
        selectCharacter(null) // Clear from store to prevent auto-advance
        console.log('Reset hasAutoAdvanced to false and cleared character from store only') // Debug log
        
        // Reset saved state when going back to start
        setStorySaved(false)
        setSavedStoryData({ id: null, visibility: 'private' })
        
        // Reset manual navigation flag after a short delay to allow re-selection
        setTimeout(() => {
          setIsManualNavigation(false)
          console.log('Reset isManualNavigation to false') // Debug log
        }, 100)
      }
    }
  }

  const handleCharacterSelect = (character) => {
    setStoryData(prev => ({ ...prev, character }))
    setHasAutoAdvanced(true) // Mark that we've auto-advanced after manual selection
    setIsManualNavigation(false) // Reset manual navigation flag
    handleNext()
  }

  const handleStorySubmit = async (promptData) => {
    // Update story data with form data
    const updatedStoryData = { ...storyData, ...promptData }
    setStoryData(updatedStoryData)
    
    // Generate the story
    if (!updatedStoryData.character || !updatedStoryData.prompt) {
      toast.error('Please complete all required fields')
      return
    }

    try {
      setLoading('generation', true)
      setGenerationInProgress(true)
      setGenerationComplete(false)
      // Reset saved state for new generation
      setStorySaved(false)
      setSavedStoryData({ id: null, visibility: 'private' })
      
      const response = await storyAPI.generate({
        prompt: updatedStoryData.prompt,
        dna_id: updatedStoryData.character.dna_id || updatedStoryData.character.id,
        style: mapStoryTypeToStyle(updatedStoryData.storyType) || 'cartoon',
        genre: mapStoryTypeToGenre(updatedStoryData.storyType) || 'adventure',
        options: {
          includeVoice: updatedStoryData.includeVoice,
          includeVideo: updatedStoryData.includeVideo,
          tone: updatedStoryData.tone,
          length: updatedStoryData.length,
          storyType: updatedStoryData.storyType,
          ...updatedStoryData.options
        }
      })

      if (response.success) {
        const jobId = response.job_id
        setGenerationJobId(jobId)
        
        createJob(jobId, {
          character: updatedStoryData.character,
          prompt: updatedStoryData.prompt,
          style: mapStoryTypeToStyle(updatedStoryData.storyType),
          genre: mapStoryTypeToGenre(updatedStoryData.storyType),
          length: updatedStoryData.length,
          estimatedTime: response.estimated_time,
          status: 'processing',
          progress: 0
        })

        // Subscribe to job updates
        storySocket.subscribe(jobId)
        
        toast.success('Story generation started!')
        handleNext() // Move to preview step with progress
      }
    } catch (error) {
      console.error('Generation failed:', error)
      toast.error('Failed to start generation')
      setGenerationInProgress(false)
    } finally {
      setLoading('generation', false)
    }
  }

  const handleGenerate = async () => {
    // This is now just for moving to the result step
    // The actual generation happens in handleStorySubmit
    handleNext()
  }

  const handleGenerationComplete = (jobData) => {
    setGenerationInProgress(false)
    setGenerationComplete(true)
    toast.success('Story generation completed!')
    
    // Don't auto-advance - let user click "View Your Story" manually
    // setTimeout(() => {
    //   handleNext()
    // }, 2000)
  }

  const handleGenerationError = (jobData) => {
    setGenerationInProgress(false)
    toast.error(`Generation failed: ${jobData.error || 'Unknown error'}`)
  }

  const handleSaveStory = async (saveOptions) => {
    try {
      console.log('Saving story with options:', saveOptions)
      
      if (!activeJob) {
        throw new Error('No active job to save')
      }
      
      const response = await storyAPI.saveStory({
        jobId: activeJob,
        visibility: saveOptions.visibility,
        title: saveOptions.title,
        description: saveOptions.description
      })
      
      // Update saved state
      setStorySaved(true)
      setSavedStoryData({
        id: response.storyId || activeJob,
        visibility: saveOptions.visibility
      })
      
      return response
    } catch (error) {
      console.error('Save story error:', error)
      throw error
    }
  }

  const handleGenerateVideo = async () => {
    try {
      console.log('Starting video generation for job:', activeJob)
      
      if (!activeJob) {
        throw new Error('No active job for video generation')
      }
      
      const response = await storyAPI.generateVideo(activeJob)
      return response
    } catch (error) {
      console.error('Video generation error:', error)
      throw error
    }
  }

  const handleDownloadStory = async () => {
    try {
      console.log('Downloading story as PDF for job:', activeJob)
      
      if (!activeJob) {
        toast.error('No story to download')
        return
      }

      // Use the export API to download as PDF
      const response = await fetch(`/api/export/${activeJob}?format=pdf`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      })
      
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${storyData.character?.name || 'story'}_story.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        toast.success('Story downloaded successfully!')
      } else {
        toast.error('Failed to download story')
      }
    } catch (error) {
      console.error('Download error:', error)
      toast.error('Failed to download story')
    }
  }

  const handleShareStory = async () => {
    try {
      console.log('Sharing story for job:', activeJob)
      
      if (!activeJob) {
        toast.error('No story to share')
        return
      }

      // Create a shareable URL
      const shareUrl = `${window.location.origin}/share/${activeJob}`
      
      if (navigator.share) {
        await navigator.share({
          title: storyData.character?.name ? `${storyData.character.name}'s Story` : 'My AI Story',
          url: shareUrl
        })
      } else {
        // Fallback to clipboard
        await navigator.clipboard.writeText(shareUrl)
        toast.success('Share link copied to clipboard!')
      }
    } catch (error) {
      console.error('Share error:', error)
      toast.error('Failed to share story')
    }
  }

  const handleComplete = async () => {
    try {
      setIsCompleting(true)
      console.log('Complete button clicked - finishing story creation process')
      
      if (!activeJob) {
        toast.error('No story to complete')
        return
      }

      // Show completion message based on whether story was saved
      if (storySaved) {
        toast.success('🎉 Story creation completed! Your story has been saved successfully.')
        
        // Open the saved story in a new tab if we have the saved story ID
        if (savedStoryData.id) {
          const savedStoryUrl = `${window.location.origin}/share/${savedStoryData.id}`
          setTimeout(() => {
            window.open(savedStoryUrl, '_blank')
          }, 1000) // Small delay to let the toast show
        }
      } else {
        // Show a warning toast with option to save first
        toast((t) => (
          <div className="flex flex-col space-y-2">
            <div className="flex items-center space-x-2">
              <span>⚠️ Your story hasn't been saved yet!</span>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  toast.dismiss(t.id)
                  // Scroll back up to save section
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                className="text-xs bg-primary-600 text-white px-2 py-1 rounded hover:bg-primary-700"
              >
                Save First
              </button>
              <button
                onClick={() => {
                  toast.dismiss(t.id)
                  // Continue without saving
                  proceedWithoutSaving()
                }}
                className="text-xs bg-gray-600 text-white px-2 py-1 rounded hover:bg-gray-700"
              >
                Continue Anyway
              </button>
            </div>
          </div>
        ), {
          duration: 6000,
          position: 'top-center'
        })
        
        setIsCompleting(false)
        return
      }

      // Navigate to library after a short delay to let user see the completion message
      setTimeout(() => {
        window.location.href = '/library'
      }, storySaved ? 2500 : 1500) // Longer delay if we're opening a new tab

    } catch (error) {
      console.error('Complete story error:', error)
      toast.error('Failed to complete story creation')
      setIsCompleting(false)
    }
  }

  const proceedWithoutSaving = () => {
    toast.success('🎉 Story creation completed!')
    
    // Navigate to library after a short delay
    setTimeout(() => {
      window.location.href = '/library'
    }, 1500)
  }

  const currentStepData = STEPS[currentStep]
  const canProceed = getCurrentStepValidation()

  function getCurrentStepValidation() {
    switch (currentStep) {
      case 0: // Upload
        return !!storyData.character
      case 1: // Prompt
        return !!storyData.prompt && storyData.prompt.length >= 10
      case 2: // Preview
        return true
      case 3: // Result
        return generationComplete && !generationInProgress
      default:
        return false
    }
  }

  // Check if we can access the preview (result) step
  const canAccessPreview = () => {
    return generationComplete && !generationInProgress
  }

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-heading font-bold text-gray-900 dark:text-white mb-4">
            Create Your Story
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Transform your character into an amazing animated story in just a few simple steps.
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-12">
          <div className="flex items-center justify-between max-w-3xl mx-auto">
            {STEPS.map((step, index) => {
              const Icon = step.icon
              const isActive = index === currentStep
              const isCompleted = index < currentStep
              // Special handling for result step - only accessible when generation is complete
              const isAccessible = index <= currentStep && (index !== 3 || canAccessPreview())

              return (
                <div key={step.id} className="flex flex-col items-center flex-1">
                  <div className="flex items-center w-full">
                    <motion.button
                      whileHover={isAccessible ? { scale: 1.05 } : {}}
                      whileTap={isAccessible ? { scale: 0.95 } : {}}
                      onClick={() => isAccessible && setCurrentStep(index)}
                      disabled={!isAccessible}
                      className={`
                        relative w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300
                        ${isActive 
                          ? 'bg-primary-600 border-primary-600 text-white shadow-glow' 
                          : isCompleted
                          ? 'bg-success-600 border-success-600 text-white'
                          : isAccessible
                          ? 'border-gray-300 text-gray-400 hover:border-primary-300'
                          : 'border-gray-200 text-gray-300'
                        }
                        ${index === 3 && !canAccessPreview() ? 'cursor-not-allowed opacity-50' : ''}
                      `}
                      title={index === 3 && !canAccessPreview() ? 'Complete story generation to access preview' : ''}
                    >
                      {isCompleted ? (
                        <CheckCircle className="h-6 w-6" />
                      ) : index === 3 && generationInProgress ? (
                        <EyeOff className="h-6 w-6" />
                      ) : (
                        <Icon className="h-6 w-6" />
                      )}
                    </motion.button>
                    
                    {index < STEPS.length - 1 && (
                      <div className={`
                        flex-1 h-0.5 mx-4 transition-colors duration-300
                        ${isCompleted ? 'bg-success-300' : 'bg-gray-200'}
                      `} />
                    )}
                  </div>
                  
                  <div className="text-center mt-3">
                    <p className={`
                      text-sm font-medium transition-colors duration-300
                      ${isActive 
                        ? 'text-primary-600' 
                        : isCompleted 
                        ? 'text-success-600'
                        : 'text-gray-500'
                      }
                    `}>
                      {step.title}
                    </p>
                    <p className="text-xs text-gray-400 mt-1 hidden sm:block">
                      {step.description}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Step Content */}
        <div className="card p-8 mb-8 min-h-[500px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="h-full"
            >
              {currentStep === 0 && (
                <CharacterUpload
                  selectedCharacter={storyData.character}
                  onCharacterSelect={handleCharacterSelect}
                />
              )}
              
              {currentStep === 1 && (
                <StoryPrompt
                  characters={storyData.character ? [storyData.character] : []}
                  onGenerate={handleStorySubmit}
                  isGenerating={loading.generation}
                />
              )}
              
              {currentStep === 2 && (
                <div className="space-y-6">
                  {generationInProgress && generationJobId ? (
                    <GenerationProgress
                      jobId={generationJobId}
                      onComplete={handleGenerationComplete}
                      onError={handleGenerationError}
                    />
                  ) : generationComplete && !showStoryPreview ? (
                    <div className="text-center space-y-4">
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle className="w-8 h-8 text-green-600" />
                      </div>
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Story Generated Successfully!</h3>
                      <p className="text-gray-600 dark:text-gray-300">Your story is ready to preview and download.</p>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleViewStory}
                        className="btn-primary"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Your Story
                      </motion.button>
                    </div>
                  ) : (
                    <StoryPreview
                      story={activeJob ? transformJobToStory(getJob(activeJob)) : null}
                      onGenerate={handleGenerate}
                    />
                  )}
                </div>
              )}
              
              {currentStep === 3 && (
                <StorySaveOptions
                  story={activeJob ? transformJobToStory(getJob(activeJob)) : null}
                  onSave={handleSaveStory}
                  onGenerateVideo={handleGenerateVideo}
                  onDownload={handleDownloadStory}
                  onShare={handleShareStory}
                  isSaved={storySaved}
                  savedStoryId={savedStoryData.id}
                  savedVisibility={savedStoryData.visibility}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <button
            onClick={handleBack}
            disabled={currentStep === 0}
            className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </button>

          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <Clock className="h-4 w-4" />
            <span>Step {currentStep + 1} of {STEPS.length}</span>
          </div>

          {currentStep < STEPS.length - 1 && currentStep !== 2 && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleNext}
              disabled={!canProceed}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </motion.button>
          )}

          {currentStep === 2 && !generationInProgress && !generationComplete && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGenerate}
              disabled={!canProceed}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Story
            </motion.button>
          )}

          {currentStep === 2 && generationInProgress && (
            <div className="flex items-center space-x-2 text-blue-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm font-medium">Generating story...</span>
            </div>
          )}

          {currentStep === 2 && generationComplete && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleNext}
              className="btn-primary"
            >
              <ArrowRight className="h-4 w-4 mr-2" />
              Next Step
            </motion.button>
          )}

          {currentStep === STEPS.length - 1 && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleComplete}
              disabled={!generationComplete || isCompleting}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCompleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Completing...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Complete
                </>
              )}
            </motion.button>
          )}
        </div>
      </div>
    </div>
  )
}
