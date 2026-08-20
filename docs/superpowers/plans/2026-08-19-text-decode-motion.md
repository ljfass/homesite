# Text Decode Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one-shot SplitText title reveals and ScrambleText terminal decoding without disturbing the homepage's existing responsive ScrollTrigger story.

**Architecture:** Keep `src/lib/gsap.ts` as the only plugin registration boundary, add a DOM-scoped `textMotion` controller that owns splitting, timelines, and cleanup, and let `useHomeMotion` own both Vue/scroll orchestration and the page-lifetime one-shot registry shared by replacement controllers. Vue components expose stable data attributes and final accessible labels; reduced-motion bypasses the controller entirely so the original DOM is rendered immediately.

**Tech Stack:** Vue 3, TypeScript, GSAP 3.15 SplitText/ScrambleText/ScrollTrigger, Vitest, Vue Test Utils, Playwright.

---

## File Map

- Modify: `src/lib/gsap.ts` - register and export SplitText and ScrambleTextPlugin beside ScrollTrigger.
- Create: `src/lib/textMotion.ts` - build chapter timelines, guard one-shot playback, handle auto re-splitting, and restore DOM on cleanup.
- Modify: `src/components/HeroSection.vue` - expose hero text targets and stable accessible values.
- Modify: `src/components/StoryPanel.vue` - expose reusable chapter text targets and stable accessible values.
- Modify: `src/components/HorizontalStory.vue` - expose ending text targets.
- Modify: `src/composables/useHomeMotion.ts` - connect text playback to existing desktop and compact chapter transitions.
- Modify: `src/styles/global.css` - declare the SplitText line-mask and reusable screen-reader-only contracts without changing page layout.
- Create: `src/__tests__/gsap.test.ts` - protect the shared plugin registration boundary.
- Create: `src/__tests__/textMotion.test.ts` - verify sequence construction, one-shot behavior, re-splitting, missing targets, and cleanup.
- Modify: `src/__tests__/App.test.ts` - verify component target and accessibility contracts.
- Modify: `src/__tests__/styles.test.ts` - verify the line-mask, screen-reader-only, and reduced-motion CSS contracts.
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
- Modify: `src/__tests__/styles.test.ts`
- Modify: `src/components/HeroSection.vue`
- Modify: `src/components/StoryPanel.vue`
- Modify: `src/components/HorizontalStory.vue`
- Modify: `src/styles/global.css`

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

  const expectedCommands = [homeContent.hero.command, ...homeContent.story.map((item) => item.command)]
  const expectedLabels = [
    `${homeContent.hero.index} / ${homeContent.hero.eyebrow}`,
    ...homeContent.story.map((item) => `${item.index} / ${item.eyebrow}`),
    `${homeContent.ending.index} / ${homeContent.ending.eyebrow}`,
  ]

  const commands = wrapper.findAll<HTMLElement>('[data-text-command]')
  expect(commands).toHaveLength(expectedCommands.length)
  commands.forEach((command, index) => {
    const staticSibling = command.element.nextElementSibling

    expect(command.element.tagName).toBe('SPAN')
    expect(command.text()).toBe(expectedCommands[index])
    expect(command.attributes('aria-hidden')).toBe('true')
    expect(command.attributes('aria-label')).toBeUndefined()
    expect(staticSibling).not.toBeNull()
    expect(staticSibling?.tagName).toBe('SPAN')
    expect(staticSibling?.matches('.sr-only[data-text-static="command"]')).toBe(true)
    expect(staticSibling?.textContent).toBe(expectedCommands[index])
  })

  const staticCommands = wrapper.findAll<HTMLElement>('[data-text-static="command"]')
  expect(staticCommands.map((command) => command.text())).toEqual(expectedCommands)

  const labels = wrapper.findAll<HTMLElement>('[data-text-label]')
  expect(labels).toHaveLength(expectedLabels.length)
  labels.forEach((label, index) => {
    const staticSibling = label.element.nextElementSibling

    expect(label.element.tagName).toBe('SPAN')
    expect(label.text()).toBe(expectedLabels[index])
    expect(label.attributes('aria-hidden')).toBe('true')
    expect(label.attributes('aria-label')).toBeUndefined()
    expect(staticSibling).not.toBeNull()
    expect(staticSibling?.tagName).toBe('SPAN')
    expect(staticSibling?.matches('.sr-only[data-text-static="label"]')).toBe(true)
    expect(staticSibling?.textContent).toBe(expectedLabels[index])
  })

  const staticLabels = wrapper.findAll<HTMLElement>('[data-text-static="label"]')
  expect(staticLabels.map((label) => label.text())).toEqual(expectedLabels)

  expect(wrapper.findAll('.chapter-label').every((label) => label.attributes('aria-label') === undefined)).toBe(true)
  expect(wrapper.findAll('.terminal-command').every((command) => command.attributes('aria-label') === undefined)).toBe(true)
  expect(wrapper.findAll('[data-text-list]')).toHaveLength(2)
  expect(wrapper.get('[data-chapter="02"]').findAll('[data-text-list]')).toHaveLength(1)
  expect(wrapper.get('[data-chapter="03"]').findAll('[data-text-list]')).toHaveLength(1)
  expect(wrapper.get('[data-chapter="00"]').findAll('[data-text-list]')).toHaveLength(0)
  expect(wrapper.get('[data-chapter="01"]').findAll('[data-text-list]')).toHaveLength(0)
  expect(wrapper.get('[data-chapter="04"]').findAll('[data-text-list]')).toHaveLength(0)
})
```

Also add this contract in `src/__tests__/styles.test.ts`:

```ts
it('provides a reusable visually hidden text utility', () => {
  expect(globalStyles).toMatch(
    /\.sr-only\s*{[^}]*position: absolute;[^}]*width: 1px;[^}]*height: 1px;[^}]*padding: 0;[^}]*margin: -1px;[^}]*overflow: hidden;[^}]*clip: rect\(0, 0, 0, 0\);[^}]*clip-path: inset\(50%\);[^}]*white-space: nowrap;[^}]*border: 0;/s,
  )
})
```

- [ ] **Step 2: Run the component and CSS tests and verify red**

Run:

```bash
npm test -- src/__tests__/App.test.ts src/__tests__/styles.test.ts
```

Expected: FAIL because the `aria-hidden` visual targets, stable final-text sibling nodes, and `.sr-only` utility do not exist.

- [ ] **Step 3: Add hero contracts without adding component animation code**

Update the relevant nodes in `src/components/HeroSection.vue`:

```vue
<p class="chapter-label display-type">
  <span data-text-label aria-hidden="true">{{ hero.index }} / {{ hero.eyebrow }}</span>
  <span class="sr-only" data-text-static="label">{{ hero.index }} / {{ hero.eyebrow }}</span>
</p>
<h1 id="entry-title" class="hero__title display-type" data-text-title>
  <span v-for="(line, index) in hero.title" :key="line">
    {{ line }}{{ index < hero.title.length - 1 ? ' ' : '' }}
  </span>
</h1>
<p class="hero__body" data-text-copy>{{ hero.body }}</p>
<p class="terminal-command display-type">
  <span data-text-command aria-hidden="true">{{ hero.command }}</span>
  <span class="sr-only" data-text-static="command">{{ hero.command }}</span>
</p>
```

Remove the superseded `data-hero-line` and `data-hero-copy` attributes; their animation is replaced by the new controller.

- [ ] **Step 4: Add reusable story-panel contracts**

Update the corresponding nodes in `src/components/StoryPanel.vue`:

```vue
<p class="chapter-label display-type">
  <span data-text-label aria-hidden="true">{{ item.index }} / {{ item.eyebrow }}</span>
  <span class="sr-only" data-text-static="label">{{ item.index }} / {{ item.eyebrow }}</span>
</p>
<h2 :id="`${item.id}-title`" class="story-panel__title display-type" data-text-title>
  <span v-for="(line, index) in item.title" :key="line">
    {{ line }}{{ index < item.title.length - 1 ? ' ' : '' }}
  </span>
</h2>
<p class="story-panel__body" data-text-copy>{{ item.body }}</p>
<p class="terminal-command display-type">
  <span data-text-command aria-hidden="true">{{ item.command }}</span>
  <span class="sr-only" data-text-static="command">{{ item.command }}</span>
</p>
<ul v-if="item.items?.length" class="status-list" data-text-list>
```

- [ ] **Step 5: Add ending contracts**

Update the ending content in `src/components/HorizontalStory.vue`:

```vue
<p class="chapter-label display-type">
  <span data-text-label aria-hidden="true">{{ ending.index }} / {{ ending.eyebrow }}</span>
  <span class="sr-only" data-text-static="label">{{ ending.index }} / {{ ending.eyebrow }}</span>
</p>
<h2 id="ending-title" class="story-panel__title display-type" data-text-title>
  <span v-for="(line, index) in ending.title" :key="line">
    {{ line }}{{ index < ending.title.length - 1 ? ' ' : '' }}
  </span>
</h2>
<p class="story-panel__body" data-text-copy>{{ ending.body }}</p>
```

- [ ] **Step 6: Add the reusable screen-reader-only utility**

Add this rule in `src/styles/global.css`:

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}
```

- [ ] **Step 7: Verify and commit the component contracts**

Run:

```bash
npm test -- src/__tests__/App.test.ts src/__tests__/styles.test.ts
npx vue-tsc --noEmit -p tsconfig.app.json
```

Expected: all focused tests pass, including exact final command and label values, and Vue/TypeScript exits with code 0.

```bash
git add src/components/HeroSection.vue src/components/StoryPanel.vue src/components/HorizontalStory.vue src/styles/global.css src/__tests__/App.test.ts src/__tests__/styles.test.ts
git commit -m "fix: preserve accessible text during decoding"
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
    <p><span data-text-label aria-hidden="true">${chapter} / LABEL</span><span class="sr-only" data-text-static="label">${chapter} / LABEL</span></p>
    ${options.title === false ? '' : '<h2 data-text-title>Chapter title</h2>'}
    <p data-text-copy>Body copy</p>
    ${options.command === false ? '' : '<p><span data-text-command aria-hidden="true">$ command</span><span class="sr-only" data-text-static="command">$ command</span></p>'}
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
  const completedTimes = new Map<string, number>()
  let reverted = false

  scope.querySelectorAll<HTMLElement>('[data-chapter]').forEach((chapterElement) => {
    const chapter = chapterElement.dataset.chapter
    if (!chapter) {
      return
    }

    const state: ChapterState = {}
    states.set(chapter, state)

    const title = chapterElement.querySelector<HTMLElement>('[data-text-title]')
    const label = chapterElement.querySelector<HTMLElement>('[data-text-label]')
    const command = chapterElement.querySelector<HTMLElement>('[data-text-command]')
    const copy = chapterElement.querySelector<HTMLElement>('[data-text-copy]')
    const listItems = chapterElement.querySelectorAll<HTMLElement>('[data-text-list] > li')
    const revealTargets = [copy, ...listItems].filter((target): target is HTMLElement => Boolean(target))
    const labelText = label ? textOf(label) : ''
    const commandText = command ? textOf(command) : ''

    const createTimeline = (lines: Element[]): gsap.core.Timeline => {
      let sequence!: gsap.core.Timeline
      sequence = gsap.timeline({
        paused: true,
        onComplete: () => {
          if (!completed.has(chapter)) {
            completed.add(chapter)
            completedTimes.set(chapter, sequence.totalTime())
          }
        },
      })

      if (chapter !== '00' && label && labelText) {
        sequence.to(
          label,
          {
            duration: 0.45,
            ease: 'none',
            scrambleText: { text: labelText, chars: scrambleChars, speed: 0.6 },
          },
          0,
        )
      }

      if (lines.length > 0) {
        sequence.from(
          lines,
          { yPercent: 110, autoAlpha: 0, duration: 0.7, stagger: 0.1, ease: 'power3.out' },
          0.08,
        )
      }

      if (revealTargets.length > 0) {
        sequence.from(
          revealTargets,
          { y: 16, autoAlpha: 0, duration: 0.4, stagger: 0.06, ease: 'power2.out' },
          0.2,
        )
      }

      if (command && commandText) {
        sequence.to(
          command,
          {
            duration: 0.8,
            ease: 'none',
            scrambleText: { text: commandText, chars: scrambleChars, speed: 0.6 },
          },
          0.25,
        )
      }

      let timeline = sequence
      const completedTime = completedTimes.get(chapter)
      if (completed.has(chapter)) {
        const naturalDuration = sequence.totalDuration()
        if (completedTime && naturalDuration && naturalDuration !== completedTime) {
          sequence.paused(false).timeScale(naturalDuration / completedTime)
          timeline = gsap.timeline({ paused: true }).add(sequence)
        }
        timeline.progress(1)
      } else if (played.has(chapter)) {
        timeline.play()
      }
      state.timeline = timeline
      return timeline
    }

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
      completedTimes.clear()
    },
  }
}
```

Chapter `00` keeps its `ENTRY` label static so the approved hero order remains title, body, then command. Cache each visual label/command's trimmed final text once, and do not create a ScrambleText tween when that value is empty. The `onSplit` callback must return the timeline expression. GSAP records the animation time before an automatic re-split: unplayed replacements remain paused, in-flight replacements call `timeline.play()` with no position so the restored time continues running, and completed replacements record their final absolute `totalTime()`. If changed line counts alter a completed replacement's natural duration, return a paused parent timeline that time-scales the visual sequence and has the recorded local duration; `timeline.progress(1)` then remains at the endpoint when SplitText restores its saved absolute time. A zero completed time skips scaling safely and remains visually complete. The controller tracks the latest returned timeline for cleanup while SplitText reverts the animation it owns.

The final implementation also accepts an optional externally owned one-shot registry. A standalone controller creates and clears its own registry on `revert()`. `useHomeMotion` instead passes one page-lifetime registry to every preference replacement controller and clears it only when the Vue component unmounts. Chapters present in that registry when a controller is created receive split line wrappers in their final visible state but no reveal or ScrambleText tweens, so controller replacement cannot decode them again.

The controller test harness must model this lifecycle statefully: it tracks natural `duration()`/`totalDuration()`, independent `progress()` and absolute `totalTime()`, and a resplit captures the old returned timeline's `totalTime()`, reverts that animation, restores the original heading markup, invokes `onSplit`, assigns the saved total time to the replacement, and retains it as SplitText-owned. Cover unplayed, in-flight, and completed replacements with longer and shorter replacement durations, repeated resplits that update cleanup ownership, heading restoration, titleless fallback cleanup, and whitespace-only visual label/command targets.

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
    if (!matchMediaTransitionActive && !preferenceRestorationPending) {
      textMotion.playChapter('00')
    }

    return () => {
      textMotion?.revert()
      textMotion = undefined
    }
  },
  scope,
)
```

Import `type TextMotionController` beside `createTextMotion`. Keep the existing asset/font wait before this point. Do not instantiate SplitText before fonts and the hero image settle. This text context remains active when only the desktop/mobile width conditions change. Runtime preference changes may replace it, so every controller receives the same page-lifetime one-shot registry; already viewed chapters remain final and do not replay. The controller automatically reverts if reduced motion becomes active or the component unmounts, but the external registry is cleared only by component unmount.

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

The separate no-preference context owns `textMotion.revert()`. Only its stable initial activation plays chapter `00`; a controller recreated during a runtime preference transition remains idle until canonical-state restoration requests the saved chapter. That request is intentionally a no-op for a chapter already present in the shared page-lifetime registry, while an unvisited saved chapter still plays once. Keep component unmount as `media?.revert()`, then clear the external registry; do not call `ScrollTrigger.killAll()`.

### Runtime Preference Changes

Keep canonical reading state from actual desktop progress updates and compact chapter entries. Record exact horizontal progress as part of the stable reading state; when entering reduced mode, keep the same lightweight non-pinning chapter triggers as compact mode so later vertical scrolling replaces that saved progress with the newly active semantic chapter. Cache the chapter element map once after assets settle and coalesce state commits and anchor layout reads to one animation frame. Horizontal commits must not read pinned chapter rectangles or replace the last compact/static within-chapter offset.

While media contexts are stable, valid responsive reports and scroll events update a dedicated last-stable snapshot. ScrollTrigger registers its global match-media init listener before the composable and can revert triggers after browser media conditions and CSS have already changed. Therefore the composable init listener cancels any uncommitted measurement frame and copies the existing stable snapshot without reading layout. Each responsive callback owns a generation and expected live desktop/mobile/reduced conditions; reports and cleanup callbacks from an obsolete generation or mismatched browser state are ignored before they can change header, text playback, or stable state.

Keep the locked snapshot through duplicate GSAP init/match cycles emitted by the same browser preference or breakpoint change, and suppress progress reporting, text playback, and the replacement controller's default chapter `00` while the cycle rebuilds. Native reduced-motion notification order must not alter the snapshot.

After the replacement context exists, refresh ScrollTrigger and resynchronize the layout. Restore desktop reading position from the replacement trigger's `start + savedProgress * (end - start)`; map vertical chapters to the midpoint of the equivalent horizontal chapter; restore compact/static layouts from the saved semantic anchor and viewport offset. Temporarily force the document scroll behavior to `auto` so desktop CSS smooth scrolling cannot emit intermediate chapter reports, then restore the previous inline style. Resynchronize the header and request the saved chapter on the newly active text controller; the shared registry suppresses replay for a previously viewed chapter. Cancel pending animation frames, clear the registry, and remove native media, scroll, and GSAP event listeners on unmount.

#### Guarded user scroll intent

The guarded rebuild must preserve a reader who moves after the replacement layout appears but before the two-frame restoration finishes. Add capture-phase passive `wheel` and `touchmove` listeners plus a capture-phase `keydown` listener for `ArrowUp`, `ArrowDown`, `PageUp`, `PageDown`, `Home`, `End`, and Space. Capture phase lets the intent listener run before ScrollTrigger's earlier window listener synchronously reports from the same wheel event. Ignore keyboard events that are default-prevented, composing, or originate within an input, textarea, select, or contenteditable ancestor.

Each accepted input creates a monotonically increasing token bound to the current responsive generation. While guarded, `reportReadingState()` must still reject disposed, stale-generation, and live-media-mismatched callbacks. A current trigger may create or refine `pendingUserSnapshot` only for the matching input token and generation; a later generation clears the active intent but retains the confirmed snapshot. This prevents its placeholder `00`, initialization update, or refresh report from overwriting an earlier user-confirmed chapter. Do not call `onMotionUpdate()` or `textMotion.playChapter()` while caching. Restoration uses:

```ts
const snapshot = pendingUserSnapshot?.snapshot ?? mediaChangeSnapshot ?? lastStableSnapshot ?? createReadingSnapshot()
```

If a real input scrolls within the current chapter without firing a semantic trigger, the guarded scroll listener schedules one position-capture frame. That frame updates the same intent token from its pending snapshot or the locked canonical state, reads the current canonical anchor offset once, and records the actual `window.scrollY`. Repeated scroll events must not create additional frames. Scroll events with no valid input token remain ignored.

The winning restoration token clears active intent immediately before `ScrollTrigger.refresh()` while retaining the cached pending snapshot; refresh-generated reports therefore cannot overwrite user input. Clear the pending snapshot when that token unlocks, and clear both snapshot and intent on unmount. Duplicate and overlapping media cycles retain the pending snapshot; superseded restoration frames cannot publish or clear it.

Add a deterministic unit regression that enters the guarded reduced-motion replacement context on chapter `03`, dispatches wheel intent, invokes its live chapter `04` trigger before either restoration frame runs, and verifies that header/text remain suppressed until restoration finishes and then publish chapter `04`. Also invoke an old-generation trigger and a guarded scroll without input to prove neither can replace the pending or locked snapshot. Run the new unit alone before production edits and expect it to fail with the final report/playback still on `03`.

In Chromium mobile, remove timing dependence from the semantic regression by issuing a real `page.mouse.wheel()` immediately after the reduced-motion wrappers disappear and polling until chapter `04` reaches the reading position. Do not wait for two animation frames before scrolling. The final header, viewport chapter, and recreated text controller must settle on `04`.

Add two held-frame Chromium regressions. First, after the guarded wheel reaches chapter `04`, change the viewport to create another responsive generation before releasing restoration frames; the later generation must not replace `04` with placeholder `00`. Second, issue an approximately `100px` wheel inside chapter `03` without leaving the chapter and verify that release preserves both `window.scrollY` and the chapter's viewport top within the existing tolerance.

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
  const staticLabel = section.locator('[data-text-static="label"]')
  await expect(label).toHaveText((await staticLabel.textContent()) ?? '')

  const command = section.locator('[data-text-command]')
  if ((await command.count()) > 0) {
    const staticCommand = section.locator('[data-text-static="command"]')
    await expect(command).toHaveText((await staticCommand.textContent()) ?? '', { timeout: 8_000 })
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

Add a mobile runtime-preference regression that scrolls chapter `03` into its reading area, continues scrolling within that chapter, observes its settled command, toggles to reduced motion and back twice with `page.emulateMedia()`, and verifies each transition retains both the chapter's viewport offset and the `03 / 04` header. While reduced, assert no line masks and immediately visible final text; after motion returns, assert the original mask count is recreated without duplication, every split line is visible at final opacity, the label/command strings remain final, and no mutation contains a non-final decoded string during a `>0.8s` observation window. A single same-string child replacement performed by GSAP timeline cleanup is not a replay. Retain no-pin, no-overflow, and runtime-error checks.

Add three state-restoration regressions: a desktop preference round trip, after reduced mode has fully settled, must return to the same ScrollTrigger progress and track transform; reduced mobile mode must track a scroll from chapter `03` to chapter `04` before recreating text motion; and a mobile-to-desktop-to-mobile breakpoint round trip must retain chapter `03`, its exact viewport offset, and its compact scroll position after each post-refresh rebuild.

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
- commands and labels retain stable screen-reader-only final-text siblings;
- reduced motion never constructs the text controller;
- SplitText cleanup restores the original semantic headings;
- the existing horizontal travel and compact breakpoints are unchanged;
- no global ScrollTrigger cleanup or unrelated content/layout changes were introduced.

- [ ] **Step 4: Request code review and address findings**

Use `superpowers:requesting-code-review` against the full `main...HEAD` diff. Resolve any Critical or Important findings with focused regression tests, then rerun the affected focused checks and `npm run check`.

- [ ] **Step 5: Use the branch-finishing workflow**

Use `superpowers:finishing-a-development-branch` to present merge, push/PR, keep, or discard options. Do not merge or push until the user selects the integration action.
