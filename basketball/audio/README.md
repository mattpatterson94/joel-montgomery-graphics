# Machine recordings

Short contacts extracted from the supplied IMG_3554.mp4 office-machine video.
Selection uses visible contacts and waveform alignment; the mix needs an ears-on review.

| Clip | Source seconds |
| --- | --- |
| rim-1 | 0.408–0.910 |
| rim-2 | 1.735–2.180 |
| sensor-1 | 4.570–4.840 |
| sensor-2 | 14.775–15.005 |
| return-1 | 15.035–15.415 |
| return-2 | 6.085–6.365 |
| fabric-impact | 4.865–5.055 |

Mono 22.05 kHz PCM WAV; 65 Hz high-pass, 8.5 kHz low-pass, peak normalization,
3 ms entrance and 35 ms exit fades. Only these short clips ship, not the video.

Scoring-arm clips trigger below the net. Return clips trigger once on the first
ramp contact. Return gain is 0.08 versus 0.7 for the scoring arm (about 19 dB lower
at equal impact strength); subsequent fabric impacts are also quiet. Variants
alternate, with slight playback-rate variation. Network/decode failures retain
procedural fallbacks; the game never waits for audio loading.

## Round cues and backboard (October 2026)

Extracted from the three additional office videos supplied for the game:

| Clip | Source | Source seconds | Trigger |
| --- | --- | --- | --- |
| round-start | IMG_4428.mp4 | 1.490–2.940 | Start / Restart Round |
| three-pointer | IMG_4430.mp4 | 0.920–2.160 | Timer reaches 10 |
| countdown | IMG_4430.mp4 | 8.140–8.760 | Timer reaches 3, 2, and 1 |
| round-end | IMG_4430.mp4 | 11.160–12.980 | Timer reaches 0 |
| backboard | IMG_4432.mp4 | 0.409–0.770 | Existing board collision event |

Mono 22.05 kHz PCM WAV. Machine cues use a 140 Hz high-pass to reduce room
rumble; the backboard uses 65 Hz to retain the impact body. All use an 8.5 kHz
low-pass, peak normalization to 0.88, a 3 ms entrance fade and a 35 ms exit fade.
The backboard cut excludes the subsequent catch. The announcements and timer
cues always play at their original pitch; impact recordings retain slight variation.

Bytes preload on page entry. AudioContext activation remains synchronous in the
Start Round click for iPhone compatibility. The first startup cue waits for decode,
but is skipped if loading takes over three seconds. Restart cancels both an active
round cue and an earlier pending startup request. Muting/backgrounding stops active
round cues; missed countdown seconds are never queued for later playback.

Cuts were checked against video frames and waveform/spectral timing. Final
subjective mix balance still needs an ears-on review on the game preview.

## Scoring beep (October 2026)

`score.wav` is a 28.160–28.550s extract from IMG_0758.mp4, following a basket
visible around 28 seconds. The recurring narrow tone is approximately 1706 Hz.
A fourth-order 1450–1950 Hz band-pass suppresses the overlapping ball/arm impact;
the clip is normalized to 0.8 peak with 8 ms entrance / 45 ms exit fades.
This is a filtered recording, not a synthesized replacement. Subjective matching
still needs an ears-on check; selection used frame and spectral evidence.

The beep plays only where points are awarded to a ball from the current live
round, before the deadline. It never plays for free-play baskets. Sensor and net
contacts remain separate physical sounds. Carpet (`floor`) collisions now use
short low-pass noise at 190 Hz rather than the rubber bounce's slap and ringing.
