import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Save, 
  Share2, 
  Download, 
  Lock, 
  Globe, 
  Film,
  PlayCircle,
  CheckCircle,
  Loader2,
  FileText,
  Camera,
  Video,
  Copy,
  ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';

const StorySaveOptions = ({ story, onSave, onGenerateVideo, onDownload, onShare, isSaved = false, savedStoryId = null, savedVisibility = 'private' }) => {
  const [saveVisibility, setSaveVisibility] = useState('private');
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoGenerated, setVideoGenerated] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Get the saved story URL
  const getSavedStoryUrl = () => {
    if (!savedStoryId) return '';
    return `${window.location.origin}/share/${savedStoryId}`;
  };

  // Copy URL to clipboard
  const copyStoryUrl = async () => {
    try {
      const url = getSavedStoryUrl();
      await navigator.clipboard.writeText(url);
      setCopySuccess(true);
      toast.success('URL copied to clipboard!');
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy URL:', error);
      toast.error('Failed to copy URL');
    }
  };

  // Open saved story in new tab
  const openSavedStory = () => {
    const url = getSavedStoryUrl();
    if (url) {
      window.open(url, '_blank');
    }
  };

  const handleSaveStory = async () => {
    if (isSaving) return;
    
    setIsSaving(true);
    try {
      await onSave({
        visibility: saveVisibility,
        title: story?.title || 'Untitled Story',
        description: story?.content?.slice(0, 200) + '...' || 'AI Generated Story'
      });
      toast.success(`Story saved as ${saveVisibility}!`);
    } catch (error) {
      toast.error('Failed to save story');
      console.error('Save error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (isGeneratingVideo) return;
    
    setIsGeneratingVideo(true);
    try {
      await onGenerateVideo();
      setVideoGenerated(true);
      toast.success('Video generation started!');
    } catch (error) {
      toast.error('Failed to start video generation');
      console.error('Video generation error:', error);
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  const saveOptions = [
    {
      id: 'private',
      label: 'Private',
      description: 'Only you can see this story',
      icon: Lock,
      color: 'primary'
    },
    {
      id: 'public',
      label: 'Public',
      description: 'Anyone can discover and read this story',
      icon: Globe,
      color: 'green'
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-4xl mx-auto space-y-6"
    >
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {isSaved ? 'Story Saved Successfully!' : 'Save & Share Your Story'}
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          {isSaved 
            ? `Your story has been saved as ${savedVisibility}. Share it with others or download it for offline reading.`
            : 'Choose how to save your story and optionally generate a video'
          }
        </p>
      </div>

      {/* Story Preview Card */}
      {story && (
        <div className="card p-6 mb-6">
          <div className="flex items-start space-x-4">
            <div className={`w-16 h-16 rounded-lg flex items-center justify-center shrink-0 ${
              isSaved 
                ? 'bg-gradient-to-br from-green-100 to-emerald-100' 
                : 'bg-gradient-to-br from-primary-100 to-accent-100'
            }`}>
              {isSaved ? (
                <CheckCircle className="w-8 h-8 text-green-600" />
              ) : (
                <FileText className="w-8 h-8 text-primary-600" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    {story.title || 'Your Generated Story'}
                  </h3>
                  {isSaved && (
                    <div className="flex items-center space-x-2 mb-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        savedVisibility === 'private' 
                          ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' 
                          : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                      }`}>
                        {savedVisibility === 'private' ? (
                          <>
                            <Lock className="w-3 h-3 mr-1" />
                            Private
                          </>
                        ) : (
                          <>
                            <Globe className="w-3 h-3 mr-1" />
                            Public
                          </>
                        )}
                      </span>
                    </div>
                  )}
                  <p className="text-gray-600 dark:text-gray-300 text-sm mb-2">
                    {story.content?.slice(0, 150)}...
                  </p>
                  <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                    <span>{story.content?.split(' ').length || 0} words</span>
                    <span>•</span>
                    <span>{story.scenes?.length || 0} scenes</span>
                    <span>•</span>
                    <span>{story.estimatedDuration || '10-15 min'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Save Story Section */}
        <div className="card p-6">
          <div className="flex items-center mb-4">
            {isSaved ? (
              <>
                <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Story Saved</h3>
              </>
            ) : (
              <>
                <Save className="w-5 h-5 text-primary-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Save Story</h3>
              </>
            )}
          </div>
          
          {isSaved ? (
            /* Saved Story Content */
            <div className="space-y-4">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-green-800 dark:text-green-300">
                    Story saved successfully as {savedVisibility}!
                  </span>
                </div>
                
                {/* Shareable URL */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Shareable URL:
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={getSavedStoryUrl()}
                      readOnly
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none"
                    />
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={copyStoryUrl}
                      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        copySuccess 
                          ? 'bg-green-100 text-green-700 border border-green-300 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800' 
                          : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200 dark:bg-gray-600 dark:text-gray-300 dark:border-gray-500 dark:hover:bg-gray-500'
                      }`}
                    >
                      {copySuccess ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </motion.button>
                  </div>
                </div>
              </div>
              
              {/* Open Story Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={openSavedStory}
                className="w-full btn-secondary"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open Saved Story
              </motion.button>
            </div>
          ) : (
            /* Save Options */
            <>
              {/* Visibility Options */}
              <div className="space-y-3 mb-6">
                {saveOptions.map((option) => {
                  const Icon = option.icon;
                  const isSelected = saveVisibility === option.id;
                  
                  return (
                    <button
                      key={option.id}
                      onClick={() => setSaveVisibility(option.id)}
                      className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                        isSelected
                          ? option.id === 'private' 
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 dark:border-primary-400' 
                            : 'border-green-500 bg-green-50 dark:bg-green-900/20 dark:border-green-400'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <Icon className={`w-5 h-5 mt-0.5 ${
                          isSelected 
                            ? option.id === 'private' 
                              ? 'text-primary-600 dark:text-primary-400' 
                              : 'text-green-600 dark:text-green-400'
                            : 'text-gray-400 dark:text-gray-500'
                        }`} />
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className={`font-medium ${
                              isSelected 
                                ? option.id === 'private' 
                                  ? 'text-primary-900 dark:text-primary-100' 
                                  : 'text-green-900 dark:text-green-100'
                                : 'text-gray-900 dark:text-white'
                            }`}>
                              {option.label}
                            </span>
                            {isSelected && (
                              <CheckCircle className={`w-4 h-4 ${
                                option.id === 'private' ? 'text-primary-600 dark:text-primary-400' : 'text-green-600 dark:text-green-400'
                              }`} />
                            )}
                          </div>
                          <p className={`text-sm ${
                            isSelected 
                              ? option.id === 'private' 
                                ? 'text-primary-700 dark:text-primary-300' 
                                : 'text-green-700 dark:text-green-300'
                              : 'text-gray-600 dark:text-gray-300'
                          }`}>
                            {option.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Save Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSaveStory}
                disabled={isSaving}
                className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Story as {saveVisibility === 'private' ? 'Private' : 'Public'}
                  </>
                )}
              </motion.button>
            </>
          )}
        </div>

        {/* Video Generation Section */}
        <div className="card p-6">
          <div className="flex items-center mb-4">
            <Film className="w-5 h-5 text-purple-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Generate Video</h3>
          </div>
          
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/40 dark:to-pink-900/40 rounded-full flex items-center justify-center mx-auto">
              {videoGenerated ? (
                <Video className="w-8 h-8 text-purple-600 dark:text-purple-400" />
              ) : (
                <Camera className="w-8 h-8 text-purple-600 dark:text-purple-400" />
              )}
            </div>
            
            {videoGenerated ? (
              <>
                <h4 className="font-semibold text-gray-900 dark:text-white">Video Generated!</h4>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Your video is ready to download and share
                </p>
              </>
            ) : (
              <>
                <h4 className="font-semibold text-gray-900 dark:text-white">Create Video</h4>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Turn your storyboard into an animated video with voiceover
                </p>
              </>
            )}
            
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGenerateVideo}
              disabled={isGeneratingVideo || videoGenerated}
              className="w-full btn-accent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGeneratingVideo ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating Video...
                </>
              ) : videoGenerated ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Video Ready
                </>
              ) : (
                <>
                  <PlayCircle className="w-4 h-4 mr-2" />
                  Generate Video
                </>
              )}
            </motion.button>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 justify-center">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onDownload}
          className="btn-secondary"
        >
          <Download className="w-4 h-4 mr-2" />
          Download PDF
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onShare}
          className="btn-secondary"
        >
          <Share2 className="w-4 h-4 mr-2" />
          Share Story
        </motion.button>
      </div>
    </motion.div>
  );
};

export default StorySaveOptions;
