import type { Meta, StoryObj } from '@storybook/react-native';

import { Sheet } from '../sheet';
import { Text } from '../text';

function SheetStory({
  body,
  ...props
}: Omit<Parameters<typeof Sheet>[0], 'children'> & { body: string }) {
  return (
    <Sheet {...props}>
      <Text variant="callout" className="text-subtle">
        {body}
      </Text>
    </Sheet>
  );
}

const meta = {
  title: 'UI/Containers/Sheet',
  component: SheetStory,
  args: {
    title: 'Room',
    subtitle: 'mydirector-poc',
    body: 'The connection, this phone and every participant.',
    onClose: () => {},
  },
  parameters: { backdrop: 'sheet', inset: 'none' },
} satisfies Meta<typeof SheetStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Room: Story = {};
export const Verification: Story = {
  args: {
    title: 'Verification',
    subtitle: '2026-11-10T09-12-33Z-4F2A',
    body: 'Checking the files…',
  },
};
