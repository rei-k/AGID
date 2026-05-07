import { 
  getCellPolygon,
  encodeAGID
} from './agid';

// We'll use the same K/M constants implicitly through agid helpers
const K = 2097152;
const M = 2097151;

self.onmessage = (e: MessageEvent) => {
  const { lat, lon, zoom, bounds, isLargeGrid } = e.data;
  
  const features = getGridFeaturesWorker(zoom, bounds, isLargeGrid, lat, lon);
  self.postMessage(features);
};

function getGridFeaturesWorker(zoom: number, bounds: any, isLargeGrid: boolean, lat: number, lon: number) {
  if (!bounds) return { gridLines: [], gridCells: [] };

  const gridCells: any[] = [];
  const gridLines: any[][] = [];
  const pointCache = new Map<string, { lat: number, lon: number }>();
  const lineCache = new Set<string>();

  // Helper to reuse points across adjacent cells
  const getPointCached = (face: number, x: number, y: number) => {
    const key = `${face}_${x}_${y}`;
    let p = pointCache.get(key);
    if (!p) {
      p = (self as any).getFromQuantizedInternal(face, x, y);
      pointCache.set(key, p!);
    }
    return p!;
  };

  const { face, qx, qy } = (self as any).getQuantizedInternal(lat, lon);
  
  let idealStep = zoom < 10 ? Math.pow(2, Math.floor(18 - zoom)) : 1;
  let finalStep = 1;
  while (finalStep * 2 <= idealStep && finalStep < 65536) finalStep *= 2;
  
  const range = zoom > 18 ? 120 : (zoom > 15 ? 80 : 40); 
  const halfStep = finalStep / 2;
  
  const startQX = Math.max(0, Math.floor(qx / finalStep) * finalStep - (finalStep * Math.floor(range/2)));
  const endQX = Math.min(M, startQX + (finalStep * range));
  const startQY = Math.max(0, Math.floor(qy / finalStep) * finalStep - (finalStep * Math.floor(range/2)));
  const endQY = Math.min(M, startQY + (finalStep * range));

  for (let y = startQY; y < endQY; y += finalStep) {
    for (let x = startQX; x < endQX; x += finalStep) {
      const cellId = `${face}_${x}_${y}_${finalStep}`;

      // Get 8 boundary points + close
      const p1 = getPointCached(face, x, y);
      const p1_2 = getPointCached(face, x + halfStep, y);
      const p2 = getPointCached(face, x + finalStep, y);
      const p2_3 = getPointCached(face, x + finalStep, y + halfStep);
      const p3 = getPointCached(face, x + finalStep, y + finalStep);
      const p3_4 = getPointCached(face, x + halfStep, y + finalStep);
      const p4 = getPointCached(face, x, y + finalStep);
      const p4_1 = getPointCached(face, x, y + halfStep);

      const poly = [
        [p1.lon, p1.lat], [p1_2.lon, p1_2.lat], [p2.lon, p2.lat],
        [p2_3.lon, p2_3.lat], [p3.lon, p3.lat], [p3_4.lon, p3_4.lat],
        [p4.lon, p4.lat], [p4_1.lon, p4_1.lat], [p1.lon, p1.lat]
      ];

      gridCells.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [poly] },
        properties: { id: cellId, step: finalStep, isFocus: finalStep === 1 }
      });

      // Add lines for grid visualization (8 segments per cell, deduplicated via lineCache)
      const points = [p1, p1_2, p2, p2_3, p3, p3_4, p4, p4_1, p1];
      for (let i = 0; i < 8; i++) {
        const ptA = points[i];
        const ptB = points[i+1];
        // Create a unique key for the segment to avoid drawing twice
        const segmentKey = ptA.lat < ptB.lat || (ptA.lat === ptB.lat && ptA.lon < ptB.lon) 
          ? `${ptA.lat}_${ptA.lon}_${ptB.lat}_${ptB.lon}`
          : `${ptB.lat}_${ptB.lon}_${ptA.lat}_${ptA.lon}`;
          
        if (!lineCache.has(segmentKey)) {
          gridLines.push([[ptA.lon, ptA.lat], [ptB.lon, ptB.lat]]);
          lineCache.add(segmentKey);
        }
      }
    }
  }

  pointCache.clear();
  lineCache.clear();

  return { gridLines, gridCells };
}

// Re-implementing projection logic inside worker for speed and independence
(self as any).getQuantizedInternal = function(lat: number, lon: number) {
  const phi = (lat * Math.PI) / 180;
  const theta = (lon * Math.PI) / 180;
  const x = Math.cos(phi) * Math.cos(theta);
  const y = Math.cos(phi) * Math.sin(theta);
  const z = Math.sin(phi);
  const absX = Math.abs(x), absY = Math.abs(y), absZ = Math.abs(z);
  let face = 0, uc = 0, vc = 0;
  if (absX >= absY && absX >= absZ) {
    if (x > 0) { face = 0; uc = y; vc = z; } else { face = 1; uc = -y; vc = z; }
  } else if (absY >= absX && absY >= absZ) {
    if (y > 0) { face = 2; uc = -x; vc = z; } else { face = 3; uc = x; vc = z; }
  } else {
    if (z > 0) { face = 4; uc = -x; vc = -y; } else { face = 5; uc = -x; vc = y; }
  }
  const maxVal = Math.max(absX, absY, absZ);
  const xi = uc / maxVal;
  const eta = vc / maxVal;
  
  // Tangent Inverse Map (Equal-Area)
  const u = 0.5 * (Math.atan(xi) * 4 / Math.PI + 1.0);
  const v = 0.5 * (Math.atan(eta) * 4 / Math.PI + 1.0);
  
  return { face, qx: Math.floor(u * 2097152), qy: Math.floor(v * 2097152) };
};

(self as any).getFromQuantizedInternal = function(face: number, qx: number, qy: number) {
  const u = (qx / 2097152) * 2.0 - 1.0;
  const v = (qy / 2097152) * 2.0 - 1.0;
  
  // Tangent Map (Equal-Area)
  const xi = Math.tan(u * Math.PI / 4);
  const eta = Math.tan(v * Math.PI / 4);
  
  let x = 0, y = 0, z = 0;
  switch (face) {
    case 0: x = 1; y = xi; z = eta; break;
    case 1: x = -1; y = -xi; z = eta; break;
    case 2: x = -xi; y = 1; z = eta; break;
    case 3: x = xi; y = -1; z = eta; break;
    case 4: x = -xi; y = -eta; z = 1; break;
    case 5: x = -xi; y = eta; z = -1; break;
  }
  const length = Math.sqrt(x * x + y * y + z * z);
  x /= length; y /= length; z /= length;
  return {
    lat: (Math.asin(z) * 180) / Math.PI,
    lon: (Math.atan2(y, x) * 180) / Math.PI
  };
};
