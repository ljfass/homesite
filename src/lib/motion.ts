export type MotionMode = 'static' | 'horizontal' | 'vertical'

type MotionConditions = {
  desktop: boolean
  reduced: boolean
}

const chapters = ['01', '02', '03', '04'] as const

function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) {
    return 0
  }

  return Math.min(Math.max(progress, 0), 1)
}

export function getMotionMode({ desktop, reduced }: MotionConditions): MotionMode {
  if (reduced) {
    return 'static'
  }

  return desktop ? 'horizontal' : 'vertical'
}

export function getHorizontalTravel(trackWidth: number, viewportWidth: number): number {
  if (!Number.isFinite(trackWidth) || !Number.isFinite(viewportWidth)) {
    return 0
  }

  return Math.max(0, trackWidth - viewportWidth)
}

export function getChapterFromProgress(progress: number): (typeof chapters)[number] {
  const chapterIndex = Math.min(Math.floor(clampProgress(progress) * chapters.length), chapters.length - 1)

  return chapters[chapterIndex]
}
