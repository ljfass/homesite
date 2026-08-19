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
      width="1200"
      height="800"
      decoding="async"
      fetchpriority="high"
    />
    <div class="hero__content">
      <p class="chapter-label display-type">
        <span data-text-label aria-hidden="true">{{ hero.index }} / {{ hero.eyebrow }}</span>
        <span class="sr-only" data-text-static="label">{{ hero.index }} / {{ hero.eyebrow }}</span>
      </p>
      <h1 id="entry-title" class="hero__title display-type" data-text-title>
        <span v-for="(line, index) in hero.title" :key="line">
          {{ line }}{{ index < hero.title.length - 1 ? ' ' : '' }}
        </span>
      </h1>
      <p class="hero__body" data-text-copy>{{ hero.body }}</p>
      <p class="terminal-command display-type">
        <span data-text-command aria-hidden="true">{{ hero.command }}</span>
        <span class="sr-only" data-text-static="command">{{ hero.command }}</span>
      </p>
    </div>
  </section>
</template>
