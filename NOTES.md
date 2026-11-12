# Notes

How the capture works, what was tested on a real iPhone, and the main risks. `FINDINGS.md` has the details and the
numbers of every run.

## How do the same camera frames reach the call and the file?

The app opens the camera once, in its own Swift code. Each frame goes to the file first (1080p, 30 fps, HEVC), and then
a smaller copy of the same frame (720p) goes to LiveKit. The file never waits for the call: if the call is busy, the
call skips that frame and the file keeps every frame. LiveKit's own camera capture and its React Native package are not
used, because both open the camera themselves, and iOS gives the camera to only one owner.

When the phone gets hot, only the call steps down (540p at 24 fps, then 360p at 15 fps). The file stays at 1080p 30 fps.

## How is the audio set up?

- **Echo cancellation.** The microphone runs through Apple's voice processing (echo cancellation, noise suppression and
  level control), which LiveKit sets up for the call. The file records the same cleaned-up sound, so the interviewer's
  voice from the speaker does not leak into the user's voice. Measured echo correlation: 0.076, limit 0.1.
- **Both sides in the file.** The interviewer's voice from the call is mixed into the file at the moment it played, so
  the file holds the whole conversation, each voice once.
- **Sync.** Checked with a flash and click beacon for 10 minutes: sound within 21 ms of the picture, about 2 ms of drift.
- **Short gaps.** About 1.2 s of silence when the call reconnects after a network drop, and about 0.6 s when a Bluetooth
  headset is connected or removed mid-recording. The recording itself does not stop.

## How does the file sound?

Like a clean video call: clear voice, no echo, little room noise. Voice processing makes it sound a bit processed next
to a studio microphone. In pauses the level control raises the microphone gain, so distant sounds such as voices in
another room can be heard; noise suppression removes steady noise like a fan or hum but lets voices through. In complete
silence a faint hiss is audible at full volume (about -74 dB); under speech it is not heard. A Bluetooth headset
microphone sounds narrower, as on any phone call.

## What works?

- **A call and a file together.** The file passes every check: resolution, frame rate, no gaps, sync.
- **A phone call mid-session.** The session pauses and the screen says why; Resume continues in the same room as a new
  numbered segment, with nothing lost before the call.
- **Home screen and the lock button.** The recording pauses while the call stays connected; one tap resumes it.
- **A crash.** After a force-quit the next launch recovers everything up to the last second and shows what was lost.
- **Background upload.** A 300 to 500 MB upload keeps going with the phone locked; after a network drop only the
  unfinished pieces go again; it is marked done only when the server confirms every byte, and the stored file matches
  the one on the phone.
- **Heat.** When the phone heats up, the call loses quality first and the file keeps its quality.

## What does not work, or works only within iOS limits?

- iOS does not let a regular app use the camera in the background, so the home screen and the lock button always pause
  the recording. Only the way back can be made quick.
- Swiping the app away cancels its background uploads; that is an iOS rule. The app restarts them on the next launch,
  and finished pieces are not sent again.
- A crash loses the last fraction of a second (the file is saved every second), and the cut end can carry a little more
  sound than picture (0.1 to 0.2 s). The app marks this as a recovered tail, not a failure.

## What would change in a production app?

Segments uploaded while recording rather than after Stop; each voice also on its own track for editing; call tokens and
upload permission from a backend with per-user tokens; phone calls handled through CallKit; LiveKit from its Swift
package; Apple's Voice Isolation microphone mode, which keeps the nearest voice and mutes the rest (iOS lets the app
open the mode picker but not switch it on), and a gentler level control in pauses to keep background voices out.

## React Native or Swift?

Both. The screens are React Native (Expo). Everything that touches media (camera, audio, the file, sending video to the
call, crash recovery, uploads) is native Swift inside an Expo module. The media has to run with exact timing even when
the JavaScript side is busy or the app is in the background, and it has to own the only camera. JavaScript only sends
commands and shows state. With this split React Native caused no problems on the media side.

## What are the biggest risks?

- Heat on older iPhones in long sessions.
- iOS decides some things: it does not always say when an interruption ends (the app retries Resume), and it chooses
  when background uploads run.
- Voice processing is Apple's and can sound different between iOS versions.
- WebRTC adds about 14 MB to the app, and LiveKit's CocoaPods release stops getting updates in 2027.
- The POC app carries one shared token for the upload service.
