<script setup lang="ts">
import type { StoryItem } from '../content/home'

defineProps<{
  item: StoryItem
}>()
</script>

<template>
  <section :id="item.id" :data-chapter="item.index" data-story-panel :aria-labelledby="`${item.id}-title`">
    <p>{{ item.index }} / {{ item.eyebrow }}</p>
    <h2 :id="`${item.id}-title`">
      <span v-for="(line, index) in item.title" :key="line">
        {{ line }}{{ index < item.title.length - 1 ? ' ' : '' }}
      </span>
    </h2>
    <p>{{ item.body }}</p>
    <p>{{ item.command }}</p>
    <dl v-if="item.items?.length">
      <template v-for="entry in item.items" :key="entry.label">
        <dt>{{ entry.label }}</dt>
        <dd v-if="entry.value">{{ entry.value }}</dd>
      </template>
    </dl>
  </section>
</template>
