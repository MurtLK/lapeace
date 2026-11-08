// Build data/census.json: where Mississauga residents who speak a language most often at home live.
//   node scripts/build-census.js --census <01_people_census folder> --crosswalk <language_crosswalk.csv>
// Measure: 2021 Census "language spoken most often at home" (home_<language> columns), counts rounded
// to 5 by Statistics Canada. Wards use the corrected ward table (Ward 10 rebuilt from neighbourhoods).
// Cross-checks the citywide total three ways and records the results in `checks`.
import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseCsv } from '../src/csv.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const { values: args } = parseArgs({
  options: {
    census: { type: 'string', default: process.env.CENSUS_DIR },
    crosswalk: { type: 'string', default: process.env.CROSSWALK_FILE },
    languages: { type: 'string', default: 'Mandarin Chinese,Punjabi' },
    top: { type: 'string', default: '5' },
    out: { type: 'string', default: path.join(here, '..', 'data', 'census.json') },
  },
});
if (!args.census || !args.crosswalk) {
  console.error('Usage: node scripts/build-census.js --census <01_people_census> --crosswalk <language_crosswalk.csv>');
  process.exit(1);
}
const read = async (p) => parseCsv(await readFile(p, 'utf8'));
const dir = path.resolve(args.census);
const crosswalk = await read(path.resolve(args.crosswalk));
const coverage = await read(path.join(dir, 'derived', 'language_coverage.csv'));
const long = await read(path.join(dir, 'derived', 'geo_language_long.csv'));
const wards = await read(path.join(dir, 'derived', 'ward_language_profile_2021_corrected.csv'));
const hoods = (await read(path.join(dir, 'neighbourhood_language_profile_2021.csv'))).filter((r) => Number(r.population_language_base) > 0);
const N = Number(args.top);
const num = (v) => Number(v);

const languages = [];
const problems = [];
for (const name of args.languages.split(',').map((s) => s.trim())) {
  const cw = crosswalk.find((c) => c.language === name);
  if (!cw?.census_home_column) { problems.push(`${name}: no census column in crosswalk`); continue; }
  const col = cw.census_home_column;
  const cov = coverage.find((c) => c.census_home_column === col);
  const longW = long.filter((r) => r.geo_level === 'ward' && r.census_home_column === col);
  const longN = long.filter((r) => r.geo_level === 'neighbourhood' && r.census_home_column === col);
  const sum = (rows, f) => rows.reduce((s, r) => s + num(f(r)), 0);

  const totals = {
    language_coverage_city_home_speakers: num(cov?.city_home_speakers),
    sum_of_neighbourhood_table: sum(hoods, (r) => r[col]),
    sum_of_corrected_ward_table: sum(wards, (r) => r[col]),
    sum_of_long_neighbourhood_rows: sum(longN, (r) => r.home_speakers),
    sum_of_long_ward_rows: sum(longW, (r) => r.home_speakers),
  };
  const values = Object.values(totals);
  const agree = values.every((v) => v === values[0]);
  if (!agree) problems.push(`${name}: totals disagree ${JSON.stringify(totals)}`);

  // Cross-check each ward row in the long file against the corrected ward table.
  const wardMismatch = longW.filter((r) => num(wards.find((w) => w.ward === r.geo)?.[col]) !== num(r.home_speakers)).map((r) => r.geo);
  if (wardMismatch.length) problems.push(`${name}: long vs corrected ward table differ for wards ${wardMismatch.join(', ')}`);

  const row = (r) => ({
    geo: r.geo,
    residents: num(r.home_speakers),
    pct_of_geo: num(r.pct_of_geo),
    share_of_city_speakers: num(r.share_of_city_speakers),
  });
  const byCount = (a, b) => b.home_speakers - a.home_speakers;
  languages.push({
    language: name,
    census_column: col,
    city_total: totals.language_coverage_city_home_speakers,
    totals_check: { ...totals, all_agree: agree },
    wards: longW.map((r) => ({ ...r, home_speakers: num(r.home_speakers) })).sort(byCount).map(row),
    top_neighbourhoods: longN.map((r) => ({ ...r, home_speakers: num(r.home_speakers) })).sort(byCount).slice(0, N).map(row),
  });
}

const out = {
  source: '2021 Census of Population, City of Mississauga ward and neighbourhood language profiles (supplied track pack)',
  measure: 'Residents who speak this language most often at home',
  notes: [
    'Counts are rounded to 5 by Statistics Canada.',
    'Wards: corrected ward table (Ward 10 rebuilt from neighbourhoods; about +/-50 rounding noise). Neighbourhoods: 39 populated areas; 17 employment/airport areas with zero population excluded.',
    'pct_of_geo = residents / population counted for home language in that area x 100. share_of_city_speakers = % of the city\'s speakers of that language living in that area.',
    'Speaking a language at home does not mean a person cannot speak English. These counts are not an estimate of how many residents voice AI misunderstands.',
  ],
  generated_at: new Date().toISOString(),
  languages,
  problems,
};
await writeFile(path.resolve(args.out), JSON.stringify(out, null, 2) + '\n');
for (const l of languages) console.log(`${l.language}: city ${l.city_total} | all totals agree: ${l.totals_check.all_agree} | top ward ${l.wards[0].geo} (${l.wards[0].residents}) | top neighbourhood ${l.top_neighbourhoods[0].geo} (${l.top_neighbourhoods[0].residents})`);
console.log(`Problems: ${problems.length ? problems.join('; ') : 'none'}`);
if (problems.length) process.exit(2);
