import { useResolveClassNames } from 'uniwind';

import { cn } from './cn';
import { FILLED_ICONS, ICONS, type IconName } from './icons';

export function Icon({
  name,
  className,
  tint,
}: {
  name: IconName;
  className: string;
  tint: string;
}) {
  const { accentColor, ...style } = useResolveClassNames(cn(className, tint));
  const Glyph = ICONS[name];
  const size = typeof style.width === 'number' ? style.width : undefined;
  const fill = FILLED_ICONS.has(name) ? { fill: accentColor } : {};
  return <Glyph size={size} color={accentColor} style={style} {...fill} />;
}
