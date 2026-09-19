# Reusable prompt — scroll-driven video websites

Copy everything below the line into a new project. Replace the bracketed parts.
It encodes the decisions that actually mattered when building this site, including
the ones that were got wrong first and had to be measured and corrected.

---

Build a scroll-driven cinematic website where scroll position controls a video
timeline. Source video: `[PATH]`. Brand/business info: `[PASTE]`.

Stack: `[Vite + React + TypeScript + Tailwind + GSAP/ScrollTrigger]`.

## 1. Inspect the source before designing anything

Do this first and show me what you found. Do not design around a video you have
not looked at.

- `ffprobe` for duration, resolution, fps, frame count, audio.
- Extract frames at ~2fps into contact sheets and actually view them.
- Detect hard cuts: `ffmpeg -i in.mp4 -vf "select='gt(scene,0.2)',metadata=print" -f null -`
- For each chapter, note the **composition**: where the subject sits, which
  regions are empty, whether it is light or dark. Place text into the empty
  regions. Never place text over the subject and then dim the video to
  compensate.
- Flag anything unusable — baked-in text, garbled AI captions, watermarks,
  logos. Tell me about it and propose a treatment rather than showing it
  straight.

## 2. Encode for scrubbing, not for streaming

Normal video advice is wrong here. Streaming optimizes for sequential playback;
scrubbing is random access. Rules:

- **Keyframe interval is the single most important setting.** Use `-g 5`
  (a keyframe every 5 frames). Any seek then costs at most 5 decodes. The usual
  "1–2 second keyframe interval" advice is 12–24× too sparse and is the main
  cause of scrub stutter.
- **`-bf 0`** — no B-frames. Out-of-order frames make decode bookkeeping
  needlessly hard.
- **Interpolate to 60fps** if the source is lower. Motion-interpolated frames
  are highly predictable and cost almost nothing in bytes — in one measurement,
  doubling 30→60fps cost 4.6 MB while halving the smoothness would have saved
  only that. **Never buy size back by cutting frame rate.**
- **Resolution is the only lever worth pulling.** Decode cost, GPU memory and
  file size all track pixel count. Cutting 1600×900 → 1280×720 cut the download
  37% and improved worst-case scrub lag ~20×.
- **Always encode in a single pass from the original master.** Deriving a
  smaller file from an already-encoded one compresses it twice. Measured, that
  double encode cost *twice as much quality as the resolution drop did*.
- Strip audio (`-an`) if unused. `-movflags +faststart`.

```
ffmpeg -i MASTER.mp4 -an \
  -vf "minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,scale=W:H:flags=lanczos" \
  -c:v libx264 -profile:v high -pix_fmt yuv420p -preset slow -crf 23 \
  -g 5 -keyint_min 5 -sc_threshold 0 -bf 0 \
  -movflags +faststart out.mp4
```

**Choosing the resolution.** Do not default to 4K — for scrubbing it is almost
always wrong: ~9× the decode cost of 720p and a 100 MB+ download for 30
seconds. Pick the smallest that covers the common viewport, verify the choice
with SSIM against the master, and serve a smaller file to phones:

```
ffmpeg -ss T -i master.mp4 -frames:v 1 -vf scale=1920:1080 ref.png
ffmpeg -ss T -i cand.mp4   -frames:v 1 -vf scale=1920:1080 tst.png
ffmpeg -i tst.png -i ref.png -lavfi ssim -f null -
```

Sample 6+ frames across the film. Report size vs SSIM as a table and recommend,
rather than asserting the quality cost is fine.

Verify the encode afterwards — count keyframes across the **whole** file, not a
sample interval:
`ffprobe -select_streams v -skip_frame nokey -count_frames -show_entries stream=nb_read_frames`

### If you serve it from a CDN

Hosting the film off-repo is worth it — a CDN edge plus `immutable, max-age=30d`
means a repeat visitor pays nothing, and the frame bank cannot start decoding
until the whole file is down, so time-to-download *is* time-to-smooth.

But **any transform re-encodes, and re-encoding destroys the keyframe spacing
everything above depends on.** Measured on Cloudinary: the master had 359
keyframes in 1797 frames; the `w_900,q_auto` derivative came back with **seven**,
a GOP of 250. Because runs are submitted whole, one `decodeRun` then queued 250
decodes — a flick drove the decode queue to 839 against a limit of 32 and the
picture froze for a second at a time. Nothing errored. The only symptom was
stutter.

So pin the interval explicitly in the transform (`ki_0.084` = 5 frames at 60fps
on Cloudinary) and **re-verify the derivative**, not just the master. It costs
real bytes — dense keyframes are expensive, 7.9 MB became 11.1 MB — and that is
simply the price of a scrubbable file.

Four properties the URL must keep, or the stage silently degrades:

| | why |
|---|---|
| `Access-Control-Allow-Origin` | the frame bank `fetch`es the bytes itself |
| `Content-Length`, CORS-exposed | the loading bar reports real byte progress |
| `Accept-Ranges: bytes` | the `<video>` fallback can seek |
| `video/mp4`, H.264 | **never `f_auto`** — it may serve VP9/AV1 in WebM, which an mp4 parser cannot read |

Set `crossOrigin="anonymous"` on the `<video>`. Drawing a cross-origin video into
a canvas taints it and throws — and that canvas is the fallback that exists to
keep the site working when the decoder fails.

Check the headers before writing any code:

```
curl -sI -H "Origin: http://localhost:5173" "$URL" \
  | grep -iE "access-control|content-length|accept-ranges|content-type"
```

## 3. Architecture — painting must never wait for decoding

This is the rule that matters most.

- Do **not** listen to `scroll` events. Let ScrollTrigger (or similar) write a
  progress value; drive everything from one rAF ticker.
- Damp the playhead toward the target each frame, frame-rate normalized —
  `1 - (1 - k)^(dt*60)`, not a bare `* 0.15`. Around `k = 0.25`; much lower
  reads as lag, much higher as stepping.
- Prefer **WebCodecs + mp4box** decoding into a frame cache, with a plain
  `<video>` + `currentTime` fallback. Any failure must leave a working site.
- The render function must be **synchronous**: paint the best frame already
  decoded — exact if available, else nearest — and return. A separate pump
  streams frames around the playhead. Awaiting the wanted frame before drawing
  collapses to ~17fps, because most animation frames arrive to find a decode in
  flight and get dropped.
- **Match decoded frames to their index by timestamp, never by arrival order.**
  A decoder under load can drop a frame; with positional matching one drop
  shifts every later frame permanently — wrong pictures, and runs that can never
  be rebuilt because they still look in-flight.
- Submit decode runs **whole and from a keyframe**. A delta frame only decodes
  correctly if its predecessors went through the same decoder in order;
  cherry-picking missing frames silently produces corrupt pictures.
- **Benchmark hardware vs software decode at load** and keep the winner.
  `hardwareAcceleration: 'prefer-hardware'` is the obvious choice and is
  sometimes badly wrong — on machines without real GPU decode it can be ~8×
  slower and stall its queue entirely. Require hardware to win by a clear
  margin, since its failure mode is stalling rather than slowing.
- **Escalate recovery.** Rebuilding a decoder is itself a visible hitch, so a
  rebuild loop trades one glitch for a rhythm of them. First rebuild → drop to
  software; repeated failure → abandon the frame bank and fall back to
  `<video>`, which is coarser but cannot wedge.
- Keep the frame cache **comfortably larger** than the streaming window.
  Trimmed too close, frames get evicted as fast as they are decoded and the
  watchdog starts rebuilding the decoder — far more expensive than the memory
  saved.
- If falling back to `<video>`, throttle seeks: skip while `video.seeking`, and
  ignore deltas under ~1/30s.
- **`preload="metadata"`, not `auto`.** The frame bank fetches the same file the
  `<video>` is pulling, and in Chrome the media-element cache and the fetch cache
  are separate — so `auto` downloaded the whole film **twice**, 67 MB instead of
  33.6 MB, with the two transfers competing for bandwidth. Since the scrub only
  becomes smooth once the bank has the file, the eager preload was delaying the
  very thing it existed to cover for. `metadata` pulls just enough to be seekable.
- Reveal on `loadeddata` as well as `canplay`. With `metadata` preload on a slow
  connection the element can sit at `HAVE_CURRENT_DATA` and never announce
  `canplay`, stranding the fallback behind the safety timeout.

## 4. Scroll mapping

- The scroll track length **is the playback speed**: the film runs across
  `trackHeight - 100vh`. Make it a named constant.
- Map scroll → time **piecewise per chapter**, not linearly. Give each chapter
  the scroll it needs to be read, which is not proportional to its duration.
- Use `svh`, not `vh`, so a mobile URL bar collapsing does not resize the track.
- Drive chapter overlays imperatively from the ticker. Do not re-render React
  per frame; keep only the active chapter index as state.

**On px-per-frame:** an earlier version of this document said to aim for ~3px
and warned that above ~6px the film "steps between notches". That was wrong, and
measurement contradicted it. This site now runs at **19px per video frame** and
is smoother and more cinematic than at 5px. More px/frame means *fewer* frames
per wheel notch, not more — the stepping failure mode is at the far end
(>100px/frame, under one frame per notch), nowhere near here. Treat px/frame as
a pacing dial, not a correctness constraint, and calibrate it by time:

```
secondsToTraverse = (trackHeight - viewportHeight) / scrollPxPerSec
playbackRate      = filmDuration / secondsToTraverse
```

Below 1.0 the footage stops reading as playback and starts reading as a held
shot. ~0.7 is a good cinematic target.

## 5. Pace the page, not the playhead

**The most important lesson on this project, learned the expensive way.**

The instinct when a fast flick looks bad is to slow *the film* — clamp how fast
the playhead may travel. It feels wonderful for about a minute: flick hard and
the footage glides instead of lurching. Then you discover you have decoupled the
film from the scroll position, and that decoupling produces two bugs which are
really one bug:

- the page reaches the end of the track, the sticky stage unpins and **the footer
  arrives with the film unfinished** — the rest is simply skipped
- **the film keeps travelling after the gesture stops**, working through a
  backlog the scrollbar has already spent

You cannot fix those while the two are decoupled; they *are* the decoupling. Keep
the playhead tied to scroll position 1:1 — then reaching the footer requires
having scrolled through the whole film, and a playhead that only moves when
scroll moves cannot run on — and **put the speed limit on the page instead**.

Intercept `wheel`, accumulate a target, and ease the page toward it at a fixed
px/sec ceiling. Two details make or break it:

- **Discard input beyond a small lead, do not queue it.** The lead *is* the coast
  budget — exactly how far the page can still travel after the hand stops. 240px
  against an 850px/sec cap is ~0.28s. Queue everything instead and you have
  reinvented the run-on you were trying to remove. With this in place, 360,000px
  of wheel input moves the page 2.3%.
- **`Home`/`End` must bypass the cap and jump.** They are an explicit "take me
  there", not a scroll gesture. Capping them means a 40-second journey to the
  footer; truncating them like other input makes the keys look dead. Skipping the
  film is legitimate when asked for that deliberately.

Leave **touch native** — intercepting `touchmove` means reimplementing momentum,
rubber-banding and overscroll, worse than the platform does. Pace phones with
track length instead. Leave **reduced-motion** untouched entirely; hijacking the
page is precisely what that setting exists to prevent. Detect external scrolls
(scrollbar drag, anchor jump, find-in-page) and hand back to them rather than
fighting.

Capping the page also removes the stutter for free, because it bounds what the
decoder can be asked for. Do that arithmetic explicitly:

```
framesPerSecDemanded = (filmFrameCount / trackPx) * scrollPxPerSec
```

Compare it to measured decode throughput. **If demand exceeds supply, no amount
of decoder tuning will save you** — see the "Do not bother with these" list in §8.

## 6. Composition and UI

- Text goes where the footage is empty, decided per chapter from the frames.
- Type sizes must answer to viewport **height** as well as width
  (`clamp(min, min(Xvw, Ysvh), max)`), or a landscape phone pushes titles under
  the header.
- **Never leave a CSS `filter` permanently on a full-screen element** — even
  `blur(0px)` forces a full-screen GPU pass every composited frame. In one
  measurement an always-on grade filter alone cost 40% of the frame rate. Bake
  static grades into static layers; apply `filter` only while it is animating.
- The loading bar must report **real bytes** and reach 100% before it lifts.
  Reporting "video is playable" strands it around 15% and looks fake. Weight it
  across the phases that genuinely take time (download / parse / decoder
  selection / first decode).

## 7. Prove it, do not assert it

Before telling me it is smooth, measure — and include the numbers:

- fps and worst frame time during: a normal scroll, a slow scroll, a fast flick,
  a reverse scrub, and the whole film in ~5s.
- **Frame accuracy**: how far the painted frame is from the one the scroll
  position asks for. Average and max. It should be 0 at normal speeds.
- A control run doing no work, to prove the harness is not the bottleneck. If
  the control is not ~60fps, your other numbers are invalid — say so rather
  than reporting them.
- Decoder health: rebuild count, longest hold while the playhead was moving.

Add a `?debug=1` overlay showing fps, dropped frames, active source, decoder
path, rebuild count, cache/queue depth, and longest hold.

### Measurement traps that produced wrong conclusions

Each of these made me report an improvement that was not real. Check for them
before trusting a number.

- **A running maximum never goes down.** `worstHoldFrames` is a high-water mark,
  so once a bad run sets it, every later test reads "0 new holds" and looks
  perfect. **Reset it before each trial.** This one cost the most: it produced a
  confident "stutter fixed" that was pure measurement artifact.
- **Compare by px/sec, not by fraction of the page.** Lengthening the track makes
  the page taller, so "scroll 45% in 1s" is a *faster physical gesture* than
  before and you are no longer comparing like with like. Scroll a fixed number of
  pixels at a fixed velocity.
- **Get a baseline before tuning.** I changed four things and measured them
  against each other rather than against the original code. `git stash` the
  change, measure, restore. Three of the four turned out to do nothing.
- **Run the same trial twice.** On identical code, one metric read 2 and then 18.
  If a number is not reproducible, it cannot support a conclusion — say so
  instead of building on it.
- **Benchmarks contend with each other.** Back-to-back decoder benchmarks reported
  8fps for a file that was fine; the second was still competing with the first.
  Isolate them, and sanity-check absurd results instead of reporting them.
- **The page can be smooth while the film is not.** Frame pacing stayed at a
  median 16.7ms with zero frames over 33ms *while the picture was frozen for a
  second*. rAF timing measures the page; you need a separate measure of whether
  the painted frame is changing.
- **A hidden browser tab throttles rAF to ~1fps.** Anything measured in a
  backgrounded or minimised window is meaningless. Check `document.hidden`.

## 8. Traps that cost real time

- `body { overflow-x: hidden }` makes the body a scroll container and **breaks
  `position: sticky`**. Use `overflow-x: clip`.
- React re-renders overwrite inline styles that GSAP is animating. Keep
  per-frame state out of React entirely.
- Anything that must never get stuck (a loading curtain, a menu) should exit on
  a CSS transition or a timer, never on a GSAP callback that can be missed or
  reverted by StrictMode.
- Never let a missed animation callback leave a full-screen overlay with
  `pointer-events: auto`.
- Hide scroll-progress chrome once the film ends, or it floats over the footer.
- Third-party embeds (maps) inside a scroll-driven film: mount them lazily and
  set `pointer-events: none`, or they swallow the wheel and zoom instead of
  scrolling.
- GitHub rejects files over 100 MB — keep camera masters out of the repo and
  commit only the encodes.
- **Eviction must not sit behind back-pressure.** A cache `trim()` placed after
  the "decoder is busy, bail out" guard never runs while the decoder is busy —
  which is exactly when it is needed. The cache stayed pinned full of pre-flick
  frames, leaving no room for anything near the new playhead, so the picture held
  on one frame for a whole scrub. Order matters: evict first, then decide whether
  to submit more work.
- **A back-pressure limit must exceed the steady-state in-flight count.** Lowering
  a queue limit from 32 to 10 to cut latency looked reasonable and deadlocked the
  pump: in-flight sat at 14–16 during a scrub, so it bailed every single tick and
  issued nothing at all.

### Do not bother with these

Measured, against a proper baseline, on a stutter that turned out to be a
supply-vs-demand problem. All four produced **no reliable improvement**:

- shrinking the decode queue
- adding hysteresis to the fast/slow decode-mode switch
- capping how far ahead the keyframe-only path reaches
- reordering eviction relative to the queue gate *(correct in principle, but it
  did not move the number on its own)*

When the playhead is asking for more frames per second than the decoder can
produce, the only real fixes are **reduce demand** (longer track, capped scroll
speed) or **increase supply** (smaller resolution). Reach for those first and
you will skip a long detour.

## 9. How to work

- Verify in a real browser and show me screenshots at desktop, mobile and
  landscape-phone sizes.
- When you claim something is fixed, say what you measured. When you cannot
  measure it, say that instead of implying you did.
- If I suggest something that will not work, tell me why with evidence rather
  than implementing it.
- **Correct yourself out loud.** Several conclusions here were wrong on the first
  pass — a measurement artifact read as a fix, a grep that missed escaped CSS
  read as "the whole reduced-motion layer is dead", a stale dev-server error read
  as a live bug. Saying "I reported X, it was wrong, here is why" is worth more
  than a clean-looking narrative.
- **Revert changes that do not earn their place.** Four decoder changes here were
  reasoned, plausible and measured to do nothing; they were removed rather than
  shipped as "probably helps". A diff you cannot defend with a number is noise
  the next person has to reason around.
