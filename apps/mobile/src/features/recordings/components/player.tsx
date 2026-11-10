import { VideoView, type VideoPlayer } from 'expo-video';
import { ScrollView, View } from 'react-native';
import { withUniwind } from 'uniwind';

import { Chip } from '@ui/chip';
import { CloseButton, IconButton } from '@ui/icon-button';
import { SafeAreaView } from '@ui/styled';
import { Text } from '@ui/text';

import type { PlayerView } from '../player-view';
import { SegmentList } from './segment-list';
import { SegmentStrip } from './segment-strip';

const Video = withUniwind(VideoView);

export function Player({
  title,
  meta,
  recovered,
  player,
  view,
  onSelect,
  onClose,
}: {
  title: string;
  meta: string;
  recovered: boolean;
  player: VideoPlayer;
  view: PlayerView;
  onSelect: (index: number) => void;
  onClose: () => void;
}) {
  const { previous, next } = view;
  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-background">
      <View className="flex-row items-center gap-2.5 px-4 pb-3 pt-1.5">
        <View className="gap-0.5">
          <Text accessibilityRole="header" variant="title" className="text-foreground">
            {title}
          </Text>
          <Text selectable variant="mono-meta" className="text-muted">
            {meta}
          </Text>
        </View>
        {recovered && <Chip label="recovered" tone="paused" className="mt-1 self-start" />}
        <View className="ml-auto">
          <CloseButton onPress={onClose} />
        </View>
      </View>
      <Video
        player={player}
        className="aspect-video w-full bg-backdrop"
        nativeControls
        contentFit="contain"
      />
      <ScrollView className="flex-1" contentContainerClassName="gap-4 p-4">
        <View className="flex-row items-center gap-2">
          <View className="flex-1 gap-0.5">
            <Text variant="title" className="text-foreground">
              {view.title}
            </Text>
            <Text selectable variant="mono-meta" className="text-muted">
              {view.file}
            </Text>
            <Text variant="caption" className="text-muted">
              {view.origin}
            </Text>
          </View>
          <IconButton
            look="round"
            icon="chevron-left"
            label="Previous segment"
            disabled={previous === undefined}
            onPress={() => previous !== undefined && onSelect(previous)}
          />
          <IconButton
            look="round"
            icon="chevron-right"
            label="Next segment"
            disabled={next === undefined}
            onPress={() => next !== undefined && onSelect(next)}
          />
        </View>
        <SegmentStrip
          items={view.items}
          progress={view.progress}
          whole={view.whole}
          endsInCrash={view.endsInCrash}
          onSelect={onSelect}
        />
        <SegmentList items={view.items} onSelect={onSelect} />
      </ScrollView>
    </SafeAreaView>
  );
}
