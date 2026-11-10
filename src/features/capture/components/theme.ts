import type { TextStyle } from 'react-native';

import type { Tone } from '../session-labels';

export const colors = {
  ground: '#0B0D10',
  surface: '#15181D',
  raised: '#1E232A',
  border: '#262B33',
  borderStrong: '#3A414B',
  text: '#E8EAED',
  secondary: '#C4CAD2',
  muted: '#9AA3AE',
  faint: '#6B7380',
  accent: '#9CC2FF',
  recordingSurface: '#3A1214',
  recordingText: '#FF8A8E',
  recordingDot: '#FF5A5F',
  recordButton: '#D13438',
  alertText: '#FFD7D9',
  pausedSurface: '#3A2A0A',
  pausedText: '#F5C76B',
  resume: '#F5B83D',
  onResume: '#1A1300',
  noticeSurface: '#2E2208',
  noticeBorder: '#6B4E12',
  noticeText: '#F5D38F',
  level: '#7FD1AE',
  levelOff: '#2A3038',
  okSurface: '#10301F',
  infoSurface: '#10223F',
  progress: '#5B9BFF',
  uploadButton: '#2F6FE0',
  scrim: 'rgba(5, 6, 8, 0.72)',
  badge: 'rgba(11, 13, 16, 0.75)',
} as const;

export const toneColor: Record<Tone, string> = {
  normal: colors.text,
  secondary: colors.secondary,
  muted: colors.muted,
  accent: colors.accent,
  warning: colors.pausedText,
  error: colors.recordingText,
};

export const mono: TextStyle = { fontFamily: 'Menlo', fontSize: 12, color: colors.text, fontVariant: ['tabular-nums'] };
export const gutter = 16;
