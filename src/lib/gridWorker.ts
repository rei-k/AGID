import { 
  encodeAGID, 
  getCellPolygon, 
  K, 
  M
} from './agid';

self.onmessage = (e: MessageEvent) => {
  const { lat, lon, zoom, bounds, isLargeGrid } = e.data;
  
  const features = getGridFeaturesWorker(zoom, bounds, isLargeGrid, lat, lon);
  self.postMessage(features);
};

function getGridFeaturesWorker(zoom: number, bounds: any, isLargeGrid: boolean, lat: number, lon: number) {
  const bObj = bounds ? {
    w: bounds[0][0],
    s: bounds[0][1],
    e: bounds[1][0],
    n: bounds[1][1]
  } : null;

  if (!bObj) return { gridLines: [], gridCells: [] };

  const gridLines: any[][] = [];
  const gridCells: any[] = [];
  const seenCellIds = new Set<string>();
  
  // Adaptive step based on viewport width to ensure full screen coverage without crashing
  // W is total width in quantization units
  const totalW = ((bObj.e + 180) / 360) * K - ((bObj.w + 180) / 360) * K;
  
  // Aim for a balanced density for good visual coverage without crashing
  const targetDensity = 400; 
  let idealStep = Math.max(1, Math.floor(totalW / targetDensity));
  
  // Snap step to powers of 2 for more stable grid lines during panning
  let step = 1;
  while (step * 2 <= idealStep) {
    step *= 2;
  }
  
  // Ensure step doesn't get too small at mid-zooms to maintain performance
  // Reduced minimums to allow the grid to stay more detailed for longer
  if (zoom < 14 && step < 4) step = 4;
  if (zoom < 11 && step < 16) step = 16;
  if (zoom < 9 && step < 64) step = 64;
  if (zoom < 7 && step < 256) step = 256;

  const shouldProduceCells = (zoom >= 14) || (isLargeGrid); 

  // Convert viewport bounds to quantization indices
  let minQX = Math.floor(((bObj.w + 180) / 360) * K);
  let maxQX = Math.floor(((bObj.e + 180) / 360) * K);
  let minQY = Math.floor(((bObj.s + 90) / 180) * (K / 2));
  let maxQY = Math.floor(((bObj.n + 90) / 180) * (K / 2));

  // Buffer area to avoid edges flickering and handle screen rotation/tilt
  // Increased to 200 steps for even more massive coverage
  minQX = Math.floor(minQX / step) * step - (step * 200);
  maxQX = Math.ceil(maxQX / step) * step + (step * 200);
  minQY = Math.floor(minQY / step) * step - (step * 200);
  maxQY = Math.ceil(maxQY / step) * step + (step * 200);

  minQX = Math.max(0, Math.min(M, minQX));
  maxQX = Math.max(0, Math.min(M, maxQX));
  minQY = Math.max(0, Math.min(Math.floor(K / 2) - 1, minQY));
  maxQY = Math.max(0, Math.min(Math.floor(K / 2) - 1, maxQY));
  
  // High count limit for professional coverage
  // Increased to 1M to ensure full viewport fill on any screen
  const countLimit = 1000000; 
  const totalCount = ((maxQX - minQX) / step + 1) * ((maxQY - minQY) / step + 1);
  
  // -- FOCUS GRID (300m Radius) --
  // Always include high-res grid (step=1) within ~300m of target center
  // 300m is roughly 100 units at K=12,960,000
  const centerQX = Math.floor(((lon + 180) / 360) * K);
  const centerQY = Math.floor(((lat + 90) / 180) * (K / 2));
  const focusRadius = 100; // ~330m at 0.1 arc-second (3.3m/cell)
  
  const minFocusX = Math.max(0, centerQX - focusRadius);
  const maxFocusX = Math.min(M, centerQX + focusRadius);
  const minFocusY = Math.max(0, centerQY - focusRadius);
  const maxFocusY = Math.min(Math.floor(K / 2) - 1, centerQY + focusRadius);

  if (totalCount > countLimit) {
    const centerX = Math.floor(((minQX + maxQX) / 2) / step) * step;
    const centerY = Math.floor(((minQY + maxQY) / 2) / step) * step;
    const side = Math.floor(Math.sqrt(countLimit) / 2) * step;
    minQX = Math.max(0, centerX - side);
    maxQX = Math.min(M, centerX + side);
    minQY = Math.max(0, centerY - side);
    maxQY = Math.min(Math.floor(K / 2) - 1, centerY + side);
  }

  const edgeSet = new Set<string>();

  // 1. FOCUS HIGHLIGHT LOOP (Always Step 1 for 300m radius)
  for (let qy = minFocusY; qy <= maxFocusY; qy += 1) {
    for (let qx = minFocusX; qx <= maxFocusX; qx += 1) {
      const cellId = `${qx}_${qy}_1`;
      if (seenCellIds.has(cellId)) continue;
      seenCellIds.add(cellId);

      const minLon = (qx / K) * 360 - 180;
      const maxLon = ((qx + 1) / K) * 360 - 180;
      const minLat = (qy / (K / 2)) * 180 - 90;
      const maxLat = ((qy + 1) / (K / 2)) * 180 - 90;

      const p0 = [minLon, minLat];
      const p1 = [maxLon, minLat];
      const p2 = [maxLon, maxLat];
      const p3 = [minLon, maxLat];

      // Edges
      const vL = `v_${qx}_${qy}`;
      if (!edgeSet.has(vL)) { gridLines.push([p0, p3]); edgeSet.add(vL); }
      const vR = `v_${qx + 1}_${qy}`;
      if (!edgeSet.has(vR)) { gridLines.push([p1, p2]); edgeSet.add(vR); }
      const hB = `h_${qx}_${qy}`;
      if (!edgeSet.has(hB)) { gridLines.push([p0, p1]); edgeSet.add(hB); }
      const hT = `h_${qx}_${qy + 1}`;
      if (!edgeSet.has(hT)) { gridLines.push([p3, p2]); edgeSet.add(hT); }

      gridCells.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [[p0, p1, p2, p3, p0]] },
        properties: { id: cellId, step: 1, isFocus: true }
      });
    }
  }

  // 2. MAIN ADAPTIVE GRID LOOP
  for (let qy = minQY; qy <= maxQY; qy += step) {
    for (let qx = minQX; qx <= maxQX; qx += step) {
      const cellId = `${qx}_${qy}_${step}`;
      if (seenCellIds.has(cellId)) continue;
      seenCellIds.add(cellId);

      // Inline coordinate calculation with clamping
      const minLon = Math.max(-180, Math.min(180, (qx / K) * 360 - 180));
      const maxLon = Math.max(-180, Math.min(180, ((qx + step) / K) * 360 - 180));
      const minLat = Math.max(-90, Math.min(90, (qy / (K / 2)) * 180 - 90));
      const maxLat = Math.max(-90, Math.min(90, ((qy + step) / (K / 2)) * 180 - 90));

      const p0 = [minLon, minLat];
      const p1 = [maxLon, minLat];
      const p2 = [maxLon, maxLat];
      const p3 = [minLon, maxLat];

      // Efficiently add unique edges using integer indices
      // Vertical left
      const vLeftId = `v_${qx}_${qy}`;
      if (!edgeSet.has(vLeftId)) {
        gridLines.push([p0, p3]);
        edgeSet.add(vLeftId);
      }
      // Vertical right
      const vRightId = `v_${qx + step}_${qy}`;
      if (!edgeSet.has(vRightId)) {
        gridLines.push([p1, p2]);
        edgeSet.add(vRightId);
      }
      // Horizontal bottom
      const hBottomId = `h_${qx}_${qy}`;
      if (!edgeSet.has(hBottomId)) {
        gridLines.push([p0, p1]);
        edgeSet.add(hBottomId);
      }
      // Horizontal top
      const hTopId = `h_${qx}_${qy + step}`;
      if (!edgeSet.has(hTopId)) {
        gridLines.push([p3, p2]);
        edgeSet.add(hTopId);
      }

      if (shouldProduceCells || step > 1) {
        gridCells.push({
          type: 'Feature',
          geometry: { 
            type: 'Polygon', 
            coordinates: [[p0, p1, p2, p3, p0]] 
          },
          properties: { id: cellId, step }
        });
      }
    }
  }

  return { gridLines, gridCells };
}
