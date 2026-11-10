import type { IconName } from '@ui/icons';

export const APP_TABS = [
  { name: 'index', title: 'Record', icon: 'ring' },
  { name: 'recordings', title: 'Recordings', icon: 'film' },
  { name: 'debug', title: 'Debug', icon: 'activity' },
  { name: 'settings', title: 'Settings', icon: 'sliders' },
] as const satisfies readonly { name: string; title: string; icon: IconName }[];
