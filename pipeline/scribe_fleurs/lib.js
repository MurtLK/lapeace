// Shared by run.js and score.js.
export const LANG_CODES = {
  en_us: 'eng', ur_pk: 'urd', ar_eg: 'ara', cmn_hans_cn: 'zho', pa_in: 'pan', pl_pl: 'pol', yue_hant_hk: 'yue',
  fil_ph: 'fil', es_419: 'spa', ta_in: 'tam', vi_vn: 'vie', hi_in: 'hin', pt_br: 'por', gu_in: 'guj',
};
export function parseCsv(text) {
  const rows = []; let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { field += '"'; i++; } else if (c === '"') q = false; else field += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(field); field = ''; if (row.length > 1 || row[0] !== '') rows.push(row); row = []; }
    else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const [h, ...b] = rows; return b.map((r) => Object.fromEntries(h.map((k, i) => [k, r[i] ?? ''])));
}
