import { download, fileStamp } from './downloads.ts';

const RECEIVED_MIME = 'video/webm;codecs=vp8,opus';
const SENT_MIME = 'audio/webm;codecs=opus';
const SLICE_MS = 1000;

function record(stream: MediaStream, mimeType: string, name: string): MediaRecorder {
  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(stream, { mimeType });
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  recorder.onstop = () => download(new Blob(chunks, { type: mimeType }), name);
  recorder.start(SLICE_MS);
  return recorder;
}

export class CallRecorder {
  #recorders: MediaRecorder[] = [];
  #startedAt: number | undefined;

  get startedAt(): number | undefined {
    return this.#startedAt;
  }

  get recording(): boolean {
    return this.#startedAt !== undefined;
  }

  start(received: MediaStream, sent: MediaStream): string {
    const id = fileStamp();
    this.#recorders = [
      record(received, RECEIVED_MIME, `received-${id}.webm`),
      record(sent, SENT_MIME, `sent-${id}.webm`),
    ];
    this.#startedAt = Date.now();
    return id;
  }

  stop(): boolean {
    if (!this.recording) return false;
    this.#recorders.forEach((recorder) => recorder.stop());
    this.#recorders = [];
    this.#startedAt = undefined;
    return true;
  }
}
