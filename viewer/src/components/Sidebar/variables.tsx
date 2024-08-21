interface defaultYearList {
  option: string;
  value: string;
}

export const defaultYearList = Array.from(
  { length: 40 },
  (_, i) => i + 1980
).map((v: any) => ({
  option: v,
  value: v,
}));

interface monthList {
  option: string;
  value: string;
}

export const monthList = Array.from({ length: 12 }, (_, i) => i + 1).map(
  (v: any) => ({
    option: v,
    value: v,
  })
);

export const timeSeriesCollections = ['fragmentation-rmf'];

interface chelsaVariableList {
  option: string;
  value: string;
}

export const chelsaVariableList = [
  {
    option: 'Mean daily air temperature - tas',
    value: 'tas',
  },
  {
    option: 'Mean daily minimum air temperature - tasmin',
    value: 'tasmin',
  },
  {
    option: 'Mean daily maximum 2m air temperature - tasmax',
    value: 'tasmax',
  },
  {
    option: 'Cloud area fraction - clt',
    value: 'clt',
  },
  {
    option: 'Climate moisture index - cmi',
    value: 'cmi',
  },
  {
    option: 'Near-surface relative humidity - hurs',
    value: 'hurs',
  },
  {
    option: 'Potential evapotranspiration - pet_penman',
    value: 'pet_penman',
  },
  {
    option: 'Precipitation amount - pr',
    value: 'pr',
  },
  {
    option: 'Near-surface wind speed - sfcWind',
    value: 'sfcWind',
  },
  {
    option: 'Vapor pressure deficit',
    value: 'vpd',
  },
];

export const mammalsScenariosList = [
  { option: 'SSP2-RCP4.5', value: '1' },
  { option: 'SSP3-RCP6.0', value: '2' },
  { option: 'SSP4-RCP6.0', value: '3' },
  { option: 'SSP5-RCP8.5', value: '4' },
];

export const mammalsYearsList = [
  { option: '2015', value: '2015' },
  { option: '2020', value: '2020' },
  { option: '2025', value: '2025' },
  { option: '2030', value: '2030' },
  { option: '2035', value: '2035' },
  { option: '2040', value: '2040' },
  { option: '2045', value: '2045' },
  { option: '2050', value: '2050' },
  { option: '2055', value: '2055' },
];
