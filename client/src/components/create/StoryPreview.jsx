import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen, 
  Download, 
  Share2, 
  Edit3, 
  Eye,
  ChevronDown,
  ChevronUp,
  Clock,
  User,
  Play,
  Film
} from 'lucide-react';
import { getImageURL } from '../../lib/api';

const StoryPreview = ({ story, onEdit, onShare, onDownload, onPlayVideo }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('story');

  if (!story) {
    return (
      <div className="w-full max-w-4xl mx-auto">
        <div className="card p-8 text-center">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No story generated yet</h3>
          <p className="text-gray-600 dark:text-gray-300">Create your characters and generate a story to see it here.</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'story', label: 'Full Story', icon: BookOpen },
    { id: 'scenes', label: 'Scene Breakdown', icon: Film },
    { id: 'storyboard', label: 'Storyboard', icon: Film },
    { id: 'characters', label: 'Characters', icon: User },
    { id: 'metadata', label: 'Details', icon: Eye }
  ];

  // Use fullStory from the backend response, fallback to content for backward compatibility
  const fullStoryText = story.fullStory || story.content || '';
  const previewText = fullStoryText.slice(0, 300) || '';
  const showExpandButton = fullStoryText.length > 300;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-4xl mx-auto space-y-6"
    >
      {/* Header */}
      <div className="card p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {story.title || 'Your Generated Story'}
            </h2>
            <div className="flex items-center text-gray-600 dark:text-gray-300 space-x-4">
              <div className="flex items-center">
                <Clock className="w-4 h-4 mr-1" />
                <span className="text-sm">
                  {story.estimatedDuration || '10-15 min'}
                </span>
              </div>
              <div className="flex items-center">
                <User className="w-4 h-4 mr-1" />
                <span className="text-sm">
                  {story.characters?.length || 0} characters
                </span>
              </div>
              {story.type && (
                <span className="px-2 py-1 bg-primary-100 text-primary-700 text-xs rounded-full font-medium">
                  {story.type}
                </span>
              )}
            </div>
          </div>
          
          {story.videoUrl && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onPlayVideo}
              className="btn-accent ml-4"
            >
              <Play className="w-4 h-4 mr-2" />
              Play Video
            </motion.button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onDownload}
            className="btn-primary"
          >
            <Download className="w-4 h-4 mr-2" />
            Download
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onShare}
            className="btn-secondary"
          >
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onEdit}
            className="btn-secondary"
          >
            <Edit3 className="w-4 h-4 mr-2" />
            Edit
          </motion.button>
        </div>
      </div>

      {/* Content Tabs */}
      <div className="card">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          <AnimatePresence mode="wait">
            {activeTab === 'story' && (
              <motion.div
                key="story"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="prose max-w-none">
                  <div className="whitespace-pre-wrap text-gray-900 dark:text-white leading-relaxed">
                    {isExpanded ? fullStoryText : previewText}
                    {!isExpanded && showExpandButton && '...'}
                  </div>
                </div>
                
                {showExpandButton && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex items-center text-primary-600 hover:text-primary-700 font-medium"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="w-4 h-4 mr-1" />
                        Show Less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4 mr-1" />
                        Read More
                      </>
                    )}
                  </motion.button>
                )}
              </motion.div>
            )}

            {activeTab === 'scenes' && (
              <motion.div
                key="scenes"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {story.scenes && story.scenes.length > 0 ? (
                  <div className="space-y-6">
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Scene Breakdown</h3>
                      <p className="text-gray-600 dark:text-gray-300">Detailed breakdown of each scene in the story</p>
                    </div>
                    
                    {story.scenes.map((scene, index) => (
                      <div key={scene.id || index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center">
                            <span className="bg-primary-100 text-primary-700 px-2 py-1 rounded-full text-sm font-medium mr-3">
                              Scene {scene.number || index + 1}
                            </span>
                            <h4 className="font-semibold text-gray-900 dark:text-white">{scene.title}</h4>
                          </div>
                          {scene.camera && (
                            <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
                              {scene.camera}
                            </span>
                          )}
                        </div>
                        
                        <div className="text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
                          {scene.description}
                        </div>
                        
                        {scene.character && (
                          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                            <User className="w-4 h-4 mr-1" />
                            <span>Character: {scene.character}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Film className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 dark:text-gray-400">No scene breakdown available</p>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'characters' && (
              <motion.div
                key="characters"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {story.characters && story.characters.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {story.characters.map((character, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start space-x-3">
                          {character.imageUrl && (
                            <img
                              src={character.imageUrl}
                              alt={character.name}
                              className="w-12 h-12 rounded-full object-cover"
                            />
                          )}
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900 dark:text-white">{character.name}</h4>
                            {character.description && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{character.description}</p>
                            )}
                            {character.traits && character.traits.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {character.traits.slice(0, 3).map((trait, i) => (
                                  <span
                                    key={i}
                                    className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-sm"
                                  >
                                    {trait}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <User className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 dark:text-gray-400">No character information available</p>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'storyboard' && (
              <motion.div
                key="storyboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {story.storyboardUrls && story.storyboardUrls.length > 0 ? (
                  <div className="space-y-6">
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Visual Storyboard</h3>
                      <p className="text-gray-600 dark:text-gray-300">Generated storyboard images with scene descriptions</p>
                    </div>

                    {story.storyboardUrls.map((storyboardUrl, index) => {
                      const correspondingScene = story.scenes && story.scenes[index];
                      return (
                        <div key={index} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                          {/* Storyboard Image */}
                          <div className="bg-gray-100">
                            <img
                              src={getImageURL(storyboardUrl)}
                              alt={`Storyboard ${index + 1}`}
                              className="w-full h-auto object-cover"
                              onError={(e) => {
                                console.error(`Failed to load storyboard image: ${getImageURL(storyboardUrl)}`);
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }}
                              onLoad={() => {
                                console.log(`Successfully loaded storyboard image: ${getImageURL(storyboardUrl)}`);
                              }}
                            />
                            <div style={{ display: 'none' }} className="w-full h-48 bg-gray-200 flex items-center justify-center">
                              <Film className="w-8 h-8 text-gray-400" />
                            </div>
                          </div>
                          
                          {/* Storyboard Details */}
                          <div className="p-4">
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="font-medium text-gray-900 dark:text-white">
                                {correspondingScene?.title || `Storyboard ${index + 1}`}
                              </h4>
                              <div className="flex items-center space-x-2">
                                <span className="bg-primary-100 text-primary-700 px-2 py-1 rounded-full text-xs font-medium">
                                  Scene {correspondingScene?.number || index + 1}
                                </span>
                                {correspondingScene?.camera && (
                                  <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
                                    {correspondingScene.camera}
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {correspondingScene?.description && (
                              <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-3 bg-gray-50 dark:bg-gray-700 p-3 rounded">
                                <strong>Scene Description:</strong> {correspondingScene.description}
                              </div>
                            )}
                            
                            <div className="flex items-center justify-between text-xs text-gray-500">
                              <span>Visual reference for story scene</span>
                              {correspondingScene?.character && (
                                <div className="flex items-center">
                                  <User className="w-3 h-3 mr-1" />
                                  <span>{correspondingScene.character}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Film className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 dark:text-gray-400">No storyboard images available</p>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'metadata' && (
              <motion.div
                key="metadata"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Story Details</h4>
                    <div className="space-y-3">
                      <div>
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Type:</span>
                        <span className="ml-2 text-sm text-gray-900 dark:text-white">{story.type || 'Not specified'}</span>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Tone:</span>
                        <span className="ml-2 text-sm text-gray-900 dark:text-white">{story.tone || 'Not specified'}</span>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Length:</span>
                        <span className="ml-2 text-sm text-gray-900 dark:text-white">{story.length || 'Not specified'}</span>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Word Count:</span>
                        <span className="ml-2 text-sm text-gray-900 dark:text-white">
                          {fullStoryText ? fullStoryText.split(' ').length : 0} words
                        </span>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Scenes:</span>
                        <span className="ml-2 text-sm text-gray-900 dark:text-white">
                          {story.scenes?.length || 0} scenes
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Generation Info</h4>
                    <div className="space-y-3">
                      <div>
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Created:</span>
                        <span className="ml-2 text-sm text-gray-900 dark:text-white">
                          {story.createdAt ? new Date(story.createdAt).toLocaleString() : 'Unknown'}
                        </span>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Voice:</span>
                        <span className="ml-2 text-sm text-gray-900 dark:text-white">
                          {story.includeVoice ? 'Included' : 'Not included'}
                        </span>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Video:</span>
                        <span className="ml-2 text-sm text-gray-900 dark:text-white">
                          {story.includeVideo ? 'Included' : 'Not included'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {story.prompt && (
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Original Prompt</h4>
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{story.prompt}</p>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

export default StoryPreview;
