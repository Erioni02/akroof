# AK Roofing & Gutters

A single-page cinematic site for AK Roofing & Gutters, Oakbrook Terrace, Illinois.
Scroll position drives the film; the UI is composed against it shot by shot.

## Run

```
npm install
npm run dev      # http://localhost:5173
npm run build
npm run preview
```

## The film

Source: `video.mp4` at the project root — 1920x1080, 30 fps, 30.000 s, 900 frames,
no audio. Hard cuts at 4.000 s, 19.633 s and 23.133 s; everything else is one
continuous camera move or a dissolve.

The shipped masters in `public/video/` are **motion-interpolated to 60 fps**
(1797 frames), which is what makes the scrub read as motion rather than as a
fast slideshow. The synthesised frames were checked against the hardest content
in the film — the rain streaks and the roof trusses — for warping artifacts.

| file                 | size     | notes                                |
| -------------------- | -------- | ------------------------------------ |
| `ak-film.mp4`        | 1600x900 | desktop, 60 fps, 42.7 MB             |
| `ak-film-mobile.mp4` | 1024x576 | <= 900 px viewports, 60 fps, 17.2 MB |

Both use a 5-frame GOP and no B-frames. That costs bitrate and buys precision:
any seek is at most five decodes, so both the WebCodecs path and the plain
`currentTime` fallback land on the exact frame.

To regenerate from the master:

```
ffmpeg -i video.mp4 -an   -vf "minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,scale=1600:900:flags=lanczos"   -c:v libx264 -profile:v high -pix_fmt yuv420p -preset medium -crf 24   -g 5 -keyint_min 5 -sc_threshold 0 -bf 0   -movflags +faststart public/video/ak-film.mp4
```

The mobile file is scaled down from that output, so the interpolation only runs
once (it takes about eight minutes).

## Chapters

The scroll-to-time map is `src/data/chapters.ts`. In/out points were read off the
footage frame by frame, and each chapter's `weight` is its share of the scroll
track — deliberately *not* proportional to its duration. The credential wall is
1.2 s of footage but needs room to be read; the storm holds itself.

| #  | chapter       | video       | UI                                       |
| -- | ------------- | ----------- | ---------------------------------------- |
| 01 | The House     | 0.00–2.10   | hero, lower left, clear of the house      |
| 02 | The Reveal    | 2.10–4.10   | type upper right as the roof opens        |
| 03 | The Rebuild   | 4.10–6.10   | over the exposed trusses                  |
| 04 | The Exterior  | 6.10–10.20  | the six services, as a numbered index     |
| 05 | The Storm     | 10.20–13.00 | upper left, into the storm sky            |
| 06 | The Proof     | 13.00–19.63 | gutters shedding water; 100% Guarantee    |
| 07 | The Standard  | 19.63–21.90 | Licensed / Insured / Bonded, license no.  |
| 08 | Credentials   | 21.90–23.13 | manufacturer certifications               |
| 09 | The Territory | 23.13–25.35 | address, hours, telephone                 |
| 10 | The Return    | 25.35–27.30 | back to the finished house                |
| 11 | AK            | 27.30–30.00 | closing hero and both CTAs                |

### One art-direction decision worth knowing

From 19.63 s to 25.35 s the source footage renders its own badge wall and service
-area map, and the text baked into those shots is garbled ("SLPAREIAS", "BBA",
"BRAVA BOSCS", "Gusifeirs"). Shown sharp, it would read as broken.

So chapters 07–09 apply an `atmosphere` treatment: the footage is blurred, dimmed
and pushed in until it reads as an abstract navy-and-gold light field, and real
typography carries the credentials over it. The render becomes lighting; the type
carries the truth. It is the most graphic passage in the film, and it is the only
place the footage is deliberately obscured.

## How the scrubbing works

Measured on a 1440x810 viewport: **60 fps with zero dropped frames and
frame-exact output** at every realistic scroll speed, including through the
blurred passage. Dragging the whole 30 s film past in five seconds still holds
60 fps, on keyframes.

Three things get it there, and each replaced something that looked reasonable
and profiled badly.

**Painting never waits for decoding.** The obvious design — await the frame you
want, then draw it — collapses to ~17 fps, because a decode is tens of
milliseconds and almost every animation frame arrives to find one already in
flight and gets dropped. So `render()` is synchronous: it paints the best frame
it already holds (the exact one, or the nearest) and returns. A separate `pump()`
streams a window of frames around the playhead into a cache. The picture is
always live; detail lands a frame or two later.

**The decode path is measured, not assumed.** `hardwareAcceleration:
'prefer-hardware'` is the obvious setting and is sometimes badly wrong: on
machines without real GPU video decode it can be several times slower than
software and, in the worst case, stop draining its queue at all. On this
development machine hardware was 33 ms/frame and wedged above five chunks;
software was 4 ms/frame and never stalled. So `chooseConfig()` times a short run
through each at load and keeps the winner, behind the loading screen.

**The scheduler has two modes.** At a readable scroll pace it decodes complete
GOPs, playhead-first, so every frame is exact. Above ~3 frames per animation
frame it switches to keyframes only, spread along the direction of travel — a
fifth of the work, and at that speed nobody can tell which of five frames they
got. The moment the scrub settles, full runs resume and it lands on the exact
frame.

**Frames are matched to their index by timestamp, never by arrival order.**
Positional matching — shift the next expected index off a queue as each frame
comes back — looks equivalent and is not. A decoder under load can drop a
frame, and one drop permanently shifts every later one: pictures get filed
under the wrong index (a visible glitch) and the affected run can never be
rebuilt, because it still looks in-flight (a freeze). This showed up under fast
erratic scrolling. The in-flight set also self-heals: if the decoder reports
nothing pending, anything still marked in-flight was dropped and is released so
those runs can be requested again.

Runs are always submitted whole and always from a keyframe: a delta frame only
decodes correctly if the frames before it went through the same decoder in
order, so cherry-picking missing frames out of a run would quietly produce
corrupt pictures.

**Recovery escalates.** Rebuilding a decoder is itself a visible hitch, so
repeatedly rebuilding a misbehaving one trades a single glitch for a rhythm of
them. Each rebuild therefore escalates: first drop to software, and if that
keeps stalling, abandon the frame bank entirely and hand back to the `<video>`
element — coarser, but it cannot wedge. Hardware also has to beat software by a
clear margin (1.25x) to be chosen at all, because its failure mode is the bad
one: some drivers stall under sustained load rather than simply slowing down.

**Diagnostics.** Append `?debug=1` to any URL for a live readout of frame rate,
dropped frames, which source is painting, which decoder was chosen, how many
times it has been rebuilt, cache and queue depth, and the longest run of
animation frames that showed the same picture while the playhead was moving.

`src/components/FilmStage.tsx` is progressive enhancement on top of that. The
`<video>` element scrubs by `currentTime` as soon as it has data, so the site is
usable immediately; the frame bank takes over silently once ready. Any failure —
WebCodecs missing, a bad config, a parse error, low device memory, Data Saver —
leaves the `<video>` path running and the site behaves the same.

The video is never played. It is muted, `playsInline`, `preload="auto"`, has no
controls and no poster.

### Scroll pacing

`TRACK` in `FilmStage.tsx` is the film's playback speed — the whole 30s runs
across `TRACK - 100svh` of scrolling. At the current `800svh` and an 810px
viewport that is 5673px of scroll for 1797 frames: about 3.2px per frame, or 32
frames (half a second of film) per wheel notch. Raise it to slow the film down
and make the scrub smoother; lower it to tighten the page.

### Loading

The bar reports the download that actually has to finish, in bytes, and it
always completes before the curtain lifts. Both halves of that matter: an
earlier version showed the video element's *buffered seconds* and lifted at
`readyState >= 3`, which arrives after a fraction of the file — so the bar
stranded around 15% and the whole thing looked fake.

Progress is weighted across the real phases, because reporting only the
download parked the bar at 92% for over a second while the rest happened:

| phase                              | share    |
| ---------------------------------- | -------- |
| file download (bytes)              | 0 – 90%  |
| mp4box sample-table parse          | 90 – 96% |
| decoder benchmark (see above)      | 96 – 99% |
| first decode                       | 99 – 100%|

If the frame bank cannot be built, the loader falls back to revealing as soon
as the video can be scrubbed, and an 18s cap means a stalled network can never
hold the page hostage.

### Compositing

A CSS `filter` on a full-screen element is a full-screen GPU pass on every
composited frame — including `blur(0px)`. An always-on grade filter alone cost
40% of the frame rate. The base grade is now a static tint layer, and `filter`
is only ever set while chapters 07-09 actually need their blur.

The canvas is also never allocated larger than the footage itself: past 1600 px
the extra fill rate buys nothing and costs every frame.

Scroll feeds a single store (`src/lib/filmStore.ts`) through ScrollTrigger; a
GSAP ticker damps it so the film never snaps between frames. Chapter layers
subscribe to that store and write styles imperatively — React does not re-render
while you scroll. Only the active chapter index, which changes eleven times a
visit, is reactive state.

The header belongs to the film and fades out as the film ends, rather than
floating over the footer — which carries its own wordmark, both calls to action
and the phone number.

## Brand and credential marks

Source files are kept in `assets-source/`; what the site loads lives in
`public/brand/` and `public/credentials/`.

The marks sit directly on the film — no plate, no border, no tinted panel. That
only works if each one actually reads against a near-black background, and four
of the seven did not: they were drawn for white paper.

Rather than flatten everything to white silhouettes (which destroys DaVinci and
the guarantee seal — both are light-on-dark designs whose filled shape becomes a
solid white blob), each mark was handled on its own terms:

| mark                         | treatment                                   |
| ---------------------------- | ------------------------------------------- |
| ShingleMaster, DaVinci, BBB, 100% Guarantee | untouched — they already read on dark |
| Mule-Hide, Brava             | reverse (knockout) version                   |
| AK logo                      | reverse version                              |

The reverse versions lift only *dark neutral* pixels — dark **and** unsaturated —
to bone. Every brand colour survives: Brava keeps its orange chevron, Mule-Hide
keeps its full-colour emblem (the lift is fenced to the wordmark), and the AK
monogram keeps its gold roof lines. The command is in the shell history of the
build; to redo one, the rule is `max(r,g,b) < 125 && max-min < 62 -> #F3F0E9`.

Favicons are generated on a solid ink ground so they survive both light and dark
browser chrome.

## Service area map

The Google Maps embed in chapter 09 is deliberately constrained:

- It mounts only once the film reaches the credentials passage, so a third-party
  frame does not cost the opening scroll or phone home before anyone asks for a
  map.
- The frame is `pointer-events: none` — a live map inside a scroll-driven film
  would swallow the wheel and zoom instead of scrolling. The whole panel is one
  link out to the real listing.
- Nothing is drawn over the lower strip: Google's attribution lives there and
  stays legible. The address sits in the column beside the map.
- Google only serves the light map to unauthenticated embeds, so it is inverted
  in CSS to sit in the film's register.

## Business information

All copy, credentials and links live in `src/data/site.ts`. Nothing is invented:
no reviews, no statistics, no certifications beyond the ones supplied.
#   a k r o o f 
 
 