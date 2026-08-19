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
    gsap: {
      matchMedia: vi.fn(),
      timeline: vi.fn(),
      to: vi.fn(),
      from: vi.fn(),
    },
    ScrollTrigger: {
      batch: vi.fn(),
      create: vi.fn(),
      refresh: vi.fn(),
    },
  }
})

vi.mock('../lib/gsap', () => ({
  gsap: mocks.gsap,
  ScrollTrigger: mocks.ScrollTrigger,
}))

import { useHomeMotion, waitForRootAssets } from '../composables/useHomeMotion'

type MotionReport = {
  progress: number
  chapter: string
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
  mocks.media.add.mockReset().mockImplementation((queries, callback, scope) => {
    void queries
    void scope
    callback({ conditions: mocks.conditions })
  })
  mocks.media.revert.mockReset()
  mocks.gsap.matchMedia.mockReset().mockReturnValue(mocks.media)
  mocks.gsap.timeline.mockReset().mockReturnValue({ from: vi.fn().mockReturnThis() })
  mocks.gsap.to.mockReset()
  mocks.gsap.from.mockReset()
  mocks.ScrollTrigger.batch.mockReset()
  mocks.ScrollTrigger.create.mockReset()
  mocks.ScrollTrigger.refresh.mockReset()
}

function mountHarness(options: { image?: boolean } = {}): { reports: MotionReport[]; wrapper: VueWrapper } {
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
    expect(mocks.media.add).toHaveBeenCalledTimes(1)
    expect(mocks.media.add.mock.calls[0][0]).toEqual({
      desktop: '(min-width: 768px)',
      mobile: '(max-width: 767px)',
      reduceMotion: '(prefers-reduced-motion: reduce)',
    })
    expect(mocks.media.add.mock.calls[0][2]).toBe(wrapper.element)
    expect(mocks.ScrollTrigger.refresh).toHaveBeenCalledTimes(1)
  })

  it('reveals mobile panels and updates chapter progress from non-pinning triggers', async () => {
    configureGsap({ desktop: false, mobile: true, reduceMotion: false })
    setFontsReady(Promise.resolve())

    const { reports } = mountHarness()
    await settle()

    expect(mocks.gsap.matchMedia).toHaveBeenCalledTimes(1)
    expect(mocks.media.add).toHaveBeenCalledTimes(1)
    expect(mocks.ScrollTrigger.batch).toHaveBeenCalledTimes(1)
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

  it('settles incomplete images on errors', async () => {
    const root = document.createElement('div')
    const image = document.createElement('img')
    Object.defineProperty(image, 'complete', { configurable: true, value: false })
    root.append(image)

    const settling = waitForRootAssets(root)
    image.dispatchEvent(new Event('error'))

    await expect(settling).resolves.toBeUndefined()
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
