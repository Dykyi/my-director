import type { Meta, StoryObj } from '@storybook/react-native';

import { WarningNotice } from '../notice';
import { SegmentedControl } from '../segmented-control';
import { SettingsGroup, type SettingsRowData } from '../settings-list';
import { TextButton } from '../text-button';

const CAMERA = [
  { value: 'front', label: 'Front' },
  { value: 'back', label: 'Back' },
];

function SettingsStory({
  label,
  rows,
  note,
  locked,
  withCamera,
}: {
  label: string;
  rows: SettingsRowData[];
  note: string;
  locked: boolean;
  withCamera: boolean;
}) {
  const camera: SettingsRowData[] = withCamera
    ? [
        {
          label: 'Camera',
          control: (
            <SegmentedControl options={CAMERA} value="front" onChange={() => {}} locked={locked} />
          ),
        },
      ]
    : [];
  return (
    <SettingsGroup
      label={label}
      locked={locked}
      rows={[...camera, ...rows]}
      note={note || undefined}
      banner={
        locked && (
          <WarningNotice
            locked
            message="Stop the recording to change the camera."
            link={{ title: 'Record', onPress: () => {} }}
          />
        )
      }
      action={
        withCamera && (
          <TextButton title="Reset camera to defaults" disabled={locked} onPress={() => {}} />
        )
      }
    />
  );
}

const meta = {
  title: 'UI/Containers/SettingsList',
  component: SettingsStory,
  args: {
    label: 'ABOUT',
    rows: [
      { label: 'App', value: 'MyDirector 0.1.0' },
      { label: 'Build', value: 'debug · 1', mono: true },
      { label: 'Device', value: 'iPhone 11 · iOS 26.1' },
    ],
    note: '',
    locked: false,
    withCamera: false,
  },
  argTypes: { rows: { control: { type: 'object' } } },
} satisfies Meta<typeof SettingsStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const About: Story = {};
export const Camera: Story = {
  args: {
    label: 'CAMERA',
    rows: [
      { label: 'Lens', value: 'Wide 1×' },
      { label: 'Format', value: '1920×1080 · 30 fps locked' },
    ],
    note: 'The preview switches right away, and this phone keeps the choice for the next launch.',
    withCamera: true,
  },
};
export const CameraLocked: Story = {
  args: { ...Camera.args, note: '', locked: true },
};
