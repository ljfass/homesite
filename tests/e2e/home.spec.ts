import { expect, test as base, type Locator, type Page } from '@playwright/test'

const test = base.extend<{ runtimeErrors: void }>({
  runtimeErrors: [
    async ({ page }, use) => {
      const errors: string[] = []

      page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
      page.on('console', (message) => {
        if (message.type() === 'error') {
          errors.push(`console.error: ${message.text()}`)
        }
      })

      await use()
      expect(errors, 'the page should not emit runtime errors').toEqual([])
    },
    { auto: true },
  ],
})

async function openHomepage(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('h1')).toHaveCount(1)
  await expect(page.getByRole('heading', { level: 1, name: /Hello\s+World/ })).toBeVisible()
  await page.evaluate(async () => {
    await document.fonts?.ready
  })
  await expect
    .poll(() => page.locator('[data-signal-visual]').evaluate((image: HTMLImageElement) => image.complete))
    .toBe(true)
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth
    return Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - viewportWidth
  })

  expect(overflow, 'the document should fit the viewport width').toBeLessThanOrEqual(1)
}

async function expectElementsWithinViewport(page: Page, locator: Locator): Promise<void> {
  const failures = await locator.evaluateAll((elements) => {
    const viewportWidth = document.documentElement.clientWidth

    return elements.flatMap((element, index) => {
      const rectangle = element.getBoundingClientRect()
      const clipped = rectangle.left < -1 || rectangle.right > viewportWidth + 1

      return clipped
        ? [{ index, left: Math.round(rectangle.left), right: Math.round(rectangle.right), viewportWidth }]
        : []
    })
  })

  expect(failures, 'key content should remain inside the viewport').toEqual([])
}

async function expectVerticalFallback(page: Page): Promise<void> {
  await expect(page.locator('.pin-spacer')).toHaveCount(0)
  await expect
    .poll(() =>
      page.locator('[data-story-stage]').evaluate((stage) => {
        const styles = getComputedStyle(stage)
        return `${styles.position}:${styles.height}`
      }),
    )
    .not.toMatch(/^fixed:/)
  await expect
    .poll(() => page.locator('[data-story-track]').evaluate((track) => getComputedStyle(track).transform))
    .toBe('none')

  const chapters = page.locator('[data-chapter]')
  await expect(chapters).toHaveCount(5)

  const chapterTops = await chapters.evaluateAll((sections) =>
    sections.map((section) => section.getBoundingClientRect().top + window.scrollY),
  )
  expect(chapterTops).toEqual([...chapterTops].sort((left, right) => left - right))
  expect(new Set(chapterTops).size).toBe(chapterTops.length)
}

async function reachEveryChapter(page: Page): Promise<void> {
  const chapters = page.locator('[data-chapter]')

  for (let index = 0; index < (await chapters.count()); index += 1) {
    const chapter = chapters.nth(index)
    await chapter.evaluate((section) => section.scrollIntoView({ block: 'center' }))
    await expect(chapter).toBeInViewport({ ratio: 0.1 })
  }
}

async function expectBackToTop(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' })
  })
  const button = page.locator('[data-back-to-top]')
  await expect(button).toBeVisible()
  await button.click()
  await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 8_000 }).toBeLessThan(2)
}

async function expectChapterTextVisible(page: Page, chapter: string): Promise<void> {
  await expect
    .poll(
      () =>
        page.locator(`[data-chapter="${chapter}"]`).evaluate((section) =>
          Array.from(section.querySelectorAll<HTMLElement>('[data-text-title], [data-text-copy], [data-text-command]')).every(
            (element) => {
              const styles = getComputedStyle(element)
              return styles.visibility !== 'hidden' && Number(styles.opacity) > 0.98 && element.getClientRects().length > 0
            },
          ),
        ),
      { timeout: 8_000 },
    )
    .toBe(true)
}

async function expectChapterInViewport(page: Page, chapter: string): Promise<void> {
  await expect
    .poll(
      () =>
        page.locator(`[data-chapter="${chapter}"]`).evaluate((section) => {
          const rectangle = section.getBoundingClientRect()
          return (
            rectangle.right > 0 &&
            rectangle.left < document.documentElement.clientWidth &&
            rectangle.bottom > 0 &&
            rectangle.top < window.innerHeight
          )
        }),
      { timeout: 8_000 },
    )
    .toBe(true)
}

async function getTrackX(page: Page): Promise<number> {
  return page.locator('[data-story-track]').evaluate((element) => {
    const transform = getComputedStyle(element).transform
    return transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m41
  })
}

async function waitForAnimationFrames(page: Page, count = 2): Promise<void> {
  await page.evaluate(
    (frameCount) =>
      new Promise<void>((resolve) => {
        const advance = (remaining: number) => {
          if (remaining <= 0) {
            resolve()
            return
          }
          requestAnimationFrame(() => advance(remaining - 1))
        }
        advance(frameCount)
      }),
    count,
  )
}

test('desktop renders the hero and drives the horizontal story from scroll', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'desktop-only behavior')
  await openHomepage(page)

  await expect(page).toHaveTitle('Hello World')
  const signal = page.locator('[data-signal-visual]')
  const imageMetrics = await signal.evaluate((image: HTMLImageElement) => {
    const rectangle = image.getBoundingClientRect()
    return {
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      width: rectangle.width,
      height: rectangle.height,
    }
  })
  expect(imageMetrics.naturalWidth).toBeGreaterThan(0)
  expect(imageMetrics.naturalHeight).toBeGreaterThan(0)
  expect(imageMetrics.width).toBeGreaterThan(0)
  expect(imageMetrics.height).toBeGreaterThan(0)

  const stage = page.locator('[data-story-stage]')
  const stageAtEntry = await stage.boundingBox()
  expect(stageAtEntry).not.toBeNull()
  expect(stageAtEntry!.y, 'the next section should peek into the initial viewport').toBeLessThan(900)
  expect(stageAtEntry!.y + stageAtEntry!.height).toBeGreaterThan(0)
  await expect(page.locator('.pin-spacer')).toHaveCount(1)

  const storyScroll = await stage.evaluate((storyStage) => {
    const track = storyStage.querySelector<HTMLElement>('[data-story-track]')
    const start = storyStage.getBoundingClientRect().top + window.scrollY
    const travel = Math.max(0, (track?.scrollWidth ?? 0) - storyStage.clientWidth)
    return {
      middle: start + travel * 0.55,
      end: start + travel,
    }
  })
  await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), storyScroll.middle)

  const track = page.locator('[data-story-track]')
  await expect
    .poll(
      () =>
        track.evaluate((element) => {
          const transform = getComputedStyle(element).transform
          return transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m41
        }),
      { timeout: 8_000 },
    )
    .toBeLessThan(-20)

  const progress = page.getByRole('progressbar', { name: '阅读进度' })
  await expect
    .poll(() => progress.getAttribute('aria-valuenow').then((value) => Number(value)), { timeout: 8_000 })
    .toBeGreaterThan(20)
  await expect(page.locator('.site-header__chapter')).not.toHaveText('00 / 04')
  await expectNoHorizontalOverflow(page)

  await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), storyScroll.end)
  await expect
    .poll(() => progress.getAttribute('aria-valuenow').then((value) => Number(value)), { timeout: 8_000 })
    .toBeGreaterThanOrEqual(99)
  await expect(page.locator('.site-header__chapter')).toHaveText('04 / 04')

  const ending = page.getByRole('heading', { level: 2, name: /To be\s+continued\./ })
  await expect(ending).toBeVisible()
  await expect(ending).toBeInViewport({ ratio: 0.2 })
  await expectBackToTop(page)
})

test('desktop preserves horizontal progress through a runtime preference round trip', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'desktop-only behavior')
  await openHomepage(page)
  const stage = page.locator('[data-story-stage]')
  const target = await stage.evaluate((storyStage) => {
    const track = storyStage.querySelector<HTMLElement>('[data-story-track]')
    const start = storyStage.getBoundingClientRect().top + window.scrollY
    const travel = Math.max(0, (track?.scrollWidth ?? 0) - storyStage.clientWidth)
    const progress = 0.55
    return { top: start + travel * progress, trackX: -travel * progress }
  })
  await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), target.top)
  await expect(page.locator('.site-header__chapter')).toHaveText('03 / 04')
  await expect
    .poll(async () => Math.abs((await getTrackX(page)) - target.trackX), { timeout: 8_000 })
    .toBeLessThan(4)

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expectVerticalFallback(page)
  await expect(page.locator('.site-header__chapter')).toHaveText('03 / 04')
  await expectChapterInViewport(page, '03')
  await waitForAnimationFrames(page)
  await expect(page.locator('.site-header__chapter')).toHaveText('03 / 04')

  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await expect(page.locator('.pin-spacer')).toHaveCount(1)
  await expect.poll(() => page.evaluate((top) => Math.abs(window.scrollY - top), target.top), { timeout: 8_000 }).toBeLessThan(4)
  await expect(page.locator('.site-header__chapter')).toHaveText('03 / 04')
  await expectChapterInViewport(page, '03')
  await expectChapterTextVisible(page, '03')
  await expect
    .poll(async () => Math.abs((await getTrackX(page)) - target.trackX), { timeout: 8_000 })
    .toBeLessThan(4)
})

test('mobile keeps every chapter in a readable vertical flow', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'mobile-only behavior')
  await openHomepage(page)
  await expectVerticalFallback(page)
  await reachEveryChapter(page)

  const laterChapter = page.locator('[data-chapter="03"]')
  await laterChapter.evaluate((section) => section.scrollIntoView({ block: 'center' }))
  await expect
    .poll(
      () => page.getByRole('progressbar', { name: '阅读进度' }).getAttribute('aria-valuenow').then(Number),
      { timeout: 8_000 },
    )
    .toBeGreaterThanOrEqual(50)

  await expectNoHorizontalOverflow(page)
  await expectElementsWithinViewport(
    page,
    page.locator('.site-header, .hero__content, [data-story-panel] .story-panel__inner, [data-site-footer]'),
  )
  await expectBackToTop(page)
})

test('mobile preserves the active chapter when runtime motion preferences change', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'mobile-only behavior')
  await openHomepage(page)
  await expectVerticalFallback(page)

  const chapter = page.locator('[data-chapter="03"]')
  await chapter.evaluate((section) => section.scrollIntoView({ block: 'center' }))
  await expect(page.locator('.site-header__chapter')).toHaveText('03 / 04')
  await expectChapterTextVisible(page, '03')

  const initialMaskCount = await page.locator('.text-motion-line').count()
  expect(initialMaskCount).toBeGreaterThan(0)
  const chapterEntryScrollY = await page.evaluate(() => window.scrollY)
  await page.evaluate(() => window.scrollBy({ top: 160, behavior: 'instant' }))
  await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 8_000 }).toBeGreaterThan(chapterEntryScrollY + 120)
  const readingPosition = await chapter.evaluate((section) => ({
    scrollY: window.scrollY,
    chapterTop: section.getBoundingClientRect().top,
  }))

  for (let cycle = 0; cycle < 2; cycle += 1) {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect(chapter).toBeInViewport({ ratio: 0.1 })
    await expect
      .poll(
        () =>
          chapter.evaluate((section, baseline) => ({
            scrollDelta: Math.abs(window.scrollY - baseline.scrollY),
            chapterDelta: Math.abs(section.getBoundingClientRect().top - baseline.chapterTop),
          }), readingPosition),
        { timeout: 8_000 },
      )
      .toEqual({ scrollDelta: 0, chapterDelta: 0 })
    await expect(page.locator('.site-header__chapter')).toHaveText('03 / 04')
    await expect(page.locator('.text-motion-line')).toHaveCount(0)
    await expectChapterTextVisible(page, '03')

    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await expect(chapter).toBeInViewport({ ratio: 0.1 })
    await expect
      .poll(
        () =>
          chapter.evaluate((section, baseline) => ({
            scrollDelta: Math.abs(window.scrollY - baseline.scrollY),
            chapterDelta: Math.abs(section.getBoundingClientRect().top - baseline.chapterTop),
          }), readingPosition),
        { timeout: 8_000 },
      )
      .toEqual({ scrollDelta: 0, chapterDelta: 0 })
    await expect(page.locator('.site-header__chapter')).toHaveText('03 / 04')
    await expect
      .poll(() => page.locator('.text-motion-line').count(), { timeout: 8_000 })
      .toBe(initialMaskCount)
    await expectChapterTextVisible(page, '03')
  }

  await expect(page.locator('.pin-spacer')).toHaveCount(0)
  await expectNoHorizontalOverflow(page)
})

test('reduced motion keeps semantic chapter tracking before text motion returns', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'mobile-only behavior')
  await openHomepage(page)
  const chapter03 = page.locator('[data-chapter="03"]')
  const chapter04 = page.locator('[data-chapter="04"]')
  await chapter03.evaluate((section) => section.scrollIntoView({ block: 'center' }))
  await expect(page.locator('.site-header__chapter')).toHaveText('03 / 04')

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.locator('.text-motion-line')).toHaveCount(0)
  await chapter04.evaluate((section) => section.scrollIntoView({ block: 'center' }))
  await expect(page.locator('.site-header__chapter')).toHaveText('04 / 04')
  await expectChapterInViewport(page, '04')

  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await expect(page.locator('.site-header__chapter')).toHaveText('04 / 04')
  await expectChapterInViewport(page, '04')
  await expectChapterTextVisible(page, '04')
  await expect.poll(() => page.locator('.text-motion-line').count(), { timeout: 8_000 }).toBeGreaterThan(0)
})

test('responsive rebuilds retain chapter 03 across mobile and desktop layouts', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'mobile-only behavior')
  await openHomepage(page)
  const chapter = page.locator('[data-chapter="03"]')
  await chapter.evaluate((section) => section.scrollIntoView({ block: 'center' }))
  await expect(page.locator('.site-header__chapter')).toHaveText('03 / 04')
  await expectChapterTextVisible(page, '03')
  await page.evaluate(() => window.scrollBy({ top: 160, behavior: 'instant' }))
  await waitForAnimationFrames(page)
  const compactReadingPosition = await chapter.evaluate((section) => ({
    scrollY: window.scrollY,
    chapterTop: section.getBoundingClientRect().top,
  }))

  await page.setViewportSize({ width: 1_440, height: 900 })
  await expect(page.locator('.pin-spacer')).toHaveCount(1)
  await expect(page.locator('.site-header__chapter')).toHaveText('03 / 04')
  await expectChapterInViewport(page, '03')
  await expectChapterTextVisible(page, '03')
  await waitForAnimationFrames(page)

  await page.setViewportSize({ width: 390, height: 844 })
  await expectVerticalFallback(page)
  await expect(page.locator('.site-header__chapter')).toHaveText('03 / 04')
  await expectChapterInViewport(page, '03')
  await expectChapterTextVisible(page, '03')
  await expect
    .poll(
      () =>
        chapter.evaluate(
          (section, baseline) => Math.abs(section.getBoundingClientRect().top - baseline),
          compactReadingPosition.chapterTop,
        ),
      { timeout: 8_000 },
    )
    .toBeLessThan(4)
  await expect
    .poll(
      () => page.evaluate((baseline) => Math.abs(window.scrollY - baseline), compactReadingPosition.scrollY),
      { timeout: 8_000 },
    )
    .toBeLessThan(4)
})

test('short landscape uses compact vertical layout without clipped content', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'short-landscape', 'short-landscape-only behavior')
  await openHomepage(page)
  await expectVerticalFallback(page)
  await reachEveryChapter(page)
  await expect(page.getByRole('heading', { level: 2, name: /To be\s+continued\./ })).toBeVisible()

  await expectNoHorizontalOverflow(page)
  await expectElementsWithinViewport(
    page,
    page.locator(
      '.site-header, .hero__content, [data-story-panel] .story-panel__inner, .terminal-command, .status-list, [data-site-footer]',
    ),
  )
})

test('reduced motion removes pinning and uses an instant back-to-top action', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'reduced-motion', 'reduced-motion-only behavior')
  await openHomepage(page)
  await expectVerticalFallback(page)
  await reachEveryChapter(page)
  await expect(page.getByRole('heading', { level: 2, name: /To be\s+continued\./ })).toBeVisible()

  await page.evaluate(() => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' })
    const nativeScrollTo = window.scrollTo.bind(window)
    const runtimeWindow = window as Window & { __backToTopBehavior?: ScrollBehavior }

    window.scrollTo = ((optionsOrX: ScrollToOptions | number, y?: number) => {
      if (typeof optionsOrX === 'object') {
        runtimeWindow.__backToTopBehavior = optionsOrX.behavior
        nativeScrollTo(optionsOrX)
        return
      }

      nativeScrollTo(optionsOrX, y ?? 0)
    }) as typeof window.scrollTo
  })
  await page.locator('[data-back-to-top]').click()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(2)
  await expect
    .poll(() =>
      page.evaluate(() => (window as Window & { __backToTopBehavior?: ScrollBehavior }).__backToTopBehavior),
    )
    .toBe('auto')

  await expectNoHorizontalOverflow(page)
})
