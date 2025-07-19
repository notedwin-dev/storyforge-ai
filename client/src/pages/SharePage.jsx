import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Share2, 
  Download, 
  Copy, 
  Facebook, 
  Twitter, 
  Mail,
  Link,
  Check,
  ArrowLeft,
  Play,
  BookOpen
} from 'lucide-react';

const SharePage = () => {
  const { shareId } = useParams();
  const navigate = useNavigate();
  const [story, setStory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    if (shareId) {
      fetchStory();
    }
  }, [shareId]);

  useEffect(() => {
    if (story) {
      navigate(`/story/${story.id}`);
    }
  }, [story, navigate]);

  const fetchStory = async () => {
    try {
      setLoading(true);
      console.log("Fetching story with ID:", shareId);
      const response = await fetch(`/api/stories/${shareId}`);
      console.log("Response status:", response.status);

      if (response.ok) {
        const data = await response.json();
        console.log("Story data:", data);
        setStory(data.story);
      } else {
        console.error(
          "Failed to fetch story:",
          response.status,
          response.statusText
        );
        navigate("/library");
      }
    } catch (error) {
      console.error("Error fetching story:", error);
      navigate("/library");
    } finally {
      setLoading(false);
    }
  };

  const shareUrl = window.location.href;
  const shareTitle = story?.title || 'Amazing AI-Generated Story';
  const shareText = story?.content?.slice(0, 200) + '...' || 'Check out this amazing story created with StoryForge AI!';

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const shareVia = (platform) => {
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedTitle = encodeURIComponent(shareTitle);
    const encodedText = encodeURIComponent(shareText);

    const urls = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}&hashtags=StoryForgeAI,AIStory`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      email: `mailto:?subject=${encodedTitle}&body=${encodedText}%0A%0A${encodedUrl}`,
      whatsapp: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
      telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`
    };

    if (urls[platform]) {
      window.open(urls[platform], '_blank', 'width=600,height=400');
    }
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    }
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(`/api/export/${storyId}?format=pdf`, {
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

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-primary-50 to-accent-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-300">Loading story...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!story) {
    return (
      <div className="min-h-screen bg-linear-to-br from-primary-50 to-accent-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Story not found</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">The story you're looking for doesn't exist or has been removed.</p>
            <button
              onClick={() => navigate('/library')}
              className="btn-primary"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Library
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-primary-50 to-accent-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/library')}
            className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Library
          </button>
          
          <div className="text-center">
            <Share2 className="w-12 h-12 text-primary-600 mx-auto mb-4" />
            <h1 className="text-3xl font-bold gradient-text mb-2">Share Your Story</h1>
            <p className="text-gray-600 dark:text-gray-300">Let others discover your amazing AI-generated story</p>
          </div>
        </div>

        {/* Story Preview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-6 mb-8"
        >
          <div className="flex items-start space-x-4">
            {story.videoUrl ? (
              <div className="relative w-24 h-24 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                <video
                  src={story.videoUrl}
                  className="w-full h-full object-cover"
                  muted
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <Play className="w-6 h-6 text-white" />
                </div>
              </div>
            ) : (
              <div className="w-24 h-24 bg-linear-to-br from-primary-100 to-accent-100 rounded-lg flex items-center justify-center shrink-0">
                <BookOpen className="w-8 h-8 text-primary-600" />
              </div>
            )}
            
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{story.title}</h2>
              <p className="text-gray-600 dark:text-gray-300 mb-3 line-clamp-3">
                {story.content?.slice(0, 200)}...
              </p>
              <div className="flex items-center space-x-4 text-sm text-gray-500">
                <span>{story.type}</span>
                <span>•</span>
                <span>{story.estimatedDuration || '10-15 min'}</span>
                <span>•</span>
                <span>{story.characters?.length || 0} characters</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Share Options */}
        <div className="space-y-6">
          {/* Quick Share */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Share</h3>
            
            {/* Copy Link */}
            <div className="mb-6">
              <label className="label mb-2">Share Link</label>
              <div className="flex">
                <input
                  type="text"
                  value={shareUrl}
                  readOnly
                  className="input rounded-r-none border-r-0 flex-1"
                />
                <button
                  onClick={copyToClipboard}
                  className={`px-4 py-2 border border-l-0 rounded-r-lg transition-colors ${
                    copySuccess 
                      ? 'bg-green-50 border-green-200 text-green-700'
                      : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                  }`}
                >
                  {copySuccess ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <Copy className="w-5 h-5" />
                  )}
                </button>
              </div>
              {copySuccess && (
                <p className="text-sm text-green-600 mt-2">Link copied to clipboard!</p>
              )}
            </div>

            {/* Native Share */}
            {navigator.share && (
              <button
                onClick={nativeShare}
                className="btn-primary w-full mb-4"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share via Device
              </button>
            )}
          </motion.div>

          {/* Social Media */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Share on Social Media</h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button
                onClick={() => shareVia('facebook')}
                className="flex items-center justify-center p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Facebook className="w-5 h-5 mr-2" />
                Facebook
              </button>
              
              <button
                onClick={() => shareVia('twitter')}
                className="flex items-center justify-center p-3 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-colors"
              >
                <Twitter className="w-5 h-5 mr-2" />
                Twitter
              </button>
              
              <button
                onClick={() => shareVia('whatsapp')}
                className="flex items-center justify-center p-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Share2 className="w-5 h-5 mr-2" />
                WhatsApp
              </button>
              
              <button
                onClick={() => shareVia('email')}
                className="flex items-center justify-center p-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <Mail className="w-5 h-5 mr-2" />
                Email
              </button>
            </div>
          </motion.div>

          {/* Download Options */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="card p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Download & Export</h3>
            
            <div className="space-y-3">
              <button
                onClick={handleDownload}
                className="w-full btn-secondary justify-start"
              >
                <Download className="w-4 h-4 mr-3" />
                Download as PDF
              </button>
              
              {story.videoUrl && (
                <a
                  href={story.videoUrl}
                  download={`${story.title || 'story'}.mp4`}
                  className="w-full btn-secondary justify-start inline-flex"
                >
                  <Download className="w-4 h-4 mr-3" />
                  Download Video
                </a>
              )}
              
              {story.audioUrl && (
                <a
                  href={story.audioUrl}
                  download={`${story.title || 'story'}.mp3`}
                  className="w-full btn-secondary justify-start inline-flex"
                >
                  <Download className="w-4 h-4 mr-3" />
                  Download Audio
                </a>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default SharePage;
