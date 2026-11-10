import { ScrollView } from 'react-native';

import { callTarget } from '@config/env';
import { useCaptureSession, useChangeCamera } from '@features/capture/capture-session-context';
import { isCameraEditable } from '@features/capture/session-labels';
import { TabScreen } from '@features/shell/tab-screen';
import { appearance, useAppearance } from '@theme/appearance';
import { Button } from '@ui/button';
import { SettingsGroup } from '@ui/settings-list';

import { ABOUT } from './about';
import { AppearanceGroup } from './components/appearance-group';
import { CameraGroup } from './components/camera-group';
import { settingsGroups } from './settings-rows';
import { useCopySettings } from './use-copy-settings';

const CAPTION =
  'What this build records with. You can switch the camera here; everything else comes from src/config/capture-config.ts.';

export function SettingsScreen() {
  const { config, snapshot } = useCaptureSession();
  const changeCamera = useChangeCamera();
  const theme = useAppearance();
  const { copied, copy } = useCopySettings(config);
  const [camera, ...rest] = settingsGroups(config, ABOUT, callTarget);
  return (
    <TabScreen title="Settings" caption={CAPTION}>
      <ScrollView className="flex-1" contentContainerClassName="gap-4.5 px-4 pb-5 pt-4">
        <AppearanceGroup theme={theme} onChange={appearance.set} />
        {camera && (
          <CameraGroup
            group={camera}
            position={config.camera.position}
            locked={!isCameraEditable(snapshot.phase)}
            onChange={(position) => void changeCamera(position)}
          />
        )}
        {rest.map((group) => (
          <SettingsGroup key={group.id} label={group.title} rows={group.rows} />
        ))}
        <Button
          title={copied ? 'Copied' : 'Copy settings as JSON'}
          icon="copy"
          onPress={() => void copy()}
        />
      </ScrollView>
    </TabScreen>
  );
}
