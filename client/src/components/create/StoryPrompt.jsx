import React, { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, BookOpen, Users, Zap } from "lucide-react";

const STORY_TYPES = [
  {
    id: "adventure",
    title: "Adventure",
    description: "Epic journeys and thrilling quests",
    icon: Zap,
    gradient: "from-orange-500 to-red-500",
  },
  {
    id: "fantasy",
    title: "Fantasy",
    description: "Magical worlds and mythical creatures",
    icon: Sparkles,
    gradient: "from-purple-500 to-pink-500",
  },
  {
    id: "scifi",
    title: "Sci-Fi",
    description: "Futuristic tales and space exploration",
    icon: BookOpen,
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    id: "drama",
    title: "Drama",
    description: "Emotional stories and character development",
    icon: Users,
    gradient: "from-green-500 to-teal-500",
  },
];

const TONES = [
  { id: "lighthearted", label: "Lighthearted" },
  { id: "serious", label: "Serious" },
  { id: "humorous", label: "Humorous" },
  { id: "dramatic", label: "Dramatic" },
  { id: "mysterious", label: "Mysterious" },
  { id: "romantic", label: "Romantic" },
];

const LENGTHS = [
  { id: "short", label: "Short (5-10 min)", duration: "5-10 minutes" },
  { id: "medium", label: "Medium (10-20 min)", duration: "10-20 minutes" },
  { id: "long", label: "Long (20+ min)", duration: "20+ minutes" },
];

const StoryPrompt = ({ characters, onGenerate, isGenerating }) => {
  const [formData, setFormData] = useState({
    prompt: "",
    storyType: "",
    tone: "",
    length: "medium",
    includeVoice: true,
    includeVideo: true,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.prompt.trim() || !formData.storyType) return;

    if (typeof onGenerate === "function") {
      onGenerate({
        ...formData,
        characters: characters?.map((c) => c.id) || [],
      });
    } else {
      console.error(
        "onGenerate is not a function. Please pass a valid onGenerate prop to StoryPrompt component."
      );
    }
  };

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold gradient-text mb-4">
          Create Your Story
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          Tell us about the story you want to create with your characters
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-8">
        {/* Story Prompt */}
        <div className="card p-6">
          <label className="label">
            <Sparkles className="w-5 h-5 mr-2 text-primary-600" />
            Story Prompt
          </label>
          <textarea
            value={formData.prompt}
            onChange={(e) => updateField("prompt", e.target.value)}
            placeholder="Describe the story you want to create. What happens? Where does it take place? What challenges do your characters face?"
            className="input min-h-32 resize-y"
            required
          />
          <p className="text-sm text-gray-500 mt-2">
            Be specific about plot points, settings, and character interactions
            for better results.
          </p>
        </div>

        {/* Story Type */}
        <div className="card p-6">
          <label className="label mb-4">
            <BookOpen className="w-5 h-5 mr-2 text-primary-600" />
            Story Type
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {STORY_TYPES.map((type) => {
              const Icon = type.icon;
              return (
                <motion.button
                  key={type.id}
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => updateField("storyType", type.id)}
                  className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                    formData.storyType === type.id
                      ? "border-primary-500 bg-primary-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}>
                  <div
                    className={`w-10 h-10 rounded-lg bg-linear-to-r ${type.gradient} flex items-center justify-center mb-3`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <h3
                    className={`font-semibold mb-1 ${
                      formData.storyType === type.id
                        ? "text-gray-900 dark:text-white"
                        : "text-gray-100 dark:text-gray-300"
                    }`}>
                    {type.title}
                  </h3>
                  <p
                    className={`text-sm ${
                      formData.storyType === type.id
                        ? "text-gray-700 dark:text-gray-300"
                        : "text-gray-400 dark:text-gray-500"
                    }`}>
                    {type.description}
                  </p>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Tone and Length */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tone */}
          <div className="card p-6">
            <label className="label mb-4">Story Tone</label>
            <div className="grid grid-cols-2 gap-3">
              {TONES.map((tone) => (
                <button
                  key={tone.id}
                  type="button"
                  onClick={() => updateField("tone", tone.id)}
                  className={`p-3 rounded-lg border transition-all duration-200 ${
                    formData.tone === tone.id
                      ? "border-primary-500 bg-primary-50 dark:bg-primary-900 text-gray-900 dark:text-white"
                      : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 text-gray-100 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                  }`}>
                  {tone.label}
                </button>
              ))}
            </div>
          </div>

          {/* Length */}
          <div className="card p-6">
            <label className="label mb-4">Story Length</label>
            <div className="space-y-3">
              {LENGTHS.map((length) => (
                <button
                  key={length.id}
                  type="button"
                  onClick={() => updateField("length", length.id)}
                  className={`w-full p-3 rounded-lg border transition-all duration-200 text-left ${
                    formData.length === length.id
                      ? "border-primary-500 bg-primary-50 dark:bg-primary-900"
                      : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                  }`}>
                  <div
                    className={`font-medium ${
                      formData.length === length.id
                        ? "text-gray-900 dark:text-white"
                        : "text-gray-100 dark:text-gray-300"
                    }`}>
                    {length.label}
                  </div>
                  <div
                    className={`text-sm ${
                      formData.length === length.id
                        ? "text-gray-700 dark:text-gray-300"
                        : "text-gray-400 dark:text-gray-500"
                    }`}>
                    {length.duration}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Options */}
        <div className="card p-6">
          <h3 className="font-semibold text-gray-100 mb-4">Output Options</h3>
          <div className="space-y-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.includeVoice}
                onChange={(e) => updateField("includeVoice", e.target.checked)}
                className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
              />
              <span className="ml-3 text-gray-100">
                Include voice narration
              </span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.includeVideo}
                onChange={(e) => updateField("includeVideo", e.target.checked)}
                className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
              />
              <span className="ml-3 text-gray-100">
                Generate video with character images
              </span>
            </label>
          </div>
        </div>

        {/* Generate Button */}
        <div className="text-center">
          <motion.button
            type="submit"
            disabled={
              !formData.prompt.trim() || !formData.storyType || isGenerating
            }
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="btn-primary text-lg px-8 py-4 disabled:opacity-50 disabled:cursor-not-allowed">
            {isGenerating ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                Generating Story...
              </div>
            ) : (
              <div className="flex items-center">
                <Sparkles className="w-5 h-5 mr-2" />
                Generate Story
              </div>
            )}
          </motion.button>
        </div>
      </form>
    </motion.div>
  );
};

export default StoryPrompt;
