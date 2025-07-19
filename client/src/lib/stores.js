import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Character store
export const useCharacterStore = create(
  persist(
    (set, get) => ({
      characters: [],
      selectedCharacter: null,
      
      setCharacters: (characters) => set({ characters }),
      
      addCharacter: (character) => set((state) => ({
        characters: [character, ...state.characters]
      })),
      
      selectCharacter: (character) => set({ selectedCharacter: character }),
      
      removeCharacter: (characterId) => set((state) => ({
        characters: state.characters.filter(c => c.id !== characterId),
        selectedCharacter: state.selectedCharacter?.id === characterId 
          ? null 
          : state.selectedCharacter
      })),
      
      updateCharacter: (characterId, updates) => set((state) => ({
        characters: state.characters.map(c => 
          c.id === characterId ? { ...c, ...updates } : c
        ),
        selectedCharacter: state.selectedCharacter?.id === characterId
          ? { ...state.selectedCharacter, ...updates }
          : state.selectedCharacter
      })),
      
      clearCharacters: () => set({ characters: [], selectedCharacter: null })
    }),
    {
      name: 'character-store',
      partialize: (state) => ({
        characters: state.characters,
        selectedCharacter: state.selectedCharacter
      })
    }
  )
)

// Story store
export const useStoryStore = create((set, get) => ({
  stories: new Map(),
  currentStory: null,
  
  setStory: (jobId, story) => set((state) => {
    const newStories = new Map(state.stories)
    newStories.set(jobId, story)
    return { stories: newStories }
  }),
  
  updateStory: (jobId, updates) => set((state) => {
    const newStories = new Map(state.stories)
    const existingStory = newStories.get(jobId)
    if (existingStory) {
      newStories.set(jobId, { ...existingStory, ...updates })
    }
    return { stories: newStories }
  }),
  
  getStory: (jobId) => {
    return get().stories.get(jobId)
  },
  
  setCurrentStory: (story) => set({ currentStory: story }),
  
  removeStory: (jobId) => set((state) => {
    const newStories = new Map(state.stories)
    newStories.delete(jobId)
    return { stories: newStories }
  }),
  
  clearStories: () => set({ stories: new Map(), currentStory: null })
}))

// Generation job store
export const useJobStore = create((set, get) => ({
  jobs: new Map(),
  activeJob: null,
  
  createJob: (jobId, jobData) => set((state) => {
    const newJobs = new Map(state.jobs)
    newJobs.set(jobId, {
      id: jobId,
      status: 'initializing',
      progress: 0,
      steps: [],
      createdAt: new Date().toISOString(),
      ...jobData
    })
    return { jobs: newJobs, activeJob: jobId }
  }),
  
  updateJob: (jobId, updates) => set((state) => {
    const newJobs = new Map(state.jobs)
    const existingJob = newJobs.get(jobId)
    if (existingJob) {
      newJobs.set(jobId, {
        ...existingJob,
        ...updates,
        updatedAt: new Date().toISOString()
      })
    }
    return { jobs: newJobs }
  }),
  
  getJob: (jobId) => {
    return get().jobs.get(jobId)
  },
  
  setActiveJob: (jobId) => set({ activeJob: jobId }),
  
  removeJob: (jobId) => set((state) => {
    const newJobs = new Map(state.jobs)
    newJobs.delete(jobId)
    return { 
      jobs: newJobs,
      activeJob: state.activeJob === jobId ? null : state.activeJob
    }
  }),
  
  getActiveJobs: () => {
    return Array.from(get().jobs.values()).filter(job => 
      job.status === 'processing' || job.status === 'initializing'
    )
  },
  
  getCompletedJobs: () => {
    return Array.from(get().jobs.values()).filter(job => 
      job.status === 'completed'
    )
  }
}))

// UI store
export const useUIStore = create((set) => ({
  // Navigation
  sidebarOpen: false,
  
  // Modals
  modals: {
    characterUpload: false,
    storyPreview: false,
    exportOptions: false,
    shareDialog: false
  },
  
  // Loading states
  loading: {
    characters: false,
    generation: false,
    export: false
  },
  
  // Errors
  errors: {},
  
  // Theme
  theme: 'light',
  
  // Actions
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  
  openModal: (modalName) => set((state) => ({
    modals: { ...state.modals, [modalName]: true }
  })),
  
  closeModal: (modalName) => set((state) => ({
    modals: { ...state.modals, [modalName]: false }
  })),
  
  closeAllModals: () => set((state) => ({
    modals: Object.keys(state.modals).reduce((acc, key) => ({
      ...acc,
      [key]: false
    }), {})
  })),
  
  setLoading: (key, loading) => set((state) => ({
    loading: { ...state.loading, [key]: loading }
  })),
  
  setError: (key, error) => set((state) => ({
    errors: { ...state.errors, [key]: error }
  })),
  
  clearError: (key) => set((state) => {
    const newErrors = { ...state.errors }
    delete newErrors[key]
    return { errors: newErrors }
  }),
  
  clearAllErrors: () => set({ errors: {} }),
  
  setTheme: (theme) => set({ theme })
}))

// Settings store
export const useSettingsStore = create(
  persist(
    (set) => ({
      // Generation preferences
      defaultStyle: 'cartoon',
      defaultGenre: 'adventure',
      defaultDuration: 30,
      defaultResolution: { width: 640, height: 360 },
      
      // Export preferences
      watermarkEnabled: true,
      includeMetadata: true,
      
      // Audio preferences
      defaultVoice: null,
      audioEnabled: true,
      
      // Notification preferences
      notifications: {
        generationComplete: true,
        errors: true,
        updates: false
      },
      
      // Actions
      updateSetting: (key, value) => set((state) => ({
        [key]: value
      })),
      
      updateNotificationSetting: (key, value) => set((state) => ({
        notifications: { ...state.notifications, [key]: value }
      })),
      
      resetSettings: () => set({
        defaultStyle: 'cartoon',
        defaultGenre: 'adventure',
        defaultDuration: 30,
        defaultResolution: { width: 640, height: 360 },
        watermarkEnabled: true,
        includeMetadata: true,
        defaultVoice: null,
        audioEnabled: true,
        notifications: {
          generationComplete: true,
          errors: true,
          updates: false
        }
      })
    }),
    {
      name: 'settings-store'
    }
  )
)
