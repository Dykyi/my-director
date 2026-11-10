import Storage from 'expo-sqlite/kv-store';

import { view } from './storybook.requires';

const StorybookRoot = view.getStorybookUI({
  storage: {
    getItem: (key) => Storage.getItem(key),
    setItem: (key, value) => Storage.setItem(key, value),
  },
});

export default StorybookRoot;
