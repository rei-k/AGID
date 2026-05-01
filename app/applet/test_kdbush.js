import KDBush from 'kdbush';
import geokdbush from 'geokdbush';

const points = [
  { lon: 10, lat: 20, name: 'A' },
  { lon: 11, lat: 21, name: 'B' }
];

const index = new KDBush(points.length);
for (const p of points) {
  index.add(p.lon, p.lat);
}
index.finish();

const nearest = geokdbush.around(index, 10.1, 20.1, 1);
console.log(nearest);
