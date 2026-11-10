import type { UploadApi } from '@modules/background-upload';

/** Removes every stored version of the object through the Worker, which holds the B2 key. */
export async function deleteFromBucket(api: UploadApi, key: string): Promise<void> {
  const response = await fetch(`${api.baseUrl}/objects?key=${encodeURIComponent(key)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${api.token}` },
  });
  if (!response.ok)
    throw new Error(`Deleting ${key} from the bucket failed with HTTP ${response.status}`);
}
