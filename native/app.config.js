// Store builds (EAS "production" profile) use the real app id; test builds keep the dev id so
// they install side by side with the store app.
module.exports = ({ config }) => {
  if (process.env.APP_VARIANT !== 'production') return config;
  return {
    ...config,
    android: { ...config.android, package: 'online.appuai.appu' },
    ios: { ...config.ios, bundleIdentifier: 'online.appuai.appu' },
  };
};
