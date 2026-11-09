import { useEffect, useState } from 'react';
import { Button, ScrollView, StyleSheet, Text, View } from 'react-native';
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

const Spike = requireNativeModule<SpikeModule>('CaptureCore');
const LOG_LIMIT = 200;
const STATS_INTERVAL_MS = 1000;
const LIVEKIT_URL = process.env.EXPO_PUBLIC_LIVEKIT_URL ?? '';
const LIVEKIT_TOKEN = process.env.EXPO_PUBLIC_LIVEKIT_TOKEN ?? '';

export default function App() {
  const [cameraReady, setCameraReady] = useState(false);
  const [stats, setStats] = useState<Record<string, string>>({});
  const [lines, setLines] = useState<string[]>([]);

  const append = (line: string) => setLines((current) => [line, ...current].slice(0, LOG_LIMIT));

  useEffect(() => {
    const subscription = Spike.addListener('onLog', (entry) =>
      append(`${entry.at.slice(11, 19)} ${entry.category} ${entry.message} ${JSON.stringify(entry.data ?? {})}`),
    );
    const timer = setInterval(() => Spike.debugStats().then(setStats).catch(() => undefined), STATS_INTERVAL_MS);
    return () => {
      subscription.remove();
      clearInterval(timer);
    };
  }, []);

  const run = (label: string, action: () => Promise<unknown>) => async () => {
    try {
      append(`${label}: ${JSON.stringify(await action())}`);
    } catch (error) {
      append(`${label} failed: ${String(error)}`);
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.screen}>
        <View style={styles.preview}>{cameraReady && <CapturePreview style={StyleSheet.absoluteFill} />}</View>
        <View style={styles.buttons}>
          <Button title="Permissions" onPress={run('permissions', Spike.requestPermissions)} />
          <Button
            title="Camera"
            onPress={run('camera', async () => {
              const report = await Spike.debugStartCamera();
              setCameraReady(true);
              return report;
            })}
          />
          <Button title="Mic on" onPress={run('mic on', Spike.debugStartMic)} />
          <Button title="Mic off" onPress={run('mic off', Spike.debugStopMic)} />
          <Button title="Segment start" onPress={run('segment start', Spike.debugStartSegment)} />
          <Button title="Segment stop" onPress={run('segment stop', Spike.debugStopSegment)} />
          <Button title="Connect" onPress={run('connect', () => Spike.debugConnect(LIVEKIT_URL, LIVEKIT_TOKEN))} />
          <Button title="Disconnect" onPress={run('disconnect', Spike.debugDisconnect)} />
          {(['standard', 'reduced', 'minimal'] as const).map((profile) => (
            <Button key={profile} title={profile} onPress={run(`profile ${profile}`, () => Spike.debugSetCallProfile(profile))} />
          ))}
          <Button title="Inspect latest" onPress={run('inspect', Spike.debugInspectLatestSegment)} />
          <Button title="SIGKILL" color="#d33" onPress={() => Spike.debugCrash()} />
        </View>
        <Text style={styles.stats}>{Object.entries(stats).map(([key, value]) => `${key}: ${value}`).join('\n')}</Text>
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
