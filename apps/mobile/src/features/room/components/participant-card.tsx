import { View } from 'react-native';

import { useParticipantColors } from '@theme/use-theme-colors';
import { cn } from '@ui/cn';
import { Icon } from '@ui/icon';
import { IconButton } from '@ui/icon-button';
import { QualityChip } from '@ui/quality-chip';
import { Text } from '@ui/text';

import type { ParticipantView, TrackChipView } from '../room-labels';
import { RoomCard } from './room-card';
import { TrackChip } from './track-chip';

function Tracks({ tracks }: { tracks: TrackChipView[] }) {
  return (
    <View className="flex-row flex-wrap gap-1.5">
      {tracks.map((track) => (
        <TrackChip key={track.label} track={track} />
      ))}
    </View>
  );
}

export function ParticipantCard({
  participant,
  index,
}: {
  participant: ParticipantView;
  index: number;
}) {
  const avatar = useParticipantColors(index);
  return (
    <RoomCard>
      <View className="flex-row items-center gap-2.5">
        <View
          className={cn(
            'size-9 items-center justify-center rounded-pill',
            participant.speaking && 'border-2 border-success',
          )}
          style={{ backgroundColor: avatar.ground }}
        >
          <Text variant="footnote-strong" style={{ color: avatar.text }}>
            {participant.initials}
          </Text>
        </View>
        <View className="flex-1 gap-0.5">
          <Text selectable variant="row-title" className="text-foreground">
            {participant.name}
          </Text>
          <Text variant="caption" className="text-muted">
            {participant.joined}
          </Text>
        </View>
        <QualityChip {...participant.quality} className="self-center" />
      </View>
      <Tracks tracks={participant.tracks} />
    </RoomCard>
  );
}

export function OwnCard({
  name,
  identity,
  tracks,
  onRename,
}: {
  name: string;
  identity: string;
  tracks: TrackChipView[];
  onRename: () => void;
}) {
  return (
    <RoomCard>
      <View className="flex-row items-center gap-2.5">
        <View className="size-9 items-center justify-center rounded-pill bg-surface-raised">
          <Icon name="smartphone" className="size-4.5" tint="accent-subtle" />
        </View>
        <View className="flex-1 gap-0.5">
          <Text variant="row-title" className="text-foreground">
            {name}
          </Text>
          <Text selectable variant="footnote" className="text-muted">
            {identity}
          </Text>
        </View>
        <IconButton icon="pencil" label="Rename this phone" onPress={onRename} />
      </View>
      <Tracks tracks={tracks} />
    </RoomCard>
  );
}
