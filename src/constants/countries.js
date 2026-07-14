/* ── COUNTRIES · the whole planet, searchable ──────────────────────
   Flag emoji is derived from the ISO-3166 code (regional-indicator
   letters), so we only store [code, name] pairs — compact and complete. */

export const flagOf = (code) =>
  (code || '')
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));

const RAW = [
  ['EG', 'Egypt'], ['SA', 'Saudi Arabia'], ['AE', 'United Arab Emirates'], ['QA', 'Qatar'],
  ['KW', 'Kuwait'], ['BH', 'Bahrain'], ['OM', 'Oman'], ['JO', 'Jordan'], ['LB', 'Lebanon'],
  ['PS', 'Palestine'], ['IQ', 'Iraq'], ['SY', 'Syria'], ['YE', 'Yemen'], ['MA', 'Morocco'],
  ['DZ', 'Algeria'], ['TN', 'Tunisia'], ['LY', 'Libya'], ['SD', 'Sudan'], ['MR', 'Mauritania'],
  ['TR', 'Türkiye'], ['IR', 'Iran'], ['PK', 'Pakistan'], ['AF', 'Afghanistan'],
  ['IN', 'India'], ['BD', 'Bangladesh'], ['LK', 'Sri Lanka'], ['NP', 'Nepal'],
  ['CN', 'China'], ['JP', 'Japan'], ['KR', 'South Korea'], ['ID', 'Indonesia'],
  ['MY', 'Malaysia'], ['SG', 'Singapore'], ['TH', 'Thailand'], ['VN', 'Vietnam'],
  ['PH', 'Philippines'], ['KZ', 'Kazakhstan'], ['UZ', 'Uzbekistan'], ['AZ', 'Azerbaijan'],
  ['GB', 'United Kingdom'], ['IE', 'Ireland'], ['FR', 'France'], ['ES', 'Spain'],
  ['PT', 'Portugal'], ['IT', 'Italy'], ['DE', 'Germany'], ['NL', 'Netherlands'],
  ['BE', 'Belgium'], ['CH', 'Switzerland'], ['AT', 'Austria'], ['SE', 'Sweden'],
  ['NO', 'Norway'], ['DK', 'Denmark'], ['FI', 'Finland'], ['IS', 'Iceland'],
  ['PL', 'Poland'], ['CZ', 'Czechia'], ['SK', 'Slovakia'], ['HU', 'Hungary'],
  ['RO', 'Romania'], ['BG', 'Bulgaria'], ['GR', 'Greece'], ['HR', 'Croatia'],
  ['RS', 'Serbia'], ['BA', 'Bosnia & Herzegovina'], ['AL', 'Albania'], ['UA', 'Ukraine'],
  ['RU', 'Russia'], ['BY', 'Belarus'], ['GE', 'Georgia'], ['AM', 'Armenia'],
  ['US', 'United States'], ['CA', 'Canada'], ['MX', 'Mexico'], ['BR', 'Brazil'],
  ['AR', 'Argentina'], ['CL', 'Chile'], ['CO', 'Colombia'], ['PE', 'Peru'],
  ['VE', 'Venezuela'], ['EC', 'Ecuador'], ['UY', 'Uruguay'], ['BO', 'Bolivia'],
  ['NG', 'Nigeria'], ['GH', 'Ghana'], ['KE', 'Kenya'], ['ET', 'Ethiopia'],
  ['TZ', 'Tanzania'], ['UG', 'Uganda'], ['ZA', 'South Africa'], ['SN', 'Senegal'],
  ['CI', "Côte d'Ivoire"], ['CM', 'Cameroon'], ['AU', 'Australia'], ['NZ', 'New Zealand'],
];

export const COUNTRY_LIST = RAW.map(([code, name]) => ({ code, name, flag: flagOf(code) }));

export function findCountry(name) {
  if (!name) return null;
  const n = String(name).toLowerCase();
  return COUNTRY_LIST.find((c) => c.name.toLowerCase() === n) || null;
}
