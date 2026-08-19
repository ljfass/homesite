<script setup lang="ts">
import type { StoryItem } from '../content/home'

defineProps<{
  item: StoryItem
}>()
</script>

<template>
  <section
    :id="item.id"
    class="story-panel"
    :data-chapter="item.index"
    data-story-panel
    :aria-labelledby="`${item.id}-title`"
  >
    <div class="story-panel__inner">
      <p class="chapter-label display-type" data-text-label :aria-label="`${item.index} / ${item.eyebrow}`">
        {{ item.index }} / {{ item.eyebrow }}
      </p>
      <h2 :id="`${item.id}-title`" class="story-panel__title display-type" data-text-title>
        <span v-for="(line, index) in item.title" :key="line">
          {{ line }}{{ index < item.title.length - 1 ? ' ' : '' }}
        </span>
      </h2>
      <p class="story-panel__body" data-text-copy>{{ item.body }}</p>
      <p class="terminal-command display-type" data-text-command :aria-label="item.command">{{ item.command }}</p>
      <ul v-if="item.items?.length" class="status-list" data-text-list>
        <li v-for="entry in item.items" :key="entry.label">
          <span>{{ entry.label }}</span>
          <span v-if="entry.value">{{ entry.value }}</span>
        </li>
      </ul>
    </div>
  </section>
</template>
