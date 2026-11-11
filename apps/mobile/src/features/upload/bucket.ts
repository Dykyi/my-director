import { z } from 'zod';

import type { UploadApi } from '@modules/background-upload';

import { describeError } from '@shared/describe-error';

const linkSchema = z.object({ url: z.url({ protocol: /^https$/ }) });

const linkFailed = (reason: string) => new Error(`Could not make a download link: ${reason}`);

/** Removes every stored version of the object through the Worker, which holds the B2 key. */
export async function deleteFromBucket(api: UploadApi, key: string): Promise<void> {
  const response = await fetch(`${api.baseUrl}/objects?key=${encodeURIComponent(key)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${api.token}` },
  });
  if (!response.ok)
    throw new Error(`Deleting ${key} from the bucket failed with HTTP ${response.status}`);
}

export async function downloadLink(api: UploadApi, key: string): Promise<string> {
  const response = await fetch(`${api.baseUrl}/download-link?key=${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${api.token}` },
  }).catch((error: unknown) => {
    throw linkFailed(describeError(error));
  });
  if (!response.ok) throw linkFailed(`the Worker answered HTTP ${response.status}`);
  const link = linkSchema.safeParse(await response.json().catch(() => undefined));
  if (!link.success) throw linkFailed('the Worker sent no link');
  return link.data.url;
}
