import { afterEach, describe, expect, it, vi } from 'vitest'

type TimelineMock = {
  from: ReturnType<typeof vi.fn>
  to: ReturnType<typeof vi.fn>
  play: ReturnType<typeof vi.fn>
  progress: ReturnType<typeof vi.fn>
  revert: ReturnType<typeof vi.fn>
  kill: ReturnType<typeof vi.fn>
}

type SplitMock = {
  lines: HTMLElement[]
  revert: ReturnType<typeof vi.fn>
}

const mocks = vi.hoisted(() => {
  const timelines: Array<{ timeline: TimelineMock; vars: Record<string, unknown> }> = []
  const splits: Array<{
    target: HTMLElement
    vars: Record<string, unknown>
    split: SplitMock
  }> = []

  const timeline = vi.fn((vars: Record<string, unknown> = {}) => {
    const instance: TimelineMock = {
      from: vi.fn(),
      to: vi.fn(),
      play: vi.fn(),
      progress: vi.fn(),
      revert: vi.fn(),
      kill: vi.fn(),
    }
    instance.from.mockReturnValue(instance)
    instance.to.mockReturnValue(instance)
    instance.play.mockReturnValue(instance)
    instance.progress.mockReturnValue(instance)
    instance.revert.mockReturnValue(instance)
    instance.kill.mockReturnValue(instance)
    timelines.push({ timeline: instance, vars })
    return instance
  })

  const create = vi.fn((target: HTMLElement, vars: Record<string, unknown>) => {
    const split: SplitMock = {
      lines: [document.createElement('span'), document.createElement('span')],
      revert: vi.fn(),
    }
    splits.push({ target, vars, split })
    const onSplit = vars.onSplit
    if (typeof onSplit === 'function') onSplit(split)
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
  options: { title?: boolean; label?: boolean; command?: boolean; copy?: boolean; list?: boolean } = {},
): string {
  const { title = true, label = true, command = true, copy = true, list = false } = options
  return `<section data-chapter="${id}">
    ${label ? '<p><span data-text-label aria-hidden="true">  ' + id + ' / label  </span><span data-text-static="label">static label</span></p>' : ''}
    ${title ? '<h2 data-text-title>Title ' + id + '</h2>' : ''}
    ${copy ? '<p data-text-copy>Copy ' + id + '</p>' : ''}
    ${command ? '<p><span data-text-command aria-hidden="true">  command ' + id + '  </span><span data-text-static="command">static command</span></p>' : ''}
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

  it('keeps completed chapters at progress one after an automatic resplit', () => {
    createTextMotion(mountMarkup(chapter('01')))
    const initial = timelineFor(0)
    const onComplete = mocks.timelines[0].vars.onComplete as () => void
    const onSplit = mocks.splits[0].vars.onSplit as (split: SplitMock) => TimelineMock

    onComplete()
    const replacement = onSplit(mocks.splits[0].split)

    expect(mocks.gsap.timeline).toHaveBeenCalledTimes(2)
    expect(replacement.progress).toHaveBeenCalledWith(1)
    expect(replacement.play).not.toHaveBeenCalled()
    expect(initial.play).not.toHaveBeenCalled()
  })

  it('reverts splits and latest timelines once while directly reverting only titleless fallbacks', () => {
    const controller = createTextMotion(mountMarkup(`${chapter('01')}${chapter('02', { title: false })}`))
    const splitTimeline = timelineFor(0)
    const fallbackTimeline = timelineFor(1)

    controller.revert()
    controller.revert()

    expect(mocks.splits[0].split.revert).toHaveBeenCalledTimes(1)
    expect(splitTimeline.revert).not.toHaveBeenCalled()
    expect(splitTimeline.kill).toHaveBeenCalledTimes(1)
    expect(fallbackTimeline.revert).toHaveBeenCalledTimes(1)
    expect(fallbackTimeline.kill).toHaveBeenCalledTimes(1)
  })
})
