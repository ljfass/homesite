<script setup lang="ts">
import type { HeroContent } from '../content/home'
import signalFieldUrl from '../assets/signal-field.webp'

defineProps<{
  hero: HeroContent
}>()
</script>

<template>
  <section id="entry" class="hero story-panel" data-chapter="00" data-story-panel aria-labelledby="entry-title">
    <img
      :src="signalFieldUrl"
      class="hero__signal"
      data-signal-visual
      alt=""
      width="1800"
      height="1013"
      decoding="async"
      fetchpriority="high"
    />
    <div class="hero__content">
      <p class="chapter-label">{{ hero.index }} / {{ hero.eyebrow }}</p>
      <h1 id="entry-title" class="hero__title">
        <span v-for="(line, index) in hero.title" :key="line" data-hero-line>
          {{ line }}{{ index < hero.title.length - 1 ? ' ' : '' }}
        </span>
      </h1>
      <p class="hero__body" data-hero-copy>{{ hero.body }}</p>
      <p class="terminal-command" data-hero-copy>{{ hero.command }}</p>
    </div>
  </section>
</template>
