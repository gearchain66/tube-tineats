export const config = { runtime: 'edge' };

export default async function handler(req) {
  const stopId = process.env.METLINK_STOP_ID;
  const apiKey = process.env.METLINK_API_KEY;
  const label  = process.env.METLINK_STOP_LABEL || ('Stop ' + stopId);

  if (!stopId || !apiKey) {
    return Response.json({ configured: false });
  }

  try {
    const depRes = await fetch(
      `https://api.metlink.org.nz/api/v1/stop-predictions/${stopId}`,
      { headers: { 'x-api-key': apiKey, 'Accept': 'application/json' } }
    );

    const rawText = await depRes.text();

    if (!depRes.ok) {
      return Response.json({ configured: true, stopId, label, error: `HTTP ${depRes.status}`, raw: rawText.slice(0, 300) }, { status: 500 });
    }

    let depData;
    try {
      depData = JSON.parse(rawText);
    } catch(e) {
      return Response.json({ configured: true, stopId, label, error: 'JSON parse failed', raw: rawText.slice(0, 300) }, { status: 500 });
    }

    return Response.json({ configured: true, stopId, label, data: depData, vehicles: [], debug: Object.keys(depData) });
  } catch (e) {
    return Response.json({ configured: true, stopId, label, error: e.message, stack: e.stack?.slice(0, 300) }, { status: 500 });
  }
}
