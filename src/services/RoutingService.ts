
import createGraph from 'ngraph.graph';
import path from 'ngraph.path';
import { fetchWithRetry } from '../lib/utils';
import { calculateDistance } from '../lib/nav';

export interface RouteNode {
  id: string;
  lat: number;
  lon: number;
}

export type travelMode = 'driving' | 'walking';

export interface RouteResult {
  path: RouteNode[];
  distance: number; // in meters
  duration: number; // estimated in seconds
  mode: travelMode;
}

/**
 * Routing Service using Bidirectional Search
 */
export class RoutingService {
  /**
   * Fetches road data from Overpass for a bounding box.
   */
  private static async fetchRoads(minLat: number, minLon: number, maxLat: number, maxLon: number, mode: travelMode) {
    const filters = mode === 'walking' 
      ? 'way["highway"]["footway"!="no"]["access"!="private"]'
      : 'way["highway"~"motorway|trunk|primary|secondary|tertiary|unclassified|residential"]["motor_vehicle"!="no"]["access"!="private"]';

    const query = `
      [out:json][timeout:90];
      (
        ${filters}(${minLat},${minLon},${maxLat},${maxLon});
      );
      out body;
      >;
      out skel qt;
    `;

    const response = await fetchWithRetry('/api/overpass', {
      method: 'POST',
      body: JSON.stringify({ query }),
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) throw new Error('Failed to fetch road data for routing');
    return await response.json();
  }

  /**
   * Finds the shortest path between two coordinates.
   */
  public static async findRoute(start: [number, number], end: [number, number], mode: travelMode = 'driving'): Promise<RouteResult | null> {
    const [startLat, startLon] = start;
    const [endLat, endLon] = end;

    // 1. Define BBOX with dynamic buffer based on distance
    const dist = calculateDistance(startLat, startLon, endLat, endLon) * 1000;
    const buffer = Math.max(0.005, Math.min(0.05, dist / 100000)); // 0.5km to 5km buffer
    
    const minLat = Math.min(startLat, endLat) - buffer;
    const maxLat = Math.max(startLat, endLat) + buffer;
    const minLon = Math.min(startLon, endLon) - buffer;
    const maxLon = Math.max(startLon, endLon) + buffer;

    console.log(`[Routing] Mode: ${mode}, BBOX: ${minLat},${minLon},${maxLat},${maxLon}`);
    const data = await this.fetchRoads(minLat, minLon, maxLat, maxLon, mode);

    // 2. Build Graph
    const graph = createGraph();
    const nodesMap = new Map<string, { lat: number, lon: number }>();

    data.elements.forEach((el: any) => {
      if (el.type === 'node') {
        nodesMap.set(el.id.toString(), { lat: el.lat, lon: el.lon });
        graph.addNode(el.id.toString(), { lat: el.lat, lon: el.lon });
      }
    });

    data.elements.forEach((el: any) => {
      if (el.type === 'way' && el.nodes) {
        const isOneWay = mode === 'driving' && (el.tags.oneway === 'yes' || el.tags.junction === 'roundabout');
        
        for (let i = 0; i < el.nodes.length - 1; i++) {
          const fromId = el.nodes[i].toString();
          const toId = el.nodes[i + 1].toString();
          
          const fromNode = nodesMap.get(fromId);
          const toNode = nodesMap.get(toId);
          
          if (fromNode && toNode) {
            const d = calculateDistance(fromNode.lat, fromNode.lon, toNode.lat, toNode.lon) * 1000;
            graph.addLink(fromId, toId, { weight: d });
            if (!isOneWay) {
              graph.addLink(toId, fromId, { weight: d });
            }
          }
        }
      }
    });

    // 3. Find closest nodes
    let startNodeId = '';
    let endNodeId = '';
    let minStartDist = Infinity;
    let minEndDist = Infinity;

    nodesMap.forEach((coords, id) => {
      const dStart = calculateDistance(startLat, startLon, coords.lat, coords.lon) * 1000;
      const dEnd = calculateDistance(endLat, endLon, coords.lat, coords.lon) * 1000;
      
      if (dStart < minStartDist) { minStartDist = dStart; startNodeId = id; }
      if (dEnd < minEndDist) { minEndDist = dEnd; endNodeId = id; }
    });

    if (!startNodeId || !endNodeId || minStartDist > 5000 || minEndDist > 5000) {
      console.warn('[Routing] Start or End node not found or too far');
      return null;
    }

    const pathFinder = path.nba(graph, {
      distance(fromNode, toNode, link) { return link.data.weight; },
      heuristic(fromNode, toNode) {
        return calculateDistance(
          (fromNode.data as any).lat, (fromNode.data as any).lon,
          (toNode.data as any).lat, (toNode.data as any).lon
        ) * 1000;
      }
    });

    const solution = pathFinder.find(startNodeId, endNodeId);
    if (!solution || solution.length === 0) return null;

    const resultPath: RouteNode[] = solution.map(n => ({
      id: n.id as string,
      lat: (n.data as any).lat,
      lon: (n.data as any).lon
    })).reverse();

    let totalDist = 0;
    for (let i = 0; i < resultPath.length - 1; i++) {
      totalDist += calculateDistance(resultPath[i].lat, resultPath[i].lon, resultPath[i+1].lat, resultPath[i+1].lon) * 1000;
    }

    // Walking: 5km/h = 1.39m/s, Driving: ~40km/h = 11.1m/s
    const speed = mode === 'walking' ? 1.39 : 11.1;

    return {
      path: resultPath,
      distance: totalDist,
      duration: totalDist / speed,
      mode
    };
  }
}
