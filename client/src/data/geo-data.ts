/**
 * Static geo dataset for the profile form: countries, currencies, phone codes,
 * emoji flags, and states/cities.
 *
 * This is bundled intentionally rather than fetched from a live geo API: a
 * profile form must work offline and must not depend on an external contract
 * that can change or disappear. Flags are derived from the ISO 3166-1 alpha-2
 * code as regional-indicator emoji (zero network, no asset pipeline).
 */

export interface CurrencyInfo {
  /** ISO 4217 alphabetic code, e.g. "INR". */
  code: string;
  /** Currency symbol, e.g. "₹". */
  symbol: string;
  /** Human-readable currency name, e.g. "Indian Rupee". */
  name: string;
}

export interface StateInfo {
  name: string;
  cities: string[];
}

export interface CountryInfo {
  /** ISO 3166-1 alpha-2 country code, e.g. "IN". */
  code: string;
  name: string;
  phoneCode: string;
  currency: CurrencyInfo;
  states: StateInfo[];
}

/** Regional-indicator emoji flag from a 2-letter ISO code, e.g. "IN" -> 🇮🇳. */
export const getFlagEmoji = (code: string): string => {
  if (!code || code.length !== 2) return '';
  return code
    .toUpperCase()
    .replace(/[A-Z]/g, (ch) => String.fromCodePoint(0x1f1e6 + ch.charCodeAt(0) - 65));
};

export const COUNTRIES: CountryInfo[] = [
  {
    code: 'IN',
    name: 'India',
    phoneCode: '+91',
    currency: { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
    states: [
      { name: 'Andhra Pradesh', cities: ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Tirupati'] },
      { name: 'Assam', cities: ['Guwahati', 'Silchar', 'Dibrugarh'] },
      { name: 'Bihar', cities: ['Patna', 'Gaya', 'Bhagalpur'] },
      { name: 'Delhi NCR', cities: ['New Delhi', 'Noida', 'Gurugram', 'Faridabad'] },
      { name: 'Goa', cities: ['Panaji', 'Vasco da Gama', 'Margao'] },
      { name: 'Gujarat', cities: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot'] },
      { name: 'Haryana', cities: ['Faridabad', 'Gurugram', 'Panipat'] },
      { name: 'Karnataka', cities: ['Bengaluru', 'Mysuru', 'Mangaluru', 'Hubli'] },
      { name: 'Kerala', cities: ['Thiruvananthapuram', 'Kochi', 'Kozhikode'] },
      { name: 'Madhya Pradesh', cities: ['Bhopal', 'Indore', 'Gwalior', 'Jabalpur'] },
      { name: 'Maharashtra', cities: ['Mumbai', 'Pune', 'Nagpur', 'Nashik'] },
      { name: 'Odisha', cities: ['Bhubaneswar', 'Cuttack', 'Rourkela'] },
      { name: 'Punjab', cities: ['Ludhiana', 'Amritsar', 'Jalandhar'] },
      { name: 'Rajasthan', cities: ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota'] },
      { name: 'Tamil Nadu', cities: ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli'] },
      { name: 'Telangana', cities: ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar'] },
      { name: 'Uttar Pradesh', cities: ['Lucknow', 'Kanpur', 'Varanasi', 'Agra'] },
      { name: 'West Bengal', cities: ['Kolkata', 'Howrah', 'Durgapur', 'Siliguri'] },
    ],
  },
  {
    code: 'US',
    name: 'United States',
    phoneCode: '+1',
    currency: { code: 'USD', symbol: '$', name: 'United States Dollar' },
    states: [
      { name: 'Arizona', cities: ['Phoenix', 'Tucson', 'Mesa'] },
      { name: 'California', cities: ['San Francisco', 'Los Angeles', 'San Diego', 'San Jose'] },
      { name: 'Colorado', cities: ['Denver', 'Boulder', 'Aurora'] },
      { name: 'Florida', cities: ['Miami', 'Orlando', 'Tampa', 'Jacksonville'] },
      { name: 'Georgia', cities: ['Atlanta', 'Savannah', 'Augusta'] },
      { name: 'Illinois', cities: ['Chicago', 'Naperville', 'Aurora', 'Rockford'] },
      { name: 'Massachusetts', cities: ['Boston', 'Cambridge', 'Worcester', 'Springfield'] },
      { name: 'New York', cities: ['New York City', 'Buffalo', 'Rochester', 'Albany'] },
      { name: 'Texas', cities: ['Austin', 'Dallas', 'Houston', 'San Antonio'] },
      { name: 'Washington', cities: ['Seattle', 'Spokane', 'Tacoma', 'Bellevue'] },
    ],
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    phoneCode: '+44',
    currency: { code: 'GBP', symbol: '£', name: 'British Pound Sterling' },
    states: [
      { name: 'England', cities: ['London', 'Manchester', 'Birmingham', 'Leeds', 'Bristol'] },
      { name: 'Scotland', cities: ['Edinburgh', 'Glasgow', 'Aberdeen', 'Dundee'] },
      { name: 'Wales', cities: ['Cardiff', 'Swansea', 'Newport'] },
      { name: 'Northern Ireland', cities: ['Belfast', 'Derry', 'Lisburn'] },
    ],
  },
  {
    code: 'CA',
    name: 'Canada',
    phoneCode: '+1',
    currency: { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar' },
    states: [
      { name: 'Alberta', cities: ['Calgary', 'Edmonton', 'Red Deer'] },
      { name: 'British Columbia', cities: ['Vancouver', 'Victoria', 'Burnaby', 'Surrey'] },
      { name: 'Ontario', cities: ['Toronto', 'Ottawa', 'Mississauga', 'Hamilton'] },
      { name: 'Quebec', cities: ['Montreal', 'Quebec City', 'Laval', 'Gatineau'] },
    ],
  },
  {
    code: 'AU',
    name: 'Australia',
    phoneCode: '+61',
    currency: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
    states: [
      { name: 'New South Wales', cities: ['Sydney', 'Newcastle', 'Wollongong'] },
      { name: 'Queensland', cities: ['Brisbane', 'Gold Coast', 'Cairns'] },
      { name: 'Victoria', cities: ['Melbourne', 'Geelong', 'Ballarat'] },
      { name: 'Western Australia', cities: ['Perth', 'Fremantle'] },
    ],
  },
  {
    code: 'DE',
    name: 'Germany',
    phoneCode: '+49',
    currency: { code: 'EUR', symbol: '€', name: 'Euro' },
    states: [
      { name: 'Bavaria', cities: ['Munich', 'Nuremberg', 'Augsburg'] },
      { name: 'Berlin', cities: ['Berlin'] },
      { name: 'Hesse', cities: ['Frankfurt', 'Wiesbaden', 'Kassel'] },
      { name: 'North Rhine-Westphalia', cities: ['Cologne', 'Düsseldorf', 'Dortmund', 'Essen'] },
    ],
  },
  {
    code: 'FR',
    name: 'France',
    phoneCode: '+33',
    currency: { code: 'EUR', symbol: '€', name: 'Euro' },
    states: [
      { name: 'Auvergne-Rhône-Alpes', cities: ['Lyon', 'Grenoble', 'Saint-Étienne'] },
      { name: 'Île-de-France', cities: ['Paris', 'Boulogne-Billancourt', 'Versailles'] },
      { name: 'Occitanie', cities: ['Toulouse', 'Montpellier', 'Nîmes'] },
      { name: "Provence-Alpes-Côte d'Azur", cities: ['Marseille', 'Nice', 'Toulon'] },
    ],
  },
  {
    code: 'SG',
    name: 'Singapore',
    phoneCode: '+65',
    currency: { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
    states: [
      { name: 'Central Region', cities: ['Singapore', 'Marina Bay', 'Orchard'] },
      { name: 'East Region', cities: ['Tampines', 'Bedok', 'Changi'] },
      { name: 'West Region', cities: ['Jurong', 'Clementi'] },
    ],
  },
  {
    code: 'AE',
    name: 'United Arab Emirates',
    phoneCode: '+971',
    currency: { code: 'AED', symbol: 'AED', name: 'UAE Dirham' },
    states: [
      { name: 'Abu Dhabi', cities: ['Abu Dhabi City', 'Al Ain'] },
      { name: 'Dubai', cities: ['Dubai City', 'Deira', 'Jumeirah', 'Downtown'] },
      { name: 'Sharjah', cities: ['Sharjah City'] },
    ],
  },
  {
    code: 'ZA',
    name: 'South Africa',
    phoneCode: '+27',
    currency: { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
    states: [
      { name: 'Gauteng', cities: ['Johannesburg', 'Pretoria', 'Soweto'] },
      { name: 'KwaZulu-Natal', cities: ['Durban', 'Pietermaritzburg'] },
      { name: 'Western Cape', cities: ['Cape Town', 'Stellenbosch'] },
    ],
  },
  {
    code: 'NZ',
    name: 'New Zealand',
    phoneCode: '+64',
    currency: { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar' },
    states: [
      { name: 'Auckland', cities: ['Auckland', 'Manukau'] },
      { name: 'Canterbury', cities: ['Christchurch', 'Timaru'] },
      { name: 'Wellington', cities: ['Wellington', 'Lower Hutt'] },
    ],
  },
  {
    code: 'JP',
    name: 'Japan',
    phoneCode: '+81',
    currency: { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
    states: [
      { name: 'Hokkaido', cities: ['Sapporo', 'Asahikawa'] },
      { name: 'Kansai', cities: ['Osaka', 'Kyoto', 'Kobe'] },
      { name: 'Kanto', cities: ['Tokyo', 'Yokohama', 'Chiba', 'Saitama'] },
    ],
  },
  {
    code: 'CN',
    name: 'China',
    phoneCode: '+86',
    currency: { code: 'CNY', symbol: '¥', name: 'Chinese Yuan Renminbi' },
    states: [
      { name: 'Beijing', cities: ['Beijing'] },
      { name: 'Guangdong', cities: ['Guangzhou', 'Shenzhen', 'Dongguan'] },
      { name: 'Shanghai', cities: ['Shanghai'] },
      { name: 'Zhejiang', cities: ['Hangzhou', 'Ningbo'] },
    ],
  },
  {
    code: 'BR',
    name: 'Brazil',
    phoneCode: '+55',
    currency: { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
    states: [
      { name: 'Minas Gerais', cities: ['Belo Horizonte', 'Uberlândia'] },
      { name: 'Rio de Janeiro', cities: ['Rio de Janeiro', 'Niterói'] },
      { name: 'São Paulo', cities: ['São Paulo', 'Campinas', 'Santos'] },
    ],
  },
  {
    code: 'IE',
    name: 'Ireland',
    phoneCode: '+353',
    currency: { code: 'EUR', symbol: '€', name: 'Euro' },
    states: [
      { name: 'Connacht', cities: ['Galway', 'Sligo'] },
      { name: 'Leinster', cities: ['Dublin', 'Kilkenny'] },
      { name: 'Munster', cities: ['Cork', 'Limerick'] },
    ],
  },
  {
    code: 'NL',
    name: 'Netherlands',
    phoneCode: '+31',
    currency: { code: 'EUR', symbol: '€', name: 'Euro' },
    states: [
      { name: 'North Holland', cities: ['Amsterdam', 'Haarlem'] },
      { name: 'South Holland', cities: ['Rotterdam', 'The Hague', 'Leiden'] },
      { name: 'Utrecht', cities: ['Utrecht', 'Amersfoort'] },
    ],
  },
  {
    code: 'ES',
    name: 'Spain',
    phoneCode: '+34',
    currency: { code: 'EUR', symbol: '€', name: 'Euro' },
    states: [
      { name: 'Andalusia', cities: ['Seville', 'Málaga', 'Granada'] },
      { name: 'Catalonia', cities: ['Barcelona', 'Girona'] },
      { name: 'Madrid', cities: ['Madrid'] },
    ],
  },
  {
    code: 'IT',
    name: 'Italy',
    phoneCode: '+39',
    currency: { code: 'EUR', symbol: '€', name: 'Euro' },
    states: [
      { name: 'Campania', cities: ['Naples', 'Salerno'] },
      { name: 'Lazio', cities: ['Rome'] },
      { name: 'Lombardy', cities: ['Milan', 'Bergamo', 'Brescia'] },
    ],
  },
  {
    code: 'SE',
    name: 'Sweden',
    phoneCode: '+46',
    currency: { code: 'SEK', symbol: 'kr', name: 'Swedish Krona' },
    states: [
      { name: 'Skåne County', cities: ['Malmö', 'Lund'] },
      { name: 'Stockholm County', cities: ['Stockholm'] },
      { name: 'Västra Götaland County', cities: ['Gothenburg'] },
    ],
  },
  {
    code: 'CH',
    name: 'Switzerland',
    phoneCode: '+41',
    currency: { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
    states: [
      { name: 'Bern', cities: ['Bern', 'Thun'] },
      { name: 'Geneva', cities: ['Geneva'] },
      { name: 'Zurich', cities: ['Zurich', 'Winterthur'] },
    ],
  },
  {
    code: 'MX',
    name: 'Mexico',
    phoneCode: '+52',
    currency: { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso' },
    states: [
      { name: 'Jalisco', cities: ['Guadalajara', 'Zapopan'] },
      { name: 'Mexico City', cities: ['Mexico City'] },
      { name: 'Nuevo León', cities: ['Monterrey', 'San Nicolás'] },
    ],
  },
  {
    code: 'KR',
    name: 'South Korea',
    phoneCode: '+82',
    currency: { code: 'KRW', symbol: '₩', name: 'South Korean Won' },
    states: [
      { name: 'Busan', cities: ['Busan'] },
      { name: 'Incheon', cities: ['Incheon'] },
      { name: 'Seoul', cities: ['Seoul'] },
    ],
  },
  {
    code: 'ID',
    name: 'Indonesia',
    phoneCode: '+62',
    currency: { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah' },
    states: [
      { name: 'East Java', cities: ['Surabaya', 'Malang'] },
      { name: 'Jakarta', cities: ['Jakarta'] },
      { name: 'West Java', cities: ['Bandung', 'Bekasi'] },
    ],
  },
  {
    code: 'MY',
    name: 'Malaysia',
    phoneCode: '+60',
    currency: { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit' },
    states: [
      { name: 'Kuala Lumpur', cities: ['Kuala Lumpur'] },
      { name: 'Penang', cities: ['George Town'] },
      { name: 'Selangor', cities: ['Shah Alam', 'Petaling Jaya'] },
    ],
  },
  {
    code: 'TH',
    name: 'Thailand',
    phoneCode: '+66',
    currency: { code: 'THB', symbol: '฿', name: 'Thai Baht' },
    states: [
      { name: 'Bangkok', cities: ['Bangkok'] },
      { name: 'Chiang Mai', cities: ['Chiang Mai'] },
      { name: 'Phuket', cities: ['Phuket'] },
    ],
  },
  {
    code: 'PH',
    name: 'Philippines',
    phoneCode: '+63',
    currency: { code: 'PHP', symbol: '₱', name: 'Philippine Peso' },
    states: [
      { name: 'Cebu', cities: ['Cebu City', 'Mandaue'] },
      { name: 'Davao', cities: ['Davao City'] },
      { name: 'Metro Manila', cities: ['Manila', 'Quezon City', 'Makati'] },
    ],
  },
  {
    code: 'VN',
    name: 'Vietnam',
    phoneCode: '+84',
    currency: { code: 'VND', symbol: '₫', name: 'Vietnamese Dong' },
    states: [
      { name: 'Da Nang', cities: ['Da Nang'] },
      { name: 'Hanoi', cities: ['Hanoi'] },
      { name: 'Ho Chi Minh City', cities: ['Ho Chi Minh City'] },
    ],
  },
  {
    code: 'TR',
    name: 'Turkey',
    phoneCode: '+90',
    currency: { code: 'TRY', symbol: '₺', name: 'Turkish Lira' },
    states: [
      { name: 'Ankara', cities: ['Ankara'] },
      { name: 'Istanbul', cities: ['Istanbul'] },
      { name: 'Izmir', cities: ['Izmir'] },
    ],
  },
  {
    code: 'SA',
    name: 'Saudi Arabia',
    phoneCode: '+966',
    currency: { code: 'SAR', symbol: 'SAR', name: 'Saudi Riyal' },
    states: [
      { name: 'Eastern Province', cities: ['Dammam', 'Dhahran'] },
      { name: 'Makkah', cities: ['Mecca', 'Jeddah'] },
      { name: 'Riyadh', cities: ['Riyadh'] },
    ],
  },
  {
    code: 'EG',
    name: 'Egypt',
    phoneCode: '+20',
    currency: { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound' },
    states: [
      { name: 'Alexandria', cities: ['Alexandria'] },
      { name: 'Cairo', cities: ['Cairo'] },
      { name: 'Giza', cities: ['Giza'] },
    ],
  },
  {
    code: 'NG',
    name: 'Nigeria',
    phoneCode: '+234',
    currency: { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
    states: [
      { name: 'Abuja', cities: ['Abuja'] },
      { name: 'Lagos', cities: ['Lagos', 'Ikeja'] },
      { name: 'Rivers', cities: ['Port Harcourt'] },
    ],
  },
  {
    code: 'KE',
    name: 'Kenya',
    phoneCode: '+254',
    currency: { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling' },
    states: [
      { name: 'Kisumu', cities: ['Kisumu'] },
      { name: 'Mombasa', cities: ['Mombasa'] },
      { name: 'Nairobi', cities: ['Nairobi'] },
    ],
  },
  {
    code: 'AR',
    name: 'Argentina',
    phoneCode: '+54',
    currency: { code: 'ARS', symbol: 'ARS', name: 'Argentine Peso' },
    states: [
      { name: 'Buenos Aires', cities: ['Buenos Aires', 'La Plata'] },
      { name: 'Córdoba', cities: ['Córdoba'] },
      { name: 'Santa Fe', cities: ['Rosario', 'Santa Fe'] },
    ],
  },
  {
    code: 'CL',
    name: 'Chile',
    phoneCode: '+56',
    currency: { code: 'CLP', symbol: 'CLP', name: 'Chilean Peso' },
    states: [
      { name: 'Santiago', cities: ['Santiago'] },
      { name: 'Valparaíso', cities: ['Valparaíso', 'Viña del Mar'] },
    ],
  },
  {
    code: 'CO',
    name: 'Colombia',
    phoneCode: '+57',
    currency: { code: 'COP', symbol: 'COP', name: 'Colombian Peso' },
    states: [
      { name: 'Antioquia', cities: ['Medellín'] },
      { name: 'Bogotá', cities: ['Bogotá'] },
      { name: 'Valle del Cauca', cities: ['Cali'] },
    ],
  },
  {
    code: 'RU',
    name: 'Russia',
    phoneCode: '+7',
    currency: { code: 'RUB', symbol: '₽', name: 'Russian Ruble' },
    states: [
      { name: 'Moscow', cities: ['Moscow'] },
      { name: 'Novosibirsk', cities: ['Novosibirsk'] },
      { name: 'Saint Petersburg', cities: ['Saint Petersburg'] },
    ],
  },
  {
    code: 'PL',
    name: 'Poland',
    phoneCode: '+48',
    currency: { code: 'PLN', symbol: 'zł', name: 'Polish Zloty' },
    states: [
      { name: 'Lesser Poland', cities: ['Kraków'] },
      { name: 'Masovian', cities: ['Warsaw'] },
      { name: 'Silesian', cities: ['Katowice'] },
    ],
  },
  {
    code: 'PT',
    name: 'Portugal',
    phoneCode: '+351',
    currency: { code: 'EUR', symbol: '€', name: 'Euro' },
    states: [
      { name: 'Braga', cities: ['Braga'] },
      { name: 'Lisbon', cities: ['Lisbon'] },
      { name: 'Porto', cities: ['Porto'] },
    ],
  },
  {
    code: 'AT',
    name: 'Austria',
    phoneCode: '+43',
    currency: { code: 'EUR', symbol: '€', name: 'Euro' },
    states: [
      { name: 'Styria', cities: ['Graz'] },
      { name: 'Upper Austria', cities: ['Linz'] },
      { name: 'Vienna', cities: ['Vienna'] },
    ],
  },
  {
    code: 'BE',
    name: 'Belgium',
    phoneCode: '+32',
    currency: { code: 'EUR', symbol: '€', name: 'Euro' },
    states: [
      { name: 'Brussels', cities: ['Brussels'] },
      { name: 'Flanders', cities: ['Antwerp', 'Ghent'] },
      { name: 'Wallonia', cities: ['Liège', 'Charleroi'] },
    ],
  },
  {
    code: 'DK',
    name: 'Denmark',
    phoneCode: '+45',
    currency: { code: 'DKK', symbol: 'kr', name: 'Danish Krone' },
    states: [
      { name: 'Capital Region', cities: ['Copenhagen'] },
      { name: 'Central Denmark', cities: ['Aarhus'] },
      { name: 'Southern Denmark', cities: ['Odense'] },
    ],
  },
  {
    code: 'NO',
    name: 'Norway',
    phoneCode: '+47',
    currency: { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone' },
    states: [
      { name: 'Oslo', cities: ['Oslo'] },
      { name: 'Trøndelag', cities: ['Trondheim'] },
      { name: 'Vestland', cities: ['Bergen'] },
    ],
  },
  {
    code: 'FI',
    name: 'Finland',
    phoneCode: '+358',
    currency: { code: 'EUR', symbol: '€', name: 'Euro' },
    states: [
      { name: 'Pirkanmaa', cities: ['Tampere'] },
      { name: 'Southwest Finland', cities: ['Turku'] },
      { name: 'Uusimaa', cities: ['Helsinki', 'Espoo'] },
    ],
  },
  {
    code: 'IL',
    name: 'Israel',
    phoneCode: '+972',
    currency: { code: 'ILS', symbol: '₪', name: 'Israeli New Shekel' },
    states: [
      { name: 'Haifa', cities: ['Haifa'] },
      { name: 'Jerusalem', cities: ['Jerusalem'] },
      { name: 'Tel Aviv', cities: ['Tel Aviv'] },
    ],
  },
  {
    code: 'PK',
    name: 'Pakistan',
    phoneCode: '+92',
    currency: { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee' },
    states: [
      { name: 'Islamabad', cities: ['Islamabad'] },
      { name: 'Punjab', cities: ['Lahore', 'Faisalabad'] },
      { name: 'Sindh', cities: ['Karachi', 'Hyderabad'] },
    ],
  },
  {
    code: 'BD',
    name: 'Bangladesh',
    phoneCode: '+880',
    currency: { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka' },
    states: [
      { name: 'Chittagong', cities: ['Chittagong'] },
      { name: 'Dhaka', cities: ['Dhaka'] },
      { name: 'Khulna', cities: ['Khulna'] },
    ],
  },
  {
    code: 'LK',
    name: 'Sri Lanka',
    phoneCode: '+94',
    currency: { code: 'LKR', symbol: 'Rs', name: 'Sri Lankan Rupee' },
    states: [
      { name: 'Central', cities: ['Kandy'] },
      { name: 'Southern', cities: ['Galle'] },
      { name: 'Western', cities: ['Colombo', 'Gampaha'] },
    ],
  },
  {
    code: 'NP',
    name: 'Nepal',
    phoneCode: '+977',
    currency: { code: 'NPR', symbol: 'Rs', name: 'Nepalese Rupee' },
    states: [
      { name: 'Bagmati', cities: ['Kathmandu', 'Lalitpur'] },
      { name: 'Gandaki', cities: ['Pokhara'] },
    ],
  },
  {
    code: 'QA',
    name: 'Qatar',
    phoneCode: '+974',
    currency: { code: 'QAR', symbol: 'QAR', name: 'Qatari Riyal' },
    states: [
      { name: 'Al Rayyan', cities: ['Al Rayyan'] },
      { name: 'Doha', cities: ['Doha'] },
    ],
  },
  {
    code: 'KW',
    name: 'Kuwait',
    phoneCode: '+965',
    currency: { code: 'KWD', symbol: 'KWD', name: 'Kuwaiti Dinar' },
    states: [
      { name: 'Al Asimah', cities: ['Kuwait City'] },
      { name: 'Hawalli', cities: ['Hawalli'] },
    ],
  },
  {
    code: 'BH',
    name: 'Bahrain',
    phoneCode: '+973',
    currency: { code: 'BHD', symbol: 'BHD', name: 'Bahraini Dinar' },
    states: [
      { name: 'Capital', cities: ['Manama'] },
      { name: 'Muharraq', cities: ['Muharraq'] },
    ],
  },
  {
    code: 'OM',
    name: 'Oman',
    phoneCode: '+968',
    currency: { code: 'OMR', symbol: 'OMR', name: 'Omani Rial' },
    states: [
      { name: 'Dhofar', cities: ['Salalah'] },
      { name: 'Muscat', cities: ['Muscat'] },
    ],
  },
  {
    code: 'HK',
    name: 'Hong Kong',
    phoneCode: '+852',
    currency: { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar' },
    states: [
      { name: 'Hong Kong Island', cities: ['Central', 'Wan Chai'] },
      { name: 'Kowloon', cities: ['Mong Kok', 'Tsim Sha Tsui'] },
    ],
  },
  {
    code: 'TW',
    name: 'Taiwan',
    phoneCode: '+886',
    currency: { code: 'TWD', symbol: 'NT$', name: 'New Taiwan Dollar' },
    states: [
      { name: 'Kaohsiung', cities: ['Kaohsiung'] },
      { name: 'New Taipei', cities: ['New Taipei'] },
      { name: 'Taipei', cities: ['Taipei'] },
    ],
  },
  {
    code: 'CZ',
    name: 'Czechia',
    phoneCode: '+420',
    currency: { code: 'CZK', symbol: 'Kč', name: 'Czech Koruna' },
    states: [
      { name: 'Moravian-Silesian', cities: ['Ostrava'] },
      { name: 'Prague', cities: ['Prague'] },
      { name: 'South Moravian', cities: ['Brno'] },
    ],
  },
  {
    code: 'HU',
    name: 'Hungary',
    phoneCode: '+36',
    currency: { code: 'HUF', symbol: 'Ft', name: 'Hungarian Forint' },
    states: [
      { name: 'Budapest', cities: ['Budapest'] },
      { name: 'Pest', cities: ['Érd'] },
    ],
  },
  {
    code: 'RO',
    name: 'Romania',
    phoneCode: '+40',
    currency: { code: 'RON', symbol: 'lei', name: 'Romanian Leu' },
    states: [
      { name: 'Bucharest', cities: ['Bucharest'] },
      { name: 'Cluj', cities: ['Cluj-Napoca'] },
      { name: 'Timis', cities: ['Timisoara'] },
    ],
  },
  {
    code: 'GR',
    name: 'Greece',
    phoneCode: '+30',
    currency: { code: 'EUR', symbol: '€', name: 'Euro' },
    states: [
      { name: 'Attica', cities: ['Athens', 'Piraeus'] },
      { name: 'Central Macedonia', cities: ['Thessaloniki'] },
    ],
  },
  {
    code: 'MA',
    name: 'Morocco',
    phoneCode: '+212',
    currency: { code: 'MAD', symbol: 'MAD', name: 'Moroccan Dirham' },
    states: [
      { name: 'Casablanca-Settat', cities: ['Casablanca'] },
      { name: 'Rabat-Salé-Kénitra', cities: ['Rabat', 'Salé'] },
    ],
  },
  {
    code: 'GH',
    name: 'Ghana',
    phoneCode: '+233',
    currency: { code: 'GHS', symbol: '₵', name: 'Ghanaian Cedi' },
    states: [
      { name: 'Ashanti', cities: ['Kumasi'] },
      { name: 'Greater Accra', cities: ['Accra'] },
    ],
  },
  {
    code: 'ET',
    name: 'Ethiopia',
    phoneCode: '+251',
    currency: { code: 'ETB', symbol: 'Br', name: 'Ethiopian Birr' },
    states: [
      { name: 'Addis Ababa', cities: ['Addis Ababa'] },
      { name: 'Oromia', cities: ['Adama'] },
    ],
  },
  {
    code: 'TZ',
    name: 'Tanzania',
    phoneCode: '+255',
    currency: { code: 'TZS', symbol: 'TSh', name: 'Tanzanian Shilling' },
    states: [
      { name: 'Arusha', cities: ['Arusha'] },
      { name: 'Dar es Salaam', cities: ['Dar es Salaam'] },
    ],
  },
  {
    code: 'UG',
    name: 'Uganda',
    phoneCode: '+256',
    currency: { code: 'UGX', symbol: 'USh', name: 'Ugandan Shilling' },
    states: [
      { name: 'Kampala', cities: ['Kampala'] },
      { name: 'Wakiso', cities: ['Wakiso'] },
    ],
  },
  {
    code: 'PE',
    name: 'Peru',
    phoneCode: '+51',
    currency: { code: 'PEN', symbol: 'S/', name: 'Peruvian Sol' },
    states: [
      { name: 'Arequipa', cities: ['Arequipa'] },
      { name: 'Lima', cities: ['Lima'] },
    ],
  },
  {
    code: 'UY',
    name: 'Uruguay',
    phoneCode: '+598',
    currency: { code: 'UYU', symbol: '$U', name: 'Uruguayan Peso' },
    states: [
      { name: 'Montevideo', cities: ['Montevideo'] },
    ],
  },
  {
    code: 'CR',
    name: 'Costa Rica',
    phoneCode: '+506',
    currency: { code: 'CRC', symbol: '₡', name: 'Costa Rican Colón' },
    states: [
      { name: 'Alajuela', cities: ['Alajuela'] },
      { name: 'San José', cities: ['San José'] },
    ],
  },
  {
    code: 'PA',
    name: 'Panama',
    phoneCode: '+507',
    currency: { code: 'PAB', symbol: 'B/.', name: 'Panamanian Balboa' },
    states: [
      { name: 'Panamá', cities: ['Panama City'] },
    ],
  },
];

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
export const GENDERS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];
export const MARITAL_STATUSES = ['Single', 'Married', 'Divorced', 'Widowed'];

/** Look up a country by name; returns undefined when the value is unset/unknown. */
export const getCountryByName = (name: string | undefined | null): CountryInfo | undefined =>
  COUNTRIES.find((c) => c.name === name);

/** Currency for a country name, or undefined when unset/unknown. */
export const getCurrencyByCountryName = (name: string | undefined | null): CurrencyInfo | undefined =>
  getCountryByName(name)?.currency;

/** Distinct currencies keyed by ISO 4217 code, for reuse and reference. */
export const CURRENCIES: Record<string, CurrencyInfo> = COUNTRIES.reduce<Record<string, CurrencyInfo>>(
  (acc, c) => {
    acc[c.currency.code] = c.currency;
    return acc;
  },
  {}
);
