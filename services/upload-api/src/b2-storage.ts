import { AwsClient } from 'aws4fetch';

import {
  buildCompleteBody,
  parseListParts,
  parseUploadId,
  parseVersionIds,
  unquoteEtag,
  xmlText,
} from './s3-xml.ts';
import { S3Error, type ListedPart, type ObjectStorage, type StoredObject } from './storage.ts';
import type { CompletedPart } from './validation.ts';

type B2Config = {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

const B2_HOST = /^s3\.([a-z0-9-]+)\.backblazeb2\.com$/;
/** SigV4 query signatures live at most 7 days, and B2 keeps the same limit. */
export const DOWNLOAD_LINK_MAX_SEC = 7 * 24 * 60 * 60;

export function regionOf(endpoint: string): string {
  const region = new URL(endpoint).hostname.match(B2_HOST)?.[1];
  if (!region) throw new Error(`Not a Backblaze B2 S3 endpoint: ${endpoint}`);
  return region;
}

async function ensureOk(operation: string, response: Response): Promise<Response> {
  if (response.ok) return response;
  throw new S3Error(
    operation,
    response.status,
    xmlText(await response.text(), 'Code') || 'no error code',
  );
}

/** No parameter properties: scripts/presign-get.mjs runs this file with Node's type stripping. */
export class B2Storage implements ObjectStorage {
  private readonly config: B2Config;
  private readonly client: AwsClient;

  constructor(config: B2Config) {
    this.config = config;
    this.client = new AwsClient({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      service: 's3',
      region: regionOf(config.endpoint),
    });
  }

  async createMultipartUpload(key: string, contentType: string): Promise<string> {
    const url = this.objectUrl(key);
    url.searchParams.set('uploads', '');
    const response = await this.sendChecked('CreateMultipartUpload', url, {
      method: 'POST',
      headers: { 'Content-Type': contentType },
    });
    return parseUploadId(await response.text());
  }

  // `allHeaders` binds Content-MD5 into the signature: the URL is good only for bytes with that digest.
  async presignPart(
    key: string,
    uploadId: string,
    partNumber: number,
    md5: string,
    expiresSec: number,
  ): Promise<string> {
    const url = this.objectUrl(key);
    url.searchParams.set('partNumber', String(partNumber));
    url.searchParams.set('uploadId', uploadId);
    url.searchParams.set('X-Amz-Expires', String(expiresSec));
    const signed = await this.client.sign(
      new Request(url, { method: 'PUT', headers: { 'Content-MD5': md5 } }),
      { aws: { signQuery: true, allHeaders: true } },
    );
    return signed.url;
  }

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: CompletedPart[],
  ): Promise<void> {
    await this.sendChecked('CompleteMultipartUpload', this.uploadUrl(key, uploadId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/xml' },
      body: buildCompleteBody(parts),
    });
  }

  async headObject(key: string): Promise<StoredObject | null> {
    const response = await this.fetchUncached(this.objectUrl(key), { method: 'HEAD' });
    if (response.status === 404) return null;
    await ensureOk('HeadObject', response);
    return {
      size: Number(response.headers.get('Content-Length')),
      etag: unquoteEtag(response.headers.get('ETag') ?? ''),
    };
  }

  // The first 1000 parts; a POC upload has about 30.
  async listParts(key: string, uploadId: string): Promise<ListedPart[]> {
    const response = await this.sendChecked('ListParts', this.uploadUrl(key, uploadId), {
      method: 'GET',
    });
    return parseListParts(await response.text());
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    await this.sendChecked('AbortMultipartUpload', this.uploadUrl(key, uploadId), {
      method: 'DELETE',
    });
  }

  // B2 keeps every version and a plain DELETE only hides the file, so each version goes by its id.
  async deleteObject(key: string): Promise<void> {
    const list = new URL(`/${this.config.bucket}/`, this.config.endpoint);
    list.searchParams.set('versions', '');
    list.searchParams.set('prefix', key);
    const xml = await (
      await this.sendChecked('ListObjectVersions', list, { method: 'GET' })
    ).text();
    for (const versionId of parseVersionIds(xml, key)) {
      const url = this.objectUrl(key);
      url.searchParams.set('versionId', versionId);
      await this.sendChecked('DeleteObject', url, { method: 'DELETE' });
    }
  }

  // Route keys pass SAFE_KEY, which has no quotes, so the name needs no escaping.
  async presignGet(key: string, expiresSec: number): Promise<string> {
    const url = this.objectUrl(key);
    url.searchParams.set('X-Amz-Expires', String(expiresSec));
    url.searchParams.set(
      'response-content-disposition',
      `attachment; filename="${key.replaceAll('/', '-')}"`,
    );
    return (await this.client.sign(new Request(url), { aws: { signQuery: true } })).url;
  }

  private async sendChecked(operation: string, url: URL, init: RequestInit): Promise<Response> {
    return ensureOk(operation, await this.fetchUncached(url, init));
  }

  // Through Cloudflare's cache a HEAD for a cacheable extension such as .bin reaches B2 as a GET,
  // so the SigV4 signature no longer matches and B2 answers 403.
  private fetchUncached(url: URL, init: RequestInit): Promise<Response> {
    return this.client.fetch(url, { ...init, cache: 'no-store' });
  }

  private objectUrl(key: string): URL {
    const path = key.split('/').map(encodeURIComponent).join('/');
    return new URL(`/${this.config.bucket}/${path}`, this.config.endpoint);
  }

  private uploadUrl(key: string, uploadId: string): URL {
    const url = this.objectUrl(key);
    url.searchParams.set('uploadId', uploadId);
    return url;
  }
}
