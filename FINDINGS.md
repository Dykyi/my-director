# Findings

The results of the test runs. `NOTES.md` is the one-page summary.

All runs were made on one test iPhone on iOS 18.5 with a debug build driven from the Mac (`yarn stand`) and the
interviewer page in Chrome. "Every check" means the phone's and the Mac's checks of resolution, frame rate, gaps, audio
and sync.

| Run | Result | Key numbers |
|---|---|---|
| Scenario A, call and file together | PASS, 3 min | the 198.2 s file passes every check; the interviewer got 720p at 30 fps with no freezes |
| Scenario B, Telegram call mid-session | PASS | paused on the ring through CallKit; Resume opened segment 2 in the same room; nothing lost before the call |
| Scenario C1, home screen for 20 s | PASS | paused as `appBackground`, the call stayed connected; both segments pass every check |
| Scenario C2, lock button | PASS | paused as `screenLocked`, the call stayed connected, Resume opened segment 2; both segments pass every check |
| Scenario C3, automatic resume | PASS | resumed on its own 0.44 s after the return, segment 2 opened 1.0 s after it; both segments pass every check |
| Scenario D1, swipe from the app switcher | PASS | recovered 0:57, lost 0.7 to 1.2 s; the file decodes and plays; the cut end carries 172 ms more sound than picture |
| Scenario D2, Simulate crash at 6:00 | PASS | recovered 6:00 of 6:00, lost up to 0.5 s; the recovered file passes every check |
| Crash under iOS screen recording | PASS · recovered | crash 2:00 into a demo: recovered 2:14 with 0.1 to 0.6 s lost, played back on the phone |
| Scenario E, background upload | PASS | parts land with the phone locked; the upload is `verified` 35 s before the app is opened; SHA-256 in B2 equals the phone's file |
| Scenario E with network loss | PASS | Wi-Fi off right after Upload with the phone locked: nothing landed meanwhile, iOS finished all 9 parts after Wi-Fi came back, `verified` in the background; SHA-256 matches |
| Scenario F, a warm phone (natural heat, 5 min) | PASS | started `serious`: call 540p 24 fps, file 1080p 30; cooled to `fair`, call back to 720p 30 after the 60 s delay; the file passes every check |
| Scenario F, 20 min on the charger | PASS | 20:13 in one segment, the file passes every check (1080p, 30.00 fps, no gaps); the phone stayed `nominal` the whole time, so the call kept 720p at 29 to 31 fps (0.7 to 1.6 Mbit/s); the heat steps are shown by the Xcode run below |
| Heat from Xcode (Thermal State) | PASS | serious: call 540p 24 fps at 0.57 Mbit/s; critical: call 360p 15 fps at 0.18 Mbit/s; back up one step 60 s after cooling; the file stayed 1080p 30 fps at 6.0 Mbit/s in every phase |
| Camera opened once | PASS | one `AVCaptureSession` and one video output; the camera is configured once per prepare and never during a recording |
| Sync, 10 min | PASS | 598 flash and click pairs: audio -4 ms at the start and -21 ms at the end (limit ±40), 1.8 ms drift over 10 min, no corrections |
| Echo | PASS | max correlation 0.076 (limit 0.1) |
| The interviewer's voice in the file | PASS | two segments (61 s, 35 s) with the call mixed in for their whole length; every question found in the phone's track at speech level; no echo by ear |
| Both voices, speaker then a Bluetooth headset | PASS | 102 s, the headset on from 55 s to 92 s: 9 of 9 interviewer lines found, spread 9.1, 13.5 and 0 ms per route (limit 20); interviewer -18.5 dB, user -19.3 dB |
| Bluetooth headset mid-recording | PASS | connected and removed mid-recording, also with the call mixed in: no pause, one segment passing every check, about 0.6 s of silence per switch |
| Bad network | PASS | Very Poor Network for a minute: the call fell to 4 to 5 fps at 255 to 369 kbps, then 540p; 100% loss for 15 s: the interviewer's audio came back by itself 10 to 15 s after the network; every file 30 fps with no gaps, no pause |
| No silent failures | PASS | no network at Start: `Could not join the call` with the reason; microphone revoked in Settings: the app shows the access card; disk and stall limits covered by unit tests |
| Asking for access | PASS | one card asks for camera, microphone and upload notices before the camera starts; a denied microphone or camera shows `Microphone is off` or `Camera is off` with Open Settings, also after a cold restart |
| Auto-lock 30 s | PASS | 3 minutes of recording untouched in one segment, the screen stayed on |
| Call tokens from the Worker, two phones | PASS | the phone joined as `iphone-4GKC` with a token from the Worker; a second phone joined beside it, the page kept the first |
| Phone name in the room | PASS | renamed to `studio` mid-call; the page showed it at once |
| Reading for 10 minutes | PASS | 54 of 59 ten-second windows of the page's voice found in the file (median correlation 0.84); the voice moved 25 ms over 10 minutes |
| Demo mode, 2 min | PASS | the page asked and answered by itself; the file passes every check; all 5 interviewer lines found; the guest at -19.6 dB through the phone's microphone; subtitles within 50 ms of the voice |
| Download link | PASS | 7-day link; the downloaded file matched the phone's by SHA-256; offline the error shows under the segment |
| Share to Photos | PASS | a segment saved to Photos from the share sheet, no download from B2 |
