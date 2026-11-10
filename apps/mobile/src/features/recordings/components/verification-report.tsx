import { View } from 'react-native';

import type { VerificationReport as Report } from '@modules/capture-core';

import { Button } from '@ui/button';
import { Sheet } from '@ui/sheet';
import { Text } from '@ui/text';

const verdict = (pass: boolean) => (pass ? 'PASS' : 'FAIL');
const verdictText = (pass: boolean) => (pass ? 'text-success' : 'text-danger');

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
        <>
          <Text variant="verdict" className={verdictText(report.pass)}>
            {verdict(report.pass)}
          </Text>
          {report.segments.map((segment) => (
            <View key={segment.index} className="gap-1">
              <Text variant="row-title" className="text-foreground">
                Segment {segment.index} ·{' '}
                <Text variant="row-title" className={verdictText(segment.pass)}>
                  {verdict(segment.pass)}
                </Text>
              </Text>
              {segment.checks.map((check) => (
                <Text
                  key={check.id}
                  selectable
                  variant="mono-value"
                  className={check.pass ? 'text-subtle' : 'text-danger'}
                >
                  {check.pass ? '✓' : '✗'} {check.label}: {check.actual} (expected {check.expected})
                </Text>
              ))}
            </View>
          ))}
        </>
      ) : (
        <Text variant="callout" className="text-muted">
          Checking the files…
        </Text>
      )}
      <Button title="Close" onPress={onClose} />
    </Sheet>
  );
}
