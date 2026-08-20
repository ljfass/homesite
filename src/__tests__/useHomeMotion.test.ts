import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'

const mocks = vi.hoisted(() => {
  const media = {
    add: vi.fn(),
    revert: vi.fn(),
  }

  return {
    media,
    conditions: {} as Record<string, boolean>,
    textMotion: { playChapter: vi.fn(), revert: vi.fn() },
    createTextMotion: vi.fn(),
    gsap: {
      matchMedia: vi.fn(),
      timeline: vi.fn(),
      to: vi.fn(),
      from: vi.fn(),
      set: vi.fn(),
    },
    ScrollTrigger: {
      batch: vi.fn(),
      create: vi.fn(),
      refresh: vi.fn(),
    },
    mediaCleanups: [] as Array<{ queries: string | object; scope: HTMLElement; cleanup: () => void }>,
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
  mocks.mediaCleanups = []
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
  mocks.gsap.timeline.mockReset().mockReturnValue({ from: vi.fn().mockReturnThis() })
  mocks.gsap.to.mockReset()
  mocks.gsap.from.mockReset()
  mocks.gsap.set.mockReset()
  mocks.ScrollTrigger.batch.mockReset()
  mocks.ScrollTrigger.create.mockReset()
  mocks.ScrollTrigger.refresh.mockReset()
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
    expect(mocks.ScrollTrigger.create).not.toHaveBeenCalled()
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
    expect(reports).toContainEqual({ progress: 0, chapter: '00' })
    expect(mocks.textMotion.playChapter).toHaveBeenLastCalledWith('invalid')
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
