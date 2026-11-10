import { Text as NativeText, type TextProps } from 'react-native';

import { TYPE_STYLES, type TypeStyle } from '@theme/type-styles';

export function Text({ variant, style, ...props }: TextProps & { variant: TypeStyle }) {
  return <NativeText {...props} allowFontScaling={false} style={[TYPE_STYLES[variant], style]} />;
}
