import { AwsClient } from 'aws4fetch';

import type { CompletedPart } from './validation';

export type S3Config = { endpoint: string; bucket: string; accessKeyId: string; secretAccessKey: string };
export type ListedPart = { partNumber: number; etag: string; size: number; uploadedAt: string };
export type StoredObject = { size: number; etag: string };

export interface ObjectStorage {
  createMultipartUpload(key: string, contentType: string): Promise<string>;
  presignPart(key: string, uploadId: string, partNumber: number, md5: string, expiresSec: number): Promise<string>;
  completeMultipartUpload(key: string, uploadId: string, parts: CompletedPart[]): Promise<void>;
  head(key: string): Promise<StoredObject | null>;
  listParts(key: string, uploadId: string): Promise<ListedPart[]>;
  abortMultipartUpload(key: string, uploadId: string): Promise<void>;
}

const B2_HOST = /^s3\.([a-z0-9-]+)\.backblazeb2\.com$/;
const S3_XMLNS = 'http://s3.amazonaws.com/doc/2006-03-01/';

export function regionOf(endpoint: string): string {
  const region = new URL(endpoint).hostname.match(B2_HOST)?.[1];
  if (!region) throw new Error(`Not a Backblaze B2 S3 endpoint: ${endpoint}`);
  return region;
}

export class S3Api implements ObjectStorage {
  private readonly config: S3Config;
  private readonly client: AwsClient;

  constructor(config: S3Config) {
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
    const response = await this.send('CreateMultipartUpload', url, { method: 'POST', headers: { 'Content-Type': contentType } });
    return parseUploadId(await response.text());
  }

  async presignPart(key: string, uploadId: string, partNumber: number, md5: string, expiresSec: number): Promise<string> {
    const url = this.objectUrl(key);
    url.searchParams.set('partNumber', String(partNumber));
    url.searchParams.set('uploadId', uploadId);
    url.searchParams.set('X-Amz-Expires', String(expiresSec));
    const signed = await this.client.sign(new Request(url, { method: 'PUT', headers: { 'Content-MD5': md5 } }), {
      aws: { signQuery: true, allHeaders: true },
    });
    return signed.url;
  }

  async completeMultipartUpload(key: string, uploadId: string, parts: CompletedPart[]): Promise<void> {
    const url = this.objectUrl(key);
    url.searchParams.set('uploadId', uploadId);
    await this.send('CompleteMultipartUpload', url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/xml' },
      body: buildCompleteBody(parts),
    });
  }

  async head(key: string): Promise<StoredObject | null> {
    const response = await this.request(this.objectUrl(key), { method: 'HEAD' });
    if (response.status === 404) return null;
    await ensureOk('HeadObject', response);
    return {
      size: Number(response.headers.get('Content-Length')),
      etag: unquoteEtag(response.headers.get('ETag') ?? ''),
    };
  }

  async listParts(key: string, uploadId: string): Promise<ListedPart[]> {
    const url = this.objectUrl(key);
    url.searchParams.set('uploadId', uploadId);
    return parseListParts(await (await this.send('ListParts', url, { method: 'GET' })).text());
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    const url = this.objectUrl(key);
    url.searchParams.set('uploadId', uploadId);
    await this.send('AbortMultipartUpload', url, { method: 'DELETE' });
  }

  async presignGet(key: string, expiresSec: number): Promise<string> {
    const url = this.objectUrl(key);
    url.searchParams.set('X-Amz-Expires', String(expiresSec));
    return (await this.client.sign(new Request(url), { aws: { signQuery: true } })).url;
  }

  private async send(operation: string, url: URL, init: RequestInit): Promise<Response> {
    return ensureOk(operation, await this.request(url, init));
  }

  private request(url: URL, init: RequestInit): Promise<Response> {
    return this.client.fetch(url, { ...init, cache: 'no-store' });
  }

  private objectUrl(key: string): URL {
    const path = key.split('/').map(encodeURIComponent).join('/');
    return new URL(`/${this.config.bucket}/${path}`, this.config.endpoint);
  }
}

async function ensureOk(operation: string, response: Response): Promise<Response> {
  if (response.ok) return response;
  const code = tag(await response.text(), 'Code') || 'no error code';
  throw new Error(`${operation} failed with HTTP ${response.status}: ${code}`);
}

function tag(xml: string, name: string): string {
  return xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1]?.trim() ?? '';
}

function escapeXmlText(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function unquoteEtag(etag: string): string {
  return etag.replaceAll('&quot;', '').replaceAll('"', '');
}

export function parseUploadId(xml: string): string {
  const uploadId = tag(xml, 'UploadId');
  if (!uploadId) throw new Error('CreateMultipartUpload answered without an UploadId');
  return uploadId;
}

export function buildCompleteBody(parts: CompletedPart[]): string {
  const items = parts.map(
    ({ partNumber, etag }) => `<Part><PartNumber>${partNumber}</PartNumber><ETag>"${escapeXmlText(unquoteEtag(etag))}"</ETag></Part>`,
  );
  return `<CompleteMultipartUpload xmlns="${S3_XMLNS}">${items.join('')}</CompleteMultipartUpload>`;
}

export function parseListParts(xml: string): ListedPart[] {
  return [...xml.matchAll(/<Part>([\s\S]*?)<\/Part>/g)].map(([, part = '']) => ({
    partNumber: Number(tag(part, 'PartNumber')),
    etag: unquoteEtag(tag(part, 'ETag')),
    size: Number(tag(part, 'Size')),
    uploadedAt: tag(part, 'LastModified'),
  }));
}
