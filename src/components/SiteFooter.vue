<script setup lang="ts">
import { ArrowUp } from 'lucide-vue-next'

defineProps<{
  site: {
    domain: string
    title: string
    icpNumber: string | null
  }
}>()

function backToTop() {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' })
}
</script>

<template>
  <footer data-site-footer>
    <p>{{ site.domain }}</p>
    <p>{{ site.title }}</p>
    <a
      v-if="site.icpNumber"
      href="https://beian.miit.gov.cn/"
      target="_blank"
      rel="noopener noreferrer"
    >
      {{ site.icpNumber }}
    </a>
    <button type="button" data-back-to-top aria-label="回到顶部" @click="backToTop">
      <ArrowUp aria-hidden="true" />
    </button>
  </footer>
</template>
