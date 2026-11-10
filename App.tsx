import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CaptureScreen } from './src/features/capture/capture-screen';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <CaptureScreen />
    </SafeAreaProvider>
  );
}
