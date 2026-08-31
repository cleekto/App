import packageJson from '../package.json' with { type: 'json' };

/** Версия развёрнутого приложения. Видна в ответе health-эндпоинта. */
export const APP_VERSION: string = packageJson.version;
