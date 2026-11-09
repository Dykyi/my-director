import { requireNativeView } from 'expo';
import type { ViewProps } from 'react-native';

export type CapturePreviewProps = ViewProps & { videoGravity?: 'aspectFill' | 'aspectFit' };

export const CapturePreview = requireNativeView<CapturePreviewProps>('CaptureCore');
