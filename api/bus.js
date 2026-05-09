module.exports = async function handler(req, res) {
  const stopId = process.env.METLINK_STOP_ID;
  const apiKey = process.env.METLINK_API_KEY;
  const label  = process.env.METLINK_STOP_LABEL || ('Stop ' + stopId);

  if (!stopId || !apiKey) {
    return res.status(200).json({ configured: false });
  }

  try {
    const depRes = await fetch(
      `https://api.metlink.org.nz/api/v1/stop-predictions/${stopId}`,
      {
        headers: {
          'x-api-key': apiKey,
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; RubyRecipes/1.0)',
        },
        signal: AbortSignal.timeout(12000),
      }
    );

    const rawText = await depRes.text();

    if (!depRes.ok) {
      return res.status(500).json({ configured: true, stopId, label, error: `Metlink HTTP ${depRes.status}`, raw: rawText.slice(0, 500) });
    }

    let depData;
    try { depData = JSON.parse(rawText); }
    catch(e) { return res.status(500).json({ configured: true, stopId, label, error: 'JSON parse failed', raw: rawText.slice(0, 500) }); }

    // vehicle positions — best effort
    let vehicles = [];
    try {
      const vpRes = await fetch('https://api.metlink.org.nz/api/v1/gtfs-rt/vehiclepositions', {
        headers: { 'x-api-key': apiKey, 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; RubyRecipes/1.0)' },
        signal: AbortSignal.timeout(8000),
      });
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

    return res.status(200).json({ configured: true, stopId, label, data: depData, vehicles, debug: Object.keys(depData) });
  } catch (e) {
    return res.status(500).json({ configured: true, stopId, label, error: e.message });
  }
};
