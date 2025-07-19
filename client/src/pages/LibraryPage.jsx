import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  BookOpen, 
  Play, 
  Download, 
  Share2, 
  Trash2,
  Search,
  Filter,
  Calendar,
  Clock,
  User
} from 'lucide-react';
import { storyAPI } from '../lib/api';
import toast from 'react-hot-toast';

const FILTER_OPTIONS = [
  { id: 'all', label: 'All Stories' },
  { id: 'adventure', label: 'Adventure' },
  { id: 'fantasy', label: 'Fantasy' },
  { id: 'scifi', label: 'Sci-Fi' },
  { id: 'drama', label: 'Drama' }
];

const SORT_OPTIONS = [
  { id: 'newest', label: 'Newest First' },
  { id: 'oldest', label: 'Oldest First' },
  { id: 'title', label: 'Title A-Z' },
  { id: 'duration', label: 'Duration' }
];

const LibraryPage = () => {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [selectedStories, setSelectedStories] = useState([]);

  useEffect(() => {
    fetchStories();
  }, []);

  const fetchStories = async () => {
    try {
      setLoading(true);
      const response = await storyAPI.getMyStories();
      setStories(response.stories || []);
    } catch (error) {
      console.error('Error fetching stories:', error);
      toast.error('Failed to load stories');
    } finally {
      setLoading(false);
    }
  };

  const filteredAndSortedStories = stories
    .filter(story => {
      const matchesSearch = story.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           story.content?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filterType === 'all' || story.type === filterType;
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt) - new Date(a.createdAt);
        case 'oldest':
          return new Date(a.createdAt) - new Date(b.createdAt);
        case 'title':
          return (a.title || '').localeCompare(b.title || '');
        case 'duration':
          return (b.estimatedDuration || 0) - (a.estimatedDuration || 0);
        default:
          return 0;
      }
    });

  const toggleStorySelection = (storyId) => {
    setSelectedStories(prev => 
      prev.includes(storyId) 
        ? prev.filter(id => id !== storyId)
        : [...prev, storyId]
    );
  };

  const handleBulkDelete = async () => {
    if (!selectedStories.length) return;
    
    if (window.confirm(`Delete ${selectedStories.length} selected stories?`)) {
      try {
        await Promise.all(
          selectedStories.map(id => storyAPI.deleteStory(id))
        );
        setStories(prev => prev.filter(story => !selectedStories.includes(story.id)));
        setSelectedStories([]);
        toast.success(`${selectedStories.length} stories deleted successfully`);
      } catch (error) {
        console.error('Error deleting stories:', error);
        toast.error('Failed to delete some stories');
      }
    }
  };

  const handleDownload = async (story) => {
    try {
      const response = await fetch(`/api/export/${story.id}?format=pdf`, {
        method: 'POST'
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${story.title || 'story'}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error downloading story:', error);
    }
  };

  const handleShare = (story) => {
    if (navigator.share) {
      navigator.share({
        title: story.title,
        text: story.content?.slice(0, 200) + '...',
        url: window.location.href
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-primary-50 to-accent-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-300">Loading your story library...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-primary-50 to-accent-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold gradient-text mb-4">Story Library</h1>
          <p className="text-gray-600 dark:text-gray-300">
            Manage and explore all your generated stories
          </p>
        </div>

        {/* Search and Filters */}
        <div className="card p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search stories..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input pl-10"
                />
              </div>
            </div>

            {/* Filter by Type */}
            <div className="relative">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="input pr-10 appearance-none"
              >
                {FILTER_OPTIONS.map(option => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Filter className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
            </div>

            {/* Sort */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="input pr-10 appearance-none"
              >
                {SORT_OPTIONS.map(option => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedStories.length > 0 && (
            <div className="mt-4 p-4 bg-primary-50 rounded-lg flex items-center justify-between">
              <span className="text-primary-700 font-medium">
                {selectedStories.length} stories selected
              </span>
              <button
                onClick={handleBulkDelete}
                className="text-red-600 hover:text-red-700 font-medium flex items-center"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Delete Selected
              </button>
            </div>
          )}
        </div>

        {/* Stories Grid */}
        {filteredAndSortedStories.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {stories.length === 0 ? 'No stories yet' : 'No stories match your search'}
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              {stories.length === 0 
                ? 'Create your first story to get started!'
                : 'Try adjusting your search or filters.'
              }
            </p>
            {stories.length === 0 && (
              <a
                href="/create"
                className="btn-primary"
              >
                Create Story
              </a>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAndSortedStories.map((story) => (
              <motion.div
                key={story.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="card-hover overflow-hidden"
              >
                {/* Story Thumbnail/Video */}
                <div className="relative h-48 bg-linear-to-br from-primary-100 to-accent-100">
                  {story.videoUrl ? (
                    <video
                      src={story.videoUrl}
                      className="w-full h-full object-cover"
                      muted
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <BookOpen className="w-12 h-12 text-primary-400" />
                    </div>
                  )}
                  
                  {/* Selection Checkbox */}
                  <div className="absolute top-3 left-3">
                    <input
                      type="checkbox"
                      checked={selectedStories.includes(story.id)}
                      onChange={() => toggleStorySelection(story.id)}
                      className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                    />
                  </div>

                  {/* Play Overlay */}
                  {story.videoUrl && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity">
                      <div className="bg-white/90 rounded-full p-3">
                        <Play className="w-6 h-6 text-gray-900 dark:text-white" />
                      </div>
                    </div>
                  )}

                  {/* Type Badge */}
                  {story.type && (
                    <div className="absolute top-3 right-3">
                      <span className="px-2 py-1 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm text-xs font-medium text-gray-700 dark:text-gray-300 rounded-full">
                        {story.type}
                      </span>
                    </div>
                  )}
                </div>

                {/* Story Info */}
                <div className="p-6">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2">
                    {story.title || 'Untitled Story'}
                  </h3>
                  
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-3">
                    {story.content?.slice(0, 150)}...
                  </p>

                  {/* Metadata */}
                  <div className="flex items-center text-xs text-gray-500 mb-4 space-x-4">
                    <div className="flex items-center">
                      <Calendar className="w-3 h-3 mr-1" />
                      {formatDate(story.createdAt)}
                    </div>
                    <div className="flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      {story.estimatedDuration || '10-15 min'}
                    </div>
                    <div className="flex items-center">
                      <User className="w-3 h-3 mr-1" />
                      {story.characters?.length || 0}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleDownload(story)}
                      className="flex-1 btn-secondary text-sm py-2"
                    >
                      <Download className="w-3 h-3 mr-1" />
                      Download
                    </button>
                    <button
                      onClick={() => handleShare(story)}
                      className="flex-1 btn-secondary text-sm py-2"
                    >
                      <Share2 className="w-3 h-3 mr-1" />
                      Share
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LibraryPage;
