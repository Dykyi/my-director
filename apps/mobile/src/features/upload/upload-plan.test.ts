import { describe, expect, it, jest } from '@jest/globals';

import type { UploadSnapshot } from '@modules/background-upload';

import { recording, segment } from '@test/session-fixtures';

import {
  findUpload,
  recordingStatus,
  runningJobs,
  runUploadPlan,
  uploadPlan,
  upsertUpload,
  verifiedKeys,
} from './upload-plan';

const SESSION = recording().sessionId;
const keyOf = (index: number) => `${SESSION}/segment-00${index}.mov`;

const job = (
  index: number,
  phase: UploadSnapshot['phase'],
  id = `job-${index}`,
): UploadSnapshot => ({
  id,
  fileUri: `file:///s/segment-00${index}.mov`,
  objectKey: keyOf(index),
  phase,
  bytesTotal: 10,
  bytesConfirmed: 0,
  partsTotal: 1,
  partsDone: 0,
  retries: [],
  updatedAt: '2026-11-10T09:00:00.000Z',
});

describe('upsertUpload', () => {
  it('puts the changed job first and keeps one entry per job', () =>
    expect(
      upsertUpload([job(1, 'uploading'), job(2, 'uploading')], job(2, 'verified')).map((u) => [
        u.id,
        u.phase,
      ]),
    ).toEqual([
      ['job-2', 'verified'],
      ['job-1', 'uploading'],
    ]));
});

describe('findUpload', () => {
  it('takes the latest job of an object', () =>
    expect(findUpload([job(1, 'uploading', 'new'), job(1, 'failed', 'old')], keyOf(1))?.id).toBe(
      'new',
    ));
});

describe('recordingStatus', () => {
  it('lists the closed segments still to upload and what runs or finished', () => {
    const status = recordingStatus(recording(), [job(1, 'verified')]);
    expect(status.pending.map((s) => s.index)).toEqual([2]);
    expect(status).toMatchObject({ uploading: false, verified: true });
  });
  it('skips a segment that is still being written', () =>
    expect(
      recordingStatus(recording({ segments: [segment(1, { state: 'writing' })] }), []).pending,
    ).toEqual([]));
});

describe('verifiedKeys and runningJobs', () => {
  const uploads = [job(1, 'verified'), job(2, 'uploading')];
  it('names the objects in the bucket', () =>
    expect(verifiedKeys(recording(), uploads)).toEqual([keyOf(1)]));
  it('names the jobs to stop', () =>
    expect(runningJobs(recording(), uploads).map((u) => u.id)).toEqual(['job-2']));
});

describe('uploadPlan', () => {
  it('replaces a failed job and restarts a cancelled one as it is', () =>
    expect(uploadPlan(recording(), [job(1, 'failed'), job(2, 'cancelled')])).toEqual([
      { segment: segment(1), replaces: job(1, 'failed') },
      { segment: segment(2) },
    ]));
});

describe('runUploadPlan', () => {
  const io = () => ({
    cancelUpload: jest.fn(async (_id: string) => {}),
    startUpload: jest.fn(async (step: { segment: { index: number } }) =>
      job(step.segment.index, 'uploading'),
    ),
    stopped: jest.fn(() => false),
    onSnapshot: jest.fn(),
  });

  it('cancels the failed job before it starts the new one', async () => {
    const calls: string[] = [];
    const steps = io();
    steps.cancelUpload.mockImplementation(async (id: string) => void calls.push(`cancel ${id}`));
    steps.startUpload.mockImplementation(async (step) => {
      calls.push(`start ${step.segment.index}`);
      return job(step.segment.index, 'uploading');
    });
    await runUploadPlan([{ segment: segment(1), replaces: job(1, 'failed') }], steps);
    expect(calls).toEqual(['cancel job-1', 'start 1']);
  });

  it('starts nothing more once the recording is cancelled', async () => {
    const steps = io();
    steps.stopped.mockReturnValueOnce(false).mockReturnValue(true);
    await runUploadPlan([{ segment: segment(1) }, { segment: segment(2) }], steps);
    expect(steps.startUpload).toHaveBeenCalledTimes(1);
    expect(steps.onSnapshot).toHaveBeenCalledTimes(1);
  });
});
