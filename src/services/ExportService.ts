import { saveAs } from 'file-saver';

export interface ExportData {
  id: string;
  lat: number;
  lon: number;
  alt?: number;
  name?: string;
  type?: string;
  timestamp: string;
}

export class ExportService {
  private static escapeXml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  static exportToCSV(data: ExportData[], fileName: string = 'geogrid_export.csv') {
    const headers = ['AGID', 'Latitude', 'Longitude', 'Altitude (m)', 'Name', 'Type', 'Timestamp'];
    const rows = data.map(item => [
      item.id,
      item.lat.toFixed(8),
      item.lon.toFixed(8),
      item.alt?.toFixed(2) || 'N/A',
      item.name || 'Unnamed',
      item.type || 'Point',
      item.timestamp
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, fileName);
  }

  static exportToGeoJSON(data: ExportData[], fileName: string = 'geogrid_export.geojson') {
    const geojson = {
      type: "FeatureCollection",
      features: data.map(item => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [item.lon, item.lat, item.alt || 0]
        },
        properties: {
          id: item.id,
          name: item.name,
          type: item.type,
          timestamp: item.timestamp
        }
      }))
    };

    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
    saveAs(blob, fileName);
  }

  static exportToKML(data: ExportData[], fileName: string = 'geogrid_export.kml') {
    let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>GeoGrid Export</name>
    <description>Precision Grid Data Export</description>
    <Style id="agidMarker">
      <IconStyle>
        <color>ff00ff00</color>
        <scale>1.1</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href>
        </Icon>
      </IconStyle>
    </Style>
`;

    data.forEach(item => {
      kml += `    <Placemark>
      <name>${item.id}</name>
      <description><![CDATA[
        Name: ${item.name || 'N/A'}<br/>
        Type: ${item.type || 'N/A'}<br/>
        Time: ${item.timestamp}
      ]]></description>
      <styleUrl>#agidMarker</styleUrl>
      <Point>
        <coordinates>${item.lon},${item.lat},${item.alt || 0}</coordinates>
      </Point>
    </Placemark>\n`;
    });

    kml += `  </Document>
</kml>`;

    const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
    saveAs(blob, fileName);
  }

  static exportToGPX(data: ExportData[], fileName: string = 'geogrid_export.gpx') {
    const exportedAt = new Date().toISOString();
    let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="AGID" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>AGID Export</name>
    <time>${exportedAt}</time>
  </metadata>
`;

    data.forEach(item => {
      const name = ExportService.escapeXml(item.name || item.id || 'AGID Point');
      const desc = ExportService.escapeXml(`AGID: ${item.id}${item.type ? ` | Type: ${item.type}` : ''}`);
      const waypointLines = [
        `  <wpt lat="${item.lat.toFixed(8)}" lon="${item.lon.toFixed(8)}">`,
        `    <name>${name}</name>`,
        `    <desc>${desc}</desc>`
      ];
      if (typeof item.alt === 'number') {
        waypointLines.push(`    <ele>${item.alt.toFixed(2)}</ele>`);
      }
      waypointLines.push(`    <time>${item.timestamp}</time>`);
      waypointLines.push(`  </wpt>`);
      gpx += `${waypointLines.join('\n')}\n`;
    });

    gpx += `</gpx>`;

    const blob = new Blob([gpx], { type: 'application/gpx+xml;charset=utf-8;' });
    saveAs(blob, fileName);
  }
}
