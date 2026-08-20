import { onBeforeUnmount, onMounted, type Ref } from 'vue'
import { gsap, ScrollTrigger } from '../lib/gsap'
import { getChapterFromProgress, getHorizontalTravel } from '../lib/motion'
import { createTextMotion, type TextMotionController } from '../lib/textMotion'

type MotionUpdate = (progress: number, chapter: string) => void

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

function reportMobileChapter(chapter: string | undefined, onMotionUpdate: MotionUpdate): void {
  const index = Number(chapter)
  if (!Number.isFinite(index)) {
    onMotionUpdate(0, '00')
    return
  }

  const clamped = Math.min(Math.max(Math.round(index), 0), 4)
  onMotionUpdate(clamped / 4, String(clamped).padStart(2, '0'))
}

export function useHomeMotion(root: Ref<HTMLElement | null>, onMotionUpdate: MotionUpdate): void {
  let media: gsap.MatchMedia | undefined
  let assetAbortController: AbortController | undefined
  let disposed = false

  onMounted(async () => {
    const scope = root.value
    if (!scope) {
      return
    }

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
          onMotionUpdate(0, '00')
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
              onMotionUpdate(0, '00')
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
                      onMotionUpdate(self.progress, chapter)
                      textMotion?.playChapter(chapter)
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
              const chapter = section.dataset.chapter
              reportMobileChapter(chapter, onMotionUpdate)
              if (chapter) textMotion?.playChapter(chapter)
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
  })

  onBeforeUnmount(() => {
    disposed = true
    assetAbortController?.abort()
    media?.revert()
  })
}
