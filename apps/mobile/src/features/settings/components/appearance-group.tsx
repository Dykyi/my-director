import type { ThemePreference } from '@theme/appearance';
import { SegmentedControl } from '@ui/segmented-control';
import { SettingsGroup } from '@ui/settings-list';

const THEME_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const satisfies readonly { value: ThemePreference; label: string }[];

export function AppearanceGroup({
  theme,
  onChange,
}: {
  theme: ThemePreference;
  onChange: (theme: ThemePreference) => void;
}) {
  return (
    <SettingsGroup
      label="APPEARANCE"
      rows={[
        {
          label: 'Appearance',
          control: <SegmentedControl options={THEME_OPTIONS} value={theme} onChange={onChange} />,
        },
      ]}
      note="System follows the iPhone. The camera preview stays dark in every theme."
    />
  );
}
