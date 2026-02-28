import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "MicroCoreOS",
  description: "Atomic Microkernel Architecture optimized for AI-Driven Development",
  themeConfig: {
    logo: '/logo.png',
    nav: [
      { text: 'Guide', link: '/guide/philosophy' },
      { text: 'Reference', link: '/reference/tools' },
      { text: 'GitHub', link: 'https://github.com/theanibalos/MicroCoreOS' }
    ],

    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Philosophy & Principles', link: '/guide/philosophy' },
          { text: 'Quick Start', link: '/guide/quick-start' },
          { text: 'Lifecycle & DI', link: '/guide/lifecycle' },
        ]
      },
      {
        text: 'Development',
        items: [
          { text: 'Creating Plugins', link: '/development/creating-plugins' },
          { text: 'Creating Tools', link: '/development/creating-tools' },
          { text: 'Testing', link: '/development/testing' },
        ]
      },
      {
        text: 'Reference',
        items: [
          { text: 'Tools Inventory', link: '/reference/tools' },
          { text: 'AI Native Design', link: '/reference/ai-native' },
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/theanibalos/MicroCoreOS' }
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024-present AnibalOS'
    }
  }
})
