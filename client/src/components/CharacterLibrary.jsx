import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  Plus, 
  Search,
  Calendar,
  Edit,
  Trash2,
  User,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import AuthModal from '../components/AuthModal';

const CharacterLibrary = () => {
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [brokenImages, setBrokenImages] = useState(new Set()); // Track characters with broken images
  const { isAuthenticated, getAuthHeader } = useAuth();

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

  useEffect(() => {
    fetchCharacters();
  }, [isAuthenticated]);

  const fetchCharacters = async () => {
    try {
      setLoading(true);
      // Clear existing characters first to avoid stale data
      setCharacters([]);
      setBrokenImages(new Set()); // Clear broken images tracking
      
      if (!isAuthenticated) {
        // If not authenticated, don't fetch any characters
        setCharacters([]);
        return;
      }
      
      // Only fetch user's own characters when authenticated
      const authHeaders = await getAuthHeader()
      const response = await fetch(`${API_BASE_URL}/upload/my/characters`, {
        headers: {
          ...authHeaders,
          // Add cache busting to ensure fresh data
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        // All characters from /my/characters endpoint are user-owned
        const validCharacters = (data.characters || []).filter(char => {
          // Basic validation - must have id and name
          return char.id && char.name;
        });
        setCharacters(validCharacters);
      }
    } catch (error) {
      console.error('Failed to fetch characters:', error);
      setCharacters([]); // Ensure we clear on error too
    } finally {
      setLoading(false);
    }
  };

  const deleteCharacter = async (characterId) => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }

    try {
      const authHeaders = await getAuthHeader()
      const response = await fetch(`${API_BASE_URL}/upload/${characterId}`, {
        method: 'DELETE',
        headers: {
          ...authHeaders,
        },
      });

      if (response.ok) {
        // Remove from local state immediately
        setCharacters(prev => prev.filter(char => char.id !== characterId));
        // Also refresh from server to ensure consistency
        setTimeout(() => fetchCharacters(), 500);
      } else {
        alert('Failed to delete character');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete character');
      // Refresh on error to see current state
      fetchCharacters();
    }
  };

  const filteredCharacters = characters.filter(character => {
    const matchesSearch = character.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (character.description && character.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Filter out characters with broken images
    const hasValidImage = !brokenImages.has(character.id);
    
    return matchesSearch && hasValidImage;
  });

  const userCharacterCount = characters.length;

  if (loading) {
    return (
      <div className="min-h-screen pt-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-4xl font-bold gradient-text">
              Character Library
            </h1>
            <button
              onClick={fetchCharacters}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
          <p className="text-gray-600 dark:text-gray-300 text-lg">
            Browse and manage your character collection
          </p>
          
          {/* Stats */}
          <div className="flex flex-wrap gap-4 mt-4">
            {isAuthenticated && (
              <div className="bg-blue-50/50 dark:bg-blue-900/50 backdrop-blur-sm rounded-lg px-4 py-2">
                <span className="text-sm text-blue-600 dark:text-blue-300">Your Characters: </span>
                <span className="font-semibold text-blue-700 dark:text-blue-200">{userCharacterCount}</span>
              </div>
            )}
            {!isAuthenticated && (
              <div className="bg-gray-50/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-lg px-4 py-2">
                <span className="text-sm text-gray-600 dark:text-gray-300">Sign in to view your characters</span>
              </div>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl p-6 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Search characters..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Characters Grid */}
        {filteredCharacters.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {searchTerm ? 'No characters found' : 'No characters yet'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {searchTerm 
                ? 'Try adjusting your search terms'
                : isAuthenticated 
                  ? 'Upload some characters to get started'
                  : 'Sign in to view and manage your characters'
              }
            </p>
            {!searchTerm && isAuthenticated && (
              <a
                href="/create"
                className="inline-flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-5 w-5" />
                <span>Upload Character</span>
              </a>
            )}
            {!isAuthenticated && (
              <button
                onClick={() => setShowAuthModal(true)}
                className="inline-flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <User className="h-5 w-5" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredCharacters.map((character, index) => (
              <motion.div
                key={character.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl overflow-hidden hover:shadow-xl transition-all duration-300 group"
              >
                {/* Character Image */}
                <div className="aspect-square relative overflow-hidden bg-gray-100 dark:bg-gray-700">
                  <img
                    src={character.thumbnailUrl || character.imageUrl}
                    alt={character.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      console.warn(`Failed to load image for character ${character.name}:`, character.thumbnailUrl || character.imageUrl);
                      // Add this character to broken images set
                      setBrokenImages(prev => new Set([...prev, character.id]));
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                    onLoad={(e) => {
                      // Remove from broken images set if image loads successfully
                      setBrokenImages(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(character.id);
                        return newSet;
                      });
                      // Hide fallback when image loads successfully
                      e.target.nextSibling.style.display = 'none';
                    }}
                  />
                  <div 
                    className="flex w-full h-full items-center justify-center bg-gray-200 dark:bg-gray-600"
                  >
                    <div className="text-center">
                      <User className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-xs text-gray-500">Image not found</p>
                    </div>
                  </div>
                </div>

                {/* Character Info */}
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1 truncate">
                    {character.name}
                  </h3>
                  
                  {character.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-2 line-clamp-2">
                      {character.description}
                    </p>
                  )}

                  {/* Tags */}
                  {character.tags && character.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {character.tags.slice(0, 3).map((tag, tagIndex) => (
                        <span
                          key={tagIndex}
                          className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                      {character.tags.length > 3 && (
                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded-full">
                          +{character.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Creation Date */}
                  <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mb-3">
                    <Calendar className="h-3 w-3 mr-1" />
                    {new Date(character.createdAt).toLocaleDateString()}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {character.source === 'supabase' ? 'Cloud' : 'Local'}
                    </span>
                    
                    {character.isOwner && isAuthenticated && (
                      <div className="flex items-center space-x-1">
                        <button className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                          <Edit className="h-4 w-4 text-gray-500" />
                        </button>
                        <button 
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this character?')) {
                              deleteCharacter(character.id);
                            }
                          }}
                          className="p-1 hover:bg-red-50 dark:hover:bg-red-900/50 rounded"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {!isAuthenticated && (
          <div className="mt-8 text-center p-6 bg-blue-50/50 dark:bg-blue-900/20 backdrop-blur-sm rounded-xl">
            <User className="h-12 w-12 text-blue-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
              Sign in to manage your characters
            </h3>
            <p className="text-blue-700 dark:text-blue-300 mb-4">
              Create an account to save and manage your uploaded characters across devices
            </p>
            <button
              onClick={() => setShowAuthModal(true)}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Sign In
            </button>
          </div>
        )}
      </div>

      {/* Auth Modal */}
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
      />
    </div>
  );
};

export default CharacterLibrary;
