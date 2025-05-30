import { RinkInfo, EventCategory, RawIceEventData } from './types';

// RINKS_CONFIG now defines the tabs. 
// Individual rinks like 'fsc-avalanche' are still used as rinkId in event data.
export const RINKS_CONFIG: RinkInfo[] = [
  {
    id: 'ice-ranch',
    name: 'The Ice Ranch (Littleton)',
    sourceUrl: 'https://www.theiceranch.com/page/show/1652320-calendar',
  },
  {
    id: 'big-bear',
    name: 'Big Bear Ice Arena (Denver)',
    sourceUrl: 'https://bigbearicearena.ezfacility.com/Sessions',
  },
  {
    id: 'du-ritchie',
    name: 'DU Ritchie Center (Denver)',
    sourceUrl: 'https://ritchiecenter.du.edu/sports/ice-programs',
  },
  {
    id: 'foothills-edge',
    name: 'Foothills Edge Ice Arena (Littleton)',
    sourceUrl: 'https://www.ifoothills.org/cal-edge/',
  },
  {
    id: 'ssprd-family-sports', // Group ID for the tab
    name: 'Family Sports Center (Centennial)',
    sourceUrl: 'https://ssprd.finnlyconnect.com/schedule/249', // Representative URL for the group
    memberRinkIds: ['fsc-avalanche', 'fsc-fixit'],
  },
  {
    id: 'ssprd-sports-complex', // Group ID for the tab
    name: 'South Suburban Sports Complex (Littleton)',
    sourceUrl: 'https://ssprd.finnlyconnect.com/schedule/250', // Representative URL for the group
    memberRinkIds: ['sssc-rink1', 'sssc-rink2', 'sssc-rink3'],
  },
];

// This flattened list is for the "Filter by Rink" section when "All Rinks" is selected
export const ALL_INDIVIDUAL_RINKS_FOR_FILTERING: RinkInfo[] = [
  { id: 'ice-ranch', name: 'The Ice Ranch (Littleton)', sourceUrl: 'https://www.theiceranch.com/page/show/1652320-calendar' },
  { id: 'big-bear', name: 'Big Bear Ice Arena (Denver)', sourceUrl: 'https://bigbearicearena.ezfacility.com/Sessions' },
  { id: 'du-ritchie', name: 'DU Ritchie Center (Denver)', sourceUrl: 'https://ritchiecenter.du.edu/sports/ice-programs' },
  { id: 'foothills-edge', name: 'Foothills Edge Ice Arena (Littleton)', sourceUrl: 'https://www.ifoothills.org/cal-edge/' },
  { id: 'fsc-avalanche', name: 'FSC Avalanche Rink', sourceUrl: 'https://ssprd.finnlyconnect.com/schedule/249' },
  { id: 'fsc-fixit', name: 'FSC Fix-it 24/7 Rink', sourceUrl: 'https://ssprd.finnlyconnect.com/schedule/249' },
  { id: 'sssc-rink1', name: 'SSSC Rink 1', sourceUrl: 'https://ssprd.finnlyconnect.com/schedule/250' },
  { id: 'sssc-rink2', name: 'SSSC Rink 2', sourceUrl: 'https://ssprd.finnlyconnect.com/schedule/250' },
  { id: 'sssc-rink3', name: 'SSSC Rink 3', sourceUrl: 'https://ssprd.finnlyconnect.com/schedule/250' },
];


// Helper to create dates for mock data
const createDate = (dayOffset: number, hour: number, minute: number = 0): Date => {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date;
};

// MOCK_EVENTS_DATA keys remain as specific rink IDs
export const MOCK_EVENTS_DATA: Record<string, RawIceEventData[]> = {
  'ice-ranch': [
    { id: 'ir1', rinkId: 'ice-ranch', title: 'Public Skate Session', startTime: createDate(1, 14), endTime: createDate(1, 15, 30), category: 'Public Skate', description: 'Open to all ages and skill levels.' },
    { id: 'ir2', rinkId: 'ice-ranch', title: 'Adult Stick & Puck', startTime: createDate(1, 19), endTime: createDate(1, 20, 30), category: 'Stick & Puck', description: '18+ only. Full gear recommended.' },
    { id: 'ir3', rinkId: 'ice-ranch', title: 'Youth Hockey Practice', startTime: createDate(2, 17), endTime: createDate(2, 18), category: 'Hockey Practice' },
    { id: 'ir4', rinkId: 'ice-ranch', title: 'Learn to Skate - Level 1', startTime: createDate(3, 9), endTime: createDate(3, 9, 45), category: 'Learn to Skate', isFeatured: true },
    { id: 'ir5', rinkId: 'ice-ranch', title: 'Figure Skating Freestyle', startTime: createDate(4, 6), endTime: createDate(4, 8), category: 'Figure Skating' },
  ],
  'big-bear': [
    { id: 'bb1', rinkId: 'big-bear', title: 'Morning Drop-In Hockey', startTime: createDate(1, 6), endTime: createDate(1, 7, 30), category: 'Drop-In Hockey', description: 'Competitive drop-in for adults.' },
    { id: 'bb2', rinkId: 'big-bear', title: 'Public Skate - Evening', startTime: createDate(1, 20), endTime: createDate(1, 22), category: 'Public Skate', isFeatured: true },
    { id: 'bb3', rinkId: 'big-bear', title: 'Beginner Hockey Clinic', startTime: createDate(2, 18), endTime: createDate(2, 19), category: 'Learn to Skate' },
    { id: 'bb4', rinkId: 'big-bear', title: 'Adult League Game - Div C', startTime: createDate(3, 21), endTime: createDate(3, 22, 15), category: 'Hockey League' },
  ],
  'du-ritchie': [
    { id: 'du1', rinkId: 'du-ritchie', title: 'DU Pioneers Practice (Closed)', startTime: createDate(1, 10), endTime: createDate(1, 12), category: 'Hockey Practice', description: 'University team practice.' },
    { id: 'du2', rinkId: 'du-ritchie', title: 'Community Public Skate', startTime: createDate(2, 13), endTime: createDate(2, 14, 30), category: 'Public Skate', isFeatured: true },
    { id: 'du3', rinkId: 'du-ritchie', title: 'Freestyle Ice Session', startTime: createDate(3, 7), endTime: createDate(3, 8, 45), category: 'Figure Skating' },
    { id: 'du4', rinkId: 'du-ritchie', title: 'Youth Hockey Development', startTime: createDate(4, 16), endTime: createDate(4, 17), category: 'Hockey Practice' },
  ],
  'foothills-edge': [
    { id: 'fe1', rinkId: 'foothills-edge', title: 'Stick & Puck - All Ages', startTime: createDate(1, 12), endTime: createDate(1, 13, 30), category: 'Stick & Puck' },
    { id: 'fe2', rinkId: 'foothills-edge', title: 'Public Skate - Weekend', startTime: createDate(2, 14), endTime: createDate(2, 16), category: 'Public Skate', isFeatured: true },
    { id: 'fe3', rinkId: 'foothills-edge', title: 'Adult Intro to Hockey', startTime: createDate(3, 19, 30), endTime: createDate(3, 20, 30), category: 'Learn to Skate' },
    { id: 'fe4', rinkId: 'foothills-edge', title: 'Rat Hockey (18+)', startTime: createDate(4, 21), endTime: createDate(4, 22, 30), category: 'Drop-In Hockey' },
  ],
  'fsc-avalanche': [
    { id: 'fsc-a1', rinkId: 'fsc-avalanche', title: 'Public Skate (FSC)', startTime: createDate(1, 13), endTime: createDate(1, 14, 45), category: 'Public Skate', description: 'Great for families!' },
  ],
  'fsc-fixit': [
    { id: 'fsc-f1', rinkId: 'fsc-fixit', title: 'Learn to Skate (FSC)', startTime: createDate(2, 10), endTime: createDate(2, 11), category: 'Learn to Skate' },
  ],
  'sssc-rink1': [
    { id: 'sssc1-1', rinkId: 'sssc-rink1', title: 'Drop-In Hockey (SSSC R1)', startTime: createDate(1, 12), endTime: createDate(1, 13, 15), category: 'Drop-In Hockey' },
  ],
  'sssc-rink2': [
     { id: 'sssc2-1', rinkId: 'sssc-rink2', title: 'Youth Hockey Practice (SSSC R2)', startTime: createDate(3, 16), endTime: createDate(3, 17), category: 'Hockey Practice' },
  ],
  'sssc-rink3': [
     { id: 'sssc3-1', rinkId: 'sssc-rink3', title: 'Public Skate (SSSC R3)', startTime: createDate(4, 15), endTime: createDate(4, 16, 30), category: 'Public Skate' },
  ]
};
