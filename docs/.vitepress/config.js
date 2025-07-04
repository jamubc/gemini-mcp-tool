import { defineConfig } from 'vitepress'
import container from 'markdown-it-container'

export default defineConfig({
  title: 'Gemini MCP Tool Documentation',
  description: 'Bridge Gemini models with Claude Desktop',
  base: '/gemini-mcp-tool/',
  
  // Force dark mode by default
  appearance: 'dark',
  
  markdown: {
    config: (md) => {
      // Register custom container for unstable features
      md.use(container, 'unstable', {
        render: function (tokens, idx) {
          const token = tokens[idx]
          if (token.nesting === 1) {
            // Opening tag
            return `<div class="custom-container unstable">\n<p class="custom-container-title">Unstable Feature</p>\n`
          } else {
            // Closing tag
            return `</div>\n`
          }
        }
      })
    }
  },
  
  themeConfig: {
    logo: '🚀',
    
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/getting-started/' },
      { text: 'API', link: '/api-reference' },
      { text: 'GitHub', link: 'https://github.com/jamubc/gemini-mcp-tool' }
    ],

    sidebar: [
      {
        text: 'Getting Started',
        collapsed: false,
        items: [
          { text: 'Overview', link: '/' },
          { text: 'Quick Start', link: '/getting-started/' },
          { text: 'Installation', link: '/installation/' },
          { text: 'First Steps', link: '/first-steps/' }
        ]
      },
      {
        text: 'Core Concepts',
        collapsed: false,
        items: [
          { text: 'How It Works', link: '/concepts/how-it-works' },
          { text: 'File Analysis (@)', link: '/concepts/file-analysis' },
          { text: 'Model Selection', link: '/concepts/models' },
          { text: 'Sandbox Mode', link: '/concepts/sandbox' }
        ]
      },
      {
        text: 'Usage',
        collapsed: false,
        items: [
          { text: 'Commands', link: '/usage/commands' },
          { text: 'Natural Language', link: '/usage/natural-language' },
          { text: 'Examples', link: '/usage/examples' },
          { text: 'Best Practices', link: '/usage/best-practices' }
        ]
      },
      {
        text: 'Contributing',
        collapsed: true,
        items: [
          { text: '3-Command Workflow', link: '/contributing/quick-start' },
          { text: 'Development Guide', link: '/contributing/development' },
          { text: 'Templates', link: '/contributing/templates' },
          { text: 'Testing', link: '/contributing/testing' }
        ]
      },
      {
        text: 'API Reference',
        collapsed: true,
        items: [
          { text: 'Tools', link: '/api/tools' },
          { text: 'Configuration', link: '/api/configuration' },
          { text: 'TypeScript API', link: '/api/typescript' }
        ]
      },
      {
        text: 'Resources',
        collapsed: true,
        items: [
          { text: 'Troubleshooting', link: '/resources/troubleshooting' },
          { text: 'FAQ', link: '/resources/faq' },
          { text: 'Changelog', link: '/resources/changelog' },
          { text: 'Roadmap', link: '/resources/roadmap' }
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/jamubc/gemini-mcp-tool' }
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Making AI collaboration simple, one tool at a time.'
    },

    search: {
      provider: 'local'
    }
  }
})