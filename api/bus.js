module.exports = async function handler(req, res) {
  const stopId = process.env.METLINK_STOP_ID;
  const apiKey = process.env.METLINK_API_KEY;
  const label  = process.env.METLINK_STOP_LABEL || ('Stop ' + stopId);

  if (!stopId || !apiKey) {
    return res.status(200).json({ configured: false });
  }

  const headers = { 'x-api-key': apiKey, 'Accept': 'application/json' };

  try {
    const [depRes, vpRes] = await Promise.all([
      fetch(`https://api.metlink.org.nz/api/v1/stop-predictions/${stopId}`, { headers }),
      fetch(`https://api.metlink.org.nz/api/v1/gtfs-rt/vehiclepositions`, { headers }),
    ]);

    if (!depRes.ok) throw new Error('Departures API returned ' + depRes.status);
    const depData = await depRes.json();

    const routeIds = new Set(
      (depData.departures || []).map(d => d.service_id).filter(Boolean)
    );

    let vehicles = [];
    if (vpRes.ok) {
      const vpData = await vpRes.json();
      const entities = vpData.entity || vpData.Entities || [];
      vehicles = entities
        .filter(e => {
          const r = e.vehicle && e.vehicle.trip && (e.vehicle.trip.route_id || e.vehicle.trip.routeId);
          return r && routeIds.has(r);
        })
        .map(e => {
          const v = e.vehicle;
          return {
            id:       e.id,
            route:    (v.trip && (v.trip.route_id || v.trip.routeId)) || '?',
            lat:      v.position && v.position.latitude,
            lng:      v.position && v.position.longitude,
            bearing:  v.position ? (v.position.bearing || null) : null,
            headsign: (v.trip && v.trip.trip_headsign) || null,
          };
        })
        .filter(v => v.lat && v.lng);
    }

    return res.status(200).json({ configured: true, stopId, label, data: depData, vehicles });
  } catch (e) {
    return res.status(500).json({ configured: true, error: e.message });
  }
};
