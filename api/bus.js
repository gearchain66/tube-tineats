module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const stopId = process.env.METLINK_STOP_ID;
  const apiKey = process.env.METLINK_API_KEY;
  const label  = process.env.METLINK_STOP_LABEL || ('Stop ' + stopId);
  if (!stopId || !apiKey) return res.status(200).json({ configured: false });

  // Metlink uses Azure API Management — try both common header names
  const mlHeaders = {
    'x-api-key': apiKey,
    'Ocp-Apim-Subscription-Key': apiKey,
    'Accept': 'application/json',
  };

  try {
    const depRes = await fetch(
      `https://api.opendata.metlink.org.nz/v1/stop-predictions/${stopId}`,
      { headers: mlHeaders }
    );

    const rawText = await depRes.text();

    if (!depRes.ok) {
      return res.status(200).json({
        configured: true, stopId, label,
        error: `Metlink returned ${depRes.status}`,
        metlinkResponse: rawText.slice(0, 500),
      });
    }

    const depData = JSON.parse(rawText);

    let vehicles = [];
    try {
      const vpRes = await fetch(
        'https://api.opendata.metlink.org.nz/v1/gtfs-rt/vehiclepositions',
        { headers: mlHeaders }
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
