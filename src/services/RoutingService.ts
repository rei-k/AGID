
import createGraph from 'ngraph.graph';
import path from 'ngraph.path';
import { fetchWithRetry } from '../lib/api-utils';

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
   * Calculates distance between two points in meters (Haversine).
   */
  private static getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Finds the shortest path between two coordinates.
   */
  public static async findRoute(start: [number, number], end: [number, number], mode: travelMode = 'driving'): Promise<RouteResult | null> {
    const [startLat, startLon] = start;
    const [endLat, endLon] = end;

    // 1. Define BBOX with dynamic buffer based on distance
    const dist = this.getDistance(startLat, startLon, endLat, endLon);
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
            const d = this.getDistance(fromNode.lat, fromNode.lon, toNode.lat, toNode.lon);
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
      const dStart = this.getDistance(startLat, startLon, coords.lat, coords.lon);
      const dEnd = this.getDistance(endLat, endLon, coords.lat, coords.lon);
      
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
        return RoutingService.getDistance(
          (fromNode.data as any).lat, (fromNode.data as any).lon,
          (toNode.data as any).lat, (toNode.data as any).lon
        );
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
      totalDist += this.getDistance(resultPath[i].lat, resultPath[i].lon, resultPath[i+1].lat, resultPath[i+1].lon);
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
