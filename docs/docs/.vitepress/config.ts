import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { defineConfig, type HeadConfig } from 'vitepress'

const REPO = 'https://github.com/devgauravjatt/scrollstackjs'

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
const origin = base === '/' ? 'https://scrollstack.js.org' : 'https://devgauravjatt.github.io'

// Canonical site root WITHOUT a trailing slash — everything below appends its own.
const siteUrl = `${origin}${base}`.replace(/\/$/, '')

// ...but VitePress resolves sitemap entries with `new URL(relativePath, hostname)`,
// and `new URL('api/core', '…/scrollstackjs')` drops the last path segment. So the
// sitemap hostname is the one place that MUST keep its trailing slash.
const sitemapHostname = `${siteUrl}/`

/**
 * Absolute canonical URL for a page, built to match exactly what the sitemap emits
 * — `cleanUrls` is on, so no `.html`, and `index.md` is the host root.
 */
function pageUrl(relativePath: string): string {
  const path = relativePath.replace(/\.md$/, '').replace(/(^|\/)index$/, '$1')
  return `${siteUrl}/${path}`
}

export default defineConfig({
  title: 'ScrollStack',
  description: 'Headless, framework-agnostic infinite scrolling for TypeScript.',
  cleanUrls: true,
  lastUpdated: true,
  base,

  sitemap: { hostname: sitemapHostname },

  // Static tags. Anything URL- or page-dependent is emitted per page in
  // `transformHead` below, so it follows the `base` switch automatically.
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: `${base}favicon.svg` }],
    ['link', { rel: 'apple-touch-icon', href: `${base}logo.png` }],
    ['meta', { name: 'theme-color', content: '#5eead4' }],
    ['meta', { name: 'author', content: 'devgauravjatt' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'ScrollStack' }],
    ['meta', { property: 'og:locale', content: 'en_US' }],
    // The logo is square (180×180), so the card type stays `summary` — claiming
    // `summary_large_image` without a 1200×630 asset renders a worse card.
    ['meta', { property: 'og:image', content: `${siteUrl}/logo.png` }],
    ['meta', { property: 'og:image:width', content: '180' }],
    ['meta', { property: 'og:image:height', content: '180' }],
    ['meta', { property: 'og:image:alt', content: 'ScrollStack' }],
    ['meta', { name: 'twitter:card', content: 'summary' }],
    ['meta', { name: 'twitter:image', content: `${siteUrl}/logo.png` }],
  ],

  // Per-page canonical + social tags. VitePress hands us the already-resolved
  // title/description, so frontmatter overrides are respected for free.
  transformHead({ pageData, title, description }) {
    const url = pageUrl(pageData.relativePath)
    const head: HeadConfig[] = [
      ['link', { rel: 'canonical', href: url }],
      ['meta', { property: 'og:url', content: url }],
      ['meta', { property: 'og:title', content: title }],
      ['meta', { property: 'og:description', content: description }],
      ['meta', { name: 'twitter:title', content: title }],
      ['meta', { name: 'twitter:description', content: description }],
    ]

    // Structured data belongs on the entry page only — repeating it per page adds
    // nothing and risks conflicting entity claims.
    if (pageData.relativePath === 'index.md') {
      head.push([
        'script',
        { type: 'application/ld+json' },
        JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'SoftwareSourceCode',
          name: 'ScrollStack',
          description,
          url: `${siteUrl}/`,
          codeRepository: REPO,
          programmingLanguage: 'TypeScript',
          runtimePlatform: ['React', 'Vue', 'Svelte'],
          license: 'https://opensource.org/licenses/MIT',
          author: { '@type': 'Person', name: 'devgauravjatt', url: REPO },
        }),
      ])
    }

    return head
  },

  // robots.txt is generated rather than kept in `public/` so its Sitemap line
  // tracks the same host the rest of the build was stamped with.
  async buildEnd({ outDir }) {
    await writeFile(
      join(outDir, 'robots.txt'),
      `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`,
    )
  },

  // Dark only — pins the site to the dark palette and removes the theme toggle.
  // `.vitepress/theme/custom.css` is written for this one palette.
  appearance: 'force-dark',

  themeConfig: {
    logo: '/logo.png',

    // Bundled at build time from the docs themselves — no external search service.
    search: { provider: 'local' },

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

    // Inline SVGs rather than the string shorthand: a string icon whose mask isn't
    // built in makes the page fetch it from api.iconify.design at runtime, and the
    // site should not depend on a third-party CDN.
    socialLinks: [
      {
        icon: {
          svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>',
        },
        link: REPO,
        ariaLabel: 'ScrollStack on GitHub',
      },
      {
        icon: {
          svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M1.763 0C.786 0 0 .786 0 1.763v20.474C0 23.214.786 24 1.763 24h20.474c.977 0 1.763-.786 1.763-1.763V1.763C24 .786 23.214 0 22.237 0zM5.13 5.323l13.837.019-.009 13.836h-3.464l.01-10.382h-3.456L12.04 19.17H5.113z"/></svg>',
        },
        link: 'https://www.npmjs.com/package/@scrollstackjs/core',
        ariaLabel: '@scrollstackjs/core on npm',
      },
    ],

    editLink: {
      pattern: `${REPO}/edit/main/docs/docs/:path`,
      text: 'Edit this page on GitHub',
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: `MIT © <a href="${REPO}">devgauravjatt</a>`,
    },
  },
})
