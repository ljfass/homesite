<script setup lang="ts">
import type { EndingContent, StoryItem } from '../content/home'
import StoryPanel from './StoryPanel.vue'

defineProps<{
  items: readonly StoryItem[]
  ending: EndingContent
}>()
</script>

<template>
  <section data-story-stage aria-label="个人主页章节">
    <div data-story-track>
      <StoryPanel v-for="story in items" :key="story.id" :item="story" />
      <section data-chapter="04" data-story-panel aria-labelledby="ending-title">
        <p>{{ ending.index }} / {{ ending.eyebrow }}</p>
        <h2 id="ending-title">
          <span v-for="(line, index) in ending.title" :key="line">
            {{ line }}{{ index < ending.title.length - 1 ? ' ' : '' }}
          </span>
        </h2>
        <p>{{ ending.body }}</p>
      </section>
    </div>
  </section>
</template>
