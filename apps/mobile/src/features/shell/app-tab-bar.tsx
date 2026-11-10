import type { BottomTabBarProps } from 'expo-router/js-tabs';

import { useCaptureSession, useSessionIssues } from '@features/capture/capture-session-context';
import { issueBadge } from '@features/capture/session-issues';
import { PHASE_PILL } from '@features/capture/session-labels';
import { Icon } from '@ui/icon';
import { TabBar, TabBarItem } from '@ui/tab-bar';

import { APP_TABS } from './app-tabs';
import { RecordTabIcon } from './record-tab-icon';

export function AppTabBar({ state, navigation, insets }: BottomTabBarProps) {
  const { snapshot } = useCaptureSession();
  const badge = issueBadge(useSessionIssues());
  const pillTone = PHASE_PILL[snapshot.phase].tone;
  return (
    <TabBar bottomInset={insets.bottom}>
      {state.routes.map((route, index) => {
        const tab = APP_TABS.find((candidate) => candidate.name === route.name);
        if (!tab) return null;
        const selected = index === state.index;
        const icon =
          tab.name === 'index' ? (
            <RecordTabIcon tone={pillTone} selected={selected} />
          ) : (
            <Icon
              name={tab.icon}
              className="size-6.5"
              tint={selected ? 'accent-accent' : 'accent-muted'}
            />
          );
        return (
          <TabBarItem
            key={route.key}
            title={tab.title}
            icon={icon}
            selected={selected}
            badge={route.name === 'debug' ? badge : undefined}
            onPress={() => navigation.navigate(route.name)}
          />
        );
      })}
    </TabBar>
  );
}
