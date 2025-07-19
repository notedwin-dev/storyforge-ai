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
  Image,
  Film,
  Volume2
} from 'lucide-react';
import AudioVisualizer from './AudioVisualizer';

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
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No story generated yet</h3>
          <p className="text-gray-600">Create your characters and generate a story to see it here.</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "story", label: "Story Text", icon: BookOpen },
    ...(story.audio_narration
      ? [{ id: "audio", label: "Audio Narration", icon: Volume2 }]
      : []),
    { id: "characters", label: "Characters", icon: User },
    { id: "scenes", label: "Scene Images", icon: Image },
    { id: "storyboard", label: "Storyboard", icon: Film },
    { id: "metadata", label: "Details", icon: Eye },
  ];

  const previewText = story.content?.slice(0, 300) || '';
  const showExpandButton = story.content?.length > 300;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="card p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {story.title || "Your Generated Story"}
            </h2>
            <div className="flex items-center text-gray-600 space-x-4">
              <div className="flex items-center">
                <Clock className="w-4 h-4 mr-1" />
                <span className="text-sm">
                  {story.estimatedDuration || "10-15 min"}
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
              className="btn-accent ml-4">
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
            className="btn-primary">
            <Download className="w-4 h-4 mr-2" />
            Download
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onShare}
            className="btn-secondary">
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onEdit}
            className="btn-secondary">
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
                      ? "border-primary-500 text-primary-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}>
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
            {activeTab === "story" && (
              <motion.div
                key="story"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4">
                <div className="prose max-w-none">
                  <div className="whitespace-pre-wrap leading-relaxed">
                    {isExpanded ? (
                      <div className="text-white">{story.content}</div>
                    ) : (
                      <div className="text-white">{previewText}</div>
                    )}
                    {!isExpanded && showExpandButton && (
                      <span className="text-white">...</span>
                    )}
                  </div>
                </div>

                {showExpandButton && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex items-center text-primary-600 hover:text-primary-700 font-medium">
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

            {activeTab === "audio" && (
              <motion.div
                key="audio"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4">
                <AudioVisualizer
                  audioNarration={story.audio_narration}
                  storyTitle={story.title || "Your Story"}
                  onSceneChange={(sceneIndex) => {
                    // Optional: Could sync with storyboard view
                    console.log("Audio scene changed to:", sceneIndex);
                  }}
                />
              </motion.div>
            )}

            {activeTab === "characters" && (
              <motion.div
                key="characters"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4">
                {story.characters && story.characters.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {story.characters.map((character, index) => (
                      <div
                        key={index}
                        className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start space-x-3">
                          {(character.imageUrl || character.thumbnailUrl) && (
                            <img
                              src={character.imageUrl || character.thumbnailUrl}
                              alt={character.name}
                              className="w-12 h-12 rounded-full object-cover"
                            />
                          )}
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">
                              {character.name}
                            </h4>
                            {character.description && (
                              <p className="text-sm text-gray-600 mt-1">
                                {character.description}
                              </p>
                            )}
                            {character.traits &&
                              character.traits.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {character.traits
                                    .slice(0, 3)
                                    .map((trait, i) => (
                                      <span
                                        key={i}
                                        className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
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
                    <p className="text-gray-600">
                      No character information available
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === "scenes" && (
              <motion.div
                key="scenes"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4">
                {story.sceneUrls && story.sceneUrls.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {story.sceneUrls.map((imageUrl, index) => {
                      // Handle relative URLs by adding server prefix if needed
                      const fullImageUrl =
                        imageUrl &&
                        typeof imageUrl === "string" &&
                        imageUrl.startsWith("/")
                          ? `http://localhost:3001${imageUrl}`
                          : imageUrl;

                      return (
                        <div
                          key={index}
                          className="border border-gray-200 rounded-lg overflow-hidden">
                          <img
                            src={fullImageUrl}
                            alt={`Scene ${index + 1}`}
                            className="w-full h-48 object-cover"
                            onError={(e) => {
                              console.log(
                                `Failed to load scene image: ${fullImageUrl}`
                              );
                              e.target.src = `https://picsum.photos/400/300?random=${index}`;
                            }}
                            onLoad={() => {
                              console.log(
                                `Successfully loaded scene image: ${fullImageUrl}`
                              );
                            }}
                          />
                          <div className="p-3">
                            <h4 className="font-medium text-gray-900">
                              Scene {index + 1}
                            </h4>
                            {story.scenes && story.scenes[index] && (
                              <p className="text-sm text-gray-600 mt-1">
                                {story.scenes[index].title}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Image className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600">No scene images available</p>
                    {console.log("Story sceneUrls:", story.sceneUrls)}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === "storyboard" && (
              <motion.div
                key="storyboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4">
                {story.storyboardUrls && story.storyboardUrls.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {story.storyboardUrls.map((imageUrl, index) => {
                      // Handle relative URLs by adding server prefix if needed
                      const fullImageUrl =
                        imageUrl &&
                        typeof imageUrl === "string" &&
                        imageUrl.startsWith("/")
                          ? `http://localhost:3001${imageUrl}`
                          : imageUrl;

                      return (
                        <div
                          key={index}
                          className="border border-gray-200 rounded-lg overflow-hidden">
                          <img
                            src={fullImageUrl}
                            alt={`Storyboard ${index + 1}`}
                            className="w-full h-64 object-cover"
                            onError={(e) => {
                              console.log(
                                `Failed to load storyboard image: ${fullImageUrl}`
                              );
                              e.target.src = `https://picsum.photos/600/400?random=${
                                index + 100
                              }`;
                            }}
                            onLoad={() => {
                              console.log(
                                `Successfully loaded storyboard image: ${fullImageUrl}`
                              );
                            }}
                          />
                          <div className="p-3">
                            <h4 className="font-medium text-gray-900">
                              Storyboard {index + 1}
                            </h4>
                            {story.scenes && story.scenes[index] && (
                              <p className="text-sm text-gray-600 mt-1">
                                {story.scenes[index].title}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Film className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600">
                      No storyboard images available
                    </p>
                    {console.log("Story storyboardUrls:", story.storyboardUrls)}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === "metadata" && (
              <motion.div
                key="metadata"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">
                      Story Details
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <span className="text-sm font-medium text-gray-600">
                          Type:{" "}
                        </span>
                        <span className="ml-1 text-sm text-gray-900">
                          {story.type || "Not specified"}
                        </span>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-600">
                          Tone:{" "}
                        </span>
                        <span className="ml-1 text-sm text-gray-900">
                          {story.tone || "Not specified"}
                        </span>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-600">
                          Length:{" "}
                        </span>
                        <span className="ml-1 text-sm text-gray-900">
                          {story.length || "Not specified"}
                        </span>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-600">
                          Word Count:{" "}
                        </span>
                        <span className="ml-1 text-sm text-gray-900">
                          {story.content?.split(" ").length || 0} words
                        </span>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-600">
                          Scenes:{" "}
                        </span>
                        <span className="ml-1 text-sm text-gray-900">
                          {story.scenes?.length || 0} scenes
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">
                      Generation Info
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <span className="text-sm font-medium text-gray-600">
                          Created:{" "}
                        </span>
                        <span className="ml-1 text-sm text-gray-900">
                          {story.createdAt
                            ? new Date(story.createdAt).toLocaleString()
                            : "Unknown"}
                        </span>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-600">
                          Voice:{" "}
                        </span>
                        <span className="ml-1 text-sm text-gray-900">
                          {story.includeVoice ? "Included" : "Not included"}
                        </span>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-600">
                          Video:{" "}
                        </span>
                        <span className="ml-1 text-sm text-gray-900">
                          {story.includeVideo ? "Included" : "Not included"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {story.prompt && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">
                      Original Prompt
                    </h4>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {story.prompt}
                      </p>
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
