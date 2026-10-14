export interface CountryInfo {
  code: string;
  name: string;
  phoneCode: string;
  states: { name: string; cities: string[] }[];
}

export const COUNTRIES: CountryInfo[] = [
  {
    code: 'US',
    name: 'United States',
    phoneCode: '+1',
    states: [
      { name: 'California', cities: ['San Francisco', 'Los Angeles', 'San Diego', 'San Jose'] },
      { name: 'New York', cities: ['New York City', 'Buffalo', 'Rochester', 'Albany'] },
      { name: 'Texas', cities: ['Austin', 'Dallas', 'Houston', 'San Antonio'] },
      { name: 'Washington', cities: ['Seattle', 'Spokane', 'Tacoma', 'Bellevue'] },
      { name: 'Florida', cities: ['Miami', 'Orlando', 'Tampa', 'Jacksonville'] },
      { name: 'Illinois', cities: ['Chicago', 'Naperville', 'Aurora', 'Rockford'] },
      { name: 'Massachusetts', cities: ['Boston', 'Cambridge', 'Worcester', 'Springfield'] },
    ],
  },
  {
    code: 'IN',
    name: 'India',
    phoneCode: '+91',
    states: [
      { name: 'Karnataka', cities: ['Bengaluru', 'Mysuru', 'Mangaluru', 'Hubli'] },
      { name: 'Maharashtra', cities: ['Mumbai', 'Pune', 'Nagpur', 'Nashik'] },
      { name: 'Delhi NCR', cities: ['New Delhi', 'Noida', 'Gurugram', 'Faridabad'] },
      { name: 'Tamil Nadu', cities: ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli'] },
      { name: 'Telangana', cities: ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar'] },
      { name: 'Gujarat', cities: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot'] },
      { name: 'West Bengal', cities: ['Kolkata', 'Howrah', 'Durgapur', 'Siliguri'] },
    ],
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    phoneCode: '+44',
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
    states: [
      { name: 'Ontario', cities: ['Toronto', 'Ottawa', 'Mississauga', 'Hamilton'] },
      { name: 'British Columbia', cities: ['Vancouver', 'Victoria', 'Burnaby', 'Surrey'] },
      { name: 'Quebec', cities: ['Montreal', 'Quebec City', 'Laval', 'Gatineau'] },
      { name: 'Alberta', cities: ['Calgary', 'Edmonton', 'Red Deer'] },
    ],
  },
  {
    code: 'DE',
    name: 'Germany',
    phoneCode: '+49',
    states: [
      { name: 'Berlin', cities: ['Berlin'] },
      { name: 'Bavaria', cities: ['Munich', 'Nuremberg', 'Augsburg'] },
      { name: 'North Rhine-Westphalia', cities: ['Cologne', 'Düsseldorf', 'Dortmund', 'Essen'] },
      { name: 'Hesse', cities: ['Frankfurt', 'Wiesbaden', 'Kassel'] },
    ],
  },
  {
    code: 'AU',
    name: 'Australia',
    phoneCode: '+61',
    states: [
      { name: 'New South Wales', cities: ['Sydney', 'Newcastle', 'Wollongong'] },
      { name: 'Victoria', cities: ['Melbourne', 'Geelong', 'Ballarat'] },
      { name: 'Queensland', cities: ['Brisbane', 'Gold Coast', 'Cairns'] },
      { name: 'Western Australia', cities: ['Perth', 'Fremantle'] },
    ],
  },
  {
    code: 'SG',
    name: 'Singapore',
    phoneCode: '+65',
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
    states: [
      { name: 'Dubai', cities: ['Dubai City', 'Deira', 'Jumeirah', 'Downtown'] },
      { name: 'Abu Dhabi', cities: ['Abu Dhabi City', 'Al Ain'] },
      { name: 'Sharjah', cities: ['Sharjah City'] },
    ],
  },
];

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
export const GENDERS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];
export const MARITAL_STATUSES = ['Single', 'Married', 'Divorced', 'Widowed'];
