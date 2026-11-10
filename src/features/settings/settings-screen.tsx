import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView } from 'react-native';

import type { CameraPosition, SessionPhase } from '@modules/capture-core';

import { callTarget } from '@config/env';
import { useChangeCamera, useSession } from '@features/capture/capture-session-context';
import { TabScreen } from '@features/shell/tab-screen';
import { appearance, useAppearance, type ThemePreference } from '@theme/appearance';
import { Button } from '@ui/button';
import { WarningNotice } from '@ui/notice';
import { SegmentedControl } from '@ui/segmented-control';
import { SettingsGroup } from '@ui/settings-list';
import { TextButton } from '@ui/text-button';

import { ABOUT } from './about';
import { settingsGroups } from './settings-rows';

const THEME_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const satisfies readonly { value: ThemePreference; label: string }[];

const CAMERA_OPTIONS = [
  { value: 'front', label: 'Front' },
  { value: 'back', label: 'Back' },
] as const satisfies readonly { value: CameraPosition; label: string }[];

const CAMERA_EDITABLE: ReadonlySet<SessionPhase> = new Set(['idle', 'ready']);
const CAPTION =
  'What this build records with. You can switch the camera here; everything else comes from src/config/capture-config.ts.';

export function SettingsScreen() {
  const { config, snapshot } = useSession();
  const changeCamera = useChangeCamera();
  const theme = useAppearance();
  const [copied, setCopied] = useState(false);
  const locked = !CAMERA_EDITABLE.has(snapshot.phase);
  const [camera, ...rest] = settingsGroups(config, ABOUT, callTarget);
  const copySettings = async () => {
    await Clipboard.setStringAsync(JSON.stringify(config, null, 2));
    setCopied(true);
  };
  return (
    <TabScreen title="Settings" caption={CAPTION}>
      <ScrollView className="flex-1" contentContainerClassName="gap-4.5 px-4 pb-5 pt-4">
        <SettingsGroup
          label="APPEARANCE"
          rows={[
            {
              label: 'Appearance',
              control: (
                <SegmentedControl options={THEME_OPTIONS} value={theme} onChange={appearance.set} />
              ),
            },
          ]}
          note="System follows the iPhone. The camera preview stays dark in every theme."
        />
        {camera && (
          <SettingsGroup
            label={camera.title}
            locked={locked}
            banner={
              locked && (
                <WarningNotice
                  locked
                  message="Stop the recording to change the camera."
                  link={{ title: 'Record', onPress: () => router.navigate('/') }}
                />
              )
            }
            rows={[
              {
                label: 'Camera',
                control: (
                  <SegmentedControl
                    options={CAMERA_OPTIONS}
                    value={config.camera.position}
                    onChange={(position) => void changeCamera(position)}
                    locked={locked}
                  />
                ),
              },
              ...camera.rows,
            ]}
            note={
              locked
                ? undefined
                : 'The preview switches right away, and this phone keeps the choice for the next launch.'
            }
            action={
              <TextButton
                title="Reset camera to defaults"
                disabled={locked}
                onPress={() => void changeCamera(undefined)}
              />
            }
          />
        )}
        {rest.map((group) => (
          <SettingsGroup key={group.id} label={group.title} rows={group.rows} />
        ))}
        <Button
          title={copied ? 'Copied' : 'Copy settings as JSON'}
          icon="copy"
          onPress={() => void copySettings()}
        />
      </ScrollView>
    </TabScreen>
  );
}
