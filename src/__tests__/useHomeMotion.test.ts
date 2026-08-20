import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'

const mocks = vi.hoisted(() => {
  const media = {
    add: vi.fn(),
    revert: vi.fn(),
  }
  const reducedMotionListeners = new Set<(event: MediaQueryListEvent) => void>()
  const reducedMotionMedia = {
    matches: false,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }
  const desktopMotionMedia = {
    ...reducedMotionMedia,
    matches: false,
    media: '(min-width: 768px) and (min-height: 600px)',
  }
  const mobileMotionMedia = {
    ...reducedMotionMedia,
    matches: false,
    media: '(max-width: 767px), (max-height: 599px)',
  }

  return {
    media,
    desktopMotionMedia,
    mobileMotionMedia,
    reducedMotionMedia,
    reducedMotionListeners,
    conditions: {} as Record<string, boolean>,
    liveConditions: {} as Record<string, boolean>,
    textMotion: { playChapter: vi.fn(), revert: vi.fn() },
    createTextMotion: vi.fn(),
    gsap: {
      matchMedia: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      timeline: vi.fn(),
      to: vi.fn(),
      from: vi.fn(),
      set: vi.fn(),
    },
    ScrollTrigger: {
      batch: vi.fn(),
      create: vi.fn(),
      refresh: vi.fn(),
      update: vi.fn(),
    },
    mediaCleanups: [] as Array<{ queries: string | object; scope: HTMLElement; cleanup: () => void }>,
    matchMediaInitListener: undefined as (() => void) | undefined,
    matchMediaListener: undefined as (() => void) | undefined,
  }
})

vi.mock('../lib/gsap', () => ({
  gsap: mocks.gsap,
  ScrollTrigger: mocks.ScrollTrigger,
}))

vi.mock('../lib/textMotion', () => ({
  createTextMotion: mocks.createTextMotion,
}))

import { useHomeMotion, waitForRootAssets } from '../composables/useHomeMotion'

type MotionReport = {
  progress: number
  chapter: string
}

type MediaCleanup = {
  queries: string | object
  scope: HTMLElement
  cleanup: () => void
}

const wrappers: VueWrapper[] = []
const originalFonts = Object.getOwnPropertyDescriptor(document, 'fonts')
const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia')
const originalImageComplete = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'complete')
const originalImageDecode = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'decode')

function restoreProperty(target: object, key: PropertyKey, descriptor: PropertyDescriptor | undefined): void {
  if (descriptor) {
    Object.defineProperty(target, key, descriptor)
    return
  }

  Reflect.deleteProperty(target, key)
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (reason?: unknown) => void } {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })

  return { promise, resolve, reject }
}

async function settle(): Promise<void> {
  await flushPromises()
  await Promise.resolve()
}

function setFontsReady(ready: Promise<void>): void {
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: { ready },
  })
}

function configureGsap(conditions: Record<string, boolean>): void {
  mocks.conditions = conditions
  mocks.liveConditions = { ...conditions }
  mocks.mediaCleanups = []
  mocks.reducedMotionListeners.clear()
  mocks.desktopMotionMedia.matches = conditions.desktop
  mocks.mobileMotionMedia.matches = conditions.mobile
  mocks.reducedMotionMedia.matches = conditions.reduceMotion
  mocks.reducedMotionMedia.addEventListener.mockReset().mockImplementation((type, listener) => {
    if (type === 'change') {
      mocks.reducedMotionListeners.add(listener)
    }
  })
  mocks.reducedMotionMedia.removeEventListener.mockReset().mockImplementation((type, listener) => {
    if (type === 'change') {
      mocks.reducedMotionListeners.delete(listener)
    }
  })
  vi.stubGlobal('matchMedia', vi.fn((query: string) => {
    if (query === mocks.desktopMotionMedia.media) {
      return mocks.desktopMotionMedia
    }
    if (query === mocks.mobileMotionMedia.media) {
      return mocks.mobileMotionMedia
    }
    return mocks.reducedMotionMedia
  }))
  mocks.media.add.mockReset().mockImplementation((queries, callback, scope) => {
    const isTextMedia = queries === '(prefers-reduced-motion: no-preference)'
    if (isTextMedia && mocks.conditions.reduceMotion) {
      return
    }

    const cleanup = callback({ conditions: mocks.conditions })
    if (typeof cleanup === 'function') {
      mocks.mediaCleanups.push({ queries, scope, cleanup })
    }
  })
  mocks.media.revert.mockReset().mockImplementation(() => {
    mocks.mediaCleanups.splice(0).forEach(({ cleanup }) => cleanup())
  })
  mocks.gsap.matchMedia.mockReset().mockReturnValue(mocks.media)
  mocks.gsap.addEventListener.mockReset().mockImplementation((event, listener) => {
    if (event === 'matchMediaInit') {
      mocks.matchMediaInitListener = listener
    }
    if (event === 'matchMedia') {
      mocks.matchMediaListener = listener
    }
  })
  mocks.gsap.removeEventListener.mockReset().mockImplementation((event, listener) => {
    if (event === 'matchMediaInit' && mocks.matchMediaInitListener === listener) {
      mocks.matchMediaInitListener = undefined
    }
    if (event === 'matchMedia' && mocks.matchMediaListener === listener) {
      mocks.matchMediaListener = undefined
    }
  })
  mocks.matchMediaInitListener = undefined
  mocks.matchMediaListener = undefined
  mocks.gsap.timeline.mockReset().mockReturnValue({ from: vi.fn().mockReturnThis() })
  mocks.gsap.to.mockReset()
  mocks.gsap.from.mockReset()
  mocks.gsap.set.mockReset()
  mocks.ScrollTrigger.batch.mockReset()
  mocks.ScrollTrigger.create.mockReset()
  mocks.ScrollTrigger.refresh.mockReset()
  mocks.ScrollTrigger.update.mockReset()
  mocks.textMotion.playChapter.mockReset()
  mocks.textMotion.revert.mockReset()
  mocks.createTextMotion.mockReset().mockReturnValue(mocks.textMotion)
}

function getResponsiveCleanup(): MediaCleanup | undefined {
  return mocks.mediaCleanups.find(({ queries }) => typeof queries === 'object')
}

function replaceResponsiveContext(): void {
  const cleanupIndex = mocks.mediaCleanups.findIndex(({ queries }) => typeof queries === 'object')
  if (cleanupIndex < 0) {
    return
  }

  const [{ cleanup }] = mocks.mediaCleanups.splice(cleanupIndex, 1)
  cleanup()

  const responsiveCall = mocks.media.add.mock.calls.find(([queries]) => typeof queries === 'object')
  if (!responsiveCall) {
    return
  }

  const [queries, callback, scope] = responsiveCall
  const replacementCleanup = callback({ conditions: mocks.conditions })
  if (typeof replacementCleanup === 'function') {
    mocks.mediaCleanups.push({ queries, scope, cleanup: replacementCleanup })
  }
}

function deactivateTextContext(): void {
  const cleanupIndex = mocks.mediaCleanups.findIndex(({ queries }) => typeof queries === 'string')
  if (cleanupIndex < 0) {
    return
  }

  const [{ cleanup }] = mocks.mediaCleanups.splice(cleanupIndex, 1)
  cleanup()
}

function activateTextContext(): void {
  const textCall = mocks.media.add.mock.calls.find(([queries]) => typeof queries === 'string')
  if (!textCall) {
    return
  }

  const [queries, callback, scope] = textCall
  const cleanup = callback({ conditions: mocks.conditions })
  if (typeof cleanup === 'function') {
    mocks.mediaCleanups.push({ queries, scope, cleanup })
  }
}

function activateResponsiveContext(): void {
  const responsiveCall = mocks.media.add.mock.calls.find(([queries]) => typeof queries === 'object')
  if (!responsiveCall) {
    return
  }

  const [queries, callback, scope] = responsiveCall
  const cleanup = callback({ conditions: mocks.conditions })
  if (typeof cleanup === 'function') {
    mocks.mediaCleanups.push({ queries, scope, cleanup })
  }
}

function emitReducedMotionChange(matches: boolean): void {
  mocks.liveConditions.reduceMotion = matches
  mocks.reducedMotionMedia.matches = matches
  const event = { matches, media: mocks.reducedMotionMedia.media } as MediaQueryListEvent
  mocks.reducedMotionListeners.forEach((listener) => listener(event))
}

function emitGsapMatchMediaInit(): void {
  mocks.matchMediaInitListener?.()
}

function emitGsapMatchMedia(): void {
  mocks.matchMediaListener?.()
}

function runMatchMediaCycle(nextConditions: Record<string, boolean>, beforeInit?: () => void): void {
  const reducedMotionChanged = mocks.conditions.reduceMotion !== nextConditions.reduceMotion
  mocks.liveConditions = { ...nextConditions }
  mocks.desktopMotionMedia.matches = nextConditions.desktop
  mocks.mobileMotionMedia.matches = nextConditions.mobile
  mocks.reducedMotionMedia.matches = nextConditions.reduceMotion
  beforeInit?.()
  emitGsapMatchMediaInit()

  if (reducedMotionChanged) {
    deactivateTextContext()
  }

  const responsiveIndex = mocks.mediaCleanups.findIndex(({ queries }) => typeof queries === 'object')
  if (responsiveIndex >= 0) {
    const [{ cleanup }] = mocks.mediaCleanups.splice(responsiveIndex, 1)
    cleanup()
  }

  mocks.conditions = nextConditions
  if (reducedMotionChanged && !nextConditions.reduceMotion) {
    activateTextContext()
  }
  activateResponsiveContext()
  emitGsapMatchMedia()

  if (reducedMotionChanged) {
    emitReducedMotionChange(nextConditions.reduceMotion)
  }
}

function runNoopMatchMediaCycle(): void {
  emitGsapMatchMediaInit()
  emitGsapMatchMedia()
}

function stubAnimationFrames(): {
  cancelFrame: ReturnType<typeof vi.fn>
  pending: () => number
  runAll: () => void
  runNext: () => void
} {
  const frames = new Map<number, FrameRequestCallback>()
  let frameId = 0
  const cancelFrame = vi.fn((id: number) => frames.delete(id))
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frameId += 1
    frames.set(frameId, callback)
    return frameId
  })
  vi.stubGlobal('cancelAnimationFrame', cancelFrame)

  const runNext = () => {
    const next = [...frames.entries()].sort(([left], [right]) => left - right)[0]
    expect(next).toBeDefined()
    if (!next) return
    const [id, callback] = next
    frames.delete(id)
    callback(0)
  }

  return {
    cancelFrame,
    pending: () => frames.size,
    runAll: () => {
      let remaining = 20
      while (frames.size > 0 && remaining > 0) {
        runNext()
        remaining -= 1
      }
      expect(frames.size).toBe(0)
    },
    runNext,
  }
}

function mountHarness(
  options: { image?: boolean; story?: boolean; signal?: boolean } = {},
): { reports: MotionReport[]; wrapper: VueWrapper } {
  const reports: MotionReport[] = []
  const Harness = defineComponent({
    setup() {
      const root = ref<HTMLElement | null>(null)
      useHomeMotion(root, (progress, chapter) => {
        reports.push({ progress, chapter })
      })

      return () =>
        h('div', { ref: root }, [
          ...['00', '01', '02', '03', '04'].map((chapter) =>
            h('section', { 'data-chapter': chapter, 'data-story-panel': '' }),
          ),
          options.story ? h('section', { 'data-story-stage': '' }, [h('div', { 'data-story-track': '' })]) : null,
          options.signal ? h('div', { 'data-signal-visual': '' }) : null,
          options.image ? h('img', { src: '/placeholder.png' }) : null,
        ])
    },
  })

  const wrapper = mount(Harness, { attachTo: document.body })
  wrappers.push(wrapper)

  return { reports, wrapper }
}

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  restoreProperty(document, 'fonts', originalFonts)
  restoreProperty(window, 'matchMedia', originalMatchMedia)
  restoreProperty(HTMLImageElement.prototype, 'complete', originalImageComplete)
  restoreProperty(HTMLImageElement.prototype, 'decode', originalImageDecode)
  document.documentElement.style.removeProperty('scroll-behavior')
})

describe('useHomeMotion', () => {
  it('reports a static chapter without creating animations for reduced motion', async () => {
    configureGsap({ desktop: true, mobile: false, reduceMotion: true })
    setFontsReady(Promise.resolve())

    const { reports, wrapper } = mountHarness()
    await settle()

    expect(reports).toEqual([{ progress: 0, chapter: '00' }])
    expect(mocks.gsap.timeline).not.toHaveBeenCalled()
    expect(mocks.gsap.to).not.toHaveBeenCalled()
    expect(mocks.gsap.from).not.toHaveBeenCalled()
    expect(mocks.ScrollTrigger.batch).not.toHaveBeenCalled()
    expect(mocks.ScrollTrigger.create).toHaveBeenCalledTimes(5)
    expect(
      mocks.ScrollTrigger.create.mock.calls.every(
        ([config]) =>
          config.start === 'top 55%' &&
          config.end === 'bottom 45%' &&
          !('pin' in config) &&
          !('scrub' in config) &&
          !('animation' in config),
      ),
    ).toBe(true)
    expect(mocks.createTextMotion).not.toHaveBeenCalled()
    expect(mocks.textMotion.playChapter).not.toHaveBeenCalled()
    expect(mocks.textMotion.revert).not.toHaveBeenCalled()
    expect(mocks.media.add).toHaveBeenCalledTimes(2)
    expect(mocks.media.add.mock.calls[0][0]).toBe('(prefers-reduced-motion: no-preference)')
    expect(mocks.media.add.mock.calls[0][2]).toBe(wrapper.element)
    expect(mocks.media.add.mock.calls[1][0]).toEqual({
      desktop: '(min-width: 768px) and (min-height: 600px)',
      mobile: '(max-width: 767px), (max-height: 599px)',
      reduceMotion: '(prefers-reduced-motion: reduce)',
    })
    expect(mocks.media.add.mock.calls[1][2]).toBe(wrapper.element)
    expect(mocks.ScrollTrigger.refresh).toHaveBeenCalledTimes(1)
  })

  it('updates compact chapter progress and text playback from non-pinning triggers', async () => {
    configureGsap({ desktop: false, mobile: true, reduceMotion: false })
    setFontsReady(Promise.resolve())

    const { reports } = mountHarness()
    await settle()

    expect(mocks.gsap.matchMedia).toHaveBeenCalledTimes(1)
    expect(mocks.media.add).toHaveBeenCalledTimes(2)
    expect(mocks.createTextMotion).toHaveBeenCalledTimes(1)
    expect(mocks.createTextMotion).toHaveBeenCalledWith(expect.any(HTMLElement))
    expect(mocks.textMotion.playChapter).toHaveBeenCalledWith('00')
    expect(mocks.ScrollTrigger.batch).not.toHaveBeenCalled()
    expect(mocks.ScrollTrigger.create).toHaveBeenCalledTimes(5)
    const triggerCalls = mocks.ScrollTrigger.create.mock.calls.map(([config]) => config)
    expect(triggerCalls.map((config) => config.start)).toEqual(Array(5).fill('top 55%'))
    expect(triggerCalls.map((config) => config.end)).toEqual(Array(5).fill('bottom 45%'))
    expect(triggerCalls.every((config) => !('pin' in config) && !('scrub' in config))).toBe(true)

    triggerCalls[0].onEnter()
    triggerCalls[3].onEnterBack()

    expect(reports).toEqual([
      { progress: 0, chapter: '00' },
      { progress: 0.75, chapter: '03' },
    ])
    expect(mocks.textMotion.playChapter).toHaveBeenLastCalledWith('03')

    triggerCalls[0].trigger.dataset.chapter = 'invalid'
    triggerCalls[0].onEnter()
    expect(reports.at(-1)).toEqual({ progress: 0, chapter: '00' })
    expect(mocks.textMotion.playChapter).toHaveBeenLastCalledWith('00')

    triggerCalls[0].trigger.dataset.chapter = '003'
    triggerCalls[0].onEnter()
    expect(reports.at(-1)).toEqual({ progress: 0.75, chapter: '03' })
    expect(mocks.textMotion.playChapter).toHaveBeenLastCalledWith('03')

    triggerCalls[0].trigger.dataset.chapter = '9'
    triggerCalls[0].onEnter()
    expect(reports.at(-1)).toEqual({ progress: 1, chapter: '04' })
    expect(mocks.textMotion.playChapter).toHaveBeenLastCalledWith('04')
  })

  it('restores the latest stable compact viewport offset after native preference changes settle', async () => {
    configureGsap({ desktop: false, mobile: true, reduceMotion: false })
    setFontsReady(Promise.resolve())
    const frames = stubAnimationFrames()
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 640, writable: true })

    const { reports, wrapper } = mountHarness()
    await settle()
    const compactChapter = mocks.ScrollTrigger.create.mock.calls[3][0]
    let anchorTop = 120
    vi.spyOn(compactChapter.trigger, 'getBoundingClientRect').mockImplementation(
      () => DOMRect.fromRect({ y: anchorTop }),
    )
    compactChapter.onEnter()
    window.dispatchEvent(new Event('scroll'))

    anchorTop = -60
    window.scrollY = 820
    window.dispatchEvent(new Event('scroll'))
    frames.runAll()

    emitReducedMotionChange(true)
    runMatchMediaCycle({ desktop: false, mobile: true, reduceMotion: true })
    anchorTop = 760
    window.scrollY = 0
    window.dispatchEvent(new Event('scroll'))
    expect(scrollTo).not.toHaveBeenCalled()
    frames.runAll()
    expect(scrollTo).toHaveBeenCalledWith({ top: 820, behavior: 'auto' })
    expect(reports.at(-1)).toEqual({ progress: 0.75, chapter: '03' })

    wrapper.unmount()
  })

  it('suppresses synthetic reports and text playback for a complete match-media rebuild cycle', async () => {
    configureGsap({ desktop: false, mobile: true, reduceMotion: false })
    setFontsReady(Promise.resolve())
    const firstTextMotion = { playChapter: vi.fn(), revert: vi.fn() }
    const replacementTextMotion = { playChapter: vi.fn(), revert: vi.fn() }
    mocks.createTextMotion.mockReset().mockReturnValueOnce(firstTextMotion).mockReturnValueOnce(replacementTextMotion)
    const frames = new Map<number, FrameRequestCallback>()
    let frameId = 0
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frameId += 1
      frames.set(frameId, callback)
      return frameId
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
    const runNextFrame = () => {
      const next = [...frames.entries()].sort(([left], [right]) => left - right)[0]
      expect(next).toBeDefined()
      if (!next) return
      const [id, callback] = next
      frames.delete(id)
      callback(0)
    }

    const { reports, wrapper } = mountHarness()
    await settle()
    mocks.ScrollTrigger.create.mock.calls[3][0].onEnter()
    runNextFrame()
    expect(reports.at(-1)).toEqual({ progress: 0.75, chapter: '03' })

    emitGsapMatchMediaInit()
    mocks.conditions = { desktop: false, mobile: true, reduceMotion: true }
    deactivateTextContext()
    replaceResponsiveContext()
    expect(reports).toEqual([{ progress: 0.75, chapter: '03' }])
    emitGsapMatchMedia()
    emitReducedMotionChange(true)
    runNextFrame()
    runNextFrame()
    runNextFrame()
    expect(reports.at(-1)).toEqual({ progress: 0.75, chapter: '03' })

    emitGsapMatchMediaInit()
    mocks.conditions = { desktop: false, mobile: true, reduceMotion: false }
    emitReducedMotionChange(false)
    activateTextContext()
    activateResponsiveContext()
    const replacementChapter = mocks.ScrollTrigger.create.mock.calls.at(-4)?.[0]
    replacementChapter?.onEnter()
    expect(replacementTextMotion.playChapter).not.toHaveBeenCalled()
    emitGsapMatchMedia()
    runNextFrame()
    runNextFrame()
    runNextFrame()
    expect(replacementTextMotion.playChapter).toHaveBeenCalledExactlyOnceWith('03')

    wrapper.unmount()
    expect(mocks.reducedMotionMedia.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
    expect(mocks.gsap.removeEventListener).toHaveBeenCalledWith('matchMediaInit', expect.any(Function))
    expect(mocks.gsap.removeEventListener).toHaveBeenCalledWith('matchMedia', expect.any(Function))
  })

  it('restores exact desktop ScrollTrigger progress after a preference round trip', async () => {
    configureGsap({ desktop: true, mobile: false, reduceMotion: false })
    setFontsReady(Promise.resolve())
    const frames = stubAnimationFrames()
    const scrollBehaviors: string[] = []
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {
      scrollBehaviors.push(document.documentElement.style.scrollBehavior)
    })
    document.documentElement.style.scrollBehavior = 'smooth'
    const firstController = { playChapter: vi.fn(), revert: vi.fn() }
    const replacementController = { playChapter: vi.fn(), revert: vi.fn() }
    mocks.createTextMotion.mockReset().mockReturnValueOnce(firstController).mockReturnValueOnce(replacementController)
    const firstTween = {
      kill: vi.fn(),
      // ScrollTrigger's public progress can briefly reset before the global
      // match-media init listener runs; the last onUpdate report is stable.
      scrollTrigger: { start: 1_000, end: 1_600, progress: 0 },
    }
    const replacementTween = {
      kill: vi.fn(),
      scrollTrigger: { start: 1_200, end: 1_800, progress: 0 },
    }
    mocks.gsap.to.mockReturnValueOnce(firstTween).mockReturnValueOnce(replacementTween)

    const { reports, wrapper } = mountHarness({ story: true })
    const stage = wrapper.get('[data-story-stage]').element
    const track = wrapper.get('[data-story-track]').element
    Object.defineProperty(stage, 'clientWidth', { configurable: true, value: 1_000 })
    Object.defineProperty(track, 'scrollWidth', { configurable: true, value: 1_600 })
    await settle()
    const oldHorizontalUpdate = mocks.gsap.to.mock.calls[0][1].scrollTrigger.onUpdate
    oldHorizontalUpdate({ progress: 0.55 })
    frames.runAll()

    runMatchMediaCycle(
      { desktop: true, mobile: false, reduceMotion: true },
      () => oldHorizontalUpdate({ progress: 0.375 }),
    )
    frames.runNext()
    runNoopMatchMediaCycle()
    frames.runAll()
    const staleReducedUpdate = mocks.ScrollTrigger.create.mock.calls[2][0].onEnter
    runMatchMediaCycle(
      { desktop: true, mobile: false, reduceMotion: false },
      staleReducedUpdate,
    )
    frames.runNext()
    runNoopMatchMediaCycle()
    frames.runAll()

    expect(scrollTo).toHaveBeenLastCalledWith({ top: 1_530, behavior: 'auto' })
    expect(scrollBehaviors.at(-1)).toBe('auto')
    expect(document.documentElement.style.scrollBehavior).toBe('smooth')
    expect(reports.at(-1)).toEqual({ progress: 0.55, chapter: '03' })
    expect(reports).not.toContainEqual({ progress: 0.375, chapter: '02' })
    expect(reports).not.toContainEqual({ progress: 0.5, chapter: '02' })
    expect(firstController.playChapter).not.toHaveBeenCalledWith('02')
    expect(replacementController.playChapter).toHaveBeenCalledExactlyOnceWith('03')
    wrapper.unmount()
  })

  it('tracks semantic chapters while reduced and restores the latest chapter to text motion', async () => {
    configureGsap({ desktop: false, mobile: true, reduceMotion: false })
    setFontsReady(Promise.resolve())
    const frames = stubAnimationFrames()
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
    const firstController = { playChapter: vi.fn(), revert: vi.fn() }
    const replacementController = { playChapter: vi.fn(), revert: vi.fn() }
    mocks.createTextMotion.mockReset().mockReturnValueOnce(firstController).mockReturnValueOnce(replacementController)

    const { reports, wrapper } = mountHarness()
    await settle()
    mocks.ScrollTrigger.create.mock.calls[3][0].onEnter()

    runMatchMediaCycle({ desktop: false, mobile: true, reduceMotion: true })
    frames.runAll()
    expect(mocks.ScrollTrigger.create).toHaveBeenCalledTimes(10)
    mocks.ScrollTrigger.create.mock.calls[9][0].onEnter()
    frames.runAll()
    expect(reports.at(-1)).toEqual({ progress: 1, chapter: '04' })

    runMatchMediaCycle({ desktop: false, mobile: true, reduceMotion: false })
    frames.runAll()
    expect(replacementController.playChapter).toHaveBeenCalledExactlyOnceWith('04')
    expect(reports.at(-1)).toEqual({ progress: 1, chapter: '04' })
    wrapper.unmount()
  })

  it('restores a current-generation chapter reached by user scroll during the guarded transition', async () => {
    configureGsap({ desktop: false, mobile: true, reduceMotion: false })
    setFontsReady(Promise.resolve())
    const frames = stubAnimationFrames()
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation((optionsOrX) => {
      const { top } = optionsOrX as unknown as ScrollToOptions
      window.scrollY = top ?? window.scrollY
    })
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 2_000, writable: true })
    const firstController = { playChapter: vi.fn(), revert: vi.fn() }
    const replacementController = { playChapter: vi.fn(), revert: vi.fn() }
    mocks.createTextMotion.mockReset().mockReturnValueOnce(firstController).mockReturnValueOnce(replacementController)

    const { reports, wrapper } = mountHarness()
    await settle()
    const initialChapter02 = mocks.ScrollTrigger.create.mock.calls[2][0]
    const initialChapter03 = mocks.ScrollTrigger.create.mock.calls[3][0]
    initialChapter03.onEnter()
    frames.runAll()
    expect(reports.at(-1)).toEqual({ progress: 0.75, chapter: '03' })

    runMatchMediaCycle({ desktop: false, mobile: true, reduceMotion: true })
    const reducedChapter02 = mocks.ScrollTrigger.create.mock.calls[7][0]
    const reducedChapter04 = mocks.ScrollTrigger.create.mock.calls[9][0]
    vi.spyOn(reducedChapter04.trigger, 'getBoundingClientRect').mockReturnValue(DOMRect.fromRect({ y: 120 }))

    window.scrollY = 3_400
    window.dispatchEvent(new Event('scroll'))
    reducedChapter02.onEnter()
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: 800 }))
    initialChapter02.onEnter()
    reducedChapter04.onEnter()
    emitReducedMotionChange(true)
    mocks.ScrollTrigger.refresh.mockImplementation(() => reducedChapter02.onEnter())

    expect(reports.at(-1)).toEqual({ progress: 0.75, chapter: '03' })
    expect(firstController.playChapter).not.toHaveBeenCalledWith('04')
    frames.runAll()
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 3_400, behavior: 'auto' })
    expect(reports.at(-1)).toEqual({ progress: 1, chapter: '04' })

    runMatchMediaCycle({ desktop: false, mobile: true, reduceMotion: false })
    frames.runAll()
    expect(replacementController.playChapter).toHaveBeenCalledExactlyOnceWith('04')
    expect(reports.at(-1)).toEqual({ progress: 1, chapter: '04' })
    wrapper.unmount()
  })

  it('retains a confirmed user chapter across an overlapping responsive generation', async () => {
    configureGsap({ desktop: false, mobile: true, reduceMotion: false })
    setFontsReady(Promise.resolve())
    const frames = stubAnimationFrames()
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation((optionsOrX) => {
      const { top } = optionsOrX as unknown as ScrollToOptions
      window.scrollY = top ?? window.scrollY
    })
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 2_000, writable: true })

    const { reports, wrapper } = mountHarness()
    await settle()
    mocks.ScrollTrigger.create.mock.calls[3][0].onEnter()
    frames.runAll()

    runMatchMediaCycle({ desktop: false, mobile: true, reduceMotion: true })
    const reducedChapter04 = mocks.ScrollTrigger.create.mock.calls[9][0]
    vi.spyOn(reducedChapter04.trigger, 'getBoundingClientRect').mockReturnValue(DOMRect.fromRect({ y: 120 }))
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: 800 }))
    window.scrollY = 3_400
    reducedChapter04.onEnter()

    runMatchMediaCycle({ desktop: true, mobile: false, reduceMotion: true })
    expect(reports.at(-1)).toEqual({ progress: 0.75, chapter: '03' })
    frames.runAll()

    expect(scrollTo).toHaveBeenLastCalledWith({ top: 3_400, behavior: 'auto' })
    expect(reports.at(-1)).toEqual({ progress: 1, chapter: '04' })
    wrapper.unmount()
  })

  it('retains same-chapter user scroll offset without a guarded chapter report', async () => {
    configureGsap({ desktop: false, mobile: true, reduceMotion: false })
    setFontsReady(Promise.resolve())
    const frames = stubAnimationFrames()
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation((optionsOrX) => {
      const { top } = optionsOrX as unknown as ScrollToOptions
      window.scrollY = top ?? window.scrollY
    })
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 2_000, writable: true })

    const { reports, wrapper } = mountHarness()
    await settle()
    const chapter03 = mocks.ScrollTrigger.create.mock.calls[3][0]
    vi.spyOn(chapter03.trigger, 'getBoundingClientRect').mockImplementation(() =>
      DOMRect.fromRect({ y: 2_120 - window.scrollY }),
    )
    chapter03.onEnter()
    window.dispatchEvent(new Event('scroll'))
    frames.runAll()

    runMatchMediaCycle({ desktop: false, mobile: true, reduceMotion: true })
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
    window.scrollY = 2_100
    window.dispatchEvent(new Event('scroll'))
    window.dispatchEvent(new Event('scroll'))
    expect(frames.pending()).toBe(2)
    frames.runAll()

    expect(scrollTo).toHaveBeenLastCalledWith({ top: 2_100, behavior: 'auto' })
    expect(reports.at(-1)).toEqual({ progress: 0.75, chapter: '03' })
    wrapper.unmount()
  })

  it.each(['prevented', 'composing', 'input', 'textarea', 'select', 'contenteditable'] as const)(
    'ignores %s keyboard events during restoration',
    async (eventSource) => {
      configureGsap({ desktop: false, mobile: true, reduceMotion: false })
      setFontsReady(Promise.resolve())
      const frames = stubAnimationFrames()
      vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)

      const { reports, wrapper } = mountHarness()
      await settle()
      mocks.ScrollTrigger.create.mock.calls[3][0].onEnter()
      frames.runAll()
      runMatchMediaCycle({ desktop: false, mobile: true, reduceMotion: true })
      const reducedChapter04 = mocks.ScrollTrigger.create.mock.calls[9][0]

      if (eventSource === 'prevented') {
        const prevented = new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true })
        prevented.preventDefault()
        window.dispatchEvent(prevented)
      } else if (eventSource === 'composing') {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, isComposing: true }))
      } else {
        const editable = document.createElement(eventSource === 'contenteditable' ? 'div' : eventSource)
        const target = eventSource === 'contenteditable' ? document.createElement('span') : editable
        if (eventSource === 'contenteditable') {
          editable.setAttribute('contenteditable', 'true')
          editable.append(target)
        }
        wrapper.element.append(editable)
        target.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
      }
      reducedChapter04.onEnter()
      frames.runAll()

      expect(reports.at(-1)).toEqual({ progress: 0.75, chapter: '03' })
      wrapper.unmount()
    },
  )

  it('resynchronizes chapter 03 across mobile and desktop match-media rebuilds', async () => {
    configureGsap({ desktop: false, mobile: true, reduceMotion: false })
    setFontsReady(Promise.resolve())
    const frames = stubAnimationFrames()
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation((optionsOrX) => {
      const { top } = optionsOrX as unknown as ScrollToOptions
      window.scrollY = top ?? window.scrollY
    })
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 2_042.7, writable: true })
    const desktopTween = {
      kill: vi.fn(),
      scrollTrigger: { start: 1_000, end: 1_600, progress: 0 },
    }
    mocks.gsap.to.mockReturnValueOnce(desktopTween)

    const { reports, wrapper } = mountHarness({ story: true })
    const stage = wrapper.get('[data-story-stage]').element
    const track = wrapper.get('[data-story-track]').element
    Object.defineProperty(stage, 'clientWidth', { configurable: true, value: 1_000 })
    Object.defineProperty(track, 'scrollWidth', { configurable: true, value: 1_600 })
    await settle()
    const chapter03 = mocks.ScrollTrigger.create.mock.calls[3][0]
    let layout: 'mobile' | 'desktop' = 'mobile'
    vi.spyOn(chapter03.trigger, 'getBoundingClientRect').mockImplementation(() =>
      DOMRect.fromRect({ y: layout === 'mobile' ? 2_000 - window.scrollY : 0 }),
    )
    chapter03.onEnter()
    window.dispatchEvent(new Event('scroll'))
    frames.runAll()

    runMatchMediaCycle(
      { desktop: true, mobile: false, reduceMotion: false },
      () => {
        layout = 'desktop'
      },
    )
    frames.runNext()
    runNoopMatchMediaCycle()
    frames.runAll()
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 1_375, behavior: 'auto' })
    expect(reports.at(-1)).toEqual({ progress: 0.625, chapter: '03' })

    runMatchMediaCycle(
      { desktop: false, mobile: true, reduceMotion: false },
      () => {
        layout = 'mobile'
      },
    )
    frames.runAll()
    expect(reports.at(-1)).toEqual({ progress: 0.75, chapter: '03' })
    expect(scrollTo).toHaveBeenCalledTimes(2)
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 2_042.7, behavior: 'auto' })
    wrapper.unmount()
  })

  it('caches chapter elements and avoids horizontal anchor layout reads', async () => {
    configureGsap({ desktop: true, mobile: false, reduceMotion: false })
    const fonts = deferred<void>()
    setFontsReady(fonts.promise)
    const frames = stubAnimationFrames()

    const { wrapper } = mountHarness({ story: true })
    const queryChapters = vi.spyOn(wrapper.element, 'querySelectorAll')
    const chapter = wrapper.get('[data-chapter="03"]').element
    const readChapterRect = vi.spyOn(chapter, 'getBoundingClientRect')
    const stage = wrapper.get('[data-story-stage]').element
    const track = wrapper.get('[data-story-track]').element
    Object.defineProperty(stage, 'clientWidth', { configurable: true, value: 1_000 })
    Object.defineProperty(track, 'scrollWidth', { configurable: true, value: 1_600 })
    fonts.resolve()
    await settle()

    const onUpdate = mocks.gsap.to.mock.calls[0][1].scrollTrigger.onUpdate
    onUpdate({ progress: 0.51 })
    onUpdate({ progress: 0.55 })
    onUpdate({ progress: 0.6 })
    window.dispatchEvent(new Event('scroll'))
    window.dispatchEvent(new Event('scroll'))

    expect(queryChapters.mock.calls.filter(([selector]) => selector === '[data-chapter]')).toHaveLength(1)
    expect(readChapterRect).not.toHaveBeenCalled()
    expect(frames.pending()).toBe(1)
    frames.runNext()
    expect(readChapterRect).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('cancels stale preference restoration frames and listeners on unmount', async () => {
    configureGsap({ desktop: false, mobile: true, reduceMotion: false })
    setFontsReady(Promise.resolve())
    const frames = new Map<number, FrameRequestCallback>()
    let frameId = 0
    const requestFrame = vi.fn((callback: FrameRequestCallback) => {
      frameId += 1
      frames.set(frameId, callback)
      return frameId
    })
    const cancelFrame = vi.fn((id: number) => frames.delete(id))
    vi.stubGlobal('requestAnimationFrame', requestFrame)
    vi.stubGlobal('cancelAnimationFrame', cancelFrame)
    const addWindowListener = vi.spyOn(window, 'addEventListener')
    const removeWindowListener = vi.spyOn(window, 'removeEventListener')

    const { wrapper } = mountHarness()
    await settle()
    emitReducedMotionChange(true)
    emitReducedMotionChange(false)
    expect(cancelFrame).toHaveBeenCalledWith(1)

    wrapper.unmount()
    expect(cancelFrame).toHaveBeenCalledWith(2)
    expect(mocks.reducedMotionMedia.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
    expect(mocks.gsap.removeEventListener).toHaveBeenCalledWith('matchMediaInit', expect.any(Function))
    expect(mocks.gsap.removeEventListener).toHaveBeenCalledWith('matchMedia', expect.any(Function))
    expect(mocks.reducedMotionListeners).toEqual(new Set())
    const wheelListener = addWindowListener.mock.calls.find(
      ([event, , options]) => event === 'wheel' && typeof options === 'object' && options.capture,
    )?.[1]
    const touchListener = addWindowListener.mock.calls.find(
      ([event, , options]) => event === 'touchmove' && typeof options === 'object' && options.capture,
    )?.[1]
    const keyListener = addWindowListener.mock.calls.find(
      ([event, , options]) => event === 'keydown' && options === true,
    )?.[1]
    expect(wheelListener).toEqual(expect.any(Function))
    expect(touchListener).toEqual(expect.any(Function))
    expect(keyListener).toEqual(expect.any(Function))
    expect(removeWindowListener).toHaveBeenCalledWith('wheel', wheelListener, true)
    expect(removeWindowListener).toHaveBeenCalledWith('touchmove', touchListener, true)
    expect(removeWindowListener).toHaveBeenCalledWith('keydown', keyListener, true)
  })

  it('keeps text playback alive across responsive cleanup and reverts it only with the media context', async () => {
    configureGsap({ desktop: true, mobile: false, reduceMotion: false })
    setFontsReady(Promise.resolve())
    const firstSignal = { kill: vi.fn() }
    const replacementSignal = { kill: vi.fn() }
    const firstHorizontal = { kill: vi.fn() }
    const replacementHorizontal = { kill: vi.fn() }
    mocks.gsap.from.mockReturnValueOnce(firstSignal).mockReturnValueOnce(replacementSignal)
    mocks.gsap.to.mockReturnValueOnce(firstHorizontal).mockReturnValueOnce(replacementHorizontal)

    const { wrapper } = mountHarness({ story: true, signal: true })
    const stage = wrapper.get('[data-story-stage]').element
    const track = wrapper.get('[data-story-track]').element
    Object.defineProperty(stage, 'clientWidth', { configurable: true, value: 1000 })
    Object.defineProperty(track, 'scrollWidth', { configurable: true, value: 1600 })
    await settle()
    const responsive = getResponsiveCleanup()
    const textCleanup = mocks.mediaCleanups.find(({ queries }) => typeof queries === 'string')
    expect(responsive).toBeDefined()
    expect(textCleanup).toBeDefined()

    replaceResponsiveContext()
    expect(firstSignal.kill).toHaveBeenCalledTimes(1)
    expect(firstHorizontal.kill).toHaveBeenCalledTimes(1)
    expect(replacementSignal.kill).not.toHaveBeenCalled()
    expect(replacementHorizontal.kill).not.toHaveBeenCalled()
    expect(mocks.textMotion.revert).not.toHaveBeenCalled()
    expect(mocks.mediaCleanups).toHaveLength(2)
    expect(getResponsiveCleanup()).toBeDefined()
    expect(getResponsiveCleanup()).not.toBe(responsive)
    expect(getResponsiveCleanup()?.cleanup).not.toBe(responsive?.cleanup)
    expect(getResponsiveCleanup()?.scope).toBe(responsive?.scope)
    expect(mocks.mediaCleanups.find(({ queries }) => typeof queries === 'string')).toBe(textCleanup)

    const replacementScrollTrigger = mocks.gsap.to.mock.calls[1][1].scrollTrigger
    replacementScrollTrigger.onUpdate({ progress: 0.5 })
    expect(mocks.textMotion.playChapter).toHaveBeenLastCalledWith('03')

    wrapper.unmount()
    expect(firstSignal.kill).toHaveBeenCalledTimes(1)
    expect(firstHorizontal.kill).toHaveBeenCalledTimes(1)
    expect(replacementSignal.kill).toHaveBeenCalledTimes(1)
    expect(replacementHorizontal.kill).toHaveBeenCalledTimes(1)
    expect(mocks.textMotion.revert).toHaveBeenCalledTimes(1)
    expect(mocks.mediaCleanups).toEqual([])
  })

  it('uses only the signal entrance and connects desktop scroll updates to text playback', async () => {
    configureGsap({ desktop: true, mobile: false, reduceMotion: false })
    setFontsReady(Promise.resolve())
    const signalTween = { kill: vi.fn() }
    mocks.gsap.from.mockReturnValue(signalTween)
    const { reports, wrapper } = mountHarness({ story: true, signal: true })
    const stage = wrapper.get('[data-story-stage]').element
    const track = wrapper.get('[data-story-track]').element
    Object.defineProperty(stage, 'clientWidth', { configurable: true, value: 1000 })
    Object.defineProperty(track, 'scrollWidth', { configurable: true, value: 1600 })
    await settle()

    expect(mocks.gsap.timeline).not.toHaveBeenCalled()
    expect(mocks.gsap.from).toHaveBeenCalledWith(
      wrapper.get('[data-signal-visual]').element,
      { scale: 0.9, autoAlpha: 0, duration: 0.6, ease: 'power2.out' },
    )
    const horizontal = mocks.gsap.to.mock.calls[0][1]
    horizontal.scrollTrigger.onUpdate({ progress: 0.5 })
    expect(reports).toContainEqual({ progress: 0.5, chapter: '03' })
    expect(mocks.textMotion.playChapter).toHaveBeenLastCalledWith('03')

  })

  it('creates and cleans up the horizontal tween when desktop overflow crosses zero', async () => {
    configureGsap({ desktop: true, mobile: false, reduceMotion: false })
    const fonts = deferred<void>()
    setFontsReady(fonts.promise)
    const firstTween = { kill: vi.fn() }
    const secondTween = { kill: vi.fn() }
    mocks.gsap.to.mockReturnValueOnce(firstTween).mockReturnValueOnce(secondTween)
    const observed: Element[] = []
    let observer: { callback: ResizeObserverCallback; disconnect: ReturnType<typeof vi.fn> } | undefined
    let frame: FrameRequestCallback | undefined
    const requestFrame = vi.fn((callback: FrameRequestCallback) => {
      frame = callback
      return 1
    })

    class TestResizeObserver {
      callback: ResizeObserverCallback
      disconnect = vi.fn()

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback
        observer = this
      }

      observe(target: Element): void {
        observed.push(target)
      }

      unobserve(): void {}
    }

    vi.stubGlobal('ResizeObserver', TestResizeObserver)
    vi.stubGlobal('requestAnimationFrame', requestFrame)
    vi.stubGlobal('cancelAnimationFrame', vi.fn())

    const { reports, wrapper } = mountHarness({ story: true })
    const stage = wrapper.get('[data-story-stage]').element
    const track = wrapper.get('[data-story-track]').element
    let trackWidth = 1000
    Object.defineProperty(stage, 'clientWidth', { configurable: true, value: 1000 })
    Object.defineProperty(track, 'scrollWidth', { configurable: true, get: () => trackWidth })

    fonts.resolve()
    await settle()
    expect(mocks.gsap.to).not.toHaveBeenCalled()
    expect(observed).toEqual([stage, track])

    trackWidth = 1600
    observer?.callback([], observer as unknown as ResizeObserver)
    observer?.callback([], observer as unknown as ResizeObserver)
    expect(requestFrame).toHaveBeenCalledTimes(1)
    frame?.(0)
    expect(mocks.gsap.to).toHaveBeenCalledTimes(1)

    trackWidth = 1000
    observer?.callback([], observer as unknown as ResizeObserver)
    frame?.(0)
    expect(firstTween.kill).toHaveBeenCalledTimes(1)
    expect(mocks.gsap.set).toHaveBeenCalledWith(track, { x: 0 })
    expect(reports).toContainEqual({ progress: 0, chapter: '00' })

    trackWidth = 1600
    observer?.callback([], observer as unknown as ResizeObserver)
    frame?.(0)
    wrapper.unmount()

    expect(secondTween.kill).toHaveBeenCalledTimes(1)
    expect(observer?.disconnect).toHaveBeenCalledTimes(1)
  })

  it('reverts the match-media context when the component unmounts', async () => {
    configureGsap({ desktop: false, mobile: true, reduceMotion: false })
    setFontsReady(Promise.resolve())

    const { wrapper } = mountHarness()
    await settle()
    wrapper.unmount()

    expect(mocks.media.revert).toHaveBeenCalledTimes(1)
  })

  it('does not initialize matchMedia after unmounting while fonts are pending', async () => {
    configureGsap({ desktop: false, mobile: true, reduceMotion: false })
    const fonts = deferred<void>()
    setFontsReady(fonts.promise)

    const { wrapper } = mountHarness()
    wrapper.unmount()
    fonts.resolve()
    await settle()

    expect(mocks.gsap.matchMedia).not.toHaveBeenCalled()
  })

  it('waits for complete image decoding before initializing motion', async () => {
    configureGsap({ desktop: false, mobile: true, reduceMotion: false })
    setFontsReady(Promise.resolve())
    const decode = deferred<void>()
    Object.defineProperty(HTMLImageElement.prototype, 'complete', {
      configurable: true,
      get: () => true,
    })
    Object.defineProperty(HTMLImageElement.prototype, 'decode', {
      configurable: true,
      value: vi.fn(() => decode.promise),
    })

    mountHarness({ image: true })
    await settle()
    expect(mocks.gsap.matchMedia).not.toHaveBeenCalled()

    decode.resolve()
    await settle()
    expect(mocks.gsap.matchMedia).toHaveBeenCalledTimes(1)
  })

  it('waits for incomplete images to load before initializing motion', async () => {
    configureGsap({ desktop: false, mobile: true, reduceMotion: false })
    setFontsReady(Promise.resolve())
    Object.defineProperty(HTMLImageElement.prototype, 'complete', {
      configurable: true,
      get: () => false,
    })

    const { wrapper } = mountHarness({ image: true })
    await settle()
    expect(mocks.gsap.matchMedia).not.toHaveBeenCalled()

    wrapper.get('img').element.dispatchEvent(new Event('load'))
    await settle()
    expect(mocks.gsap.matchMedia).toHaveBeenCalledTimes(1)
  })

  it('aborts pending image waits and removes listeners when the component unmounts', async () => {
    configureGsap({ desktop: false, mobile: true, reduceMotion: false })
    setFontsReady(Promise.resolve())
    Object.defineProperty(HTMLImageElement.prototype, 'complete', {
      configurable: true,
      get: () => false,
    })
    const removeListener = vi.spyOn(HTMLImageElement.prototype, 'removeEventListener')

    const { wrapper } = mountHarness({ image: true })
    await settle()
    wrapper.unmount()
    await settle()

    expect(mocks.gsap.matchMedia).not.toHaveBeenCalled()
    expect(removeListener).toHaveBeenCalledWith('load', expect.any(Function))
    expect(removeListener).toHaveBeenCalledWith('error', expect.any(Function))
  })

  it('settles incomplete images on errors', async () => {
    const root = document.createElement('div')
    const image = document.createElement('img')
    Object.defineProperty(image, 'complete', { configurable: true, value: false })
    root.append(image)

    const settling = waitForRootAssets(root)
    image.dispatchEvent(new Event('error'))

    await expect(settling).resolves.toBeUndefined()
  })

  it('times out pending image waits and removes their listeners', async () => {
    vi.useFakeTimers()
    const root = document.createElement('div')
    const image = document.createElement('img')
    Object.defineProperty(image, 'complete', { configurable: true, value: false })
    const removeListener = vi.spyOn(image, 'removeEventListener')
    root.append(image)
    let settled = false

    void waitForRootAssets(root, { timeoutMs: 25 }).then(() => {
      settled = true
    })
    await vi.advanceTimersByTimeAsync(25)

    expect(settled).toBe(true)
    expect(removeListener).toHaveBeenCalledWith('load', expect.any(Function))
    expect(removeListener).toHaveBeenCalledWith('error', expect.any(Function))
  })

  it('swallows image decode failures so asset settling cannot block setup', async () => {
    const root = document.createElement('div')
    const image = document.createElement('img')
    Object.defineProperty(image, 'complete', { configurable: true, value: true })
    Object.defineProperty(image, 'decode', {
      configurable: true,
      value: vi.fn(() => Promise.reject(new Error('decode failed'))),
    })
    root.append(image)

    await expect(waitForRootAssets(root)).resolves.toBeUndefined()
  })
})
