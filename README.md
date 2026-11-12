# MyDirector iOS capture POC

An iPhone app that films a live video interview twice at once: the camera and microphone go into a LiveKit call with an
interviewer, and the same frames go into a full-quality file on the phone. The file survives interruptions and crashes,
and uploads to cloud storage in the background.

`NOTES.md` is the one-page summary of how it works and the main risks. `FINDINGS.md` has every test run and its results.

## Features

- 1080p at 30 fps file on the phone while the call runs at call quality from the same camera
- The interviewer's voice from the call is mixed into the file next to the user's
- Pauses for a phone call, the home screen or the lock button and resumes in the same room; each stretch is a numbered
  segment
- After a crash the next launch recovers the recording up to the last fraction of a second and shows what was lost
- A check of every recording (resolution, frame rate, gaps, audio, sync), on the phone and on the Mac
- Background upload of 300–500 MB segments to Backblaze B2 that survives a locked phone and a lost connection
- Share a segment to Photos, Drive or AirDrop, or copy a 7-day download link
- An interviewer web page that asks questions by voice, reads a text, or holds a whole demo conversation by itself

## How it fits together

```
iPhone app ───── call ─────▶ LiveKit Cloud ◀───── interviewer page in Chrome on the Mac
    │                                              (its local server gives it a token and speaks with macOS voices)
    ▼
upload Worker (Cloudflare) ───▶ Backblaze B2
```

The upload Worker holds every secret the phone must not ship: it issues the phone's call tokens and signs uploads and
download links. Any iPhone with the app joins the call as `iphone-<install id>`; the page follows the first phone in the
room.

## Project structure

A Yarn workspaces monorepo.

| Folder | What it is |
|---|---|
| `apps/mobile` | the Expo app; native Swift modules in `modules/` (`capture-core`, `background-upload`), Mac scripts in `scripts/` |
| `apps/interviewer` | the interviewer page and its local server |
| `services/upload-api` | the Cloudflare Worker for call tokens, uploads and download links |
| `packages/design-system` | design tokens shared by the app and the page |
| `tools/verify`, `tools/sync-beacon` | Python checks of recordings; a flash and click page for the sync check |

## Requirements

- macOS with Xcode 27, Node 24, Yarn 4 (`corepack enable`), CocoaPods, ffmpeg, Python 3, Google Chrome
- An iPhone on iOS 17 or later with Developer Mode on
- Accounts: LiveKit Cloud, Backblaze B2, Cloudflare, an Apple Developer team; `eas-cli` and the Expo project
  `@dikiy/mydirector` for cloud builds

## Setup

1. `yarn install`
2. `cp .env.example .env.local` and `cp apps/mobile/.env.example apps/mobile/.env.local`, then fill them in. The comments
   in each file say what every value is for. The app gets only the Worker's URL and token
3. The Worker: `yarn upload-api types`, store its secrets with `npx wrangler secret put <NAME>` in
   `services/upload-api` (the LiveKit and B2 keys and `UPLOAD_API_TOKEN`), then `yarn deploy:api`
4. The app: `yarn ios` builds a debug build and installs it on the iPhone

## Run and use

- `yarn interviewer` opens the interviewer page in Chrome; press Join. Pick the mode in its settings: Questions, Reading,
  or Demo, where the page talks with the phone by itself; for Demo open Scene and line the phone up with its frame
- On the iPhone press Start. The app joins the call and records; Stop ends the recording and checks it
- The Recordings tab plays, verifies, uploads and shares recordings; the Room screen shows who is in the call and
  renames the phone
- `yarn start` runs Metro for a build already on the phone. `yarn stand <action>` drives the debug build from the Mac
  (`start`, `stop`, `pause`, `resume`, `upload`, `verify`, `play`, `sigkill` and more); `yarn pull <label>` copies the
  recordings to the Mac and checks them

## Check a recording on the Mac

Once: `python3 -m venv tools/verify/.venv && tools/verify/.venv/bin/pip install -r tools/verify/requirements.txt`.

While "Record when the phone joins" is on in its settings, the interviewer page saves two files to Downloads for each
call: `sent-<time>.webm`, the interviewer's voice it sent, and `received-<time>.webm`, the picture and sound it got from
the phone (the 720p call copy; open it in a browser to see what the interviewer saw). The phone keeps the full file as
`segment-001.mov`, `segment-002.mov` and so on, one per stretch between pauses.

| Check | Command | Passes when |
|---|---|---|
| The phone's file | `yarn pull <label>` | every segment is at least 1080p and 29.5 fps, with no gaps over 100 ms, audio as long as the video and a clean decode; a segment recovered after a crash shows `TAIL` for the cut end and still passes |
| The interviewer's voice in the file | `tools/verify/.venv/bin/python tools/verify/mix-check.py ~/Downloads/sent-<time>.webm pulled/<label>/<session>/segment-*.mov` | every line is found at an offset that moves by 20 ms at most, and the interviewer is at most 10 dB quieter than the user |
| No echo back to the interviewer | `tools/verify/.venv/bin/python tools/verify/echo-check.py ~/Downloads/sent-<time>.webm ~/Downloads/received-<time>.webm` | the interviewer's voice correlates below 0.1 with what came back from the phone |
| Sound against picture | film `tools/sync-beacon/index.html` (a flash and a click every second), then `tools/verify/.venv/bin/python tools/verify/av-sync.py <segment>` | the offsets stay within ±40 ms |

The first three print PASS or FAIL under their numbers. The recordings hold the phone's camera and microphone, so delete
`pulled/` and the WebM files after the check.

## Deploy

- **Worker:** `yarn deploy:api`; logs with `yarn tail:api`
- **TestFlight from the Mac:** raise `ios.buildNumber` in `apps/mobile/app.config.ts`, run `npx expo prebuild
  --platform ios` in `apps/mobile`, archive with Xcode 27 (`xcodebuild ... archive`, or Product > Archive) and upload
  from Organizer
- **TestFlight from EAS:** `yarn release:ios` builds in the cloud and submits. EAS counts build numbers on its own
  servers, so after an upload from Xcode set its counter once with `eas build:version:set --platform ios`
- **JS-only update:** `yarn update:ios --message "<what changed>"` sends the bundle to installed builds over the air.
  Any native change (Swift, `app.config.ts`, a package with native code) needs a new build

## Free plan limits

The project runs on free plans. These limits are the ones a test can run into (November 2026; the services' pricing
pages have the current numbers).

| Service | Free limit | What hitting it looks like |
|---|---|---|
| Backblaze B2 | 10 GB stored; per day 1 GB of downloads, 2,500 Class B calls (downloads, file checks) and 2,500 Class C calls (part listings); daily counters reset at 00:00 GMT | B2 answers HTTP 403 (cap exceeded): an upload or a download link fails until the next day, or until old files are deleted when storage is full. A 10-minute file is about 450 MB, so 1 GB is about two downloads a day; Share on the phone does not touch B2 |
| LiveKit Cloud (Build) | 5,000 participant minutes a month, 100 participants at once | the phone and the page count separately, so a 10-minute call uses 20 minutes, about 250 such calls a month; after that, joining the call fails until the next month |
| Cloudflare Workers (Free) | 100,000 requests a day, 10 ms of CPU per request | the Worker answers with an error until 00:00 UTC; call tokens and signed links use a small part of it |
| Expo EAS (Free) | 15 iOS cloud builds a month in a low-priority queue; 1,000 users of over-the-air updates a month | builds wait longer, then stop until the next month; an Xcode build on the Mac does not count |

## Commands

| Command | What it does |
|---|---|
| `yarn ios`, `yarn start` | build and install the debug app; Metro for an installed build |
| `yarn interviewer` | the interviewer page |
| `yarn stand <action>`, `yarn pull <label>` | drive the phone from the Mac; copy and check its recordings |
| `yarn deploy:api`, `yarn tail:api` | deploy the Worker; its logs |
| `yarn release:ios`, `yarn update:ios` | EAS build and TestFlight submit; over-the-air update |
| `yarn upload-api presign <key> [days]` | a download link to an uploaded file |
| `yarn check` | format, types, lint and every test (JS, Swift, Python) before a commit |
| `yarn mobile <script>`, `yarn upload-api <script>` | any other script of that workspace |
