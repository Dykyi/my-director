import { Chip } from '@ui/chip';
import { QualityChip } from '@ui/quality-chip';
import type { ChipView } from '@ui/tone';

import type { QualityLook } from '../call-labels';

export function CallChip({ chip }: { chip: QualityLook | ChipView }) {
  return 'lit' in chip ? (
    <QualityChip {...chip} className="self-center" />
  ) : (
    <Chip label={chip.label} tone={chip.tone} className="self-center" />
  );
}
