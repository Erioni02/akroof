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

## 4. Scroll mapping

- The scroll track length **is the playback speed**: the film runs across
  `trackHeight - 100vh`. Make it a named constant. Aim for roughly 3px of
  scroll per video frame; below ~2px feels frantic, above ~6px steps.
- Map scroll → time **piecewise per chapter**, not linearly. Give each chapter
  the scroll it needs to be read, which is not proportional to its duration.
- Use `svh`, not `vh`, so a mobile URL bar collapsing does not resize the track.
- Drive chapter overlays imperatively from the ticker. Do not re-render React
  per frame; keep only the active chapter index as state.

## 5. Composition and UI

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

## 6. Prove it, do not assert it

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

## 7. Traps that cost real time

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

## 8. How to work

- Verify in a real browser and show me screenshots at desktop, mobile and
  landscape-phone sizes.
- When you claim something is fixed, say what you measured. When you cannot
  measure it, say that instead of implying you did.
- If I suggest something that will not work, tell me why with evidence rather
  than implementing it.
