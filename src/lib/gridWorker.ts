const K = 2097152;
const M = 2097151;

self.onmessage = (e: MessageEvent) => {
  const { lat, lon, zoom, bounds } = e.data;
  
  const features = getGridFeaturesWorker(zoom, bounds, lat, lon);
  self.postMessage(features);
};

function getGridFeaturesWorker(zoom: number, bounds: any, lat: number, lon: number) {
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
  
  // Calculate ideal step based on zoom
  let idealStep = Math.pow(2, Math.max(0, Math.floor(18.5 - zoom)));
  let finalStep = 1;
  while (finalStep * 2 <= idealStep && finalStep < 131072) finalStep *= 2;
  
  const range = zoom > 18 ? 100 : (zoom > 15 ? 70 : 40); 
  
  const startQX = Math.max(0, Math.floor(qx / finalStep) * finalStep - (finalStep * Math.floor(range/2)));
  const endQX = Math.min(M, startQX + (finalStep * range));
  const startQY = Math.max(0, Math.floor(qy / finalStep) * finalStep - (finalStep * Math.floor(range/2)));
  const endQY = Math.min(M, startQY + (finalStep * range));

  for (let y = startQY; y < endQY; y += finalStep) {
    for (let x = startQX; x < endQX; x += finalStep) {
      const cellId = `${face}_${x}_${y}_${finalStep}`;

      // Get 4 corners
      const p1 = getPointCached(face, x, y);
      const p2 = getPointCached(face, x + finalStep, y);
      const p3 = getPointCached(face, x + finalStep, y + finalStep);
      const p4 = getPointCached(face, x, y + finalStep);

      const pts = [p1, p2, p3, p4];
      const refLon = p1.lon;
      const adjusted = pts.map(p => {
        let shiftLon = p.lon;
        if (shiftLon - refLon > 180) shiftLon -= 360;
        else if (shiftLon - refLon < -180) shiftLon += 360;
        return [shiftLon, p.lat];
      });

      const poly = [...adjusted, adjusted[0]];

      gridCells.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [poly] },
        properties: { id: cellId, step: finalStep, isFocus: finalStep === 1 }
      });

      for (let i = 0; i < 4; i++) {
        const ptA = poly[i];
        const ptB = poly[i+1];
        // Create a unique key for the segment
        const segmentKey = ptA[0] < ptB[0] || (ptA[0] === ptB[0] && ptA[1] < ptB[1])
          ? `${ptA[0].toFixed(8)}_${ptA[1].toFixed(8)}_${ptB[0].toFixed(8)}_${ptB[1].toFixed(8)}`
          : `${ptB[0].toFixed(8)}_${ptB[1].toFixed(8)}_${ptA[0].toFixed(8)}_${ptA[1].toFixed(8)}`;
          
        if (!lineCache.has(segmentKey)) {
          gridLines.push([ptA, ptB]);
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
