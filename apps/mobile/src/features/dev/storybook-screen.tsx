import { SafeAreaView } from '@ui/styled';

import StorybookRoot from '../../../.rnstorybook';

export function StorybookScreen() {
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <StorybookRoot />
    </SafeAreaView>
  );
}
