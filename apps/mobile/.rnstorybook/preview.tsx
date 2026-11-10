import type { Preview } from '@storybook/react-native';

import { withBackdrop } from './backdrop';

const GROUP_ORDER = [
  'Branding',
  ['Colors', 'Typography', 'Icons', 'App icon'],
  'UI',
  ['Type', 'Controls', 'Status', 'Feedback', 'Containers', 'Navigation'],
  'Features',
  ['Record', 'Room', 'Debug', 'Recordings', 'Settings'],
];

const preview: Preview = {
  decorators: [withBackdrop],
  parameters: {
    layout: 'fullscreen',
    options: { storySort: { order: GROUP_ORDER } },
  },
};

export default preview;
