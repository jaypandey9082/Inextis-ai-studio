// Upcoming Indian trade shows. Dates marked confirmed were checked against
// public announcements on 29 Oct 2026; the rest are TBC.
export type Expo = {
  id: string;
  name: string;
  short: string;
  sector: string;
  city: string;
  venue: string;
  dates: string;
  month: string;
  day: string;
  confirmed: boolean;
  daysAway: number | null;
  targets: number;
  researched: number;
  source: string;
};

export const expos: Expo[] = [
  {
    id: "iew-2027",
    name: "India Energy Week 2027",
    short: "IEW 2027",
    sector: "Oil, gas & energy",
    city: "Kolkata",
    venue: "Biswa Bangla Convention Centre",
    dates: "28–31 Jan 2027",
    month: "JAN",
    day: "28",
    confirmed: true,
    daysAway: 91,
    targets: 42,
    researched: 6,
    source: "https://psuwatch.com/newsupdates/india-energy-week-2027-to-be-held-in-kolkata-events-first-in-west-bengal",
  },
  {
    id: "bmge-2027",
    name: "Bharat Mobility Global Expo 2027",
    short: "Bharat Mobility 2027",
    sector: "Automotive & EV",
    city: "New Delhi",
    venue: "Bharat Mandapam & Yashobhoomi",
    dates: "4–9 Feb 2027",
    month: "FEB",
    day: "04",
    confirmed: true,
    daysAway: 98,
    targets: 35,
    researched: 5,
    source: "https://www.autocarindia.com/industry/next-bharat-mobility-global-expo-dates-confirmed-436000",
  },
  {
    id: "elecrama-2027",
    name: "ELECRAMA 2027",
    short: "ELECRAMA 2027",
    sector: "Power & electrical",
    city: "Greater Noida",
    venue: "India Expo Mart",
    dates: "Dates TBC",
    month: "TBC",
    day: "—",
    confirmed: false,
    daysAway: null,
    targets: 18,
    researched: 0,
    source: "https://www.ntradeshows.com/energy/india/",
  },
  {
    id: "rei-2027",
    name: "Renewable Energy India Expo 2027",
    short: "REI Expo 2027",
    sector: "Solar, wind & storage",
    city: "Greater Noida",
    venue: "India Expo Mart",
    dates: "Oct 2027 (TBC)",
    month: "OCT",
    day: "—",
    confirmed: false,
    daysAway: null,
    targets: 27,
    researched: 0,
    source: "https://www.gophotonics.com/events/details/1159-renewable-energy-india-expo-2026",
  },
];
