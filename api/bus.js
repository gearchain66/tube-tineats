export const config = { runtime: 'edge' };

export default async function handler(req) {
  const stopId = process.env.METLINK_STOP_ID;
  const apiKey = process.env.METLINK_API_KEY;
  const label  = process.env.METLINK_STOP_LABEL || ('Stop ' + stopId);

  if (!stopId || !apiKey) {
    return Response.json({ configured: false });
  }

  const mlHeaders = { 'x-api-key': apiKey, 'Accept': 'application/json' };

  try {
    const depRes = await fetch(
      `https://api.metlink.org.nz/api/v1/stop-predictions/${stopId}`,
      { headers: mlHeaders }
    );

    if (!depRes.ok) throw new Error('Metlink returned ' + depRes.status);
    const depData = await depRes.json();

    // Try vehicle positions separately — don't let it crash the whole thing
    let vehicles = [];
    try {
      const vpRes = await fetch(
        'https://api.metlink.org.nz/api/v1/gtfs-rt/vehiclepositions',
        { headers: mlHeaders }
      );
      if (vpRes.ok) {
        const vpData = await vpRes.json();
        const routeIds = new Set(
          (depData.departures || []).map(d => d.service_id).filter(Boolean)
        );
        const entities = vpData.entity || vpData.Entities || [];
        vehicles = entities
          .filter(e => {
            const r = e.vehicle && e.vehicle.trip &&
              (e.vehicle.trip.route_id || e.vehicle.trip.routeId);
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
    } catch (_) { /* vehicles optional */ }

    return Response.json({ configured: true, stopId, label, data: depData, vehicles });
  } catch (e) {
    return Response.json(
      { configured: true, stopId, label, error: e.message },
      { status: 500 }
    );
  }
}
