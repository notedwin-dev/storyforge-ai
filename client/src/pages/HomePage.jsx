import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Sparkles,
  Play,
  Upload,
  Wand2,
  Download,
  ArrowRight,
  Star,
  Users,
  Clock,
  Palette,
  Film,
  Share,
  CheckCircle,
  X,
} from "lucide-react";

export default function HomePage() {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)

  const features = [
    {
      icon: Upload,
      title: 'Character DNA System',
      description: 'Upload your character image and let our AI understand its unique features for consistent rendering across all scenes.'
    },
    {
      icon: Wand2,
      title: 'AI Story Engine',
      description: 'Generate compelling 4-scene stories with branching narratives. Choose from Fantasy, Sci-Fi, Adventure, and Mystery genres.'
    },
    {
      icon: Palette,
      title: 'Style Transfer',
      description: 'Transform your story with multiple art styles: Cartoon, Watercolor, Cinematic, Anime, and Storybook illustrations.'
    },
    {
      icon: Film,
      title: 'Video Synthesis',
      description: 'Create 15-30 second animated videos with subtle motion effects, smooth transitions, and mood-based music.'
    },
    {
      icon: Share,
      title: 'Multi-Format Export',
      description: 'Export as MP4 videos, PDF storybooks, or generate shareable web links for easy distribution.'
    },
    {
      icon: CheckCircle,
      title: 'Voice Narration',
      description: 'Add emotion-based voice synthesis in multiple languages with customizable pitch and speed controls.'
    }
  ]

  const steps = [
    {
      step: '01',
      title: 'Upload Character',
      description: 'Upload your character image and we\'ll create a unique DNA profile for consistent rendering.',
      image: '/demo/step1.jpg'
    },
    {
      step: '02',
      title: 'Create Story',
      description: 'Write a prompt and choose your genre. Our AI will generate a compelling 4-scene story.',
      image: '/demo/step2.jpg'
    },
    {
      step: '03',
      title: 'Generate Video',
      description: 'Watch as your story comes to life with consistent characters, motion effects, and music.',
      image: '/demo/step3.jpg'
    },
    {
      step: '04',
      title: 'Export & Share',
      description: 'Download your story as video, PDF, or share with a link. Perfect for social media or presentations.',
      image: '/demo/step4.jpg'
    }
  ]

  const stats = [
    { label: 'Stories Created', value: '10K+', icon: Star },
    { label: 'Happy Users', value: '2.5K+', icon: Users },
    { label: 'Avg. Generation Time', value: '<90s', icon: Clock }
  ]

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-8"
            >
              <h1 className="text-4xl sm:text-6xl lg:text-7xl font-heading font-bold text-gray-900 dark:text-white mb-6">
                Create{' '}
                <span className="gradient-text">
                  Magic Stories
                </span>
                {' '}with AI
              </h1>
              <p className="text-xl sm:text-2xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed">
                Transform your characters into amazing animated stories with AI-powered storytelling, 
                consistent character rendering, and multi-format export.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="flex flex-col sm:flex-row gap-4 justify-center mb-12"
            >
              <Link
                to="/create"
                className="btn-primary text-lg px-8 py-4 shadow-glow"
              >
                <Sparkles className="h-5 w-5 mr-2" />
                Start Creating
                <ArrowRight className="h-5 w-5 ml-2" />
              </Link>
              
              <button
                onClick={() => setIsVideoPlaying(true)}
                className="btn-secondary text-lg px-8 py-4"
              >
                <Play className="h-5 w-5 mr-2" />
                Watch Demo
              </button>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-2xl mx-auto"
            >
              {stats.map((stat, index) => {
                const Icon = stat.icon
                return (
                  <div key={stat.label} className="text-center">
                    <div className="flex items-center justify-center mb-2">
                      <Icon className="h-5 w-5 text-primary-600 mr-2" />
                      <span className="text-2xl font-bold text-gray-900 dark:text-white">
                        {stat.value}
                      </span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400">{stat.label}</p>
                  </div>
                )
              })}
            </motion.div>
          </div>
        </div>

        {/* Background decoration */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
          <div className="absolute -top-40 left-40 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white/50 dark:bg-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-heading font-bold text-gray-900 dark:text-white mb-4">
              Powerful Features
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Everything you need to create professional-quality animated stories with consistent characters.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="card-hover p-6"
                >
                  <div className="w-12 h-12 bg-linear-to-r from-primary-500 to-accent-500 rounded-lg flex items-center justify-center mb-4">
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    {feature.description}
                  </p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-heading font-bold text-gray-900 dark:text-white mb-4">
              How It Works
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              From character upload to final video, create your story in just 4 simple steps.
            </p>
          </div>

          <div className="space-y-16">
            {steps.map((step, index) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true }}
                className={`flex flex-col lg:flex-row items-center gap-12 ${
                  index % 2 === 1 ? 'lg:flex-row-reverse' : ''
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center mb-6">
                    <span className="text-4xl font-bold text-primary-600 mr-4">
                      {step.step}
                    </span>
                    <h3 className="text-2xl font-heading font-bold text-gray-900 dark:text-white">
                      {step.title}
                    </h3>
                  </div>
                  <p className="text-lg text-gray-600 dark:text-gray-300 mb-6">
                    {step.description}
                  </p>
                  {index === 0 && (
                    <Link to="/create" className="btn-primary">
                      Try It Now
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Link>
                  )}
                </div>
                <div className="flex-1">
                  <div className="aspect-video bg-linear-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 rounded-xl shadow-large flex items-center justify-center">
                    <span className="text-gray-500 dark:text-gray-400">
                      Demo Image {index + 1}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-linear-to-r from-primary-600 to-accent-600">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl sm:text-4xl font-heading font-bold text-white mb-4">
              Ready to Create Your First Story?
            </h2>
            <p className="text-xl text-white/90 mb-8">
              Join thousands of creators who are already making amazing stories with StoryForge AI.
            </p>
            <Link
              to="/create"
              className="inline-flex items-center px-8 py-4 bg-white text-primary-600 text-lg font-semibold rounded-lg hover:bg-gray-50 transition-colors shadow-large"
            >
              <Sparkles className="h-5 w-5 mr-2" />
              Start Creating for Free
              <ArrowRight className="h-5 w-5 ml-2" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Video Modal */}
      {isVideoPlaying && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setIsVideoPlaying(false)}
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.9 }}
            className="relative max-w-4xl w-full aspect-video bg-black rounded-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIsVideoPlaying(false)}
              className="absolute top-4 right-4 z-10 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
            <div className="w-full h-full flex items-center justify-center text-white">
              <Play className="h-16 w-16" />
              <span className="ml-4 text-xl">Demo Video Coming Soon</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}
