import { createHookContext } from '@shared/hook-context';

import { useNativeUploads } from './use-native-uploads';

export const [UploadsProvider, useUploads] = createHookContext('Uploads', useNativeUploads);
export type Uploads = ReturnType<typeof useUploads>;
