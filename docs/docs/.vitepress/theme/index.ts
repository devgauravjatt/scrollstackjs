import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'

import CancelDemo from './demo/CancelDemo.vue'
import DevtoolsDemo from './demo/DevtoolsDemo.vue'
import EventsDemo from './demo/EventsDemo.vue'
import FeedDemo from './demo/FeedDemo.vue'
import ManualDemo from './demo/ManualDemo.vue'
import PaginationDemo from './demo/PaginationDemo.vue'
import Playground from './demo/Playground.vue'
import RailDemo from './demo/RailDemo.vue'
import RetryDemo from './demo/RetryDemo.vue'
import StatesDemo from './demo/StatesDemo.vue'
import TutorialFeed from './demo/TutorialFeed.vue'
import VirtualDemo from './demo/VirtualDemo.vue'
import VirtualFeedDemo from './demo/VirtualFeedDemo.vue'

import './custom.css'

// The default theme, a dark-only palette, and the live demos. Every demo runs the
// real `@scrollstackjs/vue` build — VitePress is a Vue app, so no interop is needed.
export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('FeedDemo', FeedDemo)
    app.component('RetryDemo', RetryDemo)
    app.component('ManualDemo', ManualDemo)
    app.component('RailDemo', RailDemo)
    app.component('EventsDemo', EventsDemo)
    app.component('PaginationDemo', PaginationDemo)
    app.component('CancelDemo', CancelDemo)
    app.component('TutorialFeed', TutorialFeed)
    app.component('StatesDemo', StatesDemo)
    app.component('Playground', Playground)
    app.component('DevtoolsDemo', DevtoolsDemo)
    app.component('VirtualDemo', VirtualDemo)
    app.component('VirtualFeedDemo', VirtualFeedDemo)
  },
} satisfies Theme
