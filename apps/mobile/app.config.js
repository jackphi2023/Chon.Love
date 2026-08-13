/* global module */
module.exports = ({ config }) => {
  const configuredBaseUrl = process.env.EXPO_PUBLIC_WEB_BASE_URL?.trim();
  const baseUrl = configuredBaseUrl && configuredBaseUrl !== '/' ? configuredBaseUrl.replace(/\/$/u, '') : undefined;

  return {
    ...config,
    experiments: {
      ...config.experiments,
      ...(baseUrl ? { baseUrl } : {}),
    },
  };
};
