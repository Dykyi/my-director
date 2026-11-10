import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseSpeechRequest, parseTokenRequest, RequestError } from './requests.ts';
import { VoiceCatalog } from './voice-catalog.ts';

const voices = new VoiceCatalog([{ name: 'Samantha', locale: 'en_US' }]);

describe('parseTokenRequest', () => {
  it('takes LiveKit-safe names', () =>
    assert.deepEqual(parseTokenRequest({ room: 'mydirector-poc', identity: 'producer_2' }), {
      room: 'mydirector-poc',
      identity: 'producer_2',
    }));

  it('turns down spaces, long and missing names', () => {
    assert.throws(() => parseTokenRequest({ room: 'my room', identity: 'a' }), RequestError);
    assert.throws(() => parseTokenRequest({ room: 'r', identity: 'x'.repeat(65) }), RequestError);
    assert.throws(() => parseTokenRequest(null), RequestError);
  });
});

describe('parseSpeechRequest', () => {
  it('trims the line and keeps a known voice', () =>
    assert.deepEqual(parseSpeechRequest({ text: '  Hello?  ', voice: 'Samantha' }, voices), {
      text: 'Hello?',
      voice: 'Samantha',
    }));

  it('turns down empty or long text and unknown voices', () => {
    assert.throws(() => parseSpeechRequest({ text: ' ', voice: 'Samantha' }, voices), RequestError);
    const long = 'x'.repeat(501);
    assert.throws(
      () => parseSpeechRequest({ text: long, voice: 'Samantha' }, voices),
      RequestError,
    );
    assert.throws(() => parseSpeechRequest({ text: 'Hi', voice: 'Nobody' }, voices), RequestError);
  });
});
