import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Upload, 
  Image as ImageIcon, 
  X, 
  Plus,
  Loader2,
  Tag,
  User,
  Star,
  Zap,
  LogIn,
  Users
} from 'lucide-react'
import toast from 'react-hot-toast'

import { characterAPI } from '../../lib/api'
import { useCharacterStore, useUIStore } from '../../lib/stores'
import { useAuth } from '../../contexts/AuthContext'
import { formatFileSize, isValidImageFile } from '../../lib/utils'
import AuthModal from '../AuthModal'
import CharacterLibrary from '../CharacterLibrary'

export default function CharacterUpload({ selectedCharacter, onCharacterSelect }) {
  const [uploadedFile, setUploadedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [metadata, setMetadata] = useState({ name: '', tags: '' })
  const [uploading, setUploading] = useState(false)
  const [activeTab, setActiveTab] = useState('demo') // 'demo', 'upload', 'library'
  const [demoCharacters, setDemoCharacters] = useState([])
  const [loadingDemo, setLoadingDemo] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [userCharacters, setUserCharacters] = useState([]) // Separate state for user characters
  const [loadingUserCharacters, setLoadingUserCharacters] = useState(false)

  const { characters, addCharacter, selectCharacter, setCharacters, clearCharacters } = useCharacterStore()
  const { setLoading } = useUIStore()
  const { isAuthenticated, getAuthHeader } = useAuth()

  // API base URL for server resources
  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

  // Simple UUID generator for fallback
  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Load demo characters on component mount
  useEffect(() => {
    loadDemoCharacters()
  }, [])

  // Load user characters when authentication changes
  useEffect(() => {
    if (isAuthenticated) {
      // Clear any cached data first
      setUserCharacters([])
      clearCharacters() // Clear the entire character store cache
      // Force reload user characters
      loadUserCharacters()
    } else {
      setUserCharacters([])
      clearCharacters() // Clear cache when logging out too
    }
  }, [isAuthenticated, clearCharacters])

  const loadDemoCharacters = async () => {
    try {
      setLoadingDemo(true)
      const response = await characterAPI.getDemoCharacters()
      if (response.success) {
        setDemoCharacters(response.characters)
      }
    } catch (error) {
      console.error('Failed to load demo characters:', error)
      // Fallback demo characters
      setDemoCharacters([
        {
          id: 'astronaut_cat',
          name: 'Astro Cat',
          description: 'A brave feline astronaut exploring the cosmos',
          traits: ['brave', 'curious', 'adventurous', 'feline', 'space']
        },
        {
          id: 'dragon_knight',
          name: 'Dragon Knight',
          description: 'A noble warrior bonded with an ancient dragon',
          traits: ['noble', 'strong', 'magical', 'warrior', 'dragon']
        },
        {
          id: 'mystical_wizard',
          name: 'Mystical Wizard',
          description: 'An ancient spellcaster with profound magical knowledge',
          traits: ['wise', 'magical', 'ancient', 'powerful', 'mystical']
        },
        {
          id: 'cyber_ninja',
          name: 'Cyber Ninja',
          description: 'A stealthy warrior from the digital future',
          traits: ['stealthy', 'fast', 'technological', 'ninja', 'cyber']
        }
      ])
    } finally {
      setLoadingDemo(false)
    }
  }

  const loadUserCharacters = async () => {
    try {
      setLoadingUserCharacters(true)
      const response = await characterAPI.getUserCharacters()
      if (response.success) {
        // Filter characters based on user authentication status
        const validUserCharacters = (response.characters || []).filter(character => {
          // For authenticated users, show owned characters
          if (isAuthenticated) {
            return character.id && 
                   character.name && 
                   character.isOwned !== false
          } else {
            // For anonymous users, show local uploaded characters (not demo characters)
            return character.id && 
                   character.name && 
                   character.source === 'local' &&
                   !character.id.includes('demo') &&
                   !['astronaut_cat', 'dragon_knight', 'mystical_wizard', 'cyber_ninja'].includes(character.id)
          }
        })
        
        console.log(`Loaded ${validUserCharacters.length} user characters for ${isAuthenticated ? 'authenticated' : 'anonymous'} user`)
        setUserCharacters(validUserCharacters)
      }
    } catch (error) {
      console.error('Failed to load user characters:', error)
      setUserCharacters([])
    } finally {
      setLoadingUserCharacters(false)
    }
  }

  const handleDemoSelect = async (demoCharacter) => {
    try {
      setLoading('characters', true)
      const response = await characterAPI.selectDemoCharacter(demoCharacter.id)
      
      if (response.success) {
        const character = response.character
        addCharacter(character)
        selectCharacter(character)
        
        toast.success(`${character.name} selected!`)
        onCharacterSelect(character)
      }
    } catch (error) {
      console.error('Demo character selection failed:', error)
      // Fallback: create character data locally
      const character = {
        id: demoCharacter.id,
        name: demoCharacter.name,
        description: demoCharacter.description,
        traits: demoCharacter.traits,
        imageUrl: `/demo/${demoCharacter.id}.jpg`,
        thumbnailUrl: `/demo/${demoCharacter.id}_thumb.jpg`,
        is_demo: true,
        dna_id: generateUUID() // Use proper UUID
      }
      
      addCharacter(character)
      selectCharacter(character)
      toast.success(`${character.name} selected!`)
      onCharacterSelect(character)
    } finally {
      setLoading('characters', false)
    }
  }

  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    if (rejectedFiles.length > 0) {
      toast.error('Please upload a valid image file (JPEG, PNG, or WebP)')
      return
    }

    const file = acceptedFiles[0]
    if (!file) return

    if (!isValidImageFile(file)) {
      toast.error('Invalid file type. Please upload JPEG, PNG, or WebP images.')
      return
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB
      toast.error('File is too large. Maximum size is 10MB.')
      return
    }

    setUploadedFile(file)
    
    // Create preview URL
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)

    // Auto-fill name from filename
    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '')
    setMetadata(prev => ({
      ...prev,
      name: prev.name || nameWithoutExt
    }))
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp']
    },
    multiple: false,
    maxSize: 10 * 1024 * 1024 // 10MB
  })

  const handleUpload = async () => {
    if (!uploadedFile) {
      toast.error('Please select an image first')
      return
    }

    try {
      setUploading(true)
      setLoading('characters', true)

      const authHeaders = await getAuthHeader()
      const response = await characterAPI.upload(uploadedFile, metadata, authHeaders)
      
      if (response.success) {
        // Create a proper character object with dna_id
        const newCharacter = {
          ...response.character,
          dna_id: response.dna_id // Ensure dna_id is included
        }
        
        addCharacter(newCharacter)
        selectCharacter(newCharacter)
        setUserCharacters(prev => [newCharacter, ...prev]) // Add to user characters list
        
        toast.success('Character uploaded successfully!')
        
        // Reset form
        setUploadedFile(null)
        setPreviewUrl(null)
        setMetadata({ name: '', tags: '' })
        
        // Auto-select and proceed
        onCharacterSelect(newCharacter)
      }
    } catch (error) {
      console.error('Upload failed:', error)
      toast.error('Upload failed. Please try again.')
    } finally {
      setUploading(false)
      setLoading('characters', false)
    }
  }

  const handleSelectExisting = (character) => {
    console.log('Selecting existing character:', character)
    
    // Ensure the character has a dna_id field
    const characterWithDnaId = {
      ...character,
      dna_id: character.dna_id || character.id
    }
    
    console.log('Character with dna_id:', characterWithDnaId)
    selectCharacter(characterWithDnaId)
    onCharacterSelect(characterWithDnaId)
  }

  const clearUpload = () => {
    setUploadedFile(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
    setMetadata({ name: '', tags: '' })
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-heading font-bold text-gray-900 dark:text-white mb-2">
          Choose Your Character
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          Select a demo character or upload your own image to create a unique DNA profile.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('demo')}
          className={`
            flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200
            ${activeTab === 'demo' 
              ? 'bg-white dark:bg-gray-700 text-primary-600 shadow-sm' 
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }
          `}
        >
          <Star className="h-4 w-4 mr-2 inline" />
          Demo Characters
        </button>
        <button
          onClick={() => setActiveTab('upload')}
          className={`
            flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200
            ${activeTab === 'upload' 
              ? 'bg-white dark:bg-gray-700 text-primary-600 shadow-sm' 
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }
          `}
        >
          <Upload className="h-4 w-4 mr-2 inline" />
          Upload New
        </button>
        <button
          onClick={() => {
            if (!isAuthenticated) {
              setShowAuthModal(true);
              return;
            }
            setActiveTab('library');
          }}
          className={`
            flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 relative
            ${activeTab === 'library' 
              ? 'bg-white dark:bg-gray-700 text-primary-600 shadow-sm' 
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }
          `}
        >
          <Users className="h-4 w-4 mr-2 inline" />
          My Characters
          {!isAuthenticated && (
            <LogIn className="h-3 w-3 ml-1 inline opacity-50" />
          )}
        </button>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'demo' && (
          <motion.div
            key="demo"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {loadingDemo ? (
              <div className="text-center py-12">
                <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary-600 mb-4" />
                <p className="text-gray-500">Loading demo characters...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {demoCharacters.map((character) => (
                  <motion.button
                    key={character.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleDemoSelect(character)}
                    className="group relative bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-all duration-200"
                  >
                    <div className="aspect-square rounded-lg overflow-hidden bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900 dark:to-primary-800 mb-4">
                      <img
                        src={`/demo/${character.id}.jpg`}
                        alt={character.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Fallback to colored rectangle
                          e.target.style.display = 'none'
                        }}
                      />
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-center">
                          <Zap className="h-8 w-8 mx-auto text-primary-600 mb-2" />
                          <p className="text-sm font-medium text-primary-700">{character.name}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-left">
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                        {character.name}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                        {character.description}
                      </p>
                      
                      {character.traits && (
                        <div className="flex flex-wrap gap-1">
                          {character.traits.slice(0, 3).map((trait) => (
                            <span
                              key={trait}
                              className="inline-block px-2 py-1 text-xs bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 rounded-full"
                            >
                              {trait}
                            </span>
                          ))}
                          {character.traits.length > 3 && (
                            <span className="inline-block px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
                              +{character.traits.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="bg-primary-600 text-white rounded-full p-1">
                        <Plus className="h-4 w-4" />
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {/* Existing Characters */}
            {isAuthenticated && (
              <div>
                {loadingUserCharacters ? (
                  <div className="text-center py-8">
                    <Loader2 className="h-6 w-6 mx-auto animate-spin text-primary-600 mb-2" />
                    <p className="text-gray-500">Loading your characters...</p>
                  </div>
                ) : userCharacters.length > 0 ? (
                  <>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Your Character Library:
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-6">
                      {userCharacters.slice(0, 8).map((character) => (
                        <motion.button
                          key={character.id}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleSelectExisting(character)}
                          className={`
                            relative aspect-square rounded-lg overflow-hidden border-2 transition-all duration-200
                            ${selectedCharacter?.id === character.id 
                              ? 'border-primary-500 shadow-glow' 
                              : 'border-gray-200 hover:border-primary-300'
                            }
                          `}
                        >
                          <img
                            src={character.thumbnailUrl}
                            alt={character.name}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent" />
                          <div className="absolute bottom-2 left-2 right-2">
                            <p className="text-white text-sm font-medium truncate">
                              {character.name}
                            </p>
                          </div>
                          {selectedCharacter?.id === character.id && (
                            <div className="absolute top-2 right-2 bg-success-500 rounded-full p-1">
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="w-2 h-2 bg-white rounded-full"
                              />
                            </div>
                          )}
                        </motion.button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 px-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700">
                    <User className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      No characters yet
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                      Upload your first character using the form below or select a demo character to get started.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Upload Section */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-8">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Upload New Character:
              </h3>

              {!uploadedFile ? (
                <motion.div
                  {...getRootProps()}
                  whileHover={{ scale: 1.01 }}
                  className={`
                    relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200
                    ${isDragActive 
                      ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20' 
                      : 'border-gray-300 hover:border-primary-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800/50'
                    }
                  `}
                >
                  <input {...getInputProps()} />
                  <div className="space-y-4">
                    <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                      <Upload className="h-8 w-8 text-gray-400" />
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {isDragActive ? 'Drop your image here' : 'Upload character image'}
                      </h4>
                      <p className="text-gray-600 dark:text-gray-300 mt-1">
                        Drag and drop or click to browse
                      </p>
                      <p className="text-sm text-gray-500 mt-2">
                        Supports JPEG, PNG, WebP • Max 10MB
                      </p>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="space-y-6">
                  {/* Preview */}
                  <div className="relative">
                    <div className="aspect-video bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                      <img
                        src={previewUrl}
                        alt="Preview"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <button
                      onClick={clearUpload}
                      className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* File info */}
                  <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <ImageIcon className="h-5 w-5 text-gray-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {uploadedFile.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatFileSize(uploadedFile.size)}
                      </p>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label">
                        <User className="h-4 w-4 mr-1" />
                        Character Name
                      </label>
                      <input
                        type="text"
                        value={metadata.name}
                        onChange={(e) => setMetadata(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Enter character name"
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="label">
                        <Tag className="h-4 w-4 mr-1" />
                        Tags (optional)
                      </label>
                      <input
                        type="text"
                        value={metadata.tags}
                        onChange={(e) => setMetadata(prev => ({ ...prev, tags: e.target.value }))}
                        placeholder="hero, warrior, magic"
                        className="input"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Separate multiple tags with commas
                      </p>
                    </div>
                  </div>

                  {/* Upload button */}
                  <div className="flex space-x-3">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleUpload}
                      disabled={uploading || !metadata.name.trim()}
                      className="btn-primary flex-1 disabled:opacity-50"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Create Character DNA
                        </>
                      )}
                    </motion.button>
                    
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={clearUpload}
                      className="btn-secondary"
                    >
                      Cancel
                    </motion.button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Library Tab */}
        {activeTab === 'library' && isAuthenticated && (
          <motion.div
            key="library"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <CharacterLibrary onCharacterSelect={onCharacterSelect} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Auth Modal */}
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
      />
    </div>
  )
}
