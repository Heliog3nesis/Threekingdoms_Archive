// officials-rank.js
// Splits a position's free-text rank (e.g. "四品，比二千石，一人") into the
// grade part and the salary/headcount remainder. Shared by the category
// detail panel and the compare page so both read rank the same way.

export function splitRank(rankArr) {
  let gradeText = '?', salaryText = '?';
  if (!rankArr || rankArr.length === 0) return { gradeText, salaryText };

  const full = rankArr.join(' ');
  const zhMatch = full.match(/^(.*?[一二三四五六七八九]品)/);
  const enMatch = full.match(/^(.*?(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth)\s+grade)/i);
  const match = zhMatch ?? enMatch;
  if (match) {
    gradeText  = match[1].trim();
    salaryText = full.slice(match[1].length).replace(/^[,，\s]+/, '').trim();
  } else {
    salaryText = full;
  }
  salaryText = salaryText
    .replace(/,?\s*\(Shu\)/g, '<br>(Shu)')
    .replace(/,?\s*\(Wu\)/g, '<br>(Wu)')
    .replace(/,?\s*（蜀）/g, '<br>（蜀）')
    .replace(/,?\s*（吳）/g, '<br>（吳）')
    .replace(/,?\s*（吴）/g, '<br>（吴）')
    .replace(/\bshi\b,/g, '<em>shi,</em>')
    .replace(/\bshi\b(?!,)/g, '<em>shi</em>');
  return { gradeText, salaryText };
}
