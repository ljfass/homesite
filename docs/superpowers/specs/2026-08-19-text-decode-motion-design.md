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

When this preference changes while the page is open, preserve the reader's canonical chapter and viewport position. Stable scroll events keep the active chapter's viewport offset current, while teardown-generated scroll events are ignored after a match-media transition begins. On desktop, retain the last stable horizontal ScrollTrigger progress so a preference round trip returns to the same point inside the chapter. Reduced mode keeps lightweight, non-animating chapter triggers so scrolling to another chapter updates the semantic reading state before text motion returns.

GSAP may emit more than one global match-media cycle for one browser change because several media-query listeners toggle together. Lock the first stable snapshot across the full rebuild, including no-op follow-up cycles. After the replacement responsive context exists, refresh ScrollTrigger, restore either the exact horizontal progress or the saved vertical anchor without CSS smooth scrolling, resynchronize header progress, and make the saved chapter the newly active text controller's first playback. The same post-refresh resynchronization applies to desktop/mobile breakpoint changes. A default chapter `00`, reduced-motion placeholder, cleanup report, or trigger emitted while contexts are rebuilding must not update the header or drive text playback.

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
- Play chapter `00` only after stable initial initialization; a controller recreated during runtime preference restoration waits for the saved canonical chapter.
- Invoke `playChapter()` when its existing desktop progress logic reaches a new chapter.
- Invoke `playChapter()` from the existing compact chapter triggers.
- Avoid creating the text-motion module inside the reduced-motion branch.
- Revert text motion through the existing match-media and component cleanup paths.
- Capture real reading state and its chapter anchor before match-media contexts revert. Runtime preference changes restore that state after GSAP's post-match refresh; pending native media, scroll, animation-frame, and GSAP event listeners are removed on unmount.
- Cache chapter elements once after assets settle and coalesce scroll-driven anchor measurements to one animation frame.

Text motion must not add another horizontal container animation or alter the main track tween.

### Component Contracts

Components will add stable data attributes rather than animation code:

- `data-text-title`
- `data-text-command`
- `data-text-label`
- `data-text-copy`
- `data-text-list`
- `data-text-static="label"`
- `data-text-static="command"`

Visible label and command targets are `aria-hidden="true"` spans whose final strings remain in rendered markup. Each has a screen-reader-only sibling carrying the same final value through `data-text-static="label"` or `data-text-static="command"`, so assistive technology never announces intermediate scrambled characters.

## Responsive Re-Splitting

Title line splitting uses SplitText `autoSplit: true` with animations created through `onSplit()`. Returning the animation from `onSplit()` lets SplitText clean up and preserve playback state when fonts finish loading or a title width changes.

Only title lines are split. Body text and terminal commands are not split into character elements. This keeps DOM growth and resize work bounded.

If a chapter has already completed its sequence, a responsive re-split must leave it at its completed visual state rather than replaying it. Record its completed absolute timeline time and, when changed line counts alter the replacement's natural duration, return a paused parent timeline whose local duration matches that recorded time. SplitText can then restore its saved absolute time while the replacement remains exactly at progress `1` for both longer and shorter line layouts.

## Accessibility

- Preserve one semantic `h1` and the existing semantic `h2` chapter headings.
- Use SplitText's accessible text behavior for headings.
- Keep stable screen-reader-only final-text siblings beside scrambled visual labels and commands.
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
- Components expose the required data attributes, `aria-hidden` visual targets, and stable final-text siblings.
- `playChapter()` creates or starts a chapter sequence at most once.
- Missing optional targets do not throw.
- Cleanup kills timelines and reverts every SplitText instance.
- Responsive re-splitting preserves completed progress.
- Reduced-motion setup creates no SplitText or ScrambleText activity.
- Runtime preference changes retain the saved canonical chapter for both progress reporting and text playback.
- Final command and label strings match the typed content source.

### Browser Tests

- Desktop hero animation settles on the correct final title and command.
- Desktop horizontal scrolling still reaches `04 / 04` and the ending.
- Mobile `390x844` and short landscape `844x390` remain vertical and unclipped.
- Scrolling away from and back to a chapter does not replay its text sequence.
- Reduced-motion mode contains no split wrappers, scrambled intermediate text, or pinning artifacts.
- Runtime reduced-motion toggles retain the active mobile chapter and reading position, recreate one stable set of masks when motion returns, and produce no page errors or overflow after repeated changes.
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
