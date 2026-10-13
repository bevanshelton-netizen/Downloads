export type KoraDevice = 'web' | 'mobile' | 'tv' | 'tablet';

export const supportedDevices: Record<KoraDevice, { name: string; playback: ('hls' | 'dash')[] }> = {
  web: { name: 'Web', playback: ['hls', 'dash'] },
  mobile: { name: 'Mobile', playback: ['hls', 'dash'] },
  tv: { name: 'Smart TV', playback: ['hls', 'dash'] },
  tablet: { name: 'Tablet', playback: ['hls', 'dash'] },
};

export function isSupportedDevice(value: string): value is KoraDevice {
  return value in supportedDevices;
}

export function preferredProtocol(device: KoraDevice): 'hls' | 'dash' {
  return device === 'tv' ? 'dash' : 'hls';
}
