export type KoraDevice = 'web' | 'mobile' | 'android-tv' | 'fire-tv' | 'apple-tv' | 'smart-tv' | 'roku' | 'chromecast';

export type KoraPlaybackProtocol = 'hls' | 'dash';

export interface KoraDeviceProfile {
  label: string;
  family: 'browser' | 'mobile' | 'tv' | 'casting';
  playback: KoraPlaybackProtocol[];
  remoteNavigation: boolean;
  offlineCapable: boolean;
  drmReady: boolean;
}

export const supportedDevices: Record<KoraDevice, KoraDeviceProfile> = {
  web: { label: 'Web', family: 'browser', playback: ['hls', 'dash'], remoteNavigation: false, offlineCapable: false, drmReady: true },
  mobile: { label: 'Mobile', family: 'mobile', playback: ['hls', 'dash'], remoteNavigation: false, offlineCapable: true, drmReady: true },
  'android-tv': { label: 'Android TV', family: 'tv', playback: ['dash', 'hls'], remoteNavigation: true, offlineCapable: false, drmReady: true },
  'fire-tv': { label: 'Fire TV', family: 'tv', playback: ['dash', 'hls'], remoteNavigation: true, offlineCapable: false, drmReady: true },
  'apple-tv': { label: 'Apple TV', family: 'tv', playback: ['hls', 'dash'], remoteNavigation: true, offlineCapable: false, drmReady: true },
  'smart-tv': { label: 'Smart TV', family: 'tv', playback: ['dash', 'hls'], remoteNavigation: true, offlineCapable: false, drmReady: true },
  roku: { label: 'Roku', family: 'tv', playback: ['hls', 'dash'], remoteNavigation: true, offlineCapable: false, drmReady: true },
  chromecast: { label: 'Chromecast', family: 'casting', playback: ['hls', 'dash'], remoteNavigation: true, offlineCapable: false, drmReady: true },
};

export function isSupportedDevice(value: string): value is KoraDevice {
  return value in supportedDevices;
}

export function preferredProtocol(device: KoraDevice): KoraPlaybackProtocol {
  return supportedDevices[device].playback[0];
}
