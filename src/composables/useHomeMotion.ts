import { onBeforeUnmount, onMounted, type Ref } from 'vue'
import { gsap, ScrollTrigger } from '../lib/gsap'
import { getChapterFromProgress, getHorizontalTravel } from '../lib/motion'
import { createTextMotion, type TextMotionController } from '../lib/textMotion'

type MotionUpdate = (progress: number, chapter: string) => void

type ReadingState = {
  progress: number
  chapter: string
}

type ReadingSnapshot = ReadingState & {
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

export function useHomeMotion(root: Ref<HTMLElement | null>, onMotionUpdate: MotionUpdate): void {
  let media: gsap.MatchMedia | undefined
  const matchMediaEvents = gsap as typeof gsap & MatchMediaEventSource
  let assetAbortController: AbortController | undefined
  let reducedMotionMedia: MediaQueryList | undefined
  let reducedMotionListener: ((event: MediaQueryListEvent) => void) | undefined
  let matchMediaInitListener: (() => void) | undefined
  let matchMediaListener: (() => void) | undefined
  let scrollPositionListener: (() => void) | undefined
  let restorationFrame: number | undefined
  let matchMediaTransitionFrame: number | undefined
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

    savedScrollY = window.scrollY
    lastReadingAnchor = scope.querySelector<HTMLElement>('[data-chapter="00"]') ?? undefined
    lastReadingAnchorOffset = lastReadingAnchor?.getBoundingClientRect().top ?? 0
    scrollPositionListener = () => {
      if (matchMediaTransitionActive || preferenceRestorationPending) {
        return
      }

      savedScrollY = window.scrollY
      if (lastReadingAnchor?.isConnected) {
        lastReadingAnchorOffset = lastReadingAnchor.getBoundingClientRect().top
      }
    }
    window.addEventListener('scroll', scrollPositionListener, { passive: true })

    assetAbortController = new AbortController()
    await Promise.all([
      document.fonts?.ready,
      waitForRootAssets(scope, { signal: assetAbortController.signal }),
    ])
    if (disposed || !window.matchMedia) {
      return
    }

    media = gsap.matchMedia()
    let textMotion: TextMotionController | undefined
    const reportReadingState = (progress: number, chapter: string) => {
      if (matchMediaTransitionActive || preferenceRestorationPending) {
        return
      }

      lastReadingState = { progress, chapter }
      const anchor = scope.querySelector<HTMLElement>(`[data-chapter="${chapter}"]`)
      if (anchor) {
        lastReadingAnchor = anchor
        lastReadingAnchorOffset = anchor.getBoundingClientRect().top
      }
      onMotionUpdate(progress, chapter)
      textMotion?.playChapter(chapter)
    }
    const scheduleReadingRestoration = () => {
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

          const snapshot = mediaChangeSnapshot ?? {
            progress: lastReadingState.progress,
            chapter: lastReadingState.chapter,
            anchor: lastReadingAnchor,
            anchorOffset: lastReadingAnchorOffset,
          }
          const anchorScrollY = snapshot.anchor?.isConnected
            ? Math.max(0, snapshot.anchor.getBoundingClientRect().top + window.scrollY - snapshot.anchorOffset)
            : savedScrollY
          lastReadingState = { progress: snapshot.progress, chapter: snapshot.chapter }
          lastReadingAnchor = snapshot.anchor
          lastReadingAnchorOffset = snapshot.anchorOffset
          window.scrollTo({ top: anchorScrollY, behavior: 'auto' })
          ScrollTrigger.update()
          onMotionUpdate(snapshot.progress, snapshot.chapter)
          textMotion?.playChapter(snapshot.chapter)
          preferenceRestorationPending = false
          mediaChangeSnapshot = undefined
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

        if (reduceMotion) {
          reportReadingState(0, '00')
          return
        }

        let cleanupHorizontal: (() => void) | undefined
        let signalTween: gsap.core.Tween | undefined

        if (desktop) {
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
              horizontalTween?.kill()
              horizontalTween = undefined
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
                      reportReadingState(self.progress, chapter)
                    },
                  },
                })
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

        if (mobile) {
          const chapters = scope.querySelectorAll<HTMLElement>('[data-chapter]')

          chapters.forEach((section) => {
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
      if (!matchMediaTransitionActive) {
        mediaChangeSnapshot = {
          progress: lastReadingState.progress,
          chapter: lastReadingState.chapter,
          anchor: lastReadingAnchor,
          anchorOffset: lastReadingAnchorOffset,
        }
      }
      matchMediaTransitionActive = true
    }
    matchMediaListener = () => {
      if (matchMediaTransitionFrame !== undefined) {
        cancelAnimationFrame(matchMediaTransitionFrame)
      }
      matchMediaTransitionFrame = requestAnimationFrame(() => {
        matchMediaTransitionFrame = undefined
        matchMediaTransitionActive = false
      })
    }
    matchMediaEvents.addEventListener('matchMediaInit', matchMediaInitListener)
    matchMediaEvents.addEventListener('matchMedia', matchMediaListener)
    reducedMotionMedia = window.matchMedia('(prefers-reduced-motion: reduce)')
    reducedMotionListener = () => {
      preferenceRestorationPending = true
      scheduleReadingRestoration()
    }
    reducedMotionMedia.addEventListener('change', reducedMotionListener)
  })

  onBeforeUnmount(() => {
    disposed = true
    assetAbortController?.abort()
    restorationToken += 1
    if (restorationFrame !== undefined) {
      cancelAnimationFrame(restorationFrame)
    }
    if (matchMediaTransitionFrame !== undefined) {
      cancelAnimationFrame(matchMediaTransitionFrame)
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
