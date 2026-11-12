import { NativeModule, requireNativeModule } from 'expo';

import type {
  CallCredentials,
  CaptureConfig,
  CaptureConfigInput,
  CaptureCoreEvents,
  PermissionsState,
  RecordingSummary,
  RecoveryReport,
  SessionSnapshot,
  VerificationReport,
} from './CaptureCore.types';

declare class CaptureCoreNativeModule extends NativeModule<CaptureCoreEvents> {
  getPermissions(): PermissionsState;
  requestPermissions(): Promise<PermissionsState>;
  getConfig(): CaptureConfig;
  getSnapshot(): SessionSnapshot;
  prepare(config?: CaptureConfigInput): Promise<CaptureConfig>;
  start(url: string, token: string): Promise<string>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  reconnectCall(): Promise<void>;
  /** Renames the phone in the current call, and again after a rejoin that reuses the token from Start. */
  setCallName(name: string): Promise<void>;
  stop(): Promise<RecordingSummary>;
  dismissError(): Promise<void>;
  listRecordings(): Promise<RecordingSummary[]>;
  getRecoveryReports(): Promise<RecoveryReport[]>;
  acknowledgeRecovery(sessionId: string): Promise<void>;
  verifyRecording(sessionId: string): Promise<VerificationReport>;
  deleteRecording(sessionId: string): Promise<void>;
  simulateCrash(): void;
}

const native = requireNativeModule<CaptureCoreNativeModule>('CaptureCore');

export const CaptureCore = {
  getPermissions: () => native.getPermissions(),
  requestPermissions: () => native.requestPermissions(),
  getConfig: () => native.getConfig(),
  getSnapshot: () => native.getSnapshot(),
  prepare: (config?: CaptureConfigInput) => native.prepare(config),
  start: ({ url, token }: CallCredentials) => native.start(url, token),
  pause: () => native.pause(),
  resume: () => native.resume(),
  reconnectCall: () => native.reconnectCall(),
  setCallName: (name: string) => native.setCallName(name),
  stop: () => native.stop(),
  dismissError: () => native.dismissError(),
  listRecordings: () => native.listRecordings(),
  getRecoveryReports: () => native.getRecoveryReports(),
  acknowledgeRecovery: (sessionId: string) => native.acknowledgeRecovery(sessionId),
  verifyRecording: (sessionId: string) => native.verifyRecording(sessionId),
  deleteRecording: (sessionId: string) => native.deleteRecording(sessionId),
  simulateCrash: () => native.simulateCrash(),
  addListener: <Event extends keyof CaptureCoreEvents>(
    event: Event,
    listener: CaptureCoreEvents[Event],
  ) => native.addListener(event, listener),
};
