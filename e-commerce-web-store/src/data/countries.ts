// ISO 3166-1 alpha-2 country codes
// Source: https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2

export interface Country {
  code: string
  name: string
  region: string
}

export const countries: Country[] = [
  // Europe
  { code: 'AL', name: 'Albania', region: 'Europe' },
  { code: 'AD', name: 'Andorra', region: 'Europe' },
  { code: 'AT', name: 'Austria', region: 'Europe' },
  { code: 'BY', name: 'Belarus', region: 'Europe' },
  { code: 'BE', name: 'Belgium', region: 'Europe' },
  { code: 'BA', name: 'Bosnia and Herzegovina', region: 'Europe' },
  { code: 'BG', name: 'Bulgaria', region: 'Europe' },
  { code: 'HR', name: 'Croatia', region: 'Europe' },
  { code: 'CY', name: 'Cyprus', region: 'Europe' },
  { code: 'CZ', name: 'Czech Republic', region: 'Europe' },
  { code: 'DK', name: 'Denmark', region: 'Europe' },
  { code: 'EE', name: 'Estonia', region: 'Europe' },
  { code: 'FI', name: 'Finland', region: 'Europe' },
  { code: 'FR', name: 'France', region: 'Europe' },
  { code: 'DE', name: 'Germany', region: 'Europe' },
  { code: 'GR', name: 'Greece', region: 'Europe' },
  { code: 'HU', name: 'Hungary', region: 'Europe' },
  { code: 'IS', name: 'Iceland', region: 'Europe' },
  { code: 'IE', name: 'Ireland', region: 'Europe' },
  { code: 'IT', name: 'Italy', region: 'Europe' },
  { code: 'XK', name: 'Kosovo', region: 'Europe' },
  { code: 'LV', name: 'Latvia', region: 'Europe' },
  { code: 'LI', name: 'Liechtenstein', region: 'Europe' },
  { code: 'LT', name: 'Lithuania', region: 'Europe' },
  { code: 'LU', name: 'Luxembourg', region: 'Europe' },
  { code: 'MT', name: 'Malta', region: 'Europe' },
  { code: 'MD', name: 'Moldova', region: 'Europe' },
  { code: 'MC', name: 'Monaco', region: 'Europe' },
  { code: 'ME', name: 'Montenegro', region: 'Europe' },
  { code: 'NL', name: 'Netherlands', region: 'Europe' },
  { code: 'MK', name: 'North Macedonia', region: 'Europe' },
  { code: 'NO', name: 'Norway', region: 'Europe' },
  { code: 'PL', name: 'Poland', region: 'Europe' },
  { code: 'PT', name: 'Portugal', region: 'Europe' },
  { code: 'RO', name: 'Romania', region: 'Europe' },
  { code: 'RU', name: 'Russia', region: 'Europe' },
  { code: 'SM', name: 'San Marino', region: 'Europe' },
  { code: 'RS', name: 'Serbia', region: 'Europe' },
  { code: 'SK', name: 'Slovakia', region: 'Europe' },
  { code: 'SI', name: 'Slovenia', region: 'Europe' },
  { code: 'ES', name: 'Spain', region: 'Europe' },
  { code: 'SE', name: 'Sweden', region: 'Europe' },
  { code: 'CH', name: 'Switzerland', region: 'Europe' },
  { code: 'UA', name: 'Ukraine', region: 'Europe' },
  { code: 'GB', name: 'United Kingdom', region: 'Europe' },
  { code: 'VA', name: 'Vatican City', region: 'Europe' },

  // North America
  { code: 'AG', name: 'Antigua and Barbuda', region: 'North America' },
  { code: 'BS', name: 'Bahamas', region: 'North America' },
  { code: 'BB', name: 'Barbados', region: 'North America' },
  { code: 'BZ', name: 'Belize', region: 'North America' },
  { code: 'CA', name: 'Canada', region: 'North America' },
  { code: 'CR', name: 'Costa Rica', region: 'North America' },
  { code: 'CU', name: 'Cuba', region: 'North America' },
  { code: 'DM', name: 'Dominica', region: 'North America' },
  { code: 'DO', name: 'Dominican Republic', region: 'North America' },
  { code: 'SV', name: 'El Salvador', region: 'North America' },
  { code: 'GD', name: 'Grenada', region: 'North America' },
  { code: 'GT', name: 'Guatemala', region: 'North America' },
  { code: 'HT', name: 'Haiti', region: 'North America' },
  { code: 'HN', name: 'Honduras', region: 'North America' },
  { code: 'JM', name: 'Jamaica', region: 'North America' },
  { code: 'MX', name: 'Mexico', region: 'North America' },
  { code: 'NI', name: 'Nicaragua', region: 'North America' },
  { code: 'PA', name: 'Panama', region: 'North America' },
  { code: 'KN', name: 'Saint Kitts and Nevis', region: 'North America' },
  { code: 'LC', name: 'Saint Lucia', region: 'North America' },
  {
    code: 'VC',
    name: 'Saint Vincent and the Grenadines',
    region: 'North America',
  },
  { code: 'TT', name: 'Trinidad and Tobago', region: 'North America' },
  { code: 'US', name: 'United States', region: 'North America' },

  // South America
  { code: 'AR', name: 'Argentina', region: 'South America' },
  { code: 'BO', name: 'Bolivia', region: 'South America' },
  { code: 'BR', name: 'Brazil', region: 'South America' },
  { code: 'CL', name: 'Chile', region: 'South America' },
  { code: 'CO', name: 'Colombia', region: 'South America' },
  { code: 'EC', name: 'Ecuador', region: 'South America' },
  { code: 'GY', name: 'Guyana', region: 'South America' },
  { code: 'PY', name: 'Paraguay', region: 'South America' },
  { code: 'PE', name: 'Peru', region: 'South America' },
  { code: 'SR', name: 'Suriname', region: 'South America' },
  { code: 'UY', name: 'Uruguay', region: 'South America' },
  { code: 'VE', name: 'Venezuela', region: 'South America' },

  // Asia
  { code: 'AF', name: 'Afghanistan', region: 'Asia' },
  { code: 'AM', name: 'Armenia', region: 'Asia' },
  { code: 'AZ', name: 'Azerbaijan', region: 'Asia' },
  { code: 'BH', name: 'Bahrain', region: 'Asia' },
  { code: 'BD', name: 'Bangladesh', region: 'Asia' },
  { code: 'BT', name: 'Bhutan', region: 'Asia' },
  { code: 'BN', name: 'Brunei', region: 'Asia' },
  { code: 'KH', name: 'Cambodia', region: 'Asia' },
  { code: 'CN', name: 'China', region: 'Asia' },
  { code: 'GE', name: 'Georgia', region: 'Asia' },
  { code: 'HK', name: 'Hong Kong', region: 'Asia' },
  { code: 'IN', name: 'India', region: 'Asia' },
  { code: 'ID', name: 'Indonesia', region: 'Asia' },
  { code: 'IR', name: 'Iran', region: 'Asia' },
  { code: 'IQ', name: 'Iraq', region: 'Asia' },
  { code: 'IL', name: 'Israel', region: 'Asia' },
  { code: 'JP', name: 'Japan', region: 'Asia' },
  { code: 'JO', name: 'Jordan', region: 'Asia' },
  { code: 'KZ', name: 'Kazakhstan', region: 'Asia' },
  { code: 'KW', name: 'Kuwait', region: 'Asia' },
  { code: 'KG', name: 'Kyrgyzstan', region: 'Asia' },
  { code: 'LA', name: 'Laos', region: 'Asia' },
  { code: 'LB', name: 'Lebanon', region: 'Asia' },
  { code: 'MO', name: 'Macau', region: 'Asia' },
  { code: 'MY', name: 'Malaysia', region: 'Asia' },
  { code: 'MV', name: 'Maldives', region: 'Asia' },
  { code: 'MN', name: 'Mongolia', region: 'Asia' },
  { code: 'MM', name: 'Myanmar', region: 'Asia' },
  { code: 'NP', name: 'Nepal', region: 'Asia' },
  { code: 'KP', name: 'North Korea', region: 'Asia' },
  { code: 'OM', name: 'Oman', region: 'Asia' },
  { code: 'PK', name: 'Pakistan', region: 'Asia' },
  { code: 'PS', name: 'Palestine', region: 'Asia' },
  { code: 'PH', name: 'Philippines', region: 'Asia' },
  { code: 'QA', name: 'Qatar', region: 'Asia' },
  { code: 'SA', name: 'Saudi Arabia', region: 'Asia' },
  { code: 'SG', name: 'Singapore', region: 'Asia' },
  { code: 'KR', name: 'South Korea', region: 'Asia' },
  { code: 'LK', name: 'Sri Lanka', region: 'Asia' },
  { code: 'SY', name: 'Syria', region: 'Asia' },
  { code: 'TW', name: 'Taiwan', region: 'Asia' },
  { code: 'TJ', name: 'Tajikistan', region: 'Asia' },
  { code: 'TH', name: 'Thailand', region: 'Asia' },
  { code: 'TL', name: 'Timor-Leste', region: 'Asia' },
  { code: 'TR', name: 'Turkey', region: 'Asia' },
  { code: 'TM', name: 'Turkmenistan', region: 'Asia' },
  { code: 'AE', name: 'United Arab Emirates', region: 'Asia' },
  { code: 'UZ', name: 'Uzbekistan', region: 'Asia' },
  { code: 'VN', name: 'Vietnam', region: 'Asia' },
  { code: 'YE', name: 'Yemen', region: 'Asia' },

  // Africa
  { code: 'DZ', name: 'Algeria', region: 'Africa' },
  { code: 'AO', name: 'Angola', region: 'Africa' },
  { code: 'BJ', name: 'Benin', region: 'Africa' },
  { code: 'BW', name: 'Botswana', region: 'Africa' },
  { code: 'BF', name: 'Burkina Faso', region: 'Africa' },
  { code: 'BI', name: 'Burundi', region: 'Africa' },
  { code: 'CV', name: 'Cabo Verde', region: 'Africa' },
  { code: 'CM', name: 'Cameroon', region: 'Africa' },
  { code: 'CF', name: 'Central African Republic', region: 'Africa' },
  { code: 'TD', name: 'Chad', region: 'Africa' },
  { code: 'KM', name: 'Comoros', region: 'Africa' },
  { code: 'CG', name: 'Congo', region: 'Africa' },
  { code: 'CD', name: 'Congo (DRC)', region: 'Africa' },
  { code: 'CI', name: "Côte d'Ivoire", region: 'Africa' },
  { code: 'DJ', name: 'Djibouti', region: 'Africa' },
  { code: 'EG', name: 'Egypt', region: 'Africa' },
  { code: 'GQ', name: 'Equatorial Guinea', region: 'Africa' },
  { code: 'ER', name: 'Eritrea', region: 'Africa' },
  { code: 'SZ', name: 'Eswatini', region: 'Africa' },
  { code: 'ET', name: 'Ethiopia', region: 'Africa' },
  { code: 'GA', name: 'Gabon', region: 'Africa' },
  { code: 'GM', name: 'Gambia', region: 'Africa' },
  { code: 'GH', name: 'Ghana', region: 'Africa' },
  { code: 'GN', name: 'Guinea', region: 'Africa' },
  { code: 'GW', name: 'Guinea-Bissau', region: 'Africa' },
  { code: 'KE', name: 'Kenya', region: 'Africa' },
  { code: 'LS', name: 'Lesotho', region: 'Africa' },
  { code: 'LR', name: 'Liberia', region: 'Africa' },
  { code: 'LY', name: 'Libya', region: 'Africa' },
  { code: 'MG', name: 'Madagascar', region: 'Africa' },
  { code: 'MW', name: 'Malawi', region: 'Africa' },
  { code: 'ML', name: 'Mali', region: 'Africa' },
  { code: 'MR', name: 'Mauritania', region: 'Africa' },
  { code: 'MU', name: 'Mauritius', region: 'Africa' },
  { code: 'MA', name: 'Morocco', region: 'Africa' },
  { code: 'MZ', name: 'Mozambique', region: 'Africa' },
  { code: 'NA', name: 'Namibia', region: 'Africa' },
  { code: 'NE', name: 'Niger', region: 'Africa' },
  { code: 'NG', name: 'Nigeria', region: 'Africa' },
  { code: 'RW', name: 'Rwanda', region: 'Africa' },
  { code: 'ST', name: 'São Tomé and Príncipe', region: 'Africa' },
  { code: 'SN', name: 'Senegal', region: 'Africa' },
  { code: 'SC', name: 'Seychelles', region: 'Africa' },
  { code: 'SL', name: 'Sierra Leone', region: 'Africa' },
  { code: 'SO', name: 'Somalia', region: 'Africa' },
  { code: 'ZA', name: 'South Africa', region: 'Africa' },
  { code: 'SS', name: 'South Sudan', region: 'Africa' },
  { code: 'SD', name: 'Sudan', region: 'Africa' },
  { code: 'TZ', name: 'Tanzania', region: 'Africa' },
  { code: 'TG', name: 'Togo', region: 'Africa' },
  { code: 'TN', name: 'Tunisia', region: 'Africa' },
  { code: 'UG', name: 'Uganda', region: 'Africa' },
  { code: 'ZM', name: 'Zambia', region: 'Africa' },
  { code: 'ZW', name: 'Zimbabwe', region: 'Africa' },

  // Oceania
  { code: 'AU', name: 'Australia', region: 'Oceania' },
  { code: 'FJ', name: 'Fiji', region: 'Oceania' },
  { code: 'KI', name: 'Kiribati', region: 'Oceania' },
  { code: 'MH', name: 'Marshall Islands', region: 'Oceania' },
  { code: 'FM', name: 'Micronesia', region: 'Oceania' },
  { code: 'NR', name: 'Nauru', region: 'Oceania' },
  { code: 'NZ', name: 'New Zealand', region: 'Oceania' },
  { code: 'PW', name: 'Palau', region: 'Oceania' },
  { code: 'PG', name: 'Papua New Guinea', region: 'Oceania' },
  { code: 'WS', name: 'Samoa', region: 'Oceania' },
  { code: 'SB', name: 'Solomon Islands', region: 'Oceania' },
  { code: 'TO', name: 'Tonga', region: 'Oceania' },
  { code: 'TV', name: 'Tuvalu', region: 'Oceania' },
  { code: 'VU', name: 'Vanuatu', region: 'Oceania' },
]

// Sorted alphabetically by name for dropdown usage
export const countriesSortedByName = [...countries].sort((a, b) =>
  a.name.localeCompare(b.name),
)

// Group countries by region
export const countriesByRegion = countries.reduce((acc, country) => {
  if (!acc[country.region]) {
    acc[country.region] = []
  }
  acc[country.region].push(country)
  return acc
}, {} as Record<string, Country[]>)

// Get country by code
export const getCountryByCode = (code: string): Country | undefined => {
  return countries.find((c) => c.code === code)
}

// Get country name by code
export const getCountryName = (code: string): string => {
  const country = getCountryByCode(code)
  return country?.name ?? code
}

// Stripe supported countries for payments
export const stripePaymentCountries = countries.filter((c) =>
  [
    // Major Stripe supported regions
    'US',
    'CA',
    'GB',
    'AU',
    'NZ',
    'IE',
    'FR',
    'DE',
    'AT',
    'BE',
    'NL',
    'LU',
    'IT',
    'ES',
    'PT',
    'DK',
    'FI',
    'NO',
    'SE',
    'CH',
    'PL',
    'CZ',
    'SK',
    'HU',
    'RO',
    'BG',
    'HR',
    'SI',
    'EE',
    'LV',
    'LT',
    'MT',
    'CY',
    'GR',
    'JP',
    'SG',
    'HK',
    'MY',
    'TH',
    'ID',
    'PH',
    'VN',
    'IN',
    'AE',
    'SA',
    'IL',
    'BR',
    'MX',
    'AR',
    'CL',
    'CO',
    'PE',
    'ZA',
    'NG',
    'EG',
    'KE',
    'GH',
    'TW',
    'KR',
  ].includes(c.code),
)

// Alphabetically-sorted list for the delivery-estimate widget's "Update
// location" picker (src/components/product/DeliveryEstimate.tsx) -- reuses
// the same dataset above rather than maintaining a second country list.
export const COUNTRIES = countriesSortedByName

// Same lookup as getCountryName, but returns null for a null input instead
// of the country code -- matches the delivery-estimate widget's "no country
// resolved yet" state.
export function countryNameFor(code: string | null): string | null {
  if (!code) return null
  return getCountryName(code.toUpperCase())
}

export default countries
