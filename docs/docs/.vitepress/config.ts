import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
// Deploying to a sub-path (e.g. GitHub Pages project site)? Set `base: '/scrollstack/'`.
export default defineConfig({
  title: 'ScrollStack',
  description: 'Headless, framework-agnostic infinite scrolling for TypeScript.',
  cleanUrls: true,
  lastUpdated: true,

  // Dark only — pins the site to the dark palette and removes the theme toggle.
  // `.vitepress/theme/custom.css` is written for this one palette.
  appearance: 'force-dark',

  themeConfig: {
    nav: [
      { text: 'Tutorial', link: '/tutorial' },
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Demo', link: '/demo' },
      { text: 'API', link: '/api/core' },
      { text: 'Decisions', link: '/decisions' },
    ],

    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Tutorial', link: '/tutorial' },
          { text: 'Getting started', link: '/guide/getting-started' },
          { text: 'Live demo', link: '/demo' },
          { text: 'Core concepts', link: '/guide/concepts' },
          { text: 'Pagination', link: '/guide/pagination' },
          { text: 'Errors & retry', link: '/guide/errors-and-retry' },
          { text: 'Horizontal & scoped scrolling', link: '/guide/horizontal' },
          { text: 'Server rendering', link: '/guide/ssr' },
          { text: 'Events & plugins', link: '/guide/events-and-plugins' },
        ],
      },
      {
        text: 'API reference',
        items: [
          { text: '@scrollstackjs/core', link: '/api/core' },
          { text: '@scrollstackjs/react', link: '/api/react' },
          { text: '@scrollstackjs/vue', link: '/api/vue' },
          { text: '@scrollstackjs/svelte', link: '/api/svelte' },
        ],
      },
      {
        text: 'Reference',
        items: [{ text: 'Architecture decisions', link: '/decisions' }],
      },
    ],

    outline: [2, 3],
    footer: {
      message: 'Released under the MIT License.',
    },
  },
})
