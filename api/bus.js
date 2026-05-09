module.exports = function handler(req, res) {
  const stopId = process.env.METLINK_STOP_ID;
  const apiKey = process.env.METLINK_API_KEY;
  const label  = process.env.METLINK_STOP_LABEL || ('Stop ' + stopId);
  if (!stopId || !apiKey) return res.status(200).json({ configured: false });
  return res.status(200).json({ configured: true, stopId, apiKey, label, data: { departures: [] }, vehicles: [] });
};
