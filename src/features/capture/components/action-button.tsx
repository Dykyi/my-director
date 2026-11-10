import { Pressable, Text, type ViewStyle } from 'react-native';

import { SymbolIcon } from './symbol-icon';
import { colors } from './theme';

export type ButtonVariant = 'record' | 'primary' | 'raised' | 'resume' | 'notice' | 'danger' | 'ghost' | 'upload';
export type ButtonSize = 'large' | 'regular' | 'compact';

const VARIANT: Record<ButtonVariant, { background: string; border: string; text: string }> = {
  record: { background: colors.recordButton, border: colors.recordButton, text: '#FFFFFF' },
  primary: { background: colors.text, border: colors.text, text: colors.ground },
  raised: { background: colors.raised, border: colors.borderStrong, text: colors.text },
  resume: { background: colors.resume, border: colors.resume, text: colors.onResume },
  notice: { background: colors.noticeSurface, border: colors.noticeBorder, text: colors.noticeText },
  danger: { background: 'transparent', border: colors.recordButton, text: colors.recordingText },
  ghost: { background: 'transparent', border: colors.borderStrong, text: colors.secondary },
  upload: { background: colors.uploadButton, border: colors.uploadButton, text: '#FFFFFF' },
};

const SIZE: Record<ButtonSize, { height: number; fontSize: number; radius: number; icon: number }> = {
  large: { height: 64, fontSize: 20, radius: 14, icon: 18 },
  regular: { height: 52, fontSize: 17, radius: 12, icon: 14 },
  compact: { height: 44, fontSize: 15, radius: 10, icon: 13 },
};

export function ActionButton({
  title,
  onPress,
  variant = 'raised',
  size = 'regular',
  icon,
  disabled = false,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const look = VARIANT[variant];
  const metrics = SIZE[size];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          height: metrics.height,
          paddingHorizontal: 16,
          borderRadius: metrics.radius,
          borderCurve: 'continuous',
          borderWidth: 1,
          borderColor: disabled ? colors.border : look.border,
          backgroundColor: disabled ? 'transparent' : look.background,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      {icon && <SymbolIcon name={icon} size={metrics.icon} color={disabled ? colors.muted : look.text} />}
      <Text style={{ color: disabled ? colors.muted : look.text, fontSize: metrics.fontSize, fontWeight: '700' }}>{title}</Text>
    </Pressable>
  );
}

export function IconButton({ icon, label, onPress, disabled = false }: {
  icon: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => ({ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
    >
      <SymbolIcon name={icon} size={18} color={disabled ? colors.faint : colors.accent} />
    </Pressable>
  );
}
