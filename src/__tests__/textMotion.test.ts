import { afterEach, describe, expect, it, type Mock, vi } from 'vitest'

type TimelineMock = {
  from: Mock<(...args: unknown[]) => TimelineMock>
  to: Mock<(...args: unknown[]) => TimelineMock>
  play: Mock<(position?: number) => TimelineMock>
  progress: Mock<(value?: number) => TimelineMock>
  totalTime: Mock<(value?: number) => number | TimelineMock>
  paused: Mock<(value?: boolean) => boolean | TimelineMock>
  revert: Mock<() => TimelineMock>
  kill: Mock<() => TimelineMock>
}

type SplitMock = {
  target: HTMLElement
  lines: HTMLElement[]
  revert: Mock<() => void>
  resplit: Mock<() => TimelineMock | undefined>
  animation: TimelineMock | undefined
  originalHTML: string
  originalText: string
}

const mocks = vi.hoisted(() => {
  const timelines: Array<{ timeline: TimelineMock; vars: Record<string, unknown> }> = []
  const splits: Array<{
    target: HTMLElement
    vars: Record<string, unknown>
    split: SplitMock
  }> = []

  const timeline = vi.fn((vars: Record<string, unknown> = {}) => {
    const state = {
      paused: vars.paused === true,
      totalTime: 0,
      reverted: false,
      killed: false,
    }
    const instance: TimelineMock = {
      from: vi.fn<(...args: unknown[]) => TimelineMock>(),
      to: vi.fn<(...args: unknown[]) => TimelineMock>(),
      play: vi.fn<(position?: number) => TimelineMock>((position?: number) => {
        state.paused = false
        if (typeof position === 'number') state.totalTime = position
        return instance
      }),
      progress: vi.fn<(value?: number) => TimelineMock>((value?: number) => {
        if (typeof value === 'number') {
          state.totalTime = value
          if (value === 1) state.paused = true
        }
        return instance
      }),
      totalTime: vi.fn<(value?: number) => number | TimelineMock>((value?: number) => {
        if (typeof value === 'number') {
          state.totalTime = value
          return instance
        }
        return state.totalTime
      }),
      paused: vi.fn<(value?: boolean) => boolean | TimelineMock>((value?: boolean) => {
        if (typeof value === 'boolean') {
          state.paused = value
          return instance
        }
        return state.paused
      }),
      revert: vi.fn<() => TimelineMock>(() => {
        state.reverted = true
        return instance
      }),
      kill: vi.fn<() => TimelineMock>(() => {
        state.killed = true
        return instance
      }),
    }
    instance.from.mockReturnValue(instance)
    instance.to.mockReturnValue(instance)
    timelines.push({ timeline: instance, vars })
    return instance
  })

  const create = vi.fn((target: HTMLElement, vars: Record<string, unknown>) => {
    const originalHTML = target.innerHTML
    const originalText = target.textContent ?? ''
    const split: SplitMock = {
      target,
      lines: [document.createElement('span'), document.createElement('span')],
      revert: vi.fn<() => void>(),
      resplit: vi.fn<() => TimelineMock | undefined>(),
      animation: undefined,
      originalHTML,
      originalText,
    }
    const applySplitMarkup = () => {
      target.innerHTML = `<span data-test-split="true">${originalText}</span>`
      split.lines = [document.createElement('span'), document.createElement('span')]
    }
    const runSplit = () => {
      applySplitMarkup()
      const onSplit = vars.onSplit
      const animation = typeof onSplit === 'function' ? onSplit(split) : undefined
      split.animation = animation as TimelineMock | undefined
      return split.animation
    }
    split.revert.mockImplementation(() => {
      split.animation?.revert()
      target.innerHTML = originalHTML
    })
    split.resplit.mockImplementation(() => {
      const oldAnimation = split.animation
      const savedTotalTime = oldAnimation?.totalTime() as number | undefined
      oldAnimation?.revert()
      target.innerHTML = originalHTML
      const replacement = runSplit()
      if (typeof savedTotalTime === 'number') replacement?.totalTime(savedTotalTime)
      return replacement
    })
    splits.push({ target, vars, split })
    runSplit()
    return split
  })

  return {
    timelines,
    splits,
    gsap: { timeline },
    SplitText: { create },
  }
})

vi.mock('../lib/gsap', () => ({
  gsap: mocks.gsap,
  SplitText: mocks.SplitText,
}))

import { createTextMotion } from '../lib/textMotion'

function chapter(
  id: string,
  options: {
    title?: boolean
    label?: boolean
    command?: boolean
    copy?: boolean
    list?: boolean
    labelText?: string
    commandText?: string
    titleMarkup?: string
  } = {},
): string {
  const {
    title = true,
    label = true,
    command = true,
    copy = true,
    list = false,
    labelText = `  ${id} / label  `,
    commandText = `  command ${id}  `,
    titleMarkup = `Title ${id}`,
  } = options
  return `<section data-chapter="${id}">
    ${label ? '<p><span data-text-label aria-hidden="true">' + labelText + '</span><span data-text-static="label">static label</span></p>' : ''}
    ${title ? '<h2 data-text-title>' + titleMarkup + '</h2>' : ''}
    ${copy ? '<p data-text-copy>Copy ' + id + '</p>' : ''}
    ${command ? '<p><span data-text-command aria-hidden="true">' + commandText + '</span><span data-text-static="command">static command</span></p>' : ''}
    ${list ? '<ul data-text-list><li>First</li><li>Second</li></ul>' : ''}
  </section>`
}

function mountMarkup(markup: string): HTMLElement {
  document.body.innerHTML = `<main>${markup}</main>`
  return document.querySelector('main') as HTMLElement
}

function timelineFor(index: number): TimelineMock {
  return mocks.timelines[index].timeline
}

afterEach(() => {
  document.body.innerHTML = ''
  mocks.timelines.splice(0)
  mocks.splits.splice(0)
  mocks.gsap.timeline.mockClear()
  mocks.SplitText.create.mockClear()
})

describe('createTextMotion', () => {
  it('configures responsive masked SplitText and creates a paused timeline', () => {
    createTextMotion(mountMarkup(chapter('01')))

    expect(mocks.SplitText.create).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({
        type: 'lines',
        mask: 'lines',
        linesClass: 'text-motion-line',
        autoSplit: true,
        aria: 'auto',
        onSplit: expect.any(Function),
      }),
    )
    expect(mocks.gsap.timeline).toHaveBeenCalledWith(expect.objectContaining({ paused: true, onComplete: expect.any(Function) }))
  })

  it('reveals title lines, copy, and list items with the approved timing', () => {
    const scope = mountMarkup(chapter('02', { list: true, label: false, command: false }))
    createTextMotion(scope)

    const timeline = timelineFor(0)
    const split = mocks.splits[0].split
    const copy = scope.querySelector('[data-text-copy]')
    const items = Array.from(scope.querySelectorAll('[data-text-list] > li'))
    expect(timeline.from).toHaveBeenNthCalledWith(1, split.lines, {
      yPercent: 110,
      autoAlpha: 0,
      duration: 0.7,
      stagger: 0.1,
      ease: 'power3.out',
    }, 0.08)
    expect(timeline.from).toHaveBeenNthCalledWith(2, [copy, ...items], {
      y: 16,
      autoAlpha: 0,
      duration: 0.4,
      stagger: 0.06,
      ease: 'power2.out',
    }, 0.2)
  })

  it('scrambles non-hero visual label and command without animating static siblings', () => {
    const scope = mountMarkup(chapter('01'))
    createTextMotion(scope)

    const timeline = timelineFor(0)
    const label = scope.querySelector('[data-text-label]')
    const command = scope.querySelector('[data-text-command]')
    expect(timeline.to).toHaveBeenNthCalledWith(1, label, {
      duration: 0.45,
      ease: 'none',
      scrambleText: { text: '01 / label', chars: '01_/#?', speed: 0.6 },
    }, 0)
    expect(timeline.to).toHaveBeenNthCalledWith(2, command, {
      duration: 0.8,
      ease: 'none',
      scrambleText: { text: 'command 01', chars: '01_/#?', speed: 0.6 },
    }, 0.25)
    expect(timeline.to.mock.calls.flat().includes(scope.querySelector('[data-text-static="label"]'))).toBe(false)
    expect(timeline.to.mock.calls.flat().includes(scope.querySelector('[data-text-static="command"]'))).toBe(false)
  })

  it('keeps chapter 00 label static while animating its title, body, and command', () => {
    const scope = mountMarkup(chapter('00'))
    createTextMotion(scope)

    const timeline = timelineFor(0)
    const label = scope.querySelector('[data-text-label]')
    const command = scope.querySelector('[data-text-command]')
    expect(timeline.to.mock.calls.some(([target]) => target === label)).toBe(false)
    expect(timeline.from).toHaveBeenCalledTimes(2)
    expect(timeline.to).toHaveBeenCalledWith(command, expect.objectContaining({ scrambleText: expect.any(Object) }), 0.25)
  })

  it('plays a known chapter only once and ignores unknown or reverted controllers', () => {
    const controller = createTextMotion(mountMarkup(chapter('01')))
    const timeline = timelineFor(0)

    controller.playChapter('missing')
    controller.playChapter('01')
    controller.playChapter('01')
    expect(timeline.play).toHaveBeenCalledTimes(1)
    expect(timeline.play).toHaveBeenCalledWith(0)

    controller.revert()
    controller.playChapter('01')
    expect(timeline.play).toHaveBeenCalledTimes(1)
  })

  it('tolerates absent optional targets and still animates the remaining fallback targets', () => {
    const scope = mountMarkup(chapter('01', { title: false, command: false, label: false, copy: true, list: true }))
    expect(() => createTextMotion(scope)).not.toThrow()

    const timeline = timelineFor(0)
    const copy = scope.querySelector('[data-text-copy]')
    const items = Array.from(scope.querySelectorAll('[data-text-list] > li'))
    expect(mocks.SplitText.create).not.toHaveBeenCalled()
    expect(timeline.from).toHaveBeenCalledWith([copy, ...items], {
      y: 16,
      autoAlpha: 0,
      duration: 0.4,
      stagger: 0.06,
      ease: 'power2.out',
    }, 0.2)
  })

  it('keeps an unplayed replacement paused at time zero after an automatic resplit', () => {
    createTextMotion(mountMarkup(chapter('01')))
    const initial = timelineFor(0)
    const replacement = mocks.splits[0].split.resplit() as TimelineMock

    expect(replacement.totalTime()).toBe(0)
    expect(replacement.paused()).toBe(true)
    expect(replacement.play).not.toHaveBeenCalled()
    expect(initial.play).not.toHaveBeenCalled()
  })

  it('resumes an in-flight replacement after SplitText restores its saved time', () => {
    const controller = createTextMotion(mountMarkup(chapter('01')))
    const initial = timelineFor(0)
    controller.playChapter('01')
    initial.totalTime(0.4)

    const replacement = mocks.splits[0].split.resplit() as TimelineMock

    expect(initial.play).toHaveBeenCalledExactlyOnceWith(0)
    expect(replacement.totalTime()).toBe(0.4)
    expect(replacement.play).toHaveBeenCalledExactlyOnceWith()
    expect(replacement.paused()).toBe(false)
  })

  it('keeps completed chapters at progress one after an automatic resplit', () => {
    const controller = createTextMotion(mountMarkup(chapter('01')))
    const initial = timelineFor(0)
    controller.playChapter('01')
    initial.totalTime(1)
    const onComplete = mocks.timelines[0].vars.onComplete as () => void
    onComplete()

    const replacement = mocks.splits[0].split.resplit() as TimelineMock

    expect(initial.play).toHaveBeenCalledExactlyOnceWith(0)
    expect(initial.totalTime()).toBe(1)
    expect(replacement.progress).toHaveBeenCalledWith(1)
    expect(replacement.totalTime()).toBe(1)
    expect(replacement.paused()).toBe(true)
    expect(replacement.play).not.toHaveBeenCalled()
  })

  it('does not create scramble tweens for whitespace-only non-hero targets', () => {
    createTextMotion(mountMarkup(chapter('01', { labelText: '  \n ', commandText: ' \t ' })))

    expect(timelineFor(0).to).not.toHaveBeenCalled()
  })

  it('reverts each current split animation and kills only the latest replacement', () => {
    const controller = createTextMotion(mountMarkup(chapter('01', { titleMarkup: 'Title <em>01</em>' })))
    const split = mocks.splits[0].split
    const originalHTML = split.originalHTML
    const originalText = split.originalText
    const initial = timelineFor(0)
    const firstReplacement = split.resplit() as TimelineMock
    const latestReplacement = split.resplit() as TimelineMock

    controller.revert()
    controller.revert()

    expect(initial.revert).toHaveBeenCalledTimes(1)
    expect(firstReplacement.revert).toHaveBeenCalledTimes(1)
    expect(latestReplacement.revert).toHaveBeenCalledTimes(1)
    expect(split.revert).toHaveBeenCalledTimes(1)
    expect(latestReplacement.kill).toHaveBeenCalledTimes(1)
    expect(initial.kill).not.toHaveBeenCalled()
    expect(firstReplacement.kill).not.toHaveBeenCalled()
    expect(split.target.innerHTML).toBe(originalHTML)
    expect(split.target.textContent).toBe(originalText)
  })

  it('directly reverts a titleless fallback timeline once', () => {
    const controller = createTextMotion(mountMarkup(chapter('02', { title: false })))
    const fallbackTimeline = timelineFor(0)

    controller.revert()
    controller.revert()

    expect(fallbackTimeline.revert).toHaveBeenCalledTimes(1)
    expect(fallbackTimeline.kill).toHaveBeenCalledTimes(1)
  })
})
