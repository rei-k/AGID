import { wgs84togcj02, wgs84tobd09 } from './coordTransform';

export type MapProvider = 'google' | 'apple' | 'amap' | 'baidu' | 'osmand' | 'organic_maps' | 'waze';

export interface Location {
  lat: number;
  lng: number;
  name?: string;
}

/**
 * GuidanceEngine provides URLs for external mapping applications.
 */
export const GuidanceEngine = {
  /**
   * Generates a navigation URL for the specified provider.
   */
  getNavigationUrl(
    provider: MapProvider,
    origin: Location | null,
    destination: Location
  ): string {
    const destName = destination.name || 'Destination';
    const originName = origin?.name || 'My Location';

    switch (provider) {
      case 'google':
        if (origin) {
          return `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&travelmode=driving`;
        }
        return `https://www.google.com/maps/search/?api=1&query=${destination.lat},${destination.lng}`;

      case 'apple':
        if (origin) {
          return `https://maps.apple.com/?saddr=${origin.lat},${origin.lng}&daddr=${destination.lat},${destination.lng}`;
        }
        return `https://maps.apple.com/?ll=${destination.lat},${destination.lng}&q=${encodeURIComponent(destName)}`;

      case 'amap': {
        const [dGcjLng, dGcjLat] = wgs84togcj02(destination.lng, destination.lat);
        if (origin) {
          const [oGcjLng, oGcjLat] = wgs84togcj02(origin.lng, origin.lat);
          return `https://uri.amap.com/navigation?from=${oGcjLng},${oGcjLat},${encodeURIComponent(originName)}&to=${dGcjLng},${dGcjLat},${encodeURIComponent(destName)}&mode=car&policy=1&src=agid_app&callnative=1`;
        }
        return `https://uri.amap.com/marker?position=${dGcjLng},${dGcjLat}&name=${encodeURIComponent(destName)}`;
      }

      case 'baidu': {
        const [dBdLng, dBdLat] = wgs84tobd09(destination.lng, destination.lat);
        if (origin) {
          const [oBdLng, oBdLat] = wgs84tobd09(origin.lng, origin.lat);
          return `http://api.map.baidu.com/direction?origin=latlng:${oBdLat},${oBdLng}|name:${encodeURIComponent(originName)}&destination=latlng:${dBdLat},${dBdLng}|name:${encodeURIComponent(destName)}&mode=driving&region=china&output=html&src=agid_app`;
        }
        return `http://api.map.baidu.com/marker?location=${dBdLat},${dBdLng}&title=${encodeURIComponent(destName)}&content=${encodeURIComponent(destName)}&output=html`;
      }

      case 'osmand':
        return `osmand://go?lat=${destination.lat}&lon=${destination.lng}&z=15`;

      case 'organic_maps':
        return `om://map?v=1&ll=${destination.lat},${destination.lng}&n=${encodeURIComponent(destName)}`;

      case 'waze':
        return `https://waze.com/ul?ll=${destination.lat},${destination.lng}&navigate=yes`;

      default:
        return '';
    }
  }
};
