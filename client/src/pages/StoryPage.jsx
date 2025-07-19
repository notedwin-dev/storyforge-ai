import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import StoryPreview from '../components/StoryPreview';
import api from '../lib/api';

const StoryPage = () => {
  const { storyId } = useParams();
  const [story, setStory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStory = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/stories/${storyId}`);
        setStory(response.data);
      } catch (err) {
        setError('Failed to load the story.');
      } finally {
        setLoading(false);
      }
    };

    fetchStory();
  }, [storyId]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  if (!story) {
    return <div>No story found.</div>;
  }

  return (
    <div className="story-page">
      <StoryPreview
        story={story}
        onEdit={() => console.log('Edit story')}
        onShare={() => console.log('Share story')}
        onDownload={() => console.log('Download story')}
        onPlayVideo={() => console.log('Play video')}
      />
    </div>
  );
};

export default StoryPage;
