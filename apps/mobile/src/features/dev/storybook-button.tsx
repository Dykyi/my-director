import { router, usePathname } from 'expo-router';
import { useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Icon } from '@ui/icon';
import { AnimatedView } from '@ui/styled';
import { Text } from '@ui/text';

import { defaultPosition, snapToEdge, type Bounds } from './snap';
import { useSavedPosition } from './use-saved-position';

const SIZE = 48;
const MARGIN = 16;
const TAB_BAR_OFFSET = 90;
const DRAG_THRESHOLD = 8;
const STORYBOOK_ROUTE = '/storybook';

export function StorybookButton() {
  const pathname = usePathname();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const bounds: Bounds = {
    width,
    height,
    top: insets.top,
    bottom: insets.bottom,
    margin: MARGIN,
    size: SIZE,
  };
  const start = defaultPosition(bounds, TAB_BAR_OFFSET);
  const x = useSharedValue(start.x);
  const y = useSharedValue(start.y);
  const open = pathname === STORYBOOK_ROUTE;

  const save = useSavedPosition(bounds, x, y);
  const toggle = () => {
    if (!open) router.push(STORYBOOK_ROUTE);
    else if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const pan = Gesture.Pan()
    .minDistance(DRAG_THRESHOLD)
    .onChange((event) => {
      // get/set, not .value: React Compiler treats a write to .value as mutating a render value.
      x.set(x.get() + event.changeX);
      y.set(y.get() + event.changeY);
    })
    .onEnd((_event, success) => {
      const target = snapToEdge({ x: x.get(), y: y.get() }, bounds);
      x.set(withSpring(target.x));
      y.set(withSpring(target.y));
      if (success) scheduleOnRN(save, target);
    });
  const tap = Gesture.Tap().onEnd(() => scheduleOnRN(toggle));
  const position = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { translateY: y.get() }],
  }));

  return (
    <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
      <AnimatedView
        accessibilityRole="button"
        accessibilityLabel={open ? 'Close Storybook' : 'Open Storybook'}
        className="absolute left-0 top-0 z-50 size-12 items-center justify-center rounded-pill bg-[#ff4785] shadow-[0_4px_12px_rgba(0,0,0,0.35)]"
        style={position}
      >
        {open ? (
          <Icon name="close" className="size-5" tint="accent-on-record" />
        ) : (
          <Text variant="headline" className="text-on-record">
            S
          </Text>
        )}
      </AnimatedView>
    </GestureDetector>
  );
}
