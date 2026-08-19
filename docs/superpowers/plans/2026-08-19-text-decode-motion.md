# Text Decode Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one-shot SplitText title reveals and ScrambleText terminal decoding without disturbing the homepage's existing responsive ScrollTrigger story.

**Architecture:** Keep `src/lib/gsap.ts` as the only plugin registration boundary, add a DOM-scoped `textMotion` controller that owns splitting, timelines, one-shot state, and cleanup, and let `useHomeMotion` remain the only Vue lifecycle and scroll-orchestration owner. Vue components expose stable data attributes and final accessible labels; reduced-motion bypasses the controller entirely so the original DOM is rendered immediately.

**Tech Stack:** Vue 3, TypeScript, GSAP 3.15 SplitText/ScrambleText/ScrollTrigger, Vitest, Vue Test Utils, Playwright.

---

## File Map

- Modify: `src/lib/gsap.ts` - register and export SplitText and ScrambleTextPlugin beside ScrollTrigger.
- Create: `src/lib/textMotion.ts` - build chapter timelines, guard one-shot playback, handle auto re-splitting, and restore DOM on cleanup.
- Modify: `src/components/HeroSection.vue` - expose hero text targets and stable accessible values.
- Modify: `src/components/StoryPanel.vue` - expose reusable chapter text targets and stable accessible values.
- Modify: `src/components/HorizontalStory.vue` - expose ending text targets.
- Modify: `src/composables/useHomeMotion.ts` - connect text playback to existing desktop and compact chapter transitions.
- Modify: `src/styles/global.css` - declare the SplitText line-mask contract without changing page layout.
- Create: `src/__tests__/gsap.test.ts` - protect the shared plugin registration boundary.
- Create: `src/__tests__/textMotion.test.ts` - verify sequence construction, one-shot behavior, re-splitting, missing targets, and cleanup.
- Modify: `src/__tests__/App.test.ts` - verify component target and accessibility contracts.
- Modify: `src/__tests__/styles.test.ts` - verify the line-mask and reduced-motion CSS contracts.
- Modify: `src/__tests__/useHomeMotion.test.ts` - verify orchestration and reduced-motion bypass.
- Modify: `tests/e2e/home.spec.ts` - verify final text, no replay, fallbacks, and absence of runtime/layout regressions.

### Task 1: Register the Text Plugins at the Shared GSAP Boundary

**Files:**
- Create: `src/__tests__/gsap.test.ts`
- Modify: `src/lib/gsap.ts`

- [ ] **Step 1: Write the failing registration test**

Create `src/__tests__/gsap.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  gsap: { registerPlugin: vi.fn() },
  ScrollTrigger: { name: 'ScrollTrigger' },
  SplitText: { name: 'SplitText' },
  ScrambleTextPlugin: { name: 'ScrambleTextPlugin' },
}))

vi.mock('gsap', () => ({ default: mocks.gsap }))
vi.mock('gsap/ScrollTrigger', () => ({ default: mocks.ScrollTrigger }))
vi.mock('gsap/SplitText', () => ({ default: mocks.SplitText }))
vi.mock('gsap/ScrambleTextPlugin', () => ({ default: mocks.ScrambleTextPlugin }))

describe('shared GSAP boundary', () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.gsap.registerPlugin.mockClear()
  })

  it('registers and exports every homepage plugin', async () => {
    const module = await import('../lib/gsap')

    expect(mocks.gsap.registerPlugin).toHaveBeenCalledWith(
      mocks.ScrollTrigger,
      mocks.SplitText,
      mocks.ScrambleTextPlugin,
    )
    expect(module).toMatchObject({
      gsap: mocks.gsap,
      ScrollTrigger: mocks.ScrollTrigger,
      SplitText: mocks.SplitText,
      ScrambleTextPlugin: mocks.ScrambleTextPlugin,
    })
  })
})
```

- [ ] **Step 2: Run the focused test and verify red**

Run:

```bash
npm test -- src/__tests__/gsap.test.ts
```

Expected: FAIL because `SplitText` and `ScrambleTextPlugin` are neither imported, registered, nor exported.

- [ ] **Step 3: Register the bundled public plugins**

Replace `src/lib/gsap.ts` with:

```ts
import gsap from 'gsap'
import ScrambleTextPlugin from 'gsap/ScrambleTextPlugin'
import ScrollTrigger from 'gsap/ScrollTrigger'
import SplitText from 'gsap/SplitText'

gsap.registerPlugin(ScrollTrigger, SplitText, ScrambleTextPlugin)

export { gsap, ScrambleTextPlugin, ScrollTrigger, SplitText }
```

Do not add another npm dependency; both plugins ship in the installed `gsap@3.15.0` package.

- [ ] **Step 4: Verify the registration and type boundary**

Run:

```bash
npm test -- src/__tests__/gsap.test.ts
npx vue-tsc --noEmit -p tsconfig.app.json
```

Expected: the focused test passes and Vue/TypeScript exits with code 0.

- [ ] **Step 5: Commit the plugin boundary**

```bash
git add src/lib/gsap.ts src/__tests__/gsap.test.ts
git commit -m "feat: register GSAP text plugins"
```

### Task 2: Add Stable Text Targets and Accessible Final Values

**Files:**
- Modify: `src/__tests__/App.test.ts`
- Modify: `src/components/HeroSection.vue`
- Modify: `src/components/StoryPanel.vue`
- Modify: `src/components/HorizontalStory.vue`

- [ ] **Step 1: Write the failing component contract test**

Add this test inside `describe('App', ...)` in `src/__tests__/App.test.ts`:

```ts
it('exposes scoped text-motion targets with stable accessible values', () => {
  const wrapper = mount(App)
  wrappers.push(wrapper)

  const chapters = wrapper.findAll<HTMLElement>('[data-chapter]')
  expect(chapters).toHaveLength(5)
  expect(chapters.every((chapter) => chapter.findAll('[data-text-title]').length === 1)).toBe(true)
  expect(chapters.every((chapter) => chapter.findAll('[data-text-label]').length === 1)).toBe(true)
  expect(chapters.every((chapter) => chapter.findAll('[data-text-copy]').length === 1)).toBe(true)

  const commands = wrapper.findAll<HTMLElement>('[data-text-command]')
  expect(commands).toHaveLength(4)
  expect(commands.map((command) => command.attributes('aria-label'))).toEqual([
    homeContent.hero.command,
    ...homeContent.story.map((item) => item.command),
  ])

  const labels = wrapper.findAll<HTMLElement>('[data-text-label]')
  expect(labels.map((label) => label.attributes('aria-label'))).toEqual([
    `${homeContent.hero.index} / ${homeContent.hero.eyebrow}`,
    ...homeContent.story.map((item) => `${item.index} / ${item.eyebrow}`),
    `${homeContent.ending.index} / ${homeContent.ending.eyebrow}`,
  ])

  expect(wrapper.findAll('[data-text-list]')).toHaveLength(2)
})
```

- [ ] **Step 2: Run the component test and verify red**

Run:

```bash
npm test -- src/__tests__/App.test.ts
```

Expected: FAIL because the `data-text-*` and final `aria-label` attributes do not exist.

- [ ] **Step 3: Add hero contracts without adding component animation code**

Update the relevant nodes in `src/components/HeroSection.vue`:

```vue
<p
  class="chapter-label display-type"
  data-text-label
  :aria-label="`${hero.index} / ${hero.eyebrow}`"
>
  {{ hero.index }} / {{ hero.eyebrow }}
</p>
<h1 id="entry-title" class="hero__title display-type" data-text-title>
  <span v-for="(line, index) in hero.title" :key="line">
    {{ line }}{{ index < hero.title.length - 1 ? ' ' : '' }}
  </span>
</h1>
<p class="hero__body" data-text-copy>{{ hero.body }}</p>
<p
  class="terminal-command display-type"
  data-text-command
  :aria-label="hero.command"
>
  {{ hero.command }}
</p>
```

Remove the superseded `data-hero-line` and `data-hero-copy` attributes; their animation is replaced by the new controller.

- [ ] **Step 4: Add reusable story-panel contracts**

Update the corresponding nodes in `src/components/StoryPanel.vue`:

```vue
<p
  class="chapter-label display-type"
  data-text-label
  :aria-label="`${item.index} / ${item.eyebrow}`"
>
  {{ item.index }} / {{ item.eyebrow }}
</p>
<h2 :id="`${item.id}-title`" class="story-panel__title display-type" data-text-title>
  <span v-for="(line, index) in item.title" :key="line">
    {{ line }}{{ index < item.title.length - 1 ? ' ' : '' }}
  </span>
</h2>
<p class="story-panel__body" data-text-copy>{{ item.body }}</p>
<p
  class="terminal-command display-type"
  data-text-command
  :aria-label="item.command"
>
  {{ item.command }}
</p>
<ul v-if="item.items?.length" class="status-list" data-text-list>
```

- [ ] **Step 5: Add ending contracts**

Update the ending content in `src/components/HorizontalStory.vue`:

```vue
<p
  class="chapter-label display-type"
  data-text-label
  :aria-label="`${ending.index} / ${ending.eyebrow}`"
>
  {{ ending.index }} / {{ ending.eyebrow }}
</p>
<h2 id="ending-title" class="story-panel__title display-type" data-text-title>
  <span v-for="(line, index) in ending.title" :key="line">
    {{ line }}{{ index < ending.title.length - 1 ? ' ' : '' }}
  </span>
</h2>
<p class="story-panel__body" data-text-copy>{{ ending.body }}</p>
```

- [ ] **Step 6: Verify and commit the component contracts**

Run:

```bash
npm test -- src/__tests__/App.test.ts
```

Expected: all App/component tests pass, including exact final command and label values.

```bash
git add src/components/HeroSection.vue src/components/StoryPanel.vue src/components/HorizontalStory.vue src/__tests__/App.test.ts
git commit -m "feat: expose text motion targets"
```

### Task 3: Build the One-Shot Text Motion Controller

**Files:**
- Create: `src/__tests__/textMotion.test.ts`
- Create: `src/lib/textMotion.ts`

- [ ] **Step 1: Write a hoisted GSAP and SplitText test harness**

Create `src/__tests__/textMotion.test.ts` with a fresh timeline per chapter and a SplitText mock that invokes `onSplit` immediately:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

type TimelineMock = {
  from: ReturnType<typeof vi.fn>
  to: ReturnType<typeof vi.fn>
  play: ReturnType<typeof vi.fn>
  progress: ReturnType<typeof vi.fn>
  revert: ReturnType<typeof vi.fn>
  kill: ReturnType<typeof vi.fn>
  options: { onComplete?: () => void }
}

const mocks = vi.hoisted(() => ({
  timelines: [] as TimelineMock[],
  splits: [] as Array<{
    lines: HTMLElement[]
    revert: ReturnType<typeof vi.fn>
    vars: SplitText.Vars
  }>,
  gsap: { timeline: vi.fn() },
  SplitText: { create: vi.fn() },
}))

vi.mock('../lib/gsap', () => ({ gsap: mocks.gsap, SplitText: mocks.SplitText }))

import { createTextMotion } from '../lib/textMotion'

function createTimeline(options: { onComplete?: () => void }): TimelineMock {
  const timeline = {
    from: vi.fn().mockReturnThis(),
    to: vi.fn().mockReturnThis(),
    play: vi.fn().mockReturnThis(),
    progress: vi.fn().mockReturnThis(),
    revert: vi.fn().mockReturnThis(),
    kill: vi.fn().mockReturnThis(),
    options,
  }
  mocks.timelines.push(timeline)
  return timeline
}

function makeChapter(chapter = '01', options: { title?: boolean; command?: boolean } = {}): HTMLElement {
  const section = document.createElement('section')
  section.dataset.chapter = chapter
  section.innerHTML = `
    <p data-text-label aria-label="${chapter} / LABEL">${chapter} / LABEL</p>
    ${options.title === false ? '' : '<h2 data-text-title>Chapter title</h2>'}
    <p data-text-copy>Body copy</p>
    ${options.command === false ? '' : '<p data-text-command aria-label="$ command">$ command</p>'}
    <ul data-text-list><li>Status</li></ul>
  `
  return section
}

beforeEach(() => {
  mocks.timelines.length = 0
  mocks.splits.length = 0
  mocks.gsap.timeline.mockReset().mockImplementation(createTimeline)
  mocks.SplitText.create.mockReset().mockImplementation((target: HTMLElement, vars: SplitText.Vars) => {
    const split = { lines: [target], revert: vi.fn(), vars }
    mocks.splits.push(split)
    vars.onSplit?.(split as unknown as SplitText)
    return split
  })
})
```

- [ ] **Step 2: Add failing behavioral tests**

Append these cases to `src/__tests__/textMotion.test.ts`:

```ts
describe('createTextMotion', () => {
  it('creates responsive masked line splits and restrained chapter timelines', () => {
    const scope = document.createElement('main')
    scope.append(makeChapter())

    createTextMotion(scope)

    expect(mocks.SplitText.create).toHaveBeenCalledWith(
      scope.querySelector('[data-text-title]'),
      expect.objectContaining({
        type: 'lines',
        mask: 'lines',
        linesClass: 'text-motion-line',
        autoSplit: true,
        aria: 'auto',
        onSplit: expect.any(Function),
      }),
    )
    expect(mocks.timelines[0].from).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ yPercent: 110, autoAlpha: 0, duration: 0.7, stagger: 0.1 }),
      expect.any(Number),
    )
    expect(mocks.timelines[0].to).toHaveBeenCalledWith(
      scope.querySelector('[data-text-command]'),
      expect.objectContaining({
        duration: 0.8,
        scrambleText: expect.objectContaining({ text: '$ command', chars: '01_/#?' }),
      }),
      expect.any(Number),
    )
  })

  it('plays each known chapter at most once', () => {
    const scope = document.createElement('main')
    scope.append(makeChapter('01'))
    const controller = createTextMotion(scope)

    controller.playChapter('01')
    controller.playChapter('01')
    controller.playChapter('missing')

    expect(mocks.timelines[0].play).toHaveBeenCalledTimes(1)
    expect(mocks.timelines[0].play).toHaveBeenCalledWith(0)
  })

  it('animates remaining targets when optional title or command targets are missing', () => {
    const scope = document.createElement('main')
    scope.append(makeChapter('02', { title: false, command: false }))

    expect(() => createTextMotion(scope)).not.toThrow()
    expect(mocks.SplitText.create).not.toHaveBeenCalled()
    expect(mocks.timelines[0].from).toHaveBeenCalled()
  })

  it('leaves a completed chapter complete after SplitText re-splits it', () => {
    const scope = document.createElement('main')
    scope.append(makeChapter('03'))
    createTextMotion(scope)
    mocks.timelines[0].options.onComplete?.()

    const split = mocks.splits[0]
    split.vars.onSplit?.(split as unknown as SplitText)

    expect(mocks.timelines[1].progress).toHaveBeenCalledWith(1)
    expect(mocks.timelines[1].play).not.toHaveBeenCalled()
  })

  it('kills timelines and reverts every SplitText instance exactly once', () => {
    const scope = document.createElement('main')
    scope.append(makeChapter('01'), makeChapter('02'))
    const controller = createTextMotion(scope)

    controller.revert()
    controller.revert()

    expect(mocks.splits.every((split) => split.revert.mock.calls.length === 1)).toBe(true)
    expect(mocks.timelines.every((timeline) => timeline.kill.mock.calls.length === 1)).toBe(true)
  })

  it('reverts the fallback timeline when a chapter has no SplitText title', () => {
    const scope = document.createElement('main')
    scope.append(makeChapter('04', { title: false }))
    const controller = createTextMotion(scope)

    controller.revert()

    expect(mocks.timelines[0].revert).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 3: Run the controller tests and verify red**

Run:

```bash
npm test -- src/__tests__/textMotion.test.ts
```

Expected: FAIL because `src/lib/textMotion.ts` does not exist.

- [ ] **Step 4: Implement the scoped controller**

Create `src/lib/textMotion.ts`:

```ts
import { gsap, SplitText } from './gsap'

const scrambleChars = '01_/#?'

type ChapterState = {
  timeline?: gsap.core.Timeline
  split?: SplitText
}

export type TextMotionController = {
  playChapter: (chapter: string) => void
  revert: () => void
}

function textOf(target: HTMLElement): string {
  return target.textContent?.trim() ?? ''
}

export function createTextMotion(scope: HTMLElement): TextMotionController {
  const states = new Map<string, ChapterState>()
  const played = new Set<string>()
  const completed = new Set<string>()
  let reverted = false

  scope.querySelectorAll<HTMLElement>('[data-chapter]').forEach((chapterElement) => {
    const chapter = chapterElement.dataset.chapter
    if (!chapter) {
      return
    }

    const state: ChapterState = {}
    states.set(chapter, state)

    const createTimeline = (lines: Element[]): gsap.core.Timeline => {
      const label = chapterElement.querySelector<HTMLElement>('[data-text-label]')
      const command = chapterElement.querySelector<HTMLElement>('[data-text-command]')
      const copy = chapterElement.querySelector<HTMLElement>('[data-text-copy]')
      const listItems = chapterElement.querySelectorAll<HTMLElement>('[data-text-list] > li')
      const revealTargets = [copy, ...listItems].filter((target): target is HTMLElement => Boolean(target))
      const timeline = gsap.timeline({
        paused: true,
        onComplete: () => completed.add(chapter),
      })

      if (chapter !== '00' && label && textOf(label)) {
        timeline.to(
          label,
          {
            duration: 0.45,
            ease: 'none',
            scrambleText: { text: textOf(label), chars: scrambleChars, speed: 0.6 },
          },
          0,
        )
      }

      if (lines.length > 0) {
        timeline.from(
          lines,
          { yPercent: 110, autoAlpha: 0, duration: 0.7, stagger: 0.1, ease: 'power3.out' },
          0.08,
        )
      }

      if (revealTargets.length > 0) {
        timeline.from(
          revealTargets,
          { y: 16, autoAlpha: 0, duration: 0.4, stagger: 0.06, ease: 'power2.out' },
          0.2,
        )
      }

      if (command && textOf(command)) {
        timeline.to(
          command,
          {
            duration: 0.8,
            ease: 'none',
            scrambleText: { text: textOf(command), chars: scrambleChars, speed: 0.6 },
          },
          0.25,
        )
      }

      state.timeline = timeline
      if (completed.has(chapter)) {
        timeline.progress(1)
      }
      return timeline
    }

    const title = chapterElement.querySelector<HTMLElement>('[data-text-title]')
    if (title) {
      state.split = SplitText.create(title, {
        type: 'lines',
        mask: 'lines',
        linesClass: 'text-motion-line',
        autoSplit: true,
        aria: 'auto',
        onSplit: (split) => createTimeline(split.lines),
      })
    } else {
      createTimeline([])
    }
  })

  return {
    playChapter(chapter) {
      if (reverted || played.has(chapter)) {
        return
      }

      const state = states.get(chapter)
      if (!state?.timeline) {
        return
      }

      played.add(chapter)
      state.timeline.play(0)
    },
    revert() {
      if (reverted) {
        return
      }

      reverted = true
      states.forEach((state) => {
        state.split?.revert()
        if (!state.split) {
          state.timeline?.revert()
        }
        state.timeline?.kill()
      })
      states.clear()
      played.clear()
      completed.clear()
    },
  }
}
```

Chapter `00` keeps its `ENTRY` label static so the approved hero order remains title, body, then command. The `onSplit` callback must return the timeline expression. GSAP then records the animation time before an automatic re-split; the `completed` set additionally forces already-finished chapters back to progress `1` without replaying them.

- [ ] **Step 5: Verify focused behavior and TypeScript**

Run:

```bash
npm test -- src/__tests__/textMotion.test.ts
npx vue-tsc --noEmit -p tsconfig.app.json
```

Expected: all controller tests pass and TypeScript exits with code 0. If the SplitText callback inference rejects the return, preserve the returned timeline and refine only the local callback annotation; do not cast the whole module to `any`.

- [ ] **Step 6: Commit the controller**

```bash
git add src/lib/textMotion.ts src/__tests__/textMotion.test.ts
git commit -m "feat: add one-shot text motion controller"
```

### Task 4: Connect Text Playback to Existing Scroll Orchestration

**Files:**
- Modify: `src/__tests__/useHomeMotion.test.ts`
- Modify: `src/composables/useHomeMotion.ts`

- [ ] **Step 1: Mock the text controller in the composable tests**

Extend the hoisted object in `src/__tests__/useHomeMotion.test.ts`:

```ts
textMotion: {
  playChapter: vi.fn(),
  revert: vi.fn(),
},
createTextMotion: vi.fn(),
```

Add the module mock before importing the composable:

```ts
vi.mock('../lib/textMotion', () => ({
  createTextMotion: mocks.createTextMotion,
}))
```

In `configureGsap`, reset the new mocks and return the controller:

```ts
mocks.textMotion.playChapter.mockReset()
mocks.textMotion.revert.mockReset()
mocks.createTextMotion.mockReset().mockReturnValue(mocks.textMotion)
```

Replace the single `mediaCleanup` test slot with `mediaCleanups: [] as Array<() => void>`. Make the `media.add` mock execute the text context only when motion is not reduced and execute the existing condition-object context in every mode:

```ts
mocks.mediaCleanups.length = 0
mocks.media.add.mockReset().mockImplementation((queries, callback, scope) => {
  void scope
  const shouldRun =
    typeof queries === 'string'
      ? queries === '(prefers-reduced-motion: no-preference)' && !mocks.conditions.reduceMotion
      : true
  if (!shouldRun) {
    return
  }

  const cleanup = callback({ conditions: mocks.conditions })
  if (typeof cleanup === 'function') {
    mocks.mediaCleanups.push(cleanup)
  }
})
mocks.media.revert.mockReset().mockImplementation(() => {
  mocks.mediaCleanups.splice(0).reverse().forEach((cleanup) => cleanup())
})
```

- [ ] **Step 2: Write failing orchestration expectations**

Update and extend the existing tests so they assert:

```ts
// Reduced motion test
expect(mocks.createTextMotion).not.toHaveBeenCalled()

// Compact-mode test after setup
expect(mocks.createTextMotion).toHaveBeenCalledTimes(1)
expect(mocks.textMotion.playChapter).toHaveBeenCalledWith('00')
expect(mocks.ScrollTrigger.batch).not.toHaveBeenCalled()

// After compact trigger callbacks
expect(mocks.textMotion.playChapter).toHaveBeenCalledWith('03')

// Desktop onUpdate callback
const horizontalConfig = mocks.gsap.to.mock.calls[0][1]
horizontalConfig.scrollTrigger.onUpdate({ progress: 0.55 })
expect(mocks.textMotion.playChapter).toHaveBeenCalledWith('03')

// After unmount/media cleanup
expect(mocks.textMotion.revert).toHaveBeenCalledTimes(1)
```

The non-reduced tests now expect two `media.add` calls: one stable no-preference text context and one responsive scroll context. The reduced test still sees both registrations, but only the responsive context executes. Add an assertion that invoking only the responsive cleanup does not call `textMotion.revert`; this prevents a desktop/mobile breakpoint crossing from replaying text. Retain the existing progress, resize, horizontal-travel, pending-asset, and component cleanup assertions.

- [ ] **Step 3: Run the composable test and verify red**

Run:

```bash
npm test -- src/__tests__/useHomeMotion.test.ts
```

Expected: FAIL because `useHomeMotion` does not yet create or drive a stable text context and still batches whole compact panels.

- [ ] **Step 4: Create a stable no-preference text context**

Import the controller in `src/composables/useHomeMotion.ts`:

```ts
import { createTextMotion } from '../lib/textMotion'
```

After `media = gsap.matchMedia()` and before adding the responsive condition object, create a dedicated no-preference context:

```ts
let textMotion: TextMotionController | undefined

media.add(
  '(prefers-reduced-motion: no-preference)',
  () => {
    textMotion = createTextMotion(scope)
    textMotion.playChapter('00')

    return () => {
      textMotion?.revert()
      textMotion = undefined
    }
  },
  scope,
)
```

Import `type TextMotionController` beside `createTextMotion`. Keep the existing asset/font wait before this point. Do not instantiate SplitText before fonts and the hero image settle. This text context remains active when only the desktop/mobile width conditions change, so already-viewed chapters do not replay across a responsive breakpoint. It automatically reverts if reduced motion becomes active or the component unmounts.

- [ ] **Step 5: Replace the old hero text entrance and compact panel batch**

Delete the old `[data-hero-line]`/`[data-hero-copy]` entrance timeline. Preserve only the existing desktop signal-image entrance as its own tween:

```ts
let signalTween: gsap.core.Tween | undefined

if (desktop) {
  const signal = scope.querySelector<HTMLElement>('[data-signal-visual]')
  if (signal) {
    signalTween = gsap.from(signal, {
      scale: 0.9,
      autoAlpha: 0,
      duration: 0.6,
      ease: 'power2.out',
    })
  }
}
```

Delete the `ScrollTrigger.batch(panels, ...)` block in compact mode. It animates entire panels and would otherwise run on top of the new per-target timeline. Keep the five non-pinning `ScrollTrigger.create` chapter triggers.

- [ ] **Step 6: Drive the controller from both existing chapter paths**

In the desktop horizontal tween's `onUpdate`, compute the chapter once:

```ts
onUpdate: (self) => {
  const chapter = getChapterFromProgress(self.progress)
  onMotionUpdate(self.progress, chapter)
  textMotion?.playChapter(chapter)
},
```

In compact mode, replace the local callback with:

```ts
const updateChapter = () => {
  const chapter = section.dataset.chapter
  reportMobileChapter(chapter, onMotionUpdate)
  if (chapter) {
    textMotion?.playChapter(chapter)
  }
}
```

Do not modify the desktop media threshold, horizontal tween, pin, scrub, travel calculation, or trigger start/end values.

- [ ] **Step 7: Consolidate callback cleanup**

The responsive match-media callback must return one cleanup function for desktop and compact paths. Move the current desktop stage cleanup into a local `cleanupHorizontal` function instead of returning early, then finish the callback with:

```ts
return () => {
  cleanupHorizontal?.()
  signalTween?.kill()
}
```

The separate no-preference context owns `textMotion.revert()`. Keep component unmount as `media?.revert()`; it invokes both scoped cleanups. Do not call `ScrollTrigger.killAll()`.

- [ ] **Step 8: Verify orchestration and commit**

Run:

```bash
npm test -- src/__tests__/useHomeMotion.test.ts src/__tests__/textMotion.test.ts
npx vue-tsc --noEmit -p tsconfig.app.json
```

Expected: focused tests and type-check pass; reduced motion creates no controller, and every active branch reverts it once.

```bash
git add src/composables/useHomeMotion.ts src/__tests__/useHomeMotion.test.ts
git commit -m "feat: trigger text motion from chapter scroll"
```

### Task 5: Lock the Line-Mask and Reduced-Motion Visual Contract

**Files:**
- Modify: `src/__tests__/styles.test.ts`
- Modify: `src/styles/global.css`

- [ ] **Step 1: Write the failing CSS contract test**

Add to `src/__tests__/styles.test.ts`:

```ts
it('clips generated line masks and neutralizes split transforms for reduced motion', () => {
  expect(globalStyles).toMatch(/\.text-motion-line-mask\s*{[^}]*overflow: clip;/s)
  expect(globalStyles).toMatch(
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.text-motion-line\s*{[^}]*opacity: 1 !important;[^}]*transform: none !important;/,
  )
})
```

- [ ] **Step 2: Run the style test and verify red**

Run:

```bash
npm test -- src/__tests__/styles.test.ts
```

Expected: FAIL because generated line classes have no explicit CSS contract.

- [ ] **Step 3: Add the minimal generated-wrapper styles**

Add near the heading rules in `src/styles/global.css`:

```css
.text-motion-line-mask {
  overflow: clip;
}
```

Inside the existing `@media (prefers-reduced-motion: reduce)` block, add:

```css
.text-motion-line {
  opacity: 1 !important;
  transform: none !important;
}
```

Do not add persistent `will-change`; GSAP manages transient transforms, and permanently promoting every line wastes compositor memory.

- [ ] **Step 4: Verify CSS contracts and commit**

Run:

```bash
npm test -- src/__tests__/styles.test.ts
```

Expected: all visual-system tests pass.

```bash
git add src/styles/global.css src/__tests__/styles.test.ts
git commit -m "style: define text reveal masks"
```

### Task 6: Prove Final Text, One-Shot Playback, and Responsive Fallbacks in Browser

**Files:**
- Modify: `tests/e2e/home.spec.ts`

- [ ] **Step 1: Add final-text helpers**

Add below `openHomepage` in `tests/e2e/home.spec.ts`:

```ts
async function expectTextMotionSettled(page: Page, chapter: string): Promise<void> {
  const section = page.locator(`[data-chapter="${chapter}"]`)
  const label = section.locator('[data-text-label]')
  await expect(label).toHaveText((await label.getAttribute('aria-label')) ?? '')

  const command = section.locator('[data-text-command]')
  if ((await command.count()) > 0) {
    await expect(command).toHaveText((await command.getAttribute('aria-label')) ?? '', { timeout: 8_000 })
  }
}
```

- [ ] **Step 2: Extend desktop final-state coverage**

After `openHomepage(page)` in the desktop test, assert:

```ts
await expectTextMotionSettled(page, '00')
await expect(page.locator('[data-chapter="00"] .text-motion-line-mask')).not.toHaveCount(0)
```

After scrolling the story to its measured end, add:

```ts
await expectTextMotionSettled(page, '04')
```

Retain the existing transform, pinning, progress `>=99`, ending-in-viewport, overflow, runtime-error, and back-to-top assertions.

- [ ] **Step 3: Add a mobile no-replay observation window**

In the mobile test, visit chapter `01`, wait for its command to settle, install a MutationObserver on that command, visit chapter `03`, return to chapter `01`, and observe for longer than the `0.8s` command animation:

```ts
const firstChapter = page.locator('[data-chapter="01"]')
await firstChapter.evaluate((section) => section.scrollIntoView({ block: 'center' }))
await expectTextMotionSettled(page, '01')

await page.evaluate(() => {
  const command = document.querySelector('[data-chapter="01"] [data-text-command]')
  const runtimeWindow = window as Window & { __chapterReplayMutations?: number; __chapterReplayObserver?: MutationObserver }
  runtimeWindow.__chapterReplayMutations = 0
  runtimeWindow.__chapterReplayObserver = new MutationObserver((records) => {
    runtimeWindow.__chapterReplayMutations = (runtimeWindow.__chapterReplayMutations ?? 0) + records.length
  })
  if (command) {
    runtimeWindow.__chapterReplayObserver.observe(command, { childList: true, characterData: true, subtree: true })
  }
})

await page.locator('[data-chapter="03"]').evaluate((section) => section.scrollIntoView({ block: 'center' }))
await expectTextMotionSettled(page, '03')
await firstChapter.evaluate((section) => section.scrollIntoView({ block: 'center' }))
await page.waitForTimeout(900)

const replayMutations = await page.evaluate(() => {
  const runtimeWindow = window as Window & { __chapterReplayMutations?: number; __chapterReplayObserver?: MutationObserver }
  runtimeWindow.__chapterReplayObserver?.disconnect()
  return runtimeWindow.__chapterReplayMutations ?? 0
})
expect(replayMutations, 'a viewed chapter must not decode again').toBe(0)
```

This is an intentional time window for a negative temporal assertion; `900ms` exceeds the configured scramble duration.

- [ ] **Step 4: Extend compact and reduced-motion assertions**

For mobile and short landscape, call `expectTextMotionSettled` after each visited chapter and retain the existing vertical order, no-pin, no-overflow, and viewport-bound checks.

In the reduced-motion test, add:

```ts
await expect(page.locator('.text-motion-line, .text-motion-line-mask')).toHaveCount(0)
for (const chapter of ['00', '01', '02', '03', '04']) {
  await expectTextMotionSettled(page, chapter)
}
```

Expected: reduced motion retains unsplit final DOM and no text animation wrappers.

- [ ] **Step 5: Run focused browser scenarios**

Run:

```bash
npx playwright test tests/e2e/home.spec.ts --project=desktop --project=mobile --project=short-landscape --project=reduced-motion
```

Expected: 4 tests pass, with the existing cross-project tests intentionally skipped; no page errors, console errors, overflow, clipping, replay mutations, or pinning regressions.

- [ ] **Step 6: Inspect desktop and mobile screenshots**

Start the dev server:

```bash
npm run dev -- --host 127.0.0.1 --port 5175 --strictPort
```

Use Playwright/browser screenshots at `1440x900`, `390x844`, and `844x390`. Confirm:

- masked title lines settle without clipping ascenders, descenders, punctuation, or Chinese glyphs;
- command widths do not overflow while scrambling;
- title, body, command, and list sequencing reads as one concise entrance;
- returning to a chapter leaves all text static;
- the next-section hint, desktop horizontal framing, and compact vertical flow match the existing layout.

Stop the server after inspection.

- [ ] **Step 7: Commit browser coverage**

```bash
git add tests/e2e/home.spec.ts
git commit -m "test: cover text decode motion in browser"
```

### Task 7: Run Final Verification and Prepare Integration

**Files:**
- Verify all changed files
- Verify: `docs/superpowers/specs/2026-08-19-text-decode-motion-design.md`
- Verify: `docs/superpowers/plans/2026-08-19-text-decode-motion.md`

- [ ] **Step 1: Run the complete automated check**

Run:

```bash
npm run check
```

Expected: all Vitest files pass, both TypeScript checks and the production Vite build pass, and all four Playwright projects pass their intended scenario without runtime errors.

- [ ] **Step 2: Verify formatting and scope**

Run:

```bash
git diff --check main...HEAD
git status --short
git diff --stat main...HEAD
```

Expected: no whitespace errors, no unintended generated output, and changes limited to the listed source, test, and documentation files.

- [ ] **Step 3: Review the final diff against acceptance criteria**

Run:

```bash
git diff main...HEAD -- src/lib src/components src/composables src/styles tests src/__tests__
```

Confirm all of the following before integration:

- every chapter plays at most once;
- only headings, labels, commands, body copy, and list entries use the approved effects;
- commands and labels keep stable final `aria-label` values;
- reduced motion never constructs the text controller;
- SplitText cleanup restores the original semantic headings;
- the existing horizontal travel and compact breakpoints are unchanged;
- no global ScrollTrigger cleanup or unrelated content/layout changes were introduced.

- [ ] **Step 4: Request code review and address findings**

Use `superpowers:requesting-code-review` against the full `main...HEAD` diff. Resolve any Critical or Important findings with focused regression tests, then rerun the affected focused checks and `npm run check`.

- [ ] **Step 5: Use the branch-finishing workflow**

Use `superpowers:finishing-a-development-branch` to present merge, push/PR, keep, or discard options. Do not merge or push until the user selects the integration action.
