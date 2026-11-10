import { Room, RoomEvent, Track } from 'https://cdn.jsdelivr.net/npm/livekit-client@2.23.0/+esm';

const STATS_INTERVAL_MS = 1000;
const RECORDER_MIME = 'video/webm;codecs=vp8,opus';
const SENT_MIME = 'audio/webm;codecs=opus';
const CSV_COLUMNS = [
  'at',
  'phone',
  'frameWidth',
  'frameHeight',
  'framesPerSecond',
  'framesDecoded',
  'freezeCount',
  'totalFreezesDuration',
  'videoPacketsLost',
  'videoJitter',
  'videoBytesReceived',
  'audioPacketsLost',
  'audioJitter',
  'audioLevel',
  'concealedSamples',
  'audioBytesReceived',
];

const $ = (id) => document.getElementById(id);
const hash = new URLSearchParams(location.hash.slice(1));
$('url').value = hash.get('url') ?? '';
$('token').value = hash.get('token') ?? '';

let room;
let audioContext;
let speechTrack;
let statsTimer;
const remote = { video: null, audio: null, audioElement: null };
const csvRows = [CSV_COLUMNS.join(',')];
const recorders = [];

function log(message) {
  const line = `${new Date().toISOString().slice(11, 23)} ${message}`;
  $('log').textContent += `${line}\n`;
  $('log').scrollTop = $('log').scrollHeight;
  console.log(line);
}

function download(blob, name) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function publishSpeech() {
  audioContext = new AudioContext({ sampleRate: 48000 });
  const source = audioContext.createMediaElementSource($('speech'));
  const destination = audioContext.createMediaStreamDestination();
  source.connect(destination);
  speechTrack = destination.stream.getAudioTracks()[0];
  await room.localParticipant.publishTrack(speechTrack, {
    name: 'interviewer-voice',
    source: Track.Source.Microphone,
  });
  log('published interviewer voice');
}

function attachRemote(track, participant) {
  if (track.kind === Track.Kind.Video) {
    remote.video = track;
    const element = track.attach();
    $('remote').replaceChildren(element);
  } else if (track.kind === Track.Kind.Audio) {
    remote.audio = track;
    remote.audioElement = track.attach();
    remote.audioElement.muted = !$('monitor').checked;
    document.body.appendChild(remote.audioElement);
  }
  log(`subscribed ${track.kind} from ${participant.identity}`);
  $('record').disabled = !(remote.video && remote.audio);
}

async function collectStats() {
  const row = {
    at: new Date().toISOString(),
    phone: room?.remoteParticipants.has('iphone') ? 1 : 0,
  };
  const videoReport = await remote.video?.getRTCStatsReport();
  videoReport?.forEach((s) => {
    if (s.type !== 'inbound-rtp') return;
    Object.assign(row, {
      frameWidth: s.frameWidth,
      frameHeight: s.frameHeight,
      framesPerSecond: s.framesPerSecond,
      framesDecoded: s.framesDecoded,
      freezeCount: s.freezeCount,
      totalFreezesDuration: s.totalFreezesDuration,
      videoPacketsLost: s.packetsLost,
      videoJitter: s.jitter,
      videoBytesReceived: s.bytesReceived,
    });
  });
  const audioReport = await remote.audio?.getRTCStatsReport();
  audioReport?.forEach((s) => {
    if (s.type !== 'inbound-rtp') return;
    Object.assign(row, {
      audioPacketsLost: s.packetsLost,
      audioJitter: s.jitter,
      audioLevel: s.audioLevel,
      concealedSamples: s.concealedSamples,
      audioBytesReceived: s.bytesReceived,
    });
  });
  csvRows.push(CSV_COLUMNS.map((c) => row[c] ?? '').join(','));
  $('stats').textContent =
    `video ${row.frameWidth ?? '-'}x${row.frameHeight ?? '-'} @ ${row.framesPerSecond ?? '-'} fps, ` +
    `freezes ${row.freezeCount ?? '-'}, audio level ${row.audioLevel?.toFixed?.(3) ?? '-'}`;
}

function startRecorder(stream, mimeType, name) {
  const chunks = [];
  const recorder = new MediaRecorder(stream, { mimeType });
  recorder.ondataavailable = (event) => event.data.size > 0 && chunks.push(event.data);
  recorder.onstop = () => download(new Blob(chunks, { type: mimeType }), name);
  recorder.start(1000);
  recorders.push(recorder);
}

$('connect').onclick = async () => {
  room = new Room({ adaptiveStream: false, dynacast: false });
  room
    .on(RoomEvent.TrackSubscribed, (track, _pub, participant) => attachRemote(track, participant))
    .on(RoomEvent.TrackUnsubscribed, (track, _pub, participant) =>
      log(`unsubscribed ${track.kind} from ${participant.identity}`),
    )
    .on(RoomEvent.TrackMuted, (pub, participant) =>
      log(`muted ${pub.kind} by ${participant.identity}`),
    )
    .on(RoomEvent.TrackUnmuted, (pub, participant) =>
      log(`unmuted ${pub.kind} by ${participant.identity}`),
    )
    .on(RoomEvent.ParticipantConnected, (p) => log(`participant connected ${p.identity}`))
    .on(RoomEvent.ParticipantDisconnected, (p) => log(`participant disconnected ${p.identity}`))
    .on(RoomEvent.Reconnecting, () => log('reconnecting'))
    .on(RoomEvent.Reconnected, () => log('reconnected'))
    .on(RoomEvent.Disconnected, (reason) => log(`disconnected ${reason ?? ''}`));
  await room.connect($('url').value.trim(), $('token').value.trim());
  log(`connected to ${room.name} as ${room.localParticipant.identity}`);
  await publishSpeech();
  statsTimer = setInterval(collectStats, STATS_INTERVAL_MS);
  for (const id of ['disconnect', 'play', 'pause', 'downloadCsv']) $(id).disabled = false;
  $('connect').disabled = true;
};

$('disconnect').onclick = async () => {
  clearInterval(statsTimer);
  await room.disconnect();
  $('connect').disabled = false;
};

$('play').onclick = async () => {
  await audioContext.resume();
  $('speech').loop = $('loop').checked;
  await $('speech').play();
  log('script playing');
};

$('pause').onclick = () => {
  $('speech').pause();
  log('script paused');
};

$('monitor').onchange = () => {
  if (remote.audioElement) remote.audioElement.muted = !$('monitor').checked;
};

$('record').onclick = () => {
  const id = stamp();
  startRecorder(
    new MediaStream([remote.video.mediaStreamTrack, remote.audio.mediaStreamTrack]),
    RECORDER_MIME,
    `received-${id}.webm`,
  );
  startRecorder(new MediaStream([speechTrack]), SENT_MIME, `sent-${id}.webm`);
  log(`recording received and sent media (${id})`);
  $('record').disabled = true;
  $('stopRecord').disabled = false;
};

$('stopRecord').onclick = () => {
  recorders.splice(0).forEach((recorder) => recorder.stop());
  log('recording stopped');
  $('record').disabled = false;
  $('stopRecord').disabled = true;
};

$('downloadCsv').onclick = () =>
  download(new Blob([csvRows.join('\n')], { type: 'text/csv' }), `stats-${stamp()}.csv`);

if (!$('token').value) {
  const identity = new URLSearchParams(location.search).get('as');
  const file = identity ? `credentials-${identity}.json` : 'credentials.json';
  const saved = await fetch(file)
    .then((response) => (response.ok ? response.json() : null))
    .catch(() => null);
  if (saved) {
    $('url').value = saved.url;
    $('token').value = saved.token;
  }
}
if ($('url').value && $('token').value) $('connect').click();
