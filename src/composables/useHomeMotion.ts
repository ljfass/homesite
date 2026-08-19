import { onBeforeUnmount, onMounted, type Ref } from 'vue'
import { gsap, ScrollTrigger } from '../lib/gsap'
import { getChapterFromProgress, getHorizontalTravel } from '../lib/motion'

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

        if (desktop) {
          const lines = scope.querySelectorAll<HTMLElement>('[data-hero-line]')
          const copy = scope.querySelectorAll<HTMLElement>('[data-hero-copy]')
          const signal = scope.querySelector<HTMLElement>('[data-signal-visual]')

          const entrance = gsap.timeline({
            defaults: { duration: 0.6, ease: 'power2.out' },
          })

          entrance
            .from(lines, { yPercent: 100, autoAlpha: 0, stagger: 0.08 })
            .from(copy, { yPercent: 36, autoAlpha: 0, stagger: 0.06 }, '<0.12')

          if (signal) {
            entrance.from(signal, { scale: 0.9, autoAlpha: 0 }, '<0.1')
          }

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
                      onMotionUpdate(self.progress, getChapterFromProgress(self.progress))
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

            return () => {
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
          const panels = scope.querySelectorAll<HTMLElement>('[data-story-panel]')
          const chapters = scope.querySelectorAll<HTMLElement>('[data-chapter]')

          if (panels.length > 0) {
            ScrollTrigger.batch(panels, {
              start: 'top 82%',
              once: true,
              onEnter: (elements) => {
                gsap.from(elements, {
                  y: 32,
                  autoAlpha: 0,
                  stagger: 0.06,
                  duration: 0.45,
                  ease: 'power2.out',
                  overwrite: 'auto',
                })
              },
            })
          }

          chapters.forEach((section) => {
            const updateChapter = () => reportMobileChapter(section.dataset.chapter, onMotionUpdate)

            ScrollTrigger.create({
              trigger: section,
              start: 'top 55%',
              end: 'bottom 45%',
              onEnter: updateChapter,
              onEnterBack: updateChapter,
            })
          })
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
