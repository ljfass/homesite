import { describe, expect, it } from 'vitest'
import globalStyles from '../styles/global.css?inline'
import tokens from '../styles/tokens.css?inline'

describe('homepage visual system', () => {
  it('uses separate display and body font tokens', () => {
    expect(tokens).toContain("--font-display: 'JetBrains Mono Variable'")
    expect(tokens).toContain("--font-body: 'PingFang SC'")
    expect(globalStyles).toMatch(/body\s*{[^}]*font-family: var\(--font-body\);/s)
    expect(globalStyles).toMatch(/\.display-type\s*{[^}]*font-family: var\(--font-display\);/s)
  })

  it('keeps desktop story chapters narrower than the viewport', () => {
    expect(globalStyles).toContain('width: min(82vw, 1080px);')
    expect(globalStyles).toContain('flex: 0 0 min(82vw, 1080px);')
  })

  it('lets mobile and reduced-motion chapters use natural document height', () => {
    expect(globalStyles).toMatch(
      /@media \(max-width: 767px\), \(prefers-reduced-motion: reduce\)[\s\S]*?\.story-stage \.story-panel\s*{[^}]*width: 100%;[^}]*min-height: auto;/,
    )
  })
})
