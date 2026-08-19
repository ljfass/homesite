import { onBeforeUnmount, onMounted, type Ref } from 'vue'
import { gsap, ScrollTrigger } from '../lib/gsap'
import { getChapterFromProgress, getHorizontalTravel } from '../lib/motion'

type MotionUpdate = (progress: number, chapter: string) => void

export function useHomeMotion(root: Ref<HTMLElement | null>, onMotionUpdate: MotionUpdate): void {
  let media: gsap.MatchMedia | undefined
  let disposed = false

  onMounted(async () => {
    const scope = root.value
    if (!scope) {
      return
    }

    await document.fonts?.ready
    if (disposed || !window.matchMedia) {
      return
    }

    media = gsap.matchMedia()
    media.add(
      {
        desktop: '(min-width: 768px)',
        mobile: '(max-width: 767px)',
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

            if (travel() > 0) {
              gsap.to(track, {
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
        }

        if (mobile) {
          const panels = scope.querySelectorAll<HTMLElement>('[data-story-panel]')

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
        }

        ScrollTrigger.refresh()
      },
      scope,
    )
  })

  onBeforeUnmount(() => {
    disposed = true
    media?.revert()
  })
}
