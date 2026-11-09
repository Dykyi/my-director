import { useState } from 'react';
import { Button, Text, View } from 'react-native';
import { requireNativeModule } from 'expo';

const CaptureCore = requireNativeModule<{
  debugConnect(url: string, token: string): Promise<string[]>;
  debugDisconnect(): Promise<void>;
}>('CaptureCore');

export default function App() {
  const [status, setStatus] = useState('idle');
  const connect = async () => {
    try {
      const url = process.env.EXPO_PUBLIC_LIVEKIT_URL ?? '';
      const token = process.env.EXPO_PUBLIC_LIVEKIT_TOKEN ?? '';
      const remotes = await CaptureCore.debugConnect(url, token);
      setStatus(`connected, remote: ${remotes.join(', ') || 'none'}`);
    } catch (error) {
      setStatus(`failed: ${String(error)}`);
    }
  };
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#111' }}>
      <Text style={{ color: '#eee', marginBottom: 16 }}>{status}</Text>
      <Button title="Connect" onPress={connect} />
      <Button title="Disconnect" onPress={() => CaptureCore.debugDisconnect().then(() => setStatus('idle'))} />
    </View>
  );
}
