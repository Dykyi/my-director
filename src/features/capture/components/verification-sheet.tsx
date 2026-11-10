import { Modal, ScrollView, Text, View } from 'react-native';

import type { VerificationReport } from '@modules/capture-core';

import { ActionButton } from './action-button';
import { colors, gutter, mono } from './theme';

const verdict = (pass: boolean) => (pass ? 'PASS' : 'FAIL');
const verdictColor = (pass: boolean) => (pass ? colors.level : colors.recordingText);

export function VerificationSheet({ report, onClose }: { report: VerificationReport | null; onClose: () => void }) {
  return (
    <Modal visible={report !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.ground, padding: gutter, gap: 12 }}>
        {report && (
          <>
            <View style={{ gap: 2 }}>
              <Text style={{ color: verdictColor(report.pass), fontSize: 22, fontWeight: '700' }}>{verdict(report.pass)}</Text>
              <Text selectable style={[mono, { color: colors.muted }]}>
                {report.sessionId}
              </Text>
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 14 }}>
              {report.segments.map((segment) => (
                <View key={segment.index} style={{ gap: 4 }}>
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>
                    Segment {segment.index} · <Text style={{ color: verdictColor(segment.pass) }}>{verdict(segment.pass)}</Text>
                  </Text>
                  {segment.checks.map((check) => (
                    <Text key={check.id} selectable style={[mono, { color: check.pass ? colors.secondary : colors.recordingText }]}>
                      {check.pass ? '✓' : '✗'} {check.label}: {check.actual} (expected {check.expected})
                    </Text>
                  ))}
                </View>
              ))}
            </ScrollView>
          </>
        )}
        <ActionButton title="Close" onPress={onClose} />
      </View>
    </Modal>
  );
}
