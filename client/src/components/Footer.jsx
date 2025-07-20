import { motion } from 'framer-motion'
import { 
  Sparkles, 
  Heart, 
  Github, 
  Twitter, 
  Mail, 
  ExternalLink 
} from 'lucide-react'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  const links = [
    {
      title: 'Product',
      items: [
        { name: 'Features', href: '#features' },
        { name: 'How it Works', href: '#how-it-works' },
        { name: 'Pricing', href: '#pricing' },
        { name: 'FAQ', href: '#faq' }
      ]
    },
    {
      title: 'Community',
      items: [
        { name: 'GitHub', href: 'https://github.com/notedwin-dev/storyforge-ai', external: true },
        { name: 'Discord', href: '#discord', external: true },
        { name: 'Twitter', href: '#twitter', external: true },
        { name: 'Blog', href: '#blog' }
      ]
    },
    {
      title: 'Support',
      items: [
        { name: 'Help Center', href: '#help' },
        { name: 'Contact Us', href: '#contact' },
        { name: 'API Docs', href: '#api' },
        { name: 'Status', href: '#status' }
      ]
    }
  ]

  const socialLinks = [
    { name: 'GitHub', icon: Github, href: 'https://github.com/notedwin-dev/storyforge-ai' },
    { name: 'Twitter', icon: Twitter, href: '#twitter' },
    { name: 'Email', icon: Mail, href: 'mailto:hello@storyforge-ai.com' }
  ]

  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Footer */}
        <div className="py-12 lg:py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="lg:col-span-1">
              <div className="flex items-center space-x-2 mb-4">
                <motion.div
                  whileHover={{ scale: 1.1, rotate: 180 }}
                  transition={{ duration: 0.3 }}
                  className="p-2 bg-linear-to-r from-primary-500 to-accent-500 rounded-lg"
                >
                  <Sparkles className="h-6 w-6 text-white" />
                </motion.div>
                <span className="text-xl font-heading font-bold">
                  TaleCraft AI
                </span>
              </div>
              <p className="text-gray-400 mb-6 max-w-md">
                Transform your characters into amazing animated stories with AI-powered storytelling, 
                consistent character rendering, and multi-format export.
              </p>
              <div className="flex space-x-4">
                {socialLinks.map((social) => {
                  const Icon = social.icon
                  return (
                    <motion.a
                      key={social.name}
                      href={social.href}
                      target={social.href.startsWith('http') ? '_blank' : undefined}
                      rel={social.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      <Icon className="h-5 w-5" />
                    </motion.a>
                  )
                })}
              </div>
            </div>

            {/* Links */}
            {links.map((section) => (
              <div key={section.title}>
                <h3 className="text-sm font-semibold uppercase tracking-wider mb-4">
                  {section.title}
                </h3>
                <ul className="space-y-3">
                  {section.items.map((item) => (
                    <li key={item.name}>
                      <a
                        href={item.href}
                        target={item.external ? '_blank' : undefined}
                        rel={item.external ? 'noopener noreferrer' : undefined}
                        className="text-gray-400 hover:text-white transition-colors flex items-center"
                      >
                        {item.name}
                        {item.external && (
                          <ExternalLink className="h-3 w-3 ml-1" />
                        )}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-800 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-1 text-gray-400 mb-4 md:mb-0">
              <span>© {currentYear} TaleCraft AI. Made with</span>
              <Heart className="h-4 w-4 text-red-500" />
              <span>for storytellers everywhere.</span>
            </div>
            
            <div className="flex space-x-6 text-sm text-gray-400">
              <a href="#privacy" className="hover:text-white transition-colors">
                Privacy Policy
              </a>
              <a href="#terms" className="hover:text-white transition-colors">
                Terms of Service
              </a>
              <a href="#cookies" className="hover:text-white transition-colors">
                Cookie Policy
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
