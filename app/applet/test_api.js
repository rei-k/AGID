import https from 'https';
https.get('https://geoapi.heartrails.com/api/json?method=searchByGeoLocation&x=139.767&y=35.681', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => console.log(data));
}).on('error', (e) => console.error(e.message));
