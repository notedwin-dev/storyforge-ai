import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  XCircle,
  RefreshCw,
  Zap,
  Video,
  FileText,
  Palette
} from 'lucide-react'
import { useJobStore } from '../../lib/stores'
import { storyAPI } from '../../lib/api'

const STEP_ICONS = {
  character_loading: FileText,
  story_generation: Zap,
  storyboard_generation: Palette,
  video_generation: Video,
  finalization: CheckCircle
}

const STEP_DESCRIPTIONS = {
  character_loading: 'Loading character DNA profile...',
  story_generation: 'Creating story with AI...',
  storyboard_generation: 'Generating storyboard with character...',
  video_generation: 'Synthesizing final video...',
  finalization: 'Finalizing your story...'
}

export default function GenerationProgress({ jobId, onComplete, onError }) {
  const [job, setJob] = useState(null)
  const [timeElapsed, setTimeElapsed] = useState(0)
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState(null)
  const [isPolling, setIsPolling] = useState(true)
  const { getJob, updateJob } = useJobStore()

  // Timer for elapsed time
  useEffect(() => {
    if (!job || job.status === 'completed' || job.status === 'failed') return

    const timer = setInterval(() => {
      setTimeElapsed(prev => prev + 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [job?.status])

  // Calculate elapsed time from server data if available
  useEffect(() => {
    if (job?.createdAt) {
      const startTime = new Date(job.createdAt).getTime()
      const now = Date.now()
      const elapsed = Math.floor((now - startTime) / 1000)
      setTimeElapsed(elapsed)
    }
  }, [job?.createdAt])

  // Calculate estimated time remaining
  useEffect(() => {
    if (!job || !job.estimatedDuration) return

    const progressPercent = job.progress || 0
    const totalTime = job.estimatedDuration
    const elapsed = timeElapsed
    
    if (progressPercent > 0) {
      const estimatedTotal = (elapsed / progressPercent) * 100
      const remaining = Math.max(0, Math.round(estimatedTotal - elapsed))
      setEstimatedTimeRemaining(remaining)
    } else if (totalTime) {
      setEstimatedTimeRemaining(totalTime - elapsed)
    }
  }, [job?.progress, timeElapsed, job?.estimatedDuration])

  // Poll for job updates
  useEffect(() => {
    if (!jobId || !isPolling) return

    const pollInterval = setInterval(async () => {
      try {
        console.log(`Polling status for job: ${jobId}`)
        const response = await storyAPI.getGenerationStatus(jobId)
        console.log('Poll response:', response)
        
        // Handle the new response format
        const jobData = response.data || response
        
        setJob(jobData)
        updateJob(jobId, jobData)

        // Check if job is complete
        if (jobData.status === 'completed') {
          console.log('Job completed, stopping polling')
          setIsPolling(false)
          onComplete?.(jobData)
        } else if (jobData.status === 'failed') {
          console.log('Job failed, stopping polling')
          setIsPolling(false)
          onError?.(jobData)
        }
      } catch (error) {
        console.error('Failed to poll job status:', error)
        
        // If job not found, retry a few times before giving up
        if (error.response?.status === 404) {
          console.warn('Job not found, will retry in next poll...')
          // Don't stop polling immediately - the job might be restored from disk
          // Only stop after multiple consecutive failures
        } else {
          // For other errors, continue polling
          console.error('Polling error, continuing...', error.message)
        }
      }
    }, 2000) // Poll every 2 seconds

    return () => clearInterval(pollInterval)
  }, [jobId, isPolling, updateJob, onComplete, onError])

  // Initial job load
  useEffect(() => {
    if (jobId) {
      const cachedJob = getJob(jobId)
      if (cachedJob) {
        setJob(cachedJob)
      }
    }
  }, [jobId, getJob])

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getStepStatus = (step) => {
    if (step.status === 'completed') return 'completed'
    if (step.status === 'processing') return 'active'
    if (step.status === 'failed') return 'error'
    return 'pending'
  }

  const getOverallStatus = () => {
    if (!job) return 'loading'
    if (job.status === 'completed') return 'completed'
    if (job.status === 'failed') return 'error'
    if (job.status === 'cancelled') return 'cancelled'
    return 'processing'
  }

  const retryGeneration = async () => {
    if (!jobId) return
    
    try {
      setIsPolling(true)
      // The backend should handle retry logic
      const response = await storyAPI.retryGeneration(jobId)
      if (response.data.success) {
        setJob(prev => ({ ...prev, status: 'processing', error: null }))
      }
    } catch (error) {
      console.error('Failed to retry generation:', error)
    }
  }

  if (!job && !jobId) {
    return null
  }

  const status = getOverallStatus()

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-lg p-6 space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {status === 'processing' && (
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          )}
          {status === 'completed' && (
            <CheckCircle className="w-6 h-6 text-green-500" />
          )}
          {status === 'error' && (
            <XCircle className="w-6 h-6 text-red-500" />
          )}
          {status === 'loading' && (
            <Clock className="w-6 h-6 text-gray-400" />
          )}
          
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {status === 'processing' && 'Generating Your Story...'}
              {status === 'completed' && 'Story Complete!'}
              {status === 'error' && 'Generation Failed'}
              {status === 'loading' && 'Initializing...'}
            </h3>
            <p className="text-sm text-gray-500">
              {job?.message || 'Preparing story generation...'}
            </p>
          </div>
        </div>

        {/* Time Info */}
        <div className="text-right text-sm">
          <div className="text-gray-900 font-medium">
            Elapsed: {formatTime(timeElapsed)}
          </div>
          {estimatedTimeRemaining !== null && estimatedTimeRemaining > 0 && (
            <div className="text-gray-500">
              ~{formatTime(estimatedTimeRemaining)} remaining
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Progress</span>
          <span className="text-gray-900 font-medium">{job?.progress || 0}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${
              status === 'error' ? 'bg-red-500' : 
              status === 'completed' ? 'bg-green-500' : 'bg-blue-500'
            }`}
            initial={{ width: 0 }}
            animate={{ width: `${job?.progress || 0}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Steps */}
      {job?.steps && job.steps.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700">Generation Steps</h4>
          <div className="space-y-2">
            {job.steps.map((step, index) => {
              const stepStatus = getStepStatus(step)
              const StepIcon = STEP_ICONS[step.name] || Clock
              
              return (
                <motion.div
                  key={step.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`flex items-center space-x-3 p-3 rounded-lg border ${
                    stepStatus === 'completed' ? 'bg-green-50 border-green-200' :
                    stepStatus === 'active' ? 'bg-blue-50 border-blue-200' :
                    stepStatus === 'error' ? 'bg-red-50 border-red-200' :
                    'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className={`flex-shrink-0 ${
                    stepStatus === 'completed' ? 'text-green-600' :
                    stepStatus === 'active' ? 'text-blue-600' :
                    stepStatus === 'error' ? 'text-red-600' :
                    'text-gray-400'
                  }`}>
                    {stepStatus === 'active' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : stepStatus === 'completed' ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : stepStatus === 'error' ? (
                      <XCircle className="w-4 h-4" />
                    ) : (
                      <StepIcon className="w-4 h-4" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className={`text-sm font-medium ${
                        stepStatus === 'completed' ? 'text-green-800' :
                        stepStatus === 'active' ? 'text-blue-800' :
                        stepStatus === 'error' ? 'text-red-800' :
                        'text-gray-600'
                      }`}>
                        {STEP_DESCRIPTIONS[step.name] || step.name}
                      </p>
                      {step.estimatedTime && (
                        <span className="text-xs text-gray-500">
                          ~{step.estimatedTime}s
                        </span>
                      )}
                    </div>
                    {step.error && (
                      <p className="text-xs text-red-600 mt-1">{step.error}</p>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      )}

      {/* Error Section */}
      {status === 'error' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-red-50 border border-red-200 rounded-lg p-4"
        >
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-medium text-red-800">Generation Failed</h4>
              <p className="text-sm text-red-700 mt-1">
                {job?.error || 'An unexpected error occurred during generation.'}
              </p>
              <button
                onClick={retryGeneration}
                className="mt-3 inline-flex items-center space-x-1 text-sm text-red-600 hover:text-red-800 font-medium"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Retry Generation</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Success Section */}
      {status === 'completed' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-green-50 border border-green-200 rounded-lg p-4"
        >
          <div className="flex items-center space-x-3">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <div>
              <h4 className="text-sm font-medium text-green-800">Story Generated Successfully!</h4>
              <p className="text-sm text-green-700 mt-1">
                Your story is ready to preview and download.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Generation Method Info */}
      {job?.result?.metadata?.generation_method && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center space-x-2 text-sm">
            <Zap className="w-4 h-4 text-blue-500" />
            <span className="text-blue-700">
              Generated using: {
                job.result.metadata.generation_method === 'gemini-ai' ? 'Gemini AI' :
                job.result.metadata.generation_method === 'fallback-engine' ? 'Fallback Engine (Gemini unavailable)' :
                job.result.metadata.generation_method
              }
            </span>
          </div>
        </div>
      )}
    </motion.div>
  )
}
