module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { slug } = req.query;
  if (!slug || typeof slug !== 'string' || slug.length > 200) {
    return res.status(400).json({ error: 'Invalid slug' });
  }

  try {
    const url = `https://www.the-numbers.com/movie/${encodeURIComponent(slug)}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });

    if (!response.ok) {
      return res.status(200).json({ slug, domestic: null, error: 'The Numbers returned ' + response.status });
    }

    const html = await response.text();
    let domestic = null;

    // The Numbers pattern: "Domestic Box Office</td>\n<td>$64,869,693"
    // or inside a table row with "Domestic Box Office" header
    const m = html.match(/Domestic Box Office[\s\S]{0,200}?\$([\d,]+)/);
    if (m) {
      domestic = parseInt(m[1].replace(/,/g, ''));
    }

    return res.status(200).json({
      slug,
      domestic,
      updated: new Date().toISOString(),
    });

  } catch (e) {
    return res.status(200).json({ slug, domestic: null, error: e.message });
  }
};
