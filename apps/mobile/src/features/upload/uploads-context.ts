import { hookContext } from '@shared/hook-context';

import { useUploads } from './use-uploads';

export const [UploadsProvider, useUploadsState] = hookContext('Uploads', useUploads);
export type Uploads = ReturnType<typeof useUploadsState>;
