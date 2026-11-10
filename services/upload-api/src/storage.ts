import type { CompletedPart } from './validation.ts';

export type ListedPart = { partNumber: number; etag: string; size: number; uploadedAt: string };
export type StoredObject = { size: number; etag: string };

export interface ObjectStorage {
  createMultipartUpload(key: string, contentType: string): Promise<string>;
  presignPart(
    key: string,
    uploadId: string,
    partNumber: number,
    md5: string,
    expiresSec: number,
  ): Promise<string>;
  completeMultipartUpload(key: string, uploadId: string, parts: CompletedPart[]): Promise<void>;
  headObject(key: string): Promise<StoredObject | null>;
  listParts(key: string, uploadId: string): Promise<ListedPart[]>;
  abortMultipartUpload(key: string, uploadId: string): Promise<void>;
  deleteObject(key: string): Promise<void>;
}

export class S3Error extends Error {
  readonly operation: string;
  readonly status: number;
  readonly code: string;

  constructor(operation: string, status: number, code: string) {
    super(`${operation} failed with HTTP ${status}: ${code}`);
    this.operation = operation;
    this.status = status;
    this.code = code;
  }
}

export const isNoSuchUpload = (error: unknown) =>
  error instanceof S3Error && error.code === 'NoSuchUpload';
