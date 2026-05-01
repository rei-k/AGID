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
}
