import { useEffect, useEffectEvent, useState } from 'react';
import { Button, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { requireNativeModule } from 'expo';
import { CapturePreview } from '@modules/capture-core/src/CapturePreview';

type LogEntry = { at: string; level: string; category: string; message: string; data?: Record<string, string> };
type CallProfile = 'standard' | 'reduced' | 'minimal';
type SegmentInspection = { file: string; uri: string; playable: string; durationSec: string; bytes: string; reason: string };
type SpikeModule = {
  requestPermissions(): Promise<unknown>;
  debugStartCamera(): Promise<Record<string, string>>;
  debugStartSegment(): Promise<string>;
  debugStopSegment(): Promise<string>;
  debugStartMic(): Promise<Record<string, string>>;
  debugStopMic(): Promise<void>;
  debugConnect(url: string, token: string): Promise<string[]>;
  debugDisconnect(): Promise<void>;
  debugSetCallProfile(profile: CallProfile): Promise<void>;
  debugInspectLatestSegment(): Promise<SegmentInspection>;
  debugCrash(): void;
  debugStats(): Promise<Record<string, string>>;
  addListener(event: 'onLog', listener: (entry: LogEntry) => void): { remove(): void };
};
type StandAction = { title: string; run: () => Promise<unknown>; color?: string };
type UploadChange = { objectKey: string; phase: string; partsDone: number; partsTotal: number; bytesConfirmed: number; serverSize?: number; error?: string };
type UploadModule = {
  startUpload(input: { fileUri: string; objectKey: string; api: { baseUrl: string; token: string } }): Promise<UploadChange>;
  addListener(event: 'onUploadChange', listener: (change: UploadChange) => void): { remove(): void };
};

const Spike = requireNativeModule<SpikeModule>('CaptureCore');
const Upload = requireNativeModule<UploadModule>('BackgroundUpload');
const LOG_LIMIT = 200;
const STATS_INTERVAL_MS = 1000;
const STATS_LOG_INTERVAL_MS = 10_000;
const LIVEKIT_URL = process.env.EXPO_PUBLIC_LIVEKIT_URL ?? '';
const LIVEKIT_TOKEN = process.env.EXPO_PUBLIC_LIVEKIT_TOKEN ?? '';
const UPLOAD_API = {
  baseUrl: process.env.EXPO_PUBLIC_UPLOAD_API_URL ?? '',
  token: process.env.EXPO_PUBLIC_UPLOAD_API_TOKEN ?? '',
};
const STAND_LINK = /:\/\/stand\/([\w-]+)$/;
const CALL_PROFILES: CallProfile[] = ['standard', 'reduced', 'minimal'];

const formatUpload = (change: UploadChange) =>
  `${change.objectKey} ${change.phase} ${change.partsDone}/${change.partsTotal} parts, ${change.bytesConfirmed} B` +
  (change.serverSize === undefined ? '' : `, server ${change.serverSize} B`) +
  (change.error ? `, error ${change.error}` : '');

const formatStats = (stats: Record<string, string>) =>
  Object.entries(stats)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}: ${value}`);

export default function App() {
  const [cameraReady, setCameraReady] = useState(false);
  const [stats, setStats] = useState<Record<string, string>>({});
  const [lines, setLines] = useState<string[]>([]);

  const append = (line: string) => {
    console.log(line);
    setLines((current) => [line, ...current].slice(0, LOG_LIMIT));
  };

  const actions: Record<string, StandAction> = {
    permissions: { title: 'Permissions', run: Spike.requestPermissions },
    camera: {
      title: 'Camera',
      run: async () => {
        const report = await Spike.debugStartCamera();
        setCameraReady(true);
        return report;
      },
    },
    'mic-on': { title: 'Mic on', run: Spike.debugStartMic },
    'mic-off': { title: 'Mic off', run: Spike.debugStopMic },
    'segment-start': { title: 'Segment start', run: Spike.debugStartSegment },
    'segment-stop': { title: 'Segment stop', run: Spike.debugStopSegment },
    connect: { title: 'Connect', run: () => Spike.debugConnect(LIVEKIT_URL, LIVEKIT_TOKEN) },
    disconnect: { title: 'Disconnect', run: Spike.debugDisconnect },
    ...Object.fromEntries(
      CALL_PROFILES.map((profile) => [profile, { title: profile, run: () => Spike.debugSetCallProfile(profile) }]),
    ),
    inspect: { title: 'Inspect latest', run: Spike.debugInspectLatestSegment },
    upload: {
      title: 'Upload latest',
      run: async () => {
        const latest = await Spike.debugInspectLatestSegment();
        const change = await Upload.startUpload({ fileUri: latest.uri, objectKey: `stand/${latest.file}`, api: UPLOAD_API });
        return formatUpload(change);
      },
    },
    sigkill: { title: 'SIGKILL', color: '#d33', run: async () => Spike.debugCrash() },
  };

  const perform = async (name: string) => {
    const action = actions[name];
    if (!action) return append(`unknown action ${name}`);
    try {
      append(`${name}: ${JSON.stringify(await action.run())}`);
    } catch (error) {
      append(`${name} failed: ${String(error)}`);
    }
  };

  const onLink = useEffectEvent((url: string) => {
    const name = STAND_LINK.exec(url)?.[1];
    if (name) void perform(name);
  });

  useEffect(() => {
    const subscription = Spike.addListener('onLog', (entry) =>
      append(`${entry.at.slice(11, 19)} ${entry.category} ${entry.message} ${JSON.stringify(entry.data ?? {})}`),
    );
    const links = Linking.addEventListener('url', ({ url }) => onLink(url));
    const uploads = Upload.addListener('onUploadChange', (change) => append(`upload ${formatUpload(change)}`));
    const timer = setInterval(() => Spike.debugStats().then(setStats).catch(() => undefined), STATS_INTERVAL_MS);
    const statsLog = setInterval(
      () => Spike.debugStats().then((current) => console.log(`stats ${formatStats(current).join(' | ')}`)).catch(() => undefined),
      STATS_LOG_INTERVAL_MS,
    );
    return () => {
      subscription.remove();
      links.remove();
      uploads.remove();
      clearInterval(timer);
      clearInterval(statsLog);
    };
  }, []);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.screen}>
        <View style={styles.preview}>{cameraReady && <CapturePreview style={StyleSheet.absoluteFill} />}</View>
        <View style={styles.buttons}>
          {Object.entries(actions).map(([name, action]) => (
            <Button key={name} title={action.title} color={action.color} onPress={() => void perform(name)} />
          ))}
        </View>
        <Text style={styles.stats}>{formatStats(stats).join('\n')}</Text>
        <ScrollView style={styles.log}>
          <Text style={styles.logText}>{lines.join('\n')}</Text>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#111' },
  preview: { height: 220, backgroundColor: '#000' },
  buttons: { flexDirection: 'row', flexWrap: 'wrap' },
  stats: { color: '#9f9', fontFamily: 'Menlo', fontSize: 11, padding: 6 },
  log: { flex: 1 },
  logText: { color: '#ddd', fontFamily: 'Menlo', fontSize: 10, padding: 6 },
});
