import { describe, expect, it } from 'vitest'
import { getChapterFromProgress, getHorizontalTravel, getMotionMode } from '../lib/motion'

describe('motion helpers', () => {
  it('selects the accessible motion mode for the viewport and preference', () => {
    expect(getMotionMode({ desktop: true, reduced: true })).toBe('static')
    expect(getMotionMode({ desktop: true, reduced: false })).toBe('horizontal')
    expect(getMotionMode({ desktop: false, reduced: false })).toBe('vertical')
  })

  it('calculates horizontal travel without allowing negative distances', () => {
    expect(getHorizontalTravel(1600, 1000)).toBe(600)
    expect(getHorizontalTravel(800, 1000)).toBe(0)
    expect(getHorizontalTravel(-100, 1000)).toBe(0)
  })

  it('maps clamped progress values onto the four story chapters', () => {
    expect(getChapterFromProgress(0)).toBe('01')
    expect(getChapterFromProgress(0.249)).toBe('01')
    expect(getChapterFromProgress(0.25)).toBe('02')
    expect(getChapterFromProgress(0.499)).toBe('02')
    expect(getChapterFromProgress(0.5)).toBe('03')
    expect(getChapterFromProgress(0.75)).toBe('04')
    expect(getChapterFromProgress(1)).toBe('04')
    expect(getChapterFromProgress(-1)).toBe('01')
    expect(getChapterFromProgress(2)).toBe('04')
    expect(getChapterFromProgress(Number.NaN)).toBe('01')
  })
})
