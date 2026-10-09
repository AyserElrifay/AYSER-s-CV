/* EU 27, plus the three EEA countries and Switzerland — where free
   movement and most of the first-30-days rules apply. Its own small
   file so a screen can ask "is this in Europe?" without downloading
   the whole first-30-days service. */
export const EU_ISO = {
  Austria: 'AT', Belgium: 'BE', Bulgaria: 'BG', Croatia: 'HR', Cyprus: 'CY',
  Czechia: 'CZ', 'Czech Republic': 'CZ', Denmark: 'DK', Estonia: 'EE', Finland: 'FI',
  France: 'FR', Germany: 'DE', Greece: 'GR', Hungary: 'HU', Ireland: 'IE',
  Italy: 'IT', Latvia: 'LV', Lithuania: 'LT', Luxembourg: 'LU', Malta: 'MT',
  Netherlands: 'NL', Poland: 'PL', Portugal: 'PT', Romania: 'RO', Slovakia: 'SK',
  Slovenia: 'SI', Spain: 'ES', Sweden: 'SE',
  Iceland: 'IS', Liechtenstein: 'LI', Norway: 'NO', Switzerland: 'CH',
};

export const isEuCode = (code) => Object.values(EU_ISO).indexOf(String(code || '').toUpperCase()) >= 0;
