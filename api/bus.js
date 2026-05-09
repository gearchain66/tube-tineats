module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const stopId = process.env.METLINK_STOP_ID;
  const apiKey = process.env.METLINK_API_KEY;
  const label  = process.env.METLINK_STOP_LABEL || ('Stop ' + stopId);
  if (!stopId || !apiKey) return res.status(200).json({ configured: false });

  try {
    const depRes = await fetch(
      `https://api.opendata.metlink.org.nz/v1/stop-predictions/${stopId}`,
      { headers: { 'x-api-key': apiKey, 'Accept': 'application/json' } }
    );

    const rawText = await depRes.text();

    // Return full debug info so we can see exactly what Metlink says
    if (!depRes.ok) {
      return res.status(200).json({
        configured: true, stopId, label,
        error: `Metlink returned ${depRes.status}`,
        metlinkResponse: rawText.slice(0, 500),
        keyLength: apiKey.length,
        keyStart: apiKey.slice(0, 6) + '...',
      });
    }

    const depData = JSON.parse(rawText);

    // vehicle positions — best effort
    let vehicles = [];
    try {
      const vpRes = await fetch(
        'https://api.opendata.metlink.org.nz/v1/gtfs-rt/vehiclepositions',
        { headers: { 'x-api-key': apiKey, 'Accept': 'application/json' } }
      );
      if (vpRes.ok) {
        const vpData = await vpRes.json();
        const routeIds = new Set((depData.departures || []).map(d => d.service_id).filter(Boolean));
        vehicles = (vpData.entity || vpData.Entities || [])
          .filter(e => {
            const r = e.vehicle?.trip?.route_id || e.vehicle?.trip?.routeId;
            return r && routeIds.has(r);
          })
          .map(e => ({
            id:       e.id,
            route:    e.vehicle.trip.route_id || e.vehicle.trip.routeId || '?',
            lat:      e.vehicle.position?.latitude,
            lng:      e.vehicle.position?.longitude,
            bearing:  e.vehicle.position?.bearing || null,
            headsign: e.vehicle.trip?.trip_headsign || null,
          }))
          .filter(v => v.lat && v.lng);
      }
    } catch(_) {}

    return res.status(200).json({ configured: true, stopId, label, data: depData, vehicles });
  } catch(e) {
    return res.status(200).json({ configured: true, stopId, label, error: e.message });
  }
};
