import { describe, expect, it } from 'vitest'
import globalStyles from '../styles/global.css?inline'
import tokens from '../styles/tokens.css?inline'

function getHexToken(name: string): string {
  const match = tokens.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6});`, 'i'))
  expect(match, `Missing --${name} color token`).not.toBeNull()
  return match?.[1] ?? '#000000'
}

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  )

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

function contrastRatio(first: string, second: string): number {
  const firstLuminance = relativeLuminance(first)
  const secondLuminance = relativeLuminance(second)
  const lighter = Math.max(firstLuminance, secondLuminance)
  const darker = Math.min(firstLuminance, secondLuminance)

  return (lighter + 0.05) / (darker + 0.05)
}

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

  it('uses a WCAG AA dark accent without styling single-item labels as values', () => {
    expect(contrastRatio(getHexToken('color-coral-on-light'), getHexToken('color-paper'))).toBeGreaterThanOrEqual(4.5)
    expect(globalStyles).not.toContain('.status-list li span:last-child')
    expect(globalStyles).toMatch(/\.status-list li span \+ span\s*{[^}]*color: var\(--color-coral\);/s)
    expect(globalStyles).toMatch(
      /\.story-panel\[data-chapter='01'\] \.chapter-label,[\s\S]*?\.story-panel\[data-chapter='03'\] \.status-list li span \+ span\s*{[^}]*color: var\(--color-coral-on-light\);/,
    )
  })

  it('uses mutually exclusive desktop and compact height boundaries', () => {
    expect(tokens).toContain('@media (min-width: 768px) and (min-height: 600px)')
    expect(globalStyles).toContain('@media (min-width: 768px) and (min-height: 600px)')
    expect(globalStyles).toContain('@media (min-width: 1200px) and (min-height: 600px)')
    expect(globalStyles).not.toContain('@media (min-width: 768px) {')
    expect(globalStyles).not.toContain('@media (min-width: 1200px) {')
  })

  it('lets compact and reduced-motion chapters use natural document height', () => {
    expect(globalStyles).toMatch(
      /@media \(max-width: 767px\), \(max-height: 599px\), \(prefers-reduced-motion: reduce\)[\s\S]*?\.story-stage \.story-panel\s*{[^}]*width: 100%;[^}]*min-height: auto;/,
    )
  })
})
