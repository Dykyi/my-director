import type { ConfigContext } from 'expo/config';

import appConfig from '../app.config';

console.log(appConfig({ config: {} } as ConfigContext).ios?.bundleIdentifier);
