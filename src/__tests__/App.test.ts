import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import App from '../App.vue'
import HorizontalStory from '../components/HorizontalStory.vue'
import SiteFooter from '../components/SiteFooter.vue'
import SiteHeader from '../components/SiteHeader.vue'
import StoryPanel from '../components/StoryPanel.vue'
import { homeContent } from '../content/home'

const wrappers: VueWrapper[] = []
const originalTitle = document.title
const originalDescription = document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content
let testDescription: HTMLMetaElement | undefined

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
  document.title = originalTitle

  if (testDescription) {
    testDescription.remove()
    testDescription = undefined
  } else {
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (description && originalDescription !== undefined) {
      description.content = originalDescription
    }
  }
})

describe('App', () => {
  it('renders the semantic homepage structure and synchronizes metadata', () => {
    if (!document.querySelector('meta[name="description"]')) {
      testDescription = document.createElement('meta')
      testDescription.name = 'description'
      document.head.append(testDescription)
    }

    const wrapper = mount(App)
    wrappers.push(wrapper)

    const headings = wrapper.findAll('h1')
    expect(headings).toHaveLength(1)
    expect(headings[0].text().replace(/\s+/g, ' ')).toContain('Hello World')
    expect(wrapper.findAll('[data-chapter]').map((chapter) => chapter.attributes('data-chapter'))).toEqual([
      '00',
      '01',
      '02',
      '03',
      '04',
    ])
    expect(wrapper.get('#ending-title').text().replace(/\s+/g, ' ')).toBe('To be continued.')
    expect(wrapper.get('a.skip-link[href="#main-content"]').text()).toBe('跳到主要内容')
    expect(wrapper.find('header').exists()).toBe(true)
    expect(wrapper.find('main#main-content').exists()).toBe(true)
    expect(wrapper.find('footer').exists()).toBe(true)
    expect(document.title).toBe(homeContent.site.title)
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(homeContent.site.description)
  })
})

describe('SiteFooter', () => {
  it('omits the ICP link when no ICP number is configured', () => {
    const wrapper = mount(SiteFooter, { props: { site: homeContent.site } })
    wrappers.push(wrapper)

    expect(wrapper.find('a[href="https://beian.miit.gov.cn/"]').exists()).toBe(false)
  })

  it('renders a safe ICP link when an ICP number is configured', () => {
    const wrapper = mount(SiteFooter, {
      props: {
        site: { ...homeContent.site, icpNumber: '粤ICP备00000000号' },
      },
    })
    wrappers.push(wrapper)

    const link = wrapper.get('a[href="https://beian.miit.gov.cn/"]')
    expect(link.text()).toBe('粤ICP备00000000号')
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toContain('noreferrer')
  })

  it('scrolls smoothly to the top when motion is not reduced', async () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
    const wrapper = mount(SiteFooter, { props: { site: homeContent.site } })
    wrappers.push(wrapper)

    await wrapper.get('[data-back-to-top]').trigger('click')

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
  })

  it('scrolls instantly to the top when reduced motion is preferred', async () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList)
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
    const wrapper = mount(SiteFooter, { props: { site: homeContent.site } })
    wrappers.push(wrapper)

    await wrapper.get('[data-back-to-top]').trigger('click')

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' })
  })

  it('renders a copyright line with the current year and site domain', () => {
    const wrapper = mount(SiteFooter, { props: { site: homeContent.site } })
    wrappers.push(wrapper)

    expect(wrapper.text()).toContain(`© ${new Date().getFullYear()} ${homeContent.site.domain}`)
  })
})

describe('SiteHeader', () => {
  it('clamps progressbar values to the supported range', () => {
    const belowRange = mount(SiteHeader, { props: { domain: 'example.cn', progress: -0.25, chapter: '00' } })
    const aboveRange = mount(SiteHeader, { props: { domain: 'example.cn', progress: 2, chapter: '04' } })
    wrappers.push(belowRange, aboveRange)

    expect(belowRange.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('0')
    expect(aboveRange.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('100')
  })
})

describe('StoryPanel', () => {
  it('renders PRINCIPLES items as a semantic unordered list', () => {
    const wrapper = mount(StoryPanel, { props: { item: homeContent.story[2] } })
    wrappers.push(wrapper)

    expect(wrapper.find('ul').exists()).toBe(true)
    expect(wrapper.findAll('ul > li')).toHaveLength(3)
    expect(wrapper.find('dt').exists()).toBe(false)
    expect(wrapper.find('dd').exists()).toBe(false)
  })
})

describe('HorizontalStory', () => {
  it('accepts story panels through its items prop', () => {
    const wrapper = mount(HorizontalStory, {
      props: { items: homeContent.story, ending: homeContent.ending },
    })
    wrappers.push(wrapper)

    expect(wrapper.findAll('[data-chapter="01"]')).toHaveLength(1)
  })
})
