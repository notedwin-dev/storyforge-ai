import axios from 'axios'
import toast from 'react-hot-toast'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

// Helper to get the server base URL for static files
export const getServerBaseURL = () => {
  if (import.meta.env.VITE_API_URL) {
    // If VITE_API_URL is set, extract the base URL (remove /api)
    return import.meta.env.VITE_API_URL.replace('/api', '')
  }
  // Default to current origin for relative URLs
  return window.location.origin
}

// Helper function to construct full image URLs
export const getImageURL = (relativePath) => {
  if (!relativePath) return null
  if (relativePath.startsWith('http')) return relativePath // Already full URL
  return `${getServerBaseURL()}${relativePath}`
}

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds for most requests
  headers: {
    'Content-Type': 'application/json',
  },
})

// Create axios instance for long-running operations like story generation
const longTimeoutApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 900000, // 15 minutes for story generation
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor for both APIs
const requestInterceptor = async (config) => {
  // Add auth token if available
  const token = localStorage.getItem('auth_token')
  if (token) {
    try {
      // Check if token is about to expire
      const payload = JSON.parse(atob(token.split('.')[1]))
      const exp = payload.exp * 1000 // Convert to milliseconds
      const now = Date.now()
      
      // If token expires in less than 5 minutes, refresh it
      if (exp - now < 5 * 60 * 1000) {
        const refreshToken = localStorage.getItem('refresh_token')
        if (refreshToken) {
          try {
            const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ refresh_token: refreshToken }),
            })
            
            if (response.ok) {
              const data = await response.json()
              localStorage.setItem('auth_token', data.session.access_token)
              localStorage.setItem('refresh_token', data.session.refresh_token)
              config.headers.Authorization = `Bearer ${data.session.access_token}`
            } else {
              // Refresh failed, remove tokens
              localStorage.removeItem('auth_token')
              localStorage.removeItem('refresh_token')
            }
          } catch (refreshError) {
            console.error('Token refresh failed:', refreshError)
            localStorage.removeItem('auth_token')
            localStorage.removeItem('refresh_token')
          }
        }
      } else {
        config.headers.Authorization = `Bearer ${token}`
      }
    } catch (error) {
      console.error('Error parsing token:', error)
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  
  return config
}

// Response interceptor factory for both APIs
const createResponseInterceptor = (apiInstance) => async (error) => {
  const originalRequest = error.config
  
  // If we get a 401 or 403 and haven't already tried to refresh
  if ((error.response?.status === 401 || error.response?.status === 403) && !originalRequest._retry) {
    originalRequest._retry = true
    
    const refreshToken = localStorage.getItem('refresh_token')
    if (refreshToken) {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refresh_token: refreshToken }),
        })
        
        if (response.ok) {
          const data = await response.json()
          localStorage.setItem('auth_token', data.session.access_token)
          localStorage.setItem('refresh_token', data.session.refresh_token)
          
          // Retry the original request with new token
          originalRequest.headers.Authorization = `Bearer ${data.session.access_token}`
          return apiInstance(originalRequest)
        } else {
          // Refresh failed, remove tokens and redirect to login
          localStorage.removeItem('auth_token')
          localStorage.removeItem('refresh_token')
          window.location.href = '/login'
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError)
        localStorage.removeItem('auth_token')
        localStorage.removeItem('refresh_token')
        window.location.href = '/login'
      }
    } else {
      // No refresh token, redirect to login
      window.location.href = '/login'
    }
  }
  
  return Promise.reject(error)
}

// Request interceptor
api.interceptors.request.use(requestInterceptor, (error) => Promise.reject(error))
longTimeoutApi.interceptors.request.use(requestInterceptor, (error) => Promise.reject(error))

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Try to handle auth errors first
    try {
      return await createResponseInterceptor(api)(error)
    } catch (authError) {
      // If auth handling fails, continue with error processing
      const message = error.response?.data?.message || error.message || 'An error occurred'
      
      // Don't show toast for certain endpoints
      const silentEndpoints = ['/status/', '/health']
      const shouldShowToast = !silentEndpoints.some(endpoint => 
        error.config?.url?.includes(endpoint)
      )
      
      if (shouldShowToast) {
        toast.error(message)
      }
      
      return Promise.reject(error)
    }
  }
)

// Response interceptor for long timeout API (no toast for timeouts during generation)
longTimeoutApi.interceptors.response.use(
  (response) => response,
  createResponseInterceptor(longTimeoutApi)
)

// Character DNA API
export const characterAPI = {
  upload: async (file, metadata = {}, authHeaders = {}) => {
    const formData = new FormData()
    formData.append('character', file)
    
    if (metadata.name) formData.append('name', metadata.name)
    if (metadata.tags) formData.append('tags', metadata.tags)
    if (metadata.description) formData.append('description', metadata.description)
    
    const response = await api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        ...authHeaders
      },
    })
    return response.data
  },
  
  get: async (id) => {
    const response = await api.get(`/upload/${id}`)
    return response.data
  },
  
  list: async () => {
    const response = await api.get('/upload')
    return response.data
  },

  // User character management
  getUserCharacters: async () => {
    // Try authenticated endpoint first, fall back to general listing
    try {
      const response = await api.get('/upload/my/characters')
      return response.data
    } catch (error) {
      // If authentication fails, try the general endpoint for local characters
      if (error.response?.status === 401 || error.response?.status === 403) {
        const response = await api.get('/upload')
        return response.data
      }
      throw error
    }
  },

  updateCharacter: async (id, data) => {
    const response = await api.put(`/upload/${id}`, data)
    return response.data
  },

  deleteCharacter: async (id) => {
    const response = await api.delete(`/upload/${id}`)
    return response.data
  },
  
  // Demo character functions
  getDemoCharacters: async () => {
    const response = await api.get('/upload/demo-characters')
    return response.data
  },
  
  selectDemoCharacter: async (characterId) => {
    const response = await api.post('/upload/demo-character', { characterId })
    return response.data
  }
}

// Story Generation API
export const storyAPI = {
  generate: async (params) => {
    const response = await longTimeoutApi.post('/generate', params)
    return response.data
  },
  
  getStatus: async (jobId) => {
    const response = await api.get(`/generate/${jobId}/status`)
    return response.data
  },
  
  getGenerationStatus: async (jobId) => {
    const response = await api.get(`/generate/${jobId}/status`)
    return response.data
  },
  
  retryGeneration: async (jobId) => {
    const response = await longTimeoutApi.post(`/generate/${jobId}/retry`)
    return response.data
  },
  
  cancel: async (jobId) => {
    const response = await api.delete(`/generate/${jobId}`)
    return response.data
  },

  // Story management functions
  saveStory: async (params) => {
    const response = await api.post('/stories/save', params)
    return response.data
  },

  getMyStories: async (limit = 20, offset = 0) => {
    const response = await api.get(`/stories/my-stories?limit=${limit}&offset=${offset}`)
    return response.data
  },

  deleteStory: async (storyId) => {
    const response = await api.delete(`/stories/${storyId}`)
    return response.data
  },

  generateVideo: async (storyId) => {
    const response = await longTimeoutApi.post(`/stories/${storyId}/generate-video`)
    return response.data
  }
}

// Status API
export const statusAPI = {
  get: async (jobId) => {
    const response = await api.get(`/status/${jobId}`)
    return response.data
  }
}

// Export API
export const exportAPI = {
  pdf: async (jobId, options = {}) => {
    const response = await api.post('/export/pdf', {
      job_id: jobId,
      ...options
    })
    return response.data
  },
  
  share: async (jobId, metadata = {}) => {
    const response = await api.post('/export/share', {
      job_id: jobId,
      ...metadata
    })
    return response.data
  },
  
  getShared: async (shareId) => {
    const response = await api.get(`/export/share/${shareId}`)
    return response.data
  }
}

// Voice API
export const voiceAPI = {
  getVoices: async () => {
    const response = await api.get('/voices')
    return response.data
  },
  
  narrate: async (params) => {
    const response = await api.post('/voices/narrate', params)
    return response.data
  }
}

// Health check
export const healthAPI = {
  check: async () => {
    const response = await api.get('/health')
    return response.data
  }
}

// WebSocket connection for real-time updates
export class StorySocket {
  constructor() {
    this.ws = null
    this.listeners = new Map()
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 5
  }
  
  connect() {
    // Connect to backend WebSocket server, not the frontend dev server
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
    const wsUrl = API_BASE_URL.replace('http://', 'ws://').replace('https://', 'wss://') + '/ws'
    
    console.log('Connecting to WebSocket:', wsUrl) // Debug log
    
    try {
      this.ws = new WebSocket(wsUrl)
      
      // Add connection timeout
      const connectionTimeout = setTimeout(() => {
        if (this.ws.readyState === WebSocket.CONNECTING) {
          console.warn('WebSocket connection timeout')
          this.ws.close()
        }
      }, 5000) // 5 second timeout
      
      this.ws.onopen = () => {
        clearTimeout(connectionTimeout) // Clear timeout on successful connection
        console.log('WebSocket connected')
        this.reconnectAttempts = 0
        this.emit('connected')
      }
      
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          this.emit(data.type, data)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }
      
      this.ws.onclose = (event) => {
        clearTimeout(connectionTimeout) // Clear timeout on close
        console.log('WebSocket disconnected:', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        })
        this.emit('disconnected')
        
        // Only reconnect if it wasn't a clean close
        if (!event.wasClean && event.code !== 1000) {
          this.reconnect()
        }
      }
      
      this.ws.onerror = (error) => {
        clearTimeout(connectionTimeout) // Clear timeout on error
        console.error('WebSocket error details:', {
          error,
          readyState: this.ws?.readyState,
          url: this.ws?.url
        })
        this.emit('error', error)
      }
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error)
    }
  }
  
  reconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      const delay = Math.pow(2, this.reconnectAttempts) * 1000 // Exponential backoff
      
      console.log(`Reconnecting WebSocket (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`)
      setTimeout(() => {
        this.connect()
      }, delay)
    } else {
      console.warn('Max WebSocket reconnection attempts reached. WebSocket will remain disconnected.')
    }
  }
  
  subscribe(jobId) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'subscribe',
        job_id: jobId
      }))
    }
  }
  
  unsubscribe(jobId) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'unsubscribe',
        job_id: jobId
      }))
    }
  }
  
  on(event, listener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event).push(listener)
  }
  
  off(event, listener) {
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      const index = eventListeners.indexOf(listener)
      if (index > -1) {
        eventListeners.splice(index, 1)
      }
    }
  }
  
  emit(event, data) {
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      eventListeners.forEach(listener => listener(data))
    }
  }
  
  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.listeners.clear()
  }
}

// Singleton socket instance
export const storySocket = new StorySocket()

// Utility functions
export const downloadFile = (url, filename) => {
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export const shareUrl = async (url, title = 'Check out my StoryForge AI story!') => {
  if (navigator.share) {
    try {
      await navigator.share({
        title,
        url
      })
    } catch (error) {
      // Fallback to clipboard
      await navigator.clipboard.writeText(url)
      toast.success('Link copied to clipboard!')
    }
  } else {
    // Fallback to clipboard
    await navigator.clipboard.writeText(url)
    toast.success('Link copied to clipboard!')
  }
}

export default api
