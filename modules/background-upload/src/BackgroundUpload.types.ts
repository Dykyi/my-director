export type UploadApi = { baseUrl: string; token: string };

export type StartUploadInput = {
  fileUri: string;
  objectKey: string;
  api: UploadApi;
  partSizeMB?: number;
  maxAttemptsPerPart?: number;
};

export type UploadPhase = 'preparing' | 'uploading' | 'completing' | 'verified' | 'failed' | 'cancelled';

export type UploadRetry = { partNumber: number; attempt: number; reason: string; at: string };

export type UploadSnapshot = {
  id: string;
  fileUri: string;
  objectKey: string;
  uploadId?: string;
  phase: UploadPhase;
  bytesTotal: number;
  bytesConfirmed: number;
  partsTotal: number;
  partsDone: number;
  retries: UploadRetry[];
  serverSize?: number;
  error?: string;
  updatedAt: string;
};

export type BackgroundUploadEvents = { onUploadChange: (snapshot: UploadSnapshot) => void };
