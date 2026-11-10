import { Image as ExpoImage } from 'expo-image';
import { GestureHandlerRootView as GestureHandlerRoot } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { SafeAreaView as SafeAreaViewBase } from 'react-native-safe-area-context';
import { withUniwind } from 'uniwind';

export const Image = withUniwind(ExpoImage);
export const SafeAreaView = withUniwind(SafeAreaViewBase);
export const GestureHandlerRootView = withUniwind(GestureHandlerRoot);
export const AnimatedView = withUniwind(Animated.View);
