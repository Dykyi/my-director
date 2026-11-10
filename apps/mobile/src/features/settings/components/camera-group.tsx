import { router } from 'expo-router';

import type { CameraPosition } from '@modules/capture-core';

import { CAMERA_LABEL, CAMERA_POSITIONS } from '@features/capture/camera-preference';
import { WarningNotice } from '@ui/notice';
import { SegmentedControl } from '@ui/segmented-control';
import { SettingsGroup } from '@ui/settings-list';
import { TextButton } from '@ui/text-button';

import type { SettingsGroupView } from '../settings-rows';

const CAMERA_OPTIONS = CAMERA_POSITIONS.map((value) => ({ value, label: CAMERA_LABEL[value] }));

export function CameraGroup({
  group,
  position,
  locked,
  onChange,
}: {
  group: SettingsGroupView;
  position: CameraPosition;
  locked: boolean;
  onChange: (position: CameraPosition | undefined) => void;
}) {
  return (
    <SettingsGroup
      label={group.title}
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
              value={position}
              onChange={onChange}
              locked={locked}
            />
          ),
        },
        ...group.rows,
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
          onPress={() => onChange(undefined)}
        />
      }
    />
  );
}
