// Sample numbers for the parts of the dashboard not driven by deals (see src/lib/business.ts).

export const aiImpact = {
  months: [
    { m: "Jun", design: 6, bd: 4, screens: 0 },
    { m: "Jul", design: 14, bd: 10, screens: 3 },
    { m: "Aug", design: 22, bd: 18, screens: 8 },
    { m: "Sep", design: 31, bd: 27, screens: 14 },
    { m: "Oct", design: 48, bd: 52, screens: 26 },
  ],
  hoursSaved: 126,
  aiCost: "₹18,400",
  valueOfTime: "₹2.5 L",
};

export const designStats = [
  { label: "Booths in design", value: "5" },
  { label: "Brief → first 3D", value: "2 h", note: "was 3–4 days" },
];

export const screenStats = {
  event: "NOVA Energy · IEW 2027",
  screens: 11,
  lastChange: "Sponsor swapped, all 11 screens regenerated in under a second",
};
