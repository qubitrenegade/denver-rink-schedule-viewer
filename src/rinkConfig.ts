import { RinkInfo } from './types';

// RINKS_CONFIG defines the rink tabs and groupings for the app UI
export const RINKS_CONFIG: RinkInfo[] = [
  {
    id: 'ice-ranch',
    name: 'The Ice Ranch (Littleton - South Park)',
    sourceUrl: 'https://www.theiceranch.com/page/show/1652320-calendar',
  },
  {
    id: 'big-bear',
    name: 'Big Bear Ice Arena (Lowry)',
    sourceUrl: 'https://bigbearicearena.ezfacility.com/Sessions',
  },
  {
    id: 'du-ritchie',
    name: 'DU Ritchie Center (University of Denver)',
    sourceUrl: 'https://ritchiecenter.du.edu/sports/ice-programs',
  },
  {
    id: 'foothills-edge',
    name: 'Foothills Edge Ice Arena (Littleton - Ken Caryl)',
    sourceUrl: 'https://www.ifoothills.org/cal-edge/',
  },
  {
    id: 'ssprd-family-sports',
    name: 'Family Sports Center (Englewood)',
    sourceUrl: 'https://ssprd.finnlyconnect.com/schedule/249',
    memberRinkIds: ['fsc-avalanche', 'fsc-fixit'],
  },
  {
    id: 'ssprd-sports-complex',
    name: 'South Suburban Sports Complex (Highlands Ranch)',
    sourceUrl: 'https://ssprd.finnlyconnect.com/schedule/250',
    memberRinkIds: ['sssc-rink1', 'sssc-rink2', 'sssc-rink3'],
  },
];

// List of all individual rinks for filtering when "All Rinks" is selected
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
