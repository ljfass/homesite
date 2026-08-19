# Hello World Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-ready Vue 3 + TypeScript single-page personal homepage with an accessible GSAP ScrollTrigger horizontal desktop story and complete mobile/reduced-motion fallbacks.

**Architecture:** Keep all editable copy in a typed content module, render it through small semantic Vue components, and isolate animation setup in a single composable. GSAP is progressive enhancement: desktop users get a pinned horizontal story, while mobile and reduced-motion users get a complete vertical document.

**Tech Stack:** Vue 3, TypeScript, Vite, GSAP + ScrollTrigger, Lucide Vue, JetBrains Mono variable font, Vitest, Vue Test Utils, Playwright.

---

## File Map

- `package.json`: scripts and dependency manifest.
- `index.html`: Chinese document metadata and app mount point.
- `vite.config.ts`: Vue, Vitest and build configuration.
- `tsconfig.json`, `tsconfig.app.json`, `src/env.d.ts`: TypeScript configuration.
- `vitest.setup.ts`: DOM test cleanup.
- `playwright.config.ts`: desktop, mobile and reduced-motion browser projects.
- `src/main.ts`: application bootstrap and global style/font imports.
- `src/App.vue`: top-level semantic page composition.
- `src/content/home.ts`: typed editable copy and optional ICP record.
- `src/components/SiteHeader.vue`: fixed status/header progress.
- `src/components/HeroSection.vue`: entry section and raster signal artwork.
- `src/components/HorizontalStory.vue`: pin-ready story stage and track.
- `src/components/StoryPanel.vue`: reusable semantic chapter.
- `src/components/SiteFooter.vue`: back-to-top control and optional ICP link.
- `src/composables/useHomeMotion.ts`: GSAP timelines, media queries, refresh and cleanup.
- `src/lib/gsap.ts`: one-time ScrollTrigger registration.
- `src/lib/motion.ts`: pure motion-mode and horizontal-distance calculations.
- `src/styles/tokens.css`: semantic color, spacing, typography and motion tokens.
- `src/styles/global.css`: reset, layout, responsive and reduced-motion rules.
- `src/assets/signal-field.webp`: licensed, attributed, cropped and edited decorative raster artwork.
- `src/__tests__/content.test.ts`: typed content invariants.
- `src/__tests__/App.test.ts`: semantic homepage and footer behavior.
- `src/__tests__/motion.test.ts`: motion policy and distance unit tests.
- `tests/home.spec.ts`: browser-level layout, ScrollTrigger and fallback tests.

### Task 1: Bootstrap Vue and Test Tooling

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `vitest.setup.ts`
- Create: `src/env.d.ts`

- [ ] **Step 1: Create the package manifest**

```json
{
  "name": "hello-world-homepage",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "engines": {
    "node": "^20.19.0 || ^22.13.0 || >=24.0.0"
  },
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "vue-tsc --noEmit -p tsconfig.app.json && tsc --noEmit -p tsconfig.node.json && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "check": "npm run test && npm run build && npm run test:e2e"
  }
}
```

- [ ] **Step 2: Install runtime and development dependencies**

Run:

```bash
npm install vue gsap lucide-vue-next @fontsource-variable/jetbrains-mono
npm install -D vite typescript vue-tsc @vitejs/plugin-vue vitest @vue/test-utils jsdom @playwright/test @types/node
```

Expected: `package-lock.json` is created and `npm ls --depth=0` exits with code 0.

- [ ] **Step 3: Add TypeScript, Vite and Vitest configuration**

`tsconfig.json`:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

`tsconfig.app.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "jsx": "preserve",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "noEmit": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client"]
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue"]
}
```

`tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "lib": ["ES2022", "ESNext.Disposable", "DOM"],
    "types": ["node", "vitest/globals"]
  },
  "include": ["vite.config.ts", "vitest.setup.ts", "playwright.config.ts"]
}
```

`vite.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
})
```

`vitest.setup.ts`:

```ts
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
})
```

`src/env.d.ts`:

```ts
/// <reference types="vite/client" />
```

- [ ] **Step 4: Add the HTML shell**

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#0c0f0d" />
    <meta name="description" content="一个尚未被定义、持续生长的个人主页" />
    <title>Hello World</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 5: Verify dependency and configuration health**

Run: `npm ls --depth=0`

Expected: exit code 0 with Vue, Vite, Vitest, GSAP and Playwright listed.

- [ ] **Step 6: Commit the toolchain**

```bash
git add package.json package-lock.json index.html tsconfig.json tsconfig.app.json vite.config.ts vitest.setup.ts src/env.d.ts
git commit -m "chore: bootstrap vue homepage toolchain"
```

### Task 2: Define Typed Homepage Content

**Files:**
- Test: `src/__tests__/content.test.ts`
- Create: `src/content/home.ts`

- [ ] **Step 1: Write the failing content test**

```ts
import { describe, expect, it } from 'vitest'
import { homeContent } from '../content/home'

describe('homeContent', () => {
  it('keeps the story chapters unique and ordered', () => {
    expect(homeContent.story.map((item) => item.index)).toEqual(['01', '02', '03'])
    expect(new Set(homeContent.story.map((item) => item.id)).size).toBe(3)
  })

  it('does not publish an unassigned ICP record', () => {
    expect(homeContent.site.icpNumber).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test and verify red**

Run: `npm test -- src/__tests__/content.test.ts`

Expected: FAIL because `src/content/home.ts` does not exist.

- [ ] **Step 3: Implement the typed content module**

```ts
export type StoryItem = {
  id: 'about' | 'now' | 'principles'
  index: '01' | '02' | '03'
  eyebrow: string
  title: string[]
  body: string
  command: string
  items?: Array<{ label: string; value?: string }>
}

export const homeContent = {
  site: {
    domain: 'huangjianfen.cn',
    title: 'Hello World',
    description: '一个尚未被定义、持续生长的个人主页',
    icpNumber: null as string | null,
  },
  hero: {
    index: '00',
    eyebrow: 'ENTRY',
    title: ['Hello', 'World'],
    body: '一个还没有被定义的个人主页。先在互联网留下一处坐标，其他的以后慢慢发生。',
    command: '$ scroll_to_begin',
  },
  story: [
    {
      id: 'about', index: '01', eyebrow: 'ABOUT THIS PLACE', title: ['这里，', '暂时没有主题。'],
      body: '它可以装下偶然的想法、正在做的事情，也可以什么都不解释。保持开放，本身就是一种方向。',
      command: '$ cat /about/intention.txt',
    },
    {
      id: 'now', index: '02', eyebrow: 'NOW', title: ['正在', '发生'],
      body: '不虚构经历，只展示这个站点此刻的真实状态。', command: '$ watch /now',
      items: [{ label: '学习', value: '持续' }, { label: '记录', value: '偶尔' }, { label: '构建', value: '进行中' }],
    },
    {
      id: 'principles', index: '03', eyebrow: 'PRINCIPLES', title: ['保持', '未完成'],
      body: '先用三条简单原则占住这里，未来再替换成你的项目、文章或生活切片。', command: '$ list /principles',
      items: [{ label: '保持好奇' }, { label: '先做再说' }, { label: '留点空白' }],
    },
  ] satisfies StoryItem[],
  ending: {
    index: '04', eyebrow: 'END', title: ['To be', 'continued.'],
    body: '这里不是结尾，只是本次滚动的终点。',
  },
} as const
```

- [ ] **Step 4: Run the test and verify green**

Run: `npm test -- src/__tests__/content.test.ts`

Expected: 2 tests pass.

- [ ] **Step 5: Commit typed content**

```bash
git add src/content/home.ts src/__tests__/content.test.ts
git commit -m "feat: define typed homepage content"
```

### Task 3: Build the Semantic Vue Page

**Files:**
- Test: `src/__tests__/App.test.ts`
- Create: `src/App.vue`
- Create: `src/main.ts`
- Create: `src/components/SiteHeader.vue`
- Create: `src/components/HeroSection.vue`
- Create: `src/components/HorizontalStory.vue`
- Create: `src/components/StoryPanel.vue`
- Create: `src/components/SiteFooter.vue`

- [ ] **Step 1: Write the failing semantic render tests**

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import App from '../App.vue'

describe('App', () => {
  it('renders one main heading and all five numbered chapters', () => {
    const wrapper = mount(App)
    expect(wrapper.findAll('h1')).toHaveLength(1)
    expect(wrapper.get('h1').text()).toContain('HelloWorld')
    expect(wrapper.findAll('[data-chapter]')).toHaveLength(5)
    expect(wrapper.text()).toContain('To becontinued.')
  })

  it('renders semantic landmarks and a skip link', () => {
    const wrapper = mount(App)
    expect(wrapper.get('a[href="#main-content"]').text()).toBe('跳到主要内容')
    expect(wrapper.find('header').exists()).toBe(true)
    expect(wrapper.find('main').exists()).toBe(true)
    expect(wrapper.find('footer').exists()).toBe(true)
  })

  it('scrolls to the top from the footer control', async () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
    const wrapper = mount(App)
    await wrapper.get('[data-back-to-top]').trigger('click')
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
  })
})
```

- [ ] **Step 2: Run the component test and verify red**

Run: `npm test -- src/__tests__/App.test.ts`

Expected: FAIL because `src/App.vue` does not exist.

- [ ] **Step 3: Implement focused semantic components**

`StoryPanel.vue` receives a `StoryItem` prop and renders a numbered `section[data-chapter]`. `HeroSection.vue` renders the only `h1`. `HorizontalStory.vue` loops over `homeContent.story` and appends the ending panel. `SiteHeader.vue` exposes `progress` and `chapter` props. `SiteFooter.vue` emits no events and calls `window.scrollTo` directly using reduced-motion detection.

Core `App.vue` composition:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { homeContent } from './content/home'
import SiteHeader from './components/SiteHeader.vue'
import HeroSection from './components/HeroSection.vue'
import HorizontalStory from './components/HorizontalStory.vue'
import SiteFooter from './components/SiteFooter.vue'

const progress = ref(0)
const chapter = ref('00')
</script>

<template>
  <a class="skip-link" href="#main-content">跳到主要内容</a>
  <SiteHeader :domain="homeContent.site.domain" :progress="progress" :chapter="chapter" />
  <main id="main-content">
    <HeroSection :content="homeContent.hero" />
    <HorizontalStory :items="homeContent.story" :ending="homeContent.ending" />
  </main>
  <SiteFooter :site="homeContent.site" />
</template>
```

`src/main.ts`:

```ts
import { createApp } from 'vue'
import '@fontsource-variable/jetbrains-mono'
import './styles/tokens.css'
import './styles/global.css'
import App from './App.vue'

createApp(App).mount('#app')
```

- [ ] **Step 4: Run component tests and make them green**

Run: `npm test -- src/__tests__/App.test.ts`

Expected: 3 tests pass with no Vue warnings.

- [ ] **Step 5: Verify all unit tests**

Run: `npm test`

Expected: 5 tests pass.

- [ ] **Step 6: Commit the semantic page**

```bash
git add src/App.vue src/main.ts src/components src/__tests__/App.test.ts
git commit -m "feat: build semantic homepage structure"
```

### Task 4: Add Motion Policy and GSAP Integration

**Files:**
- Test: `src/__tests__/motion.test.ts`
- Create: `src/lib/motion.ts`
- Create: `src/lib/gsap.ts`
- Create: `src/composables/useHomeMotion.ts`
- Modify: `src/App.vue`
- Modify: `src/components/HeroSection.vue`
- Modify: `src/components/HorizontalStory.vue`
- Modify: `src/components/SiteHeader.vue`

- [ ] **Step 1: Write failing pure motion tests**

```ts
import { describe, expect, it } from 'vitest'
import { getHorizontalTravel, getMotionMode } from '../lib/motion'

describe('motion policy', () => {
  it('uses static vertical content for reduced motion', () => {
    expect(getMotionMode({ desktop: true, reduced: true })).toBe('static')
  })

  it('uses horizontal motion only on desktop', () => {
    expect(getMotionMode({ desktop: true, reduced: false })).toBe('horizontal')
    expect(getMotionMode({ desktop: false, reduced: false })).toBe('vertical')
  })

  it('never returns a negative horizontal travel distance', () => {
    expect(getHorizontalTravel(1600, 1000)).toBe(600)
    expect(getHorizontalTravel(800, 1000)).toBe(0)
  })
})
```

- [ ] **Step 2: Run motion tests and verify red**

Run: `npm test -- src/__tests__/motion.test.ts`

Expected: FAIL because `src/lib/motion.ts` does not exist.

- [ ] **Step 3: Implement motion policy**

```ts
export type MotionMode = 'horizontal' | 'vertical' | 'static'

export function getMotionMode(input: { desktop: boolean; reduced: boolean }): MotionMode {
  if (input.reduced) return 'static'
  return input.desktop ? 'horizontal' : 'vertical'
}

export function getHorizontalTravel(trackWidth: number, viewportWidth: number): number {
  return Math.max(0, trackWidth - viewportWidth)
}
```

- [ ] **Step 4: Run motion tests and verify green**

Run: `npm test -- src/__tests__/motion.test.ts`

Expected: 3 tests pass.

- [ ] **Step 5: Register ScrollTrigger once**

```ts
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export { gsap, ScrollTrigger }
```

- [ ] **Step 6: Implement the Vue motion composable**

`useHomeMotion.ts` must:

```ts
import { onBeforeUnmount, onMounted, type Ref } from 'vue'
import { gsap, ScrollTrigger } from '../lib/gsap'
import { getHorizontalTravel } from '../lib/motion'

export function useHomeMotion(root: Ref<HTMLElement | null>, onProgress: (value: number, chapter: string) => void) {
  let media: gsap.MatchMedia | undefined

  onMounted(async () => {
    if (!root.value) return
    await document.fonts?.ready
    media = gsap.matchMedia()
    const scope = root.value

    media.add('(prefers-reduced-motion: reduce)', () => undefined)
    media.add('(prefers-reduced-motion: no-preference) and (min-width: 768px)', () => {
      const context = gsap.context(() => {
        gsap.timeline().from('[data-hero-line]', { yPercent: 110, opacity: 0, stagger: 0.08, duration: 0.7 })
        const stage = scope.querySelector<HTMLElement>('[data-story-stage]')
        const track = scope.querySelector<HTMLElement>('[data-story-track]')
        if (!stage || !track) return
        gsap.to(track, {
          x: () => -getHorizontalTravel(track.scrollWidth, window.innerWidth),
          ease: 'none',
          scrollTrigger: {
            trigger: stage,
            start: 'top top',
            end: () => `+=${getHorizontalTravel(track.scrollWidth, window.innerWidth)}`,
            pin: true,
            scrub: 0.8,
            invalidateOnRefresh: true,
            onUpdate: (self) => onProgress(self.progress, String(Math.min(4, Math.floor(self.progress * 4) + 1)).padStart(2, '0')),
          },
        })
      }, scope)
      return () => context.revert()
    })

    media.add('(prefers-reduced-motion: no-preference) and (max-width: 767px)', () => {
      const context = gsap.context(() => {
        ScrollTrigger.batch('[data-story-panel]', {
          start: 'top 82%', once: true,
          onEnter: (elements) => gsap.from(elements, { y: 32, opacity: 0, stagger: 0.06, duration: 0.45 }),
        })
      }, scope)
      return () => context.revert()
    })
    ScrollTrigger.refresh()
  })

  onBeforeUnmount(() => media?.revert())
}
```

Call the composable once from `App.vue`, pass a root ref, and update the header progress/chapter refs. Add the required `data-*` hooks to hero, stage, track and panels.

- [ ] **Step 7: Run unit tests and type check**

Run: `npm test`

Expected: 8 tests pass.

Run: `npx vue-tsc --noEmit -p tsconfig.app.json`

Expected: exit code 0.

- [ ] **Step 8: Commit motion integration**

```bash
git add src/lib src/composables src/App.vue src/components src/__tests__/motion.test.ts
git commit -m "feat: add responsive scrolltrigger motion"
```

### Task 5: Create the Visual System and Raster Asset

**Files:**
- Create: `src/styles/tokens.css`
- Create: `src/styles/global.css`
- Create: `src/assets/signal-field.webp`
- Modify: `src/components/HeroSection.vue`
- Modify: `src/components/HorizontalStory.vue`
- Modify: `src/components/StoryPanel.vue`
- Modify: `src/components/SiteHeader.vue`
- Modify: `src/components/SiteFooter.vue`

- [ ] **Step 1: Prepare the signal artwork**

> Controlled substitution (2026-08-19): the built-in image generator was unavailable in the execution environment. A free-to-use Unsplash image by Logan Voss was used under the Unsplash License with attribution, then cropped, resized and edited to match the required signal-field direction.

The selected source and local edit preserve this target direction:

```text
Abstract digital signal field for a contemporary personal developer homepage. Near-black neutral green background, precise phosphor-green contour lines and sparse coral-orange pulses, visible scan texture, asymmetrical composition, crisp high-frequency detail, no text, no logos, no gradients or glowing bokeh, editorial and technical rather than sci-fi, enough negative space for oversized typography. Landscape 3:2.
```

Save the optimized 3:2 output as `src/assets/signal-field.webp` and keep it under 500 KB. Record the source, author, license and local edits in `src/assets/ATTRIBUTION.md`.

- [ ] **Step 2: Add semantic design tokens**

```css
:root {
  color-scheme: dark;
  --color-bg: #0c0f0d;
  --color-surface: #151a16;
  --color-line: #343d36;
  --color-text: #eef3ec;
  --color-muted: #a7b1a8;
  --color-signal: #91f4a4;
  --color-pulse: #ff825a;
  --font-display: 'JetBrains Mono Variable', ui-monospace, monospace;
  --font-body: 'PingFang SC', 'Microsoft YaHei', sans-serif;
  --space-1: 0.5rem;
  --space-2: 1rem;
  --space-3: 1.5rem;
  --space-4: 2rem;
  --space-6: 3rem;
  --content-max: 1440px;
  --focus-ring: 0 0 0 3px #0c0f0d, 0 0 0 5px #91f4a4;
}
```

- [ ] **Step 3: Implement global and responsive CSS**

`global.css` must include:

```css
*, *::before, *::after { box-sizing: border-box; }
html { background: var(--color-bg); scroll-behavior: smooth; }
body { margin: 0; min-width: 320px; overflow-x: clip; background: var(--color-bg); color: var(--color-text); font-family: var(--font-body); }
button, a { touch-action: manipulation; }
:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.skip-link { position: fixed; left: 1rem; top: 1rem; z-index: 1000; transform: translateY(-160%); }
.skip-link:focus { transform: translateY(0); }
.hero { min-height: 100dvh; }
.story-track { display: flex; width: max-content; }
.story-panel { width: min(82vw, 1080px); min-height: 100dvh; border-right: 1px solid var(--color-line); }
@media (max-width: 767px), (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  .story-track { display: block; width: 100%; transform: none !important; }
  .story-panel { width: 100%; min-height: auto; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
}
```

Complete the component-level classes with a stable sticky header, large but responsive title, section grids, visible progress bar, hover/focus states, safe-area padding, and no horizontal overflow at 320px.

- [ ] **Step 4: Connect the raster asset**

Use a semantic `<img class="hero__signal" src="..." alt="" width="1200" height="800" fetchpriority="high">` in `HeroSection.vue`. Reserve its aspect ratio in CSS and place it full-bleed behind/alongside the title without wrapping it in a decorative card.

- [ ] **Step 5: Run tests and production build**

Run: `npm test`

Expected: 8 tests pass.

Run: `npm run build`

Expected: exit code 0 and optimized assets in `dist/`.

- [ ] **Step 6: Commit the visual system**

```bash
git add src/styles src/assets src/components
git commit -m "feat: apply horizontal terminal visual system"
```

### Task 6: Lock Browser Behavior with Playwright

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/home.spec.ts`
- Modify: `package.json`
- Modify: `src/composables/useHomeMotion.ts`
- Modify: `src/styles/global.css`

- [ ] **Step 1: Add Playwright configuration**

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:5173', reuseExistingServer: true },
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['iPhone 13'] } },
    { name: 'reduced-motion', use: { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' } },
  ],
})
```

- [ ] **Step 2: Write browser behavior tests**

```ts
import { expect, test } from '@playwright/test'

test('renders all content without horizontal viewport overflow', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: /Hello\s*World/ })).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})

test('desktop scroll moves the horizontal story track', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop')
  await page.goto('/')
  const track = page.locator('[data-story-track]')
  const before = await track.evaluate((el) => getComputedStyle(el).transform)
  await page.locator('[data-story-stage]').scrollIntoViewIfNeeded()
  await page.mouse.wheel(0, 1200)
  await page.waitForTimeout(900)
  const after = await track.evaluate((el) => getComputedStyle(el).transform)
  expect(after).not.toBe(before)
})

test('fallback mode does not create a pin spacer', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'desktop')
  await page.goto('/')
  await expect(page.locator('.pin-spacer')).toHaveCount(0)
  await expect(page.getByText('To be continued.')).toBeVisible()
})

test('back to top works', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.getByRole('button', { name: '回到顶部' }).click()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(2)
})
```

- [ ] **Step 3: Run the browser tests**

Run: `npx playwright install chromium` if Chromium is absent, then `npm run test:e2e`.

Expected: the page boots in all three projects; desktop changes the track transform after scroll; mobile and reduced-motion have no `.pin-spacer`; every project has no viewport overflow and reaches the ending.

- [ ] **Step 4: Verify all browser projects**

Run: `npm run test:e2e`

Expected: all tests pass in desktop, mobile and reduced-motion projects, with intentional project skips only.

- [ ] **Step 5: Commit browser coverage**

```bash
git add playwright.config.ts tests package.json src
git commit -m "test: cover homepage motion and fallbacks"
```

### Task 7: Final Verification and Delivery

**Files:**
- Modify only if verification finds an issue.

- [ ] **Step 1: Run the complete automated check**

Run: `npm run check`

Expected: unit tests pass, production build exits 0, and all Playwright projects pass.

- [ ] **Step 2: Start the production-equivalent preview**

Run: `npm run dev -- --host 127.0.0.1`

Expected: Vite prints a reachable local URL with no startup errors.

- [ ] **Step 3: Capture desktop and mobile screenshots**

Capture at least:

- Desktop `1440×900`: hero top, horizontal story mid-progress and ending.
- Mobile `390×844`: hero, stacked story and footer.
- Desktop `1440×900` with reduced motion.

Inspect each image for blank artwork, clipping, horizontal viewport overflow, unreadable contrast, content overlap and hidden controls.

- [ ] **Step 4: Verify ScrollTrigger interactions manually**

Confirm that desktop scrolling moves the internal track while the stage is pinned, header progress advances from `00` to `04`, the ending is reachable, mobile has no pinning, reduced motion has no transform-driven story, and the back-to-top button returns to scroll position 0.

- [ ] **Step 5: Run a final clean verification after any visual fix**

Run: `npm run check`

Expected: the full command exits 0 after the last source edit.

- [ ] **Step 6: Commit final verified fixes**

```bash
git add src tests
git commit -m "fix: polish verified homepage layout"
```

Skip this commit when verification required no source changes.
