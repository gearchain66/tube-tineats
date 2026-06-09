module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const url = 'https://regulationfan.com/community/movie-bidding/results';
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });

    if (!response.ok) {
      return res.status(200).json({ results: [], error: 'Site returned ' + response.status });
    }

    const html = await response.text();
    const results = [];

    // Parse table rows — each row typically has: movie title, gross, bidder
    // Look for <tr> blocks containing dollar amounts
    // Common patterns: <td>Movie Title</td><td>$123,456,789</td>
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;

    while ((rowMatch = rowRegex.exec(html)) !== null) {
      const rowHtml = rowMatch[1];
      // Extract all <td> cell texts
      const cells = [];
      const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      let cellMatch;
      while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
        // Strip inner HTML tags and decode entities
        const text = cellMatch[1]
          .replace(/<[^>]+>/g, '')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&nbsp;/g, ' ')
          .replace(/&#\d+;/g, '')
          .trim();
        if (text) cells.push(text);
      }

      if (cells.length < 2) continue;

      // Find a cell that looks like a dollar amount
      let gross = null;
      let titleIdx = -1;
      for (let i = 0; i < cells.length; i++) {
        const m = cells[i].match(/^\$?([\d,]+)$/);
        if (m) {
          gross = parseInt(m[1].replace(/,/g, ''));
          // title is typically the first non-dollar cell before this
          for (let j = i - 1; j >= 0; j--) {
            if (!cells[j].match(/^\$?[\d,]+$/) && cells[j].length > 2) {
              titleIdx = j;
              break;
            }
          }
          break;
        }
        // Also catch "123,456,789" without $
        const m2 = cells[i].match(/^([\d]{1,3}(?:,\d{3})+)$/);
        if (m2) {
          gross = parseInt(m2[1].replace(/,/g, ''));
          for (let j = i - 1; j >= 0; j--) {
            if (!cells[j].match(/^[\d,]+$/) && cells[j].length > 2) {
              titleIdx = j;
              break;
            }
          }
          break;
        }
      }

      if (gross !== null && gross > 0 && titleIdx >= 0) {
        const title = cells[titleIdx].replace(/\s+/g, ' ').trim();
        // Skip header-like rows
        if (/title|movie|film|gross|earn/i.test(title) && title.length < 20) continue;
        results.push({ title, gross });
      }
    }

    // Deduplicate by title (keep highest gross)
    const deduped = {};
    for (const r of results) {
      const key = r.title.toLowerCase();
      if (!deduped[key] || r.gross > deduped[key].gross) {
        deduped[key] = r;
      }
    }

    return res.status(200).json({
      results: Object.values(deduped),
      count: Object.keys(deduped).length,
      updated: new Date().toISOString(),
    });

  } catch (e) {
    return res.status(200).json({ results: [], error: e.message });
  }
};
