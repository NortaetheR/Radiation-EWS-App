module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // ... (kalau ada plugin lain, biarkan di atas)
      'react-native-reanimated/plugin', // <--- WAJIB ADA & HARUS PALING BAWAH
    ],
  };
};