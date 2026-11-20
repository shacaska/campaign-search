// HTML -> readable plain text, without needing a DOM (works in Node and the browser).

const NAMED = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—',
  hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', bull: '•', middot: '·',
  copy: '©', reg: '®', trade: '™', times: '×', eacute: 'é', egrave: 'è', aacute: 'á',
  oacute: 'ó', uacute: 'ú', iacute: 'í', ouml: 'ö', uuml: 'ü', auml: 'ä', szlig: 'ß',
  laquo: '«', raquo: '»', deg: '°', euro: '€', pound: '£', frac12: '½', rarr: '→', larr: '←',
};

export function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      try { return String.fromCodePoint(code); } catch { return m; }
    }
    const v = NAMED[e.toLowerCase()];
    return v === undefined ? m : v;
  });
}

export function htmlToText(html) {
  if (!html) return '';
  let s = String(html);
  s = s.replace(/<(script|style|noscript|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  s = s.replace(/<!--[\s\S]*?-->/g, ' ');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<li\b[^>]*>/gi, '\n• ');
  s = s.replace(/<\/(p|div|h[1-6]|li|ul|ol|blockquote|figure|figcaption|tr|table|section|article|header|footer|pre)>/gi, '\n\n');
  s = s.replace(/<(h[1-6]|p|div|blockquote|figure|table|ul|ol)\b[^>]*>/gi, '\n');
  s = s.replace(/<\/t[dh]>/gi, '\t');
  // Keep image captions/alt text, which often name components ("Eidolon box")
  s = s.replace(/<img\b[^>]*?\balt\s*=\s*"([^"]{2,})"[^>]*>/gi, (m, alt) => ` [image: ${alt}] `);
  s = s.replace(/<[^>]+>/g, '');
  s = decodeEntities(s);
  s = s
    .replace(/\r/g, '')
    .replace(/[ \t\u00a0\u200b]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return s;
}
