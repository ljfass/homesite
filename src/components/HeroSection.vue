<script setup lang="ts">
import type { HeroContent } from '../content/home'

defineProps<{
  hero: HeroContent
}>()
</script>

<template>
  <section id="entry" data-chapter="00" data-story-panel aria-labelledby="entry-title">
    <p>{{ hero.index }} / {{ hero.eyebrow }}</p>
    <h1 id="entry-title">
      <span v-for="(line, index) in hero.title" :key="line" data-hero-line>
        {{ line }}{{ index < hero.title.length - 1 ? ' ' : '' }}
      </span>
    </h1>
    <p>{{ hero.body }}</p>
    <p>{{ hero.command }}</p>
    <div data-signal-visual aria-hidden="true" />
  </section>
</template>
