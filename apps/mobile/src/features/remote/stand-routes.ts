import type { Href } from 'expo-router';

export const STAND_ROUTES = {
  back: '/',
  recordings: '/recordings',
  debug: '/debug',
  settings: '/settings',
  room: '/room',
  storybook: '/storybook',
} as const satisfies Record<string, Href>;

const STAND_PATH = /(?:^|:\/\/|\/)stand\/([\w-]+)$/;

export function standAction(path: string): string | undefined {
  return STAND_PATH.exec(path)?.[1];
}
