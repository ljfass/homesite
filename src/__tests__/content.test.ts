import { describe, expect, it } from 'vitest'
import { homeContent } from '../content/home'

describe('home content', () => {
  it('defines the three stories in order', () => {
    expect(homeContent.story.map((story) => story.index)).toEqual(['01', '02', '03'])
  })

  it('uses unique story IDs', () => {
    expect(new Set(homeContent.story.map((story) => story.id)).size).toBe(homeContent.story.length)
  })

  it('does not define an ICP number', () => {
    expect(homeContent.site.icpNumber).toBeNull()
  })

  it('identifies the homepage', () => {
    expect(homeContent.site.title).toBe('Hello World')
    expect(homeContent.site.domain).toBe('huangjianfen.cn')
  })
})
