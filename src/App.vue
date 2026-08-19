<script setup lang="ts">
import { ref } from 'vue'
import SiteFooter from './components/SiteFooter.vue'
import HeroSection from './components/HeroSection.vue'
import HorizontalStory from './components/HorizontalStory.vue'
import SiteHeader from './components/SiteHeader.vue'
import { homeContent } from './content/home'

const progress = ref(0)
const chapter = ref('00')

document.title = homeContent.site.title
const description = document.querySelector<HTMLMetaElement>('meta[name="description"]')
if (description) {
  description.content = homeContent.site.description
}
</script>

<template>
  <a href="#main-content">跳到主要内容</a>
  <SiteHeader :domain="homeContent.site.domain" :progress="progress" :chapter="chapter" />
  <main id="main-content">
    <HeroSection :hero="homeContent.hero" />
    <HorizontalStory :stories="homeContent.story" :ending="homeContent.ending" />
  </main>
  <SiteFooter :site="homeContent.site" />
</template>
