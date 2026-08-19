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
  <header class="site-header display-type" data-site-header>
    <a class="site-header__domain" href="#main-content">{{ domain }}</a>
    <div class="site-header__status" aria-label="页面进度">
      <span class="site-header__chapter">{{ chapter }} / 04</span>
      <div
        class="site-progress__track"
        role="progressbar"
        aria-label="阅读进度"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="progressPercent"
      >
        <span
          class="site-progress__value"
          aria-hidden="true"
          :style="{ transform: `scaleX(${clampedProgress})` }"
        />
      </div>
    </div>
  </header>
</template>
