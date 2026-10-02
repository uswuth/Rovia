# Screen Recording — Capture Contract

Measured facts that the backend implementation depends on. Everything here was
observed in a throwaway browser diagnostic that has since been deleted; this
document is the surviving record of it.

Test environment: **Chromium 148 / Google Chrome 148, Windows**.

## Media format

| Property | Value | Note |
| --- | --- | --- |
| Container / codec | `video/webm` — VP8 or VP9 with Opus | Both encode successfully |
| Resolution | 1280×658 | Constrain via `ideal: 1280×720`; the browser picks the final size |
| Frame rate | 30 | Source-reported |
| `videoBitsPerSecond` | `1_000_000` | **Must be set explicitly.** Leaving it to the browser default is the single largest size lever. |
| `audioBitsPerSecond` | `64_000` | Speech-grade mono |
| Measured size | **0.98 MB / 15 s ≈ 3.9 MB / minute** | |
| Measured duration | 60.02 s against a 60.00 s target (drift ≤ 0.03 s) | The client-side timer is accurate; record measured duration, not requested |

Recommended server constants:

```text
MAX_RECORDING_DURATION_MS = 60_000
MAX_RECORDING_SIZE_BYTES   = 25_678_900   // 25 MB — ~6 min of headroom over the 60s cap
```

`MAX_RECORDING_SIZE_BYTES` is a **policy limit, not a trust boundary**. A client can
send any `Content-Length` it likes. `complete()` must treat
`HeadObject.ContentLength` as authoritative and reject (then delete) any object
over the limit.

## Audio

MVP audio is **the audio tracks available to the browser's recording stream**.
It is explicitly *not* "all participants in a future WebRTC meeting" — that
requires the media architecture, which does not exist yet.

Observed on Windows Chrome:

- **Sharing a tab** with "Share tab audio" ticked → 1 audio track available
- **Sharing the whole screen** → **0 audio tracks**; system audio is not offered
- Microphone via `getUserMedia` → 1 track

So the MVP can capture **microphone + tab/system audio**. The product must tell
users to share a *tab* with tab audio enabled, or they will silently get video
only.

### Mixing: the one real trap

Audio sources **must** be routed through the Web Audio graph:

```ts
const ctx = new AudioContext();
const dest = ctx.createMediaStreamDestination();
for (const track of [...displayStream.getAudioTracks(), ...micStream.getAudioTracks()]) {
  ctx.createMediaStreamSource(new MediaStream([track])).connect(dest);
}
const mixed = new MediaStream([
  ...displayStream.getVideoTracks(),
  ...dest.stream.getAudioTracks(),   // exactly one audio track
]);
```

Appending a source track directly onto `dest.stream` instead of connecting it
bypasses the graph. The destination never receives samples, the WebM muxer waits
for audio clusters that never arrive, and `MediaRecorder` produces a **0-byte
file with no error** while the source is demonstrably live.

This was diagnosed by isolation, not inspection — the same capture, codec and
duration produced 0 bytes with a broken graph and 0.98 MB once sources were
connected properly. If recordings ever come out empty, check this first.

## MIME type: validate what was emitted, not what was requested

The browser does not always honour the requested codec string:

| Requested | Emitted |
| --- | --- |
| `video/webm;codecs=vp9,opus` | `video/webm;codecs=vp9` |
| `video/webm;codecs=vp8` | `video/webm;codecs=vp8,opus` |
| `video/webm;codecs=vp8,opus` | `video/webm;codecs=vp8,opus` |

Consequences for the server:

- The allowlist is checked against the **emitted** `recorder.mimeType`, and
  `complete()` re-verifies the stored object's `ContentType` via `HeadObject`.
- The **storage key extension is derived from the validated MIME type**
  (`.webm` / `.mp4`), never hardcoded — Chrome 148 also reports `video/mp4` as
  supported, and other browsers will use it exclusively.

## Future audio

Keep the recorder's audio inputs injectable so the meeting room can pass
`[localMic, localDisplay, ...remoteStreams]` later without touching the
recorder, the upload, or the transcription pipeline:

```ts
useScreenRecorder({ audioSources: MediaStream[] })
```
