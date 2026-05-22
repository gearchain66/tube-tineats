module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { tt } = req.query;
  if (!tt || !/^tt\d+$/.test(tt)) {
    return res.status(400).json({ error: 'Invalid tt ID' });
  }

  try {
    const url = `https://www.boxofficemojo.com/title/${tt}/`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });

    if (!response.ok) {
      return res.status(200).json({ tt, domestic: null, error: 'BOM returned ' + response.status });
    }

    const html = await response.text();

    // Box Office Mojo domestic gross patterns:
    // "Domestic\n$123,456,789" or "Domestic (XX%)\n$123,456,789"
    // Look for the summary money table
    let domestic = null;

    // Pattern 1: summary-domestic-money span (most reliable)
    let m = html.match(/summary-domestic-money[^>]*>[^$]*\$([\d,]+)/);
    if (m) {
      domestic = parseInt(m[1].replace(/,/g, ''));
    }

    // Pattern 2: Domestic label followed by $ amount
    if (domestic === null) {
      m = html.match(/Domestic[^<]{0,80}?\$([\d,]+)/);
      if (m) {
        domestic = parseInt(m[1].replace(/,/g, ''));
      }
    }

    // Pattern 3: Look for the money-value span near "Domestic"
    if (domestic === null) {
      const domIdx = html.indexOf('>Domestic<');
      if (domIdx !== -1) {
        const chunk = html.slice(domIdx, domIdx + 600);
        const mChunk = chunk.match(/\$([\d,]{3,})/);
        if (mChunk) domestic = parseInt(mChunk[1].replace(/,/g, ''));
      }
    }

    return res.status(200).json({
      tt,
      domestic,          // integer dollars, or null if not found / not yet released
      updated: new Date().toISOString(),
    });

  } catch (e) {
    return res.status(200).json({ tt, domestic: null, error: e.message });
  }
};
