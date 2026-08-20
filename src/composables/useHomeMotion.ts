import { onBeforeUnmount, onMounted, type Ref } from 'vue'
import { gsap, ScrollTrigger } from '../lib/gsap'
import { getChapterFromProgress, getHorizontalTravel, getMotionMode, type MotionMode } from '../lib/motion'
import { createTextMotion, type TextMotionController } from '../lib/textMotion'

type MotionUpdate = (progress: number, chapter: string) => void

type ReadingState = {
  progress: number
  chapter: string
  horizontalProgress?: number
}

type ReadingSnapshot = ReadingState & {
  mode: MotionMode
  anchor?: HTMLElement
  anchorOffset: number
}

type MatchMediaEventSource = {
  addEventListener: (event: 'matchMediaInit' | 'matchMedia', listener: () => void) => void
  removeEventListener: (event: 'matchMediaInit' | 'matchMedia', listener: () => void) => void
}

type RootAssetWaitOptions = {
  signal?: AbortSignal
  timeoutMs?: number
}

const assetTimeoutMs = 4_000

function waitForImage(image: HTMLImageElement, { signal, timeoutMs }: Required<RootAssetWaitOptions>): Promise<void> {
  return new Promise((resolve) => {
    let settled = false
    const settle = () => {
      if (settled) {
        return
      }

      settled = true
      window.clearTimeout(timeout)
      image.removeEventListener('load', settle)
      image.removeEventListener('error', settle)
      signal.removeEventListener('abort', settle)
      resolve()
    }

    image.addEventListener('load', settle)
    image.addEventListener('error', settle)
    signal.addEventListener('abort', settle, { once: true })
    const timeout = window.setTimeout(settle, timeoutMs)

    if (signal.aborted) {
      settle()
      return
    }

    if (image.complete) {
      void Promise.resolve()
        .then(() => image.decode?.())
        .then(settle, settle)
    }
  })
}

export function waitForRootAssets(root: HTMLElement, options: RootAssetWaitOptions = {}): Promise<void> {
  const controller = new AbortController()
  const signal = options.signal ?? controller.signal
  const timeoutMs = options.timeoutMs ?? assetTimeoutMs

  return Promise.all(
    Array.from(root.querySelectorAll('img'), (image) => waitForImage(image, { signal, timeoutMs })),
  ).then(() => undefined)
}

function getMobileReadingState(chapter: string | undefined): ReadingState {
  const index = Number(chapter)
  if (!Number.isFinite(index)) {
    return { progress: 0, chapter: '00' }
  }

  const clamped = Math.min(Math.max(Math.round(index), 0), 4)
  return { progress: clamped / 4, chapter: String(clamped).padStart(2, '0') }
}

function clampProgress(progress: number): number {
  return Math.min(Math.max(Number.isFinite(progress) ? progress : 0, 0), 1)
}

function getHorizontalProgressForChapter(chapter: string): number {
  const chapterIndex = Number(chapter)
  if (!Number.isFinite(chapterIndex) || chapterIndex <= 0) {
    return 0
  }

  return clampProgress((Math.min(Math.round(chapterIndex), 4) - 0.5) / 4)
}

export function useHomeMotion(root: Ref<HTMLElement | null>, onMotionUpdate: MotionUpdate): void {
  let media: gsap.MatchMedia | undefined
  const matchMediaEvents = gsap as typeof gsap & MatchMediaEventSource
  let assetAbortController: AbortController | undefined
  let reducedMotionMedia: MediaQueryList | undefined
  let reducedMotionListener: ((event: MediaQueryListEvent) => void) | undefined
  let matchMediaInitListener: (() => void) | undefined
  let matchMediaListener: (() => void) | undefined
  let scrollPositionListener: (() => void) | undefined
  let readingPositionFrame: number | undefined
  let restorationFrame: number | undefined
  let restorationToken = 0
  let savedScrollY = 0
  let lastReadingState: ReadingState = { progress: 0, chapter: '00' }
  let lastReadingAnchor: HTMLElement | undefined
  let lastReadingAnchorOffset = 0
  let mediaChangeSnapshot: ReadingSnapshot | undefined
  let matchMediaTransitionActive = false
  let preferenceRestorationPending = false
  let disposed = false

  onMounted(async () => {
    const scope = root.value
    if (!scope) {
      return
    }

    const chapterElements = new Map<string, HTMLElement>()
    const captureReadingPosition = (force = false) => {
      if (!force && (matchMediaTransitionActive || preferenceRestorationPending)) {
        return
      }

      savedScrollY = window.scrollY
      if (lastReadingAnchor?.isConnected) {
        lastReadingAnchorOffset = lastReadingAnchor.getBoundingClientRect().top
      }
    }
    const scheduleReadingPositionCapture = () => {
      if (matchMediaTransitionActive || preferenceRestorationPending || readingPositionFrame !== undefined) {
        return
      }

      readingPositionFrame = requestAnimationFrame(() => {
        readingPositionFrame = undefined
        captureReadingPosition()
      })
    }
    const flushReadingPosition = () => {
      if (readingPositionFrame !== undefined) {
        cancelAnimationFrame(readingPositionFrame)
        readingPositionFrame = undefined
      }
      captureReadingPosition(true)
    }

    savedScrollY = window.scrollY
    scrollPositionListener = scheduleReadingPositionCapture
    window.addEventListener('scroll', scrollPositionListener, { passive: true })

    assetAbortController = new AbortController()
    await Promise.all([
      document.fonts?.ready,
      waitForRootAssets(scope, { signal: assetAbortController.signal }),
    ])
    if (disposed || !window.matchMedia) {
      return
    }

    scope.querySelectorAll<HTMLElement>('[data-chapter]').forEach((chapterElement) => {
      const chapter = chapterElement.dataset.chapter
      if (chapter && !chapterElements.has(chapter)) {
        chapterElements.set(chapter, chapterElement)
      }
    })
    lastReadingAnchor = chapterElements.get('00')
    captureReadingPosition()

    media = gsap.matchMedia()
    let textMotion: TextMotionController | undefined
    let activeMotionMode: MotionMode = 'vertical'
    let activeHorizontalTween: gsap.core.Tween | undefined
    const reportReadingState = (progress: number, chapter: string, horizontalProgress?: number) => {
      if (disposed || matchMediaTransitionActive || preferenceRestorationPending) {
        return
      }

      const chapterChanged = lastReadingState.chapter !== chapter
      lastReadingState = { progress, chapter, horizontalProgress }
      if (chapterChanged) {
        lastReadingAnchor = chapterElements.get(chapter)
        scheduleReadingPositionCapture()
      }
      onMotionUpdate(progress, chapter)
      textMotion?.playChapter(chapter)
    }
    const createReadingSnapshot = (): ReadingSnapshot => {
      return {
        progress: lastReadingState.progress,
        chapter: lastReadingState.chapter,
        horizontalProgress: lastReadingState.horizontalProgress,
        mode: activeMotionMode,
        anchor: lastReadingAnchor,
        anchorOffset: lastReadingAnchorOffset,
      }
    }
    const scheduleReadingRestoration = () => {
      preferenceRestorationPending = true
      const token = ++restorationToken
      if (restorationFrame !== undefined) {
        cancelAnimationFrame(restorationFrame)
      }

      restorationFrame = requestAnimationFrame(() => {
        restorationFrame = requestAnimationFrame(() => {
          restorationFrame = undefined
          if (disposed || token !== restorationToken) {
            return
          }

          ScrollTrigger.refresh()
          const snapshot = mediaChangeSnapshot ?? createReadingSnapshot()
          const horizontalProgress =
            snapshot.horizontalProgress ??
            (snapshot.mode === 'horizontal'
              ? clampProgress(snapshot.progress)
              : getHorizontalProgressForChapter(snapshot.chapter))
          const mobileReadingState = getMobileReadingState(snapshot.chapter)
          const restoredReadingState: ReadingState =
            activeMotionMode === 'horizontal' && snapshot.chapter !== '00'
              ? { progress: horizontalProgress, chapter: snapshot.chapter, horizontalProgress }
              : { ...mobileReadingState, horizontalProgress: snapshot.horizontalProgress }
          const horizontalTrigger = activeHorizontalTween?.scrollTrigger
          const horizontalTravel = horizontalTrigger ? horizontalTrigger.end - horizontalTrigger.start : 0
          const restoredAnchor = chapterElements.get(restoredReadingState.chapter) ?? snapshot.anchor
          const anchorScrollY = restoredAnchor?.isConnected
            ? Math.max(0, restoredAnchor.getBoundingClientRect().top + window.scrollY - snapshot.anchorOffset)
            : savedScrollY
          const restoredScrollY =
            activeMotionMode === 'horizontal' && snapshot.chapter !== '00' && horizontalTrigger && horizontalTravel > 0
              ? horizontalTrigger.start + horizontalProgress * horizontalTravel
              : anchorScrollY
          lastReadingState = restoredReadingState
          lastReadingAnchor = restoredAnchor
          lastReadingAnchorOffset = snapshot.anchorOffset
          savedScrollY = restoredScrollY
          const documentStyle = document.documentElement.style
          const previousScrollBehavior = documentStyle.scrollBehavior
          documentStyle.scrollBehavior = 'auto'
          try {
            window.scrollTo({ top: restoredScrollY, behavior: 'auto' })
          } finally {
            documentStyle.scrollBehavior = previousScrollBehavior
          }
          ScrollTrigger.update()
          onMotionUpdate(restoredReadingState.progress, restoredReadingState.chapter)
          textMotion?.playChapter(restoredReadingState.chapter)
          matchMediaTransitionActive = false
          preferenceRestorationPending = false
          mediaChangeSnapshot = undefined
          scheduleReadingPositionCapture()
        })
      })
    }
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
    media.add(
      {
        desktop: '(min-width: 768px) and (min-height: 600px)',
        mobile: '(max-width: 767px), (max-height: 599px)',
        reduceMotion: '(prefers-reduced-motion: reduce)',
      },
      (context) => {
        const conditions = context.conditions ?? {}
        const desktop = conditions.desktop === true
        const mobile = conditions.mobile === true
        const reduceMotion = conditions.reduceMotion === true
        activeMotionMode = getMotionMode({ desktop, reduced: reduceMotion })

        let cleanupHorizontal: (() => void) | undefined
        let signalTween: gsap.core.Tween | undefined

        if (reduceMotion) {
          reportReadingState(0, '00')
        }

        if (desktop && !reduceMotion) {
          const signal = scope.querySelector<HTMLElement>('[data-signal-visual]')
          signalTween = signal
            ? gsap.from(signal, { scale: 0.9, autoAlpha: 0, duration: 0.6, ease: 'power2.out' })
            : undefined

          const stage = scope.querySelector<HTMLElement>('[data-story-stage]')
          const track = scope.querySelector<HTMLElement>('[data-story-track]')

          if (stage && track) {
            const travel = () => getHorizontalTravel(track.scrollWidth, stage.clientWidth || window.innerWidth)
            let horizontalTween: gsap.core.Tween | undefined
            let resizeFrame: number | undefined
            let resizeObserver: ResizeObserver | undefined

            const resetHorizontalTween = () => {
              const tween = horizontalTween
              tween?.kill()
              horizontalTween = undefined
              if (activeHorizontalTween === tween) {
                activeHorizontalTween = undefined
              }
              gsap.set(track, { x: 0 })
              reportReadingState(0, '00')
            }

            const syncHorizontalTween = () => {
              if (travel() <= 0) {
                if (horizontalTween) {
                  resetHorizontalTween()
                }
                return
              }

              if (!horizontalTween) {
                horizontalTween = gsap.to(track, {
                  x: () => -travel(),
                  ease: 'none',
                  scrollTrigger: {
                    trigger: stage,
                    start: 'top top',
                    end: () => `+=${travel()}`,
                    pin: true,
                    scrub: 0.8,
                    invalidateOnRefresh: true,
                    anticipatePin: 1,
                    onUpdate: (self) => {
                      const chapter = getChapterFromProgress(self.progress)
                      reportReadingState(self.progress, chapter, self.progress)
                    },
                  },
                })
                activeHorizontalTween = horizontalTween
              }
            }

            syncHorizontalTween()

            if (typeof ResizeObserver !== 'undefined') {
              resizeObserver = new ResizeObserver(() => {
                if (resizeFrame !== undefined) {
                  return
                }

                resizeFrame = requestAnimationFrame(() => {
                  resizeFrame = undefined
                  syncHorizontalTween()
                  ScrollTrigger.refresh()
                })
              })
              resizeObserver.observe(stage)
              resizeObserver.observe(track)
            }

            cleanupHorizontal = () => {
              if (resizeFrame !== undefined) {
                cancelAnimationFrame(resizeFrame)
              }
              resizeObserver?.disconnect()
              if (horizontalTween) {
                resetHorizontalTween()
              }
            }
          }
        }

        if (mobile || reduceMotion) {
          chapterElements.forEach((section) => {
            const updateChapter = () => {
              const readingState = getMobileReadingState(section.dataset.chapter)
              reportReadingState(readingState.progress, readingState.chapter)
            }

            ScrollTrigger.create({
              trigger: section,
              start: 'top 55%',
              end: 'bottom 45%',
              onEnter: updateChapter,
              onEnterBack: updateChapter,
            })
          })
        }

        return () => {
          cleanupHorizontal?.()
          signalTween?.kill()
        }
      },
      scope,
    )
    ScrollTrigger.refresh()
    matchMediaInitListener = () => {
      if (!mediaChangeSnapshot) {
        flushReadingPosition()
        mediaChangeSnapshot = createReadingSnapshot()
      }
      matchMediaTransitionActive = true
      preferenceRestorationPending = true
    }
    matchMediaListener = () => {
      scheduleReadingRestoration()
    }
    matchMediaEvents.addEventListener('matchMediaInit', matchMediaInitListener)
    matchMediaEvents.addEventListener('matchMedia', matchMediaListener)
    reducedMotionMedia = window.matchMedia('(prefers-reduced-motion: reduce)')
    reducedMotionListener = scheduleReadingRestoration
    reducedMotionMedia.addEventListener('change', reducedMotionListener)
  })

  onBeforeUnmount(() => {
    disposed = true
    assetAbortController?.abort()
    restorationToken += 1
    if (readingPositionFrame !== undefined) {
      cancelAnimationFrame(readingPositionFrame)
    }
    if (restorationFrame !== undefined) {
      cancelAnimationFrame(restorationFrame)
    }
    if (scrollPositionListener) {
      window.removeEventListener('scroll', scrollPositionListener)
    }
    if (reducedMotionMedia && reducedMotionListener) {
      reducedMotionMedia.removeEventListener('change', reducedMotionListener)
    }
    if (matchMediaInitListener) {
      matchMediaEvents.removeEventListener('matchMediaInit', matchMediaInitListener)
    }
    if (matchMediaListener) {
      matchMediaEvents.removeEventListener('matchMedia', matchMediaListener)
    }
    media?.revert()
  })
}
