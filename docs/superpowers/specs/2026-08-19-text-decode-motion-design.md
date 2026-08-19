# GSAP Text Decode Motion Design

## Context

The homepage already uses GSAP and ScrollTrigger for a desktop horizontal story, vertical compact layouts, header progress, and reduced-motion fallbacks. The new motion layer should strengthen the terminal identity without turning the page into an animation showcase or destabilizing the existing scroll system.

The selected direction is A3: masked title reveals combined with restrained command and chapter-label decoding. Each chapter plays once on first entry.

## Goals

- Reveal the hero and chapter titles by line with a clean clipped motion.
- Decode short terminal commands and chapter labels with a restrained character scramble.
- Play each chapter's text sequence only once per page visit.
- Preserve the current desktop horizontal story, compact vertical layouts, and progress behavior.
- Keep final text stable and accessible to assistive technology.
- Skip all text splitting and decoding when reduced motion is requested.

## Non-Goals

- Do not scramble Chinese body copy, list content, the domain, or footer text.
- Do not loop text animations or replay them when scrolling back to a viewed chapter.
- Do not add ScrollSmoother, Draggable, Observer, SVG morphing, or additional page sections.
- Do not change the current content model or invent new personal information.
- Do not change the existing horizontal travel, pinning, or compact-mode thresholds.

## User-Visible Behavior

### Hero Sequence

After fonts and the hero image are ready:

1. `Hello` and `World` reveal from below through line masks.
2. The two lines use an approximately 0.1-second stagger and complete in about 0.7 seconds.
3. The hero body copy moves upward slightly and fades in.
4. `$ scroll_to_begin` decodes from a restricted terminal character set into its final value in about 0.8 seconds.
5. All text remains static after the sequence finishes.

### Chapter Sequence

When a chapter enters its effective reading area for the first time:

1. The chapter label, such as `02 / NOW`, quickly decodes into its final value.
2. The chapter title reveals by line through masks.
3. The command decodes after the title begins.
4. Body copy and lists only fade and move slightly; they are never scrambled.
5. Returning to the chapter does not replay the sequence.

The same order and restraint apply to desktop, mobile, and short-landscape layouts. Trigger positions may differ to match their existing scroll mechanics, but the visual result remains consistent.

### Reduced Motion

When `prefers-reduced-motion: reduce` is active:

- Do not create SplitText instances.
- Do not create ScrambleText tweens or text entrance timelines.
- Do not hide or translate text before display.
- Render all final text immediately and preserve the existing vertical story fallback.

## Motion Values

- Title reveal duration: approximately `0.7s`.
- Title line stagger: approximately `0.1s`.
- Body/list reveal duration: approximately `0.35s` to `0.45s`.
- Command decode duration: approximately `0.8s`.
- Chapter-label decode duration: approximately `0.45s`.
- Allowed scramble characters: a restrained subset such as `01_/#?`.
- Use transform and opacity properties for entrance motion; do not animate layout properties.

Exact timing may be tuned during browser QA within these ranges, provided the sequence remains readable and finishes promptly.

## Architecture

### Plugin Registration

`src/lib/gsap.ts` remains the single GSAP registration boundary. It will register and export:

- `ScrollTrigger`
- `SplitText`
- `ScrambleTextPlugin`

The existing public `gsap` package already contains these plugins, so no additional package or private registry is required.

### Text Motion Module

Add `src/lib/textMotion.ts` as a focused DOM-motion factory. It will:

- Find title, command, label, body, and list targets within one chapter element.
- Create responsive SplitText line masks for title targets.
- Create the chapter's paused GSAP timeline.
- Keep an internal `Set<string>` of chapter identifiers that have played.
- Expose a `playChapter(chapter)` operation that is idempotent.
- Expose cleanup that reverts SplitText, kills timelines, and restores the original DOM.

The module does not own Vue lifecycle hooks or ScrollTrigger positioning.

### Scroll Orchestration

`src/composables/useHomeMotion.ts` remains the owner of page lifecycle, media conditions, and scroll behavior. It will:

- Create the text-motion module after fonts and root images settle.
- Play chapter `00` after initialization.
- Invoke `playChapter()` when its existing desktop progress logic reaches a new chapter.
- Invoke `playChapter()` from the existing compact chapter triggers.
- Avoid creating the text-motion module inside the reduced-motion branch.
- Revert text motion through the existing match-media and component cleanup paths.

Text motion must not add another horizontal container animation or alter the main track tween.

### Component Contracts

Components will add stable data attributes rather than animation code:

- `data-text-title`
- `data-text-command`
- `data-text-label`
- `data-text-copy`
- `data-text-list`

Command and label elements retain their final string in the rendered markup. Elements whose visible text is temporarily scrambled receive an `aria-label` containing the final value so assistive technology does not announce intermediate characters.

## Responsive Re-Splitting

Title line splitting uses SplitText `autoSplit: true` with animations created through `onSplit()`. Returning the animation from `onSplit()` lets SplitText clean up and preserve playback state when fonts finish loading or a title width changes.

Only title lines are split. Body text and terminal commands are not split into character elements. This keeps DOM growth and resize work bounded.

If a chapter has already completed its sequence, a responsive re-split must leave it at its completed visual state rather than replaying it.

## Accessibility

- Preserve one semantic `h1` and the existing semantic `h2` chapter headings.
- Use SplitText's accessible text behavior for headings.
- Keep stable final-value `aria-label` attributes on scrambled commands and chapter labels.
- Never scramble links, buttons, body copy, or interactive labels.
- Do not move keyboard focus or block scrolling during a text sequence.
- Reduced-motion users receive final content without transitional hidden states.

## Error and Cleanup Behavior

- Missing optional targets are skipped without blocking the rest of a chapter timeline.
- A missing title must not prevent command, label, or copy handling.
- Plugin setup happens before any plugin use; build and unit tests guard the registration boundary.
- Cleanup is idempotent and safe during pending font/image initialization.
- No global ScrollTrigger kill is allowed.
- Original DOM and text must be restored when the component unmounts or media conditions revert.

## Testing

### Unit and Component Tests

- Both new plugins are registered through the shared GSAP module.
- Components expose the required data attributes and final `aria-label` values.
- `playChapter()` creates or starts a chapter sequence at most once.
- Missing optional targets do not throw.
- Cleanup kills timelines and reverts every SplitText instance.
- Responsive re-splitting preserves completed progress.
- Reduced-motion setup creates no SplitText or ScrambleText activity.
- Final command and label strings match the typed content source.

### Browser Tests

- Desktop hero animation settles on the correct final title and command.
- Desktop horizontal scrolling still reaches `04 / 04` and the ending.
- Mobile `390x844` and short landscape `844x390` remain vertical and unclipped.
- Scrolling away from and back to a chapter does not replay its text sequence.
- Reduced-motion mode contains no split wrappers, scrambled intermediate text, or pinning artifacts.
- All tested viewports have no horizontal page overflow, page errors, or console errors.

## Acceptance Criteria

- The page visibly follows the approved A3 sequence.
- Every chapter sequence plays at most once per page visit.
- Existing horizontal and compact scroll behavior remains unchanged.
- Final content is stable, selectable, and accessible.
- Reduced-motion renders immediately without text animation.
- Automated checks and multi-viewport browser tests pass.

## References

- [GSAP SplitText](https://gsap.com/docs/v3/Plugins/SplitText/)
- [GSAP ScrambleText](https://gsap.com/docs/v3/Plugins/ScrambleTextPlugin/)
