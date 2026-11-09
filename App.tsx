import { useEffect, useEffectEvent, useState } from 'react';
import { Button, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { requireNativeModule } from 'expo';
import { CapturePreview } from '@modules/capture-core/src/CapturePreview';

type LogEntry = { at: string; level: string; category: string; message: string; data?: Record<string, string> };
type CallProfile = 'standard' | 'reduced' | 'minimal';
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
  debugInspectLatestSegment(): Promise<Record<string, string>>;
  debugCrash(): void;
  debugStats(): Promise<Record<string, string>>;
  addListener(event: 'onLog', listener: (entry: LogEntry) => void): { remove(): void };
};
type StandAction = { title: string; run: () => Promise<unknown>; color?: string };

const Spike = requireNativeModule<SpikeModule>('CaptureCore');
const LOG_LIMIT = 200;
const STATS_INTERVAL_MS = 1000;
const STATS_LOG_INTERVAL_MS = 10_000;
const LIVEKIT_URL = process.env.EXPO_PUBLIC_LIVEKIT_URL ?? '';
const LIVEKIT_TOKEN = process.env.EXPO_PUBLIC_LIVEKIT_TOKEN ?? '';
const STAND_LINK = /:\/\/stand\/([\w-]+)$/;
const CALL_PROFILES: CallProfile[] = ['standard', 'reduced', 'minimal'];

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
    const timer = setInterval(() => Spike.debugStats().then(setStats).catch(() => undefined), STATS_INTERVAL_MS);
    const statsLog = setInterval(
      () => Spike.debugStats().then((current) => console.log(`stats ${formatStats(current).join(' | ')}`)).catch(() => undefined),
      STATS_LOG_INTERVAL_MS,
    );
    return () => {
      subscription.remove();
      links.remove();
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
