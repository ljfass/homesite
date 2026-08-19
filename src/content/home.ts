export type StoryItem = {
  readonly id: 'about' | 'now' | 'principles'
  readonly index: '01' | '02' | '03'
  readonly eyebrow: string
  readonly title: readonly string[]
  readonly body: string
  readonly command: string
  readonly items?: readonly {
    readonly label: string
    readonly value?: string
  }[]
}

export type SiteContent = {
  readonly domain: string
  readonly title: string
  readonly description: string
  readonly icpNumber: string | null
}

export type HeroContent = {
  readonly index: '00'
  readonly eyebrow: string
  readonly title: readonly string[]
  readonly body: string
  readonly command: string
}

export type EndingContent = {
  readonly index: '04'
  readonly eyebrow: string
  readonly title: readonly string[]
  readonly body: string
}

export const homeContent = {
  site: {
    domain: 'huangjianfen.cn',
    title: 'Hello World',
    description: '一个尚未被定义、持续生长的个人主页',
    icpNumber: null as string | null,
  } satisfies SiteContent,
  hero: {
    index: '00',
    eyebrow: 'ENTRY',
    title: ['Hello', 'World'],
    body: '一个还没有被定义的个人主页。先在互联网留下一处坐标，其他的以后慢慢发生。',
    command: '$ scroll_to_begin',
  } satisfies HeroContent,
  story: [
    {
      id: 'about',
      index: '01',
      eyebrow: 'ABOUT THIS PLACE',
      title: ['这里，', '暂时没有主题。'],
      body: '它可以装下偶然的想法、正在做的事情，也可以什么都不解释。保持开放，本身就是一种方向。',
      command: '$ cat /about/intention.txt',
    },
    {
      id: 'now',
      index: '02',
      eyebrow: 'NOW',
      title: ['正在', '发生'],
      body: '不虚构经历，只展示这个站点此刻的真实状态。',
      command: '$ watch /now',
      items: [
        { label: '学习', value: '持续' },
        { label: '记录', value: '偶尔' },
        { label: '构建', value: '进行中' },
      ],
    },
    {
      id: 'principles',
      index: '03',
      eyebrow: 'PRINCIPLES',
      title: ['保持', '未完成'],
      body: '先用三条简单原则占住这里，未来再替换成你的项目、文章或生活切片。',
      command: '$ list /principles',
      items: [
        { label: '保持好奇' },
        { label: '先做再说' },
        { label: '留点空白' },
      ],
    },
  ] satisfies readonly StoryItem[],
  ending: {
    index: '04',
    eyebrow: 'END',
    title: ['To be', 'continued.'],
    body: '这里不是结尾，只是本次滚动的终点。',
  } satisfies EndingContent,
} as const
