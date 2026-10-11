export type KoraDevice = 'web' | 'mobile' | 'android-tv' | 'fire-tv' | 'apple-tv' | 'smart-tv' | 'roku' | 'chromecast';

export const supportedDevices: Record<KoraDevice, { label: string; playback: 'hls' | 'dash' }> = {
  web: { label: 'Web', playback: 'hls' },
  mobile: { label: 'Mobile', playback: 'hls' },
  'android-tv': { label: 'Android TV', playback: 'dash' },
  'fire-tv': { label: 'Fire TV', playback: 'dash' },
  'apple-tv': { label: 'Apple TV', playback: 'hls' },
  'smart-tv': { label: 'Smart TV', playback: 'dash' },
  roku: { label: 'Roku', playback: 'hls' },
  chromecast: { label: 'Chromecast', playback: 'hls' },
};
