import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import StoryPreview from '../components/StoryPreview';
import { storyAPI } from "../lib/api";

const StoryPage = () => {
  const { storyId } = useParams();
  const [story, setStory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStory = async () => {
      try {
        setLoading(true);
        const response = await storyAPI.getStory(storyId);

        // Transform the story data to match StoryPreview expectations
        const transformedStory = transformStoryData(response.story);
        setStory(transformedStory);
      } catch (err) {
        console.error("Error fetching story:", err);
        setError("Failed to load the story.");
      } finally {
        setLoading(false);
      }
    };

    fetchStory();
  }, [storyId]);

  // Transform backend story data to frontend expected format
  const transformStoryData = (storyData) => {
    if (!storyData) return null;

    return {
      id: storyData.id,
      title: storyData.title || "Untitled Story",
      content: storyData.content || storyData.fullStory || "",
      fullStory: storyData.fullStory || storyData.content || "",
      scenes: storyData.scenes || [],
      characters: storyData.characters || [],
      type: storyData.type || "adventure",
      tone: storyData.tone || "engaging",
      length: storyData.length || "short",
      createdAt: storyData.createdAt,
      estimatedDuration: storyData.estimatedDuration || "5-10 min",
      videoUrl: storyData.videoUrl,
      storyboardUrls: storyData.storyboardUrls || [],
      sceneUrls: storyData.sceneUrls || storyData.storyboardUrls || [],
      audio_narration:
        storyData.audio_narration || storyData.audioUrl
          ? { audioUrl: storyData.audioUrl }
          : null,
      includeVoice: !!storyData.audio_narration,
      includeVideo: !!storyData.videoUrl,
      metadata: storyData.metadata || {
        generatedBy: "Gemini AI",
        wordCount: storyData.content ? storyData.content.split(" ").length : 0,
        sceneCount: storyData.scenes ? storyData.scenes.length : 0,
      },
    };
  };

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
        onEdit={() => console.log("Edit story")}
        onShare={() => console.log("Share story")}
        onDownload={() => console.log("Download story")}
        onPlayVideo={() => console.log("Play video")}
      />
    </div>
  );
};

export default StoryPage;
