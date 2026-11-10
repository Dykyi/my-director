import { NativeModule, requireNativeModule } from 'expo';

import type {
  BackgroundUploadEvents,
  StartUploadInput,
  UploadSnapshot,
} from './BackgroundUpload.types';

declare class BackgroundUploadNativeModule extends NativeModule<BackgroundUploadEvents> {
  requestNotificationPermission(): Promise<boolean>;
  startUpload(input: StartUploadInput): Promise<UploadSnapshot>;
  getUploads(): Promise<UploadSnapshot[]>;
  retryFailedParts(id: string): Promise<void>;
  cancelUpload(id: string): Promise<void>;
}

export const BackgroundUpload =
  requireNativeModule<BackgroundUploadNativeModule>('BackgroundUpload');
