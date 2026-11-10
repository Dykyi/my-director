import type { SvgProps } from 'react-native-svg';

/** Jest does not run Metro's SVG transformer; an imported .svg renders as nothing in tests. */
export default function SvgMock(_props: SvgProps) {
  return null;
}
