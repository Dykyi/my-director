import { View } from 'react-native';

import type {
  VerificationReport as Report,
  SegmentVerification,
  VerificationCheck,
} from '@modules/capture-core';

import { Button } from '@ui/button';
import { Icon } from '@ui/icon';
import { Sheet } from '@ui/sheet';
import { Text } from '@ui/text';
import { chipText } from '@ui/tone';

import { verificationVerdict } from '../recording-labels';

const checkLine = ({ label, actual, expected }: VerificationCheck) =>
  `${label}: ${actual} (expected ${expected})`;

function CheckRow({ check }: { check: VerificationCheck }) {
  if (!check.crashTail) {
    return (
      <Text selectable variant="mono-value" className={check.pass ? 'text-subtle' : 'text-danger'}>
        {check.pass ? '✓' : '✗'} {checkLine(check)}
      </Text>
    );
  }
  return (
    <View className="flex-row gap-1">
      <Icon name="contrast" className="mt-0.5 size-3" tint="accent-paused" />
      <View className="flex-1">
        <Text selectable variant="mono-value" className="text-paused">
          {checkLine(check)}
        </Text>
        <Text variant="caption" className="text-paused">
          {check.note}
        </Text>
      </View>
    </View>
  );
}

function SegmentChecks({ segment }: { segment: SegmentVerification }) {
  const verdict = verificationVerdict(segment.pass, segment.checks);
  return (
    <View className="gap-1">
      <Text variant="row-title" className="text-foreground">
        Segment {segment.index} ·{' '}
        <Text variant="row-title" className={chipText({ tone: verdict.tone })}>
          {verdict.label}
        </Text>
      </Text>
      {segment.checks.map((check) => (
        <CheckRow key={check.id} check={check} />
      ))}
    </View>
  );
}

function ReportBody({ report }: { report: Report }) {
  const checks = report.segments.flatMap((segment) => segment.checks);
  const verdict = verificationVerdict(report.pass, checks);
  return (
    <>
      <Text variant="verdict" className={chipText({ tone: verdict.tone })}>
        {verdict.label}
      </Text>
      {report.segments.map((segment) => (
        <SegmentChecks key={segment.index} segment={segment} />
      ))}
    </>
  );
}

export function VerificationReport({
  report,
  onClose,
}: {
  report: Report | null;
  onClose: () => void;
}) {
  return (
    <Sheet title="Verification" subtitle={report?.sessionId} onClose={onClose}>
      {report ? (
        <ReportBody report={report} />
      ) : (
        <Text variant="callout" className="text-muted">
          Checking the files…
        </Text>
      )}
      <Button title="Close" onPress={onClose} />
    </Sheet>
  );
}
