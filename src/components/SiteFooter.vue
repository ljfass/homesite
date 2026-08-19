<script setup lang="ts">
import { ArrowUp } from 'lucide-vue-next'
import type { SiteContent } from '../content/home'

defineProps<{
  site: SiteContent
}>()

const currentYear = new Date().getFullYear()

function backToTop() {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' })
}
</script>

<template>
  <footer class="site-footer" data-site-footer>
    <div class="site-footer__identity">
      <p>{{ site.domain }}</p>
      <p>{{ site.title }}</p>
    </div>
    <div class="site-footer__legal">
      <p>© {{ currentYear }} {{ site.domain }}</p>
      <a
        v-if="site.icpNumber"
        href="https://beian.miit.gov.cn/"
        target="_blank"
        rel="noopener noreferrer"
      >
        {{ site.icpNumber }}
      </a>
    </div>
    <button class="site-footer__top" type="button" data-back-to-top aria-label="回到顶部" @click="backToTop">
      <ArrowUp aria-hidden="true" />
    </button>
  </footer>
</template>
