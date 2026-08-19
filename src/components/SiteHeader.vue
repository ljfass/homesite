<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  domain: string
  progress: number
  chapter: string
}>()

const clampedProgress = computed(() => Math.min(Math.max(props.progress, 0), 1))
const progressPercent = computed(() => Math.round(clampedProgress.value * 100))
</script>

<template>
  <header data-site-header>
    <a href="#main-content">{{ domain }}</a>
    <div aria-label="页面进度">
      <span>{{ chapter }} / 04</span>
      <div
        role="progressbar"
        aria-label="阅读进度"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="progressPercent"
      />
    </div>
  </header>
</template>
