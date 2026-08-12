import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
//
// GitHub Pages serves this repo at two different roots and no single `base` covers
// both — asset URLs are baked in at build time:
//
//   https://scrollstack.js.org/                    → base '/'              (custom domain)
//   https://devgauravjatt.github.io/scrollstackjs/ → base '/scrollstackjs/' (bare project URL)
//
// So CI passes it in. `DOCS_BASE=/scrollstackjs/` until the js.org subdomain resolves;
// drop the env var from the workflow the moment the custom domain is attached.
// VitePress has no relative-base mode, so this really is either/or.
const base = process.env.DOCS_BASE ?? '/'

// Canonical host follows the base — sitemap URLs must match where the site is served,
// or search engines index URLs that 404. VitePress does not fold `base` into sitemap
// links, so the sub-path has to be carried on the hostname itself.
const hostname =
  base === '/' ? 'https://scrollstack.js.org' : `https://devgauravjatt.github.io${base}`

export default defineConfig({
  title: 'ScrollStack',
  description: 'Headless, framework-agnostic infinite scrolling for TypeScript.',
  cleanUrls: true,
  lastUpdated: true,
  base,

  sitemap: { hostname },

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
