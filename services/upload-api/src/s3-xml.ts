import type { ListedPart } from './storage.ts';
import type { CompletedPart } from './validation.ts';

const S3_XMLNS = 'http://s3.amazonaws.com/doc/2006-03-01/';

export function xmlText(xml: string, element: string): string {
  return xml.match(new RegExp(`<${element}>([\\s\\S]*?)</${element}>`))?.[1]?.trim() ?? '';
}

// ETags come from the app, so they are escaped like any input; element text needs only &, < and >.
function escapeXmlText(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function unquoteEtag(etag: string): string {
  return etag.replaceAll('&quot;', '').replaceAll('"', '');
}

export function parseUploadId(xml: string): string {
  const uploadId = xmlText(xml, 'UploadId');
  if (!uploadId) throw new Error('CreateMultipartUpload answered without an UploadId');
  return uploadId;
}

// ETags go back quoted, the way UploadPart returned them; B2 accepts this.
export function buildCompleteBody(parts: CompletedPart[]): string {
  const items = parts.map(
    ({ partNumber, etag }) =>
      `<Part><PartNumber>${partNumber}</PartNumber><ETag>"${escapeXmlText(unquoteEtag(etag))}"</ETag></Part>`,
  );
  return `<CompleteMultipartUpload xmlns="${S3_XMLNS}">${items.join('')}</CompleteMultipartUpload>`;
}

export function parseListParts(xml: string): ListedPart[] {
  return [...xml.matchAll(/<Part>([\s\S]*?)<\/Part>/g)].map(([, part = '']) => ({
    partNumber: Number(xmlText(part, 'PartNumber')),
    etag: unquoteEtag(xmlText(part, 'ETag')),
    size: Number(xmlText(part, 'Size')),
    uploadedAt: xmlText(part, 'LastModified'),
  }));
}

// A prefix listing also returns longer keys, so only exactly `key` counts.
export function parseVersionIds(xml: string, key: string): string[] {
  return [...xml.matchAll(/<(Version|DeleteMarker)>([\s\S]*?)<\/\1>/g)]
    .map(([, , entry = '']) => entry)
    .filter((entry) => xmlText(entry, 'Key') === key)
    .map((entry) => xmlText(entry, 'VersionId'));
}
