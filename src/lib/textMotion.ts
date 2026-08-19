import { gsap, SplitText } from './gsap'

export type TextMotionController = {
  playChapter: (chapter: string) => void
  revert: () => void
}

type ChapterState = {
  split?: SplitText
  fallback: boolean
  timeline: gsap.core.Timeline
}

const scrambleChars = '01_/#?'

function trimmedText(element: Element): string {
  return element.textContent?.trim() ?? ''
}

export function createTextMotion(scope: HTMLElement): TextMotionController {
  const states = new Map<string, ChapterState>()
  const played = new Set<string>()
  const completed = new Set<string>()
  let reverted = false

  for (const chapterElement of scope.querySelectorAll<HTMLElement>('[data-chapter]')) {
    const chapter = chapterElement.dataset.chapter?.trim()
    if (!chapter) continue

    const title = chapterElement.querySelector<HTMLElement>('[data-text-title]')
    const label = chapterElement.querySelector<HTMLElement>('[data-text-label]')
    const command = chapterElement.querySelector<HTMLElement>('[data-text-command]')
    const copy = chapterElement.querySelector<HTMLElement>('[data-text-copy]')
    const listItems = Array.from(chapterElement.querySelectorAll<HTMLElement>('[data-text-list] > li'))
    const copyTargets = [copy, ...listItems].filter((target): target is HTMLElement => target !== null)

    const makeTimeline = (lines: Element[] = []): gsap.core.Timeline => {
      const timeline = gsap.timeline({
        paused: true,
        onComplete: () => completed.add(chapter),
      })

      if (chapter !== '00' && label) {
        timeline.to(
          label,
          {
            duration: 0.45,
            ease: 'none',
            scrambleText: { text: trimmedText(label), chars: scrambleChars, speed: 0.6 },
          },
          0,
        )
      }

      if (lines.length) {
        timeline.from(
          lines,
          { yPercent: 110, autoAlpha: 0, duration: 0.7, stagger: 0.1, ease: 'power3.out' },
          0.08,
        )
      }

      if (copyTargets.length) {
        timeline.from(
          copyTargets,
          { y: 16, autoAlpha: 0, duration: 0.4, stagger: 0.06, ease: 'power2.out' },
          0.2,
        )
      }

      if (command) {
        timeline.to(
          command,
          {
            duration: 0.8,
            ease: 'none',
            scrambleText: { text: trimmedText(command), chars: scrambleChars, speed: 0.6 },
          },
          0.25,
        )
      }

      if (completed.has(chapter)) timeline.progress(1)
      const state = states.get(chapter)
      if (state) state.timeline = timeline
      return timeline
    }

    if (!title) {
      states.set(chapter, { fallback: true, timeline: makeTimeline() })
      continue
    }

    let initialTimeline: gsap.core.Timeline | undefined
    const split = SplitText.create(title, {
      type: 'lines',
      mask: 'lines',
      linesClass: 'text-motion-line',
      autoSplit: true,
      aria: 'auto',
      onSplit: (instance) => {
        initialTimeline = makeTimeline(instance.lines)
        return initialTimeline
      },
    })
    if (initialTimeline) states.set(chapter, { split, fallback: false, timeline: initialTimeline })
  }

  return {
    playChapter(chapter) {
      if (reverted || played.has(chapter)) return
      const state = states.get(chapter)
      if (!state) return
      played.add(chapter)
      state.timeline.play(0)
    },
    revert() {
      if (reverted) return
      reverted = true
      states.forEach((state) => {
        if (state.split) state.split.revert()
        if (state.fallback) state.timeline.revert()
        state.timeline.kill()
      })
      states.clear()
      played.clear()
      completed.clear()
    },
  }
}
