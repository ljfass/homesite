import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  gsap: { registerPlugin: vi.fn() },
  ScrollTrigger: { name: 'ScrollTrigger' },
  SplitText: { name: 'SplitText' },
  ScrambleTextPlugin: { name: 'ScrambleTextPlugin' },
}))

vi.mock('gsap', () => ({ default: mocks.gsap }))
vi.mock('gsap/ScrollTrigger', () => ({ default: mocks.ScrollTrigger }))
vi.mock('gsap/SplitText', () => ({ default: mocks.SplitText }))
vi.mock('gsap/ScrambleTextPlugin', () => ({ default: mocks.ScrambleTextPlugin }))

describe('shared GSAP boundary', () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.gsap.registerPlugin.mockClear()
  })

  it('registers and exports every homepage plugin', async () => {
    const module = await import('../lib/gsap')

    expect(mocks.gsap.registerPlugin).toHaveBeenCalledWith(
      mocks.ScrollTrigger,
      mocks.SplitText,
      mocks.ScrambleTextPlugin,
    )
    expect(module).toMatchObject({
      gsap: mocks.gsap,
      ScrollTrigger: mocks.ScrollTrigger,
      SplitText: mocks.SplitText,
      ScrambleTextPlugin: mocks.ScrambleTextPlugin,
    })
  })
})
