<script setup lang="ts">
import type { EndingContent, StoryItem } from '../content/home'
import StoryPanel from './StoryPanel.vue'

defineProps<{
  items: readonly StoryItem[]
  ending: EndingContent
}>()
</script>

<template>
  <section class="story-stage" data-story-stage aria-label="个人主页章节">
    <div class="story-track" data-story-track>
      <StoryPanel v-for="story in items" :key="story.id" :item="story" />
      <section
        class="story-panel story-panel--ending"
        data-chapter="04"
        data-story-panel
        aria-labelledby="ending-title"
      >
        <div class="story-panel__inner">
          <p class="chapter-label">{{ ending.index }} / {{ ending.eyebrow }}</p>
          <h2 id="ending-title" class="story-panel__title">
            <span v-for="(line, index) in ending.title" :key="line">
              {{ line }}{{ index < ending.title.length - 1 ? ' ' : '' }}
            </span>
          </h2>
          <p class="story-panel__body">{{ ending.body }}</p>
        </div>
      </section>
    </div>
  </section>
</template>
