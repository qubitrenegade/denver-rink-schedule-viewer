// workers/shared/rink-config.ts - Shared configuration for both frontend and workers

export interface RinkConfiguration {
  id: string;
  facilityName: string;
  displayName: string;
  sourceUrl: string;
  rinkName: string;
  memberRinkIds?: string[];
}

// Master configuration - single source of truth for all rink information
export const RINK_CONFIGURATIONS: Record<string, RinkConfiguration> = {
  'ice-ranch': {
    id: 'ice-ranch',
    facilityName: 'Ice Ranch',
    displayName: 'The Ice Ranch (Littleton - South Park)',
    sourceUrl: 'https://www.theiceranch.com/page/show/1652320-calendar',
    rinkName: 'Main Rink'
  },
  'big-bear': {
    id: 'big-bear',
    facilityName: 'Big Bear Ice Arena',
    displayName: 'Big Bear Ice Arena (Lowry)',
    sourceUrl: 'https://bigbearicearena.ezfacility.com/Sessions',
    rinkName: 'Main Rink'
  },
  'du-ritchie': {
    id: 'du-ritchie',
    facilityName: 'DU Ritchie Center',
    displayName: 'DU Ritchie Center (University of Denver)',
    sourceUrl: 'https://ritchiecenter.du.edu/sports/ice-programs',
    rinkName: 'Main Rink'
  },
  'foothills-edge': {
    id: 'foothills-edge',
    facilityName: 'Foothills Edge Ice Arena',
    displayName: 'Foothills Edge Ice Arena (Littleton - Ken Caryl)',
    sourceUrl: 'https://www.ifoothills.org/cal-edge/',
    rinkName: 'Main Rink'
  },
  'fsc-avalanche': {
    id: 'fsc-avalanche',
    facilityName: 'Family Sports Center',
    displayName: 'Family Sports Center (Englewood)',
    sourceUrl: 'https://ssprd.finnlyconnect.com/schedule/249',
    rinkName: 'Avalanche Rink'
  },
  'fsc-fixit': {
    id: 'fsc-fixit',
    facilityName: 'Family Sports Center',
    displayName: 'Family Sports Center (Englewood)',
    sourceUrl: 'https://ssprd.finnlyconnect.com/schedule/249',
    rinkName: 'Fix-it 24/7 Rink'
  },
  'sssc-rink1': {
    id: 'sssc-rink1',
    facilityName: 'South Suburban Sports Complex',
    displayName: 'South Suburban Sports Complex (Highlands Ranch)',
    sourceUrl: 'https://ssprd.finnlyconnect.com/schedule/250',
    rinkName: 'Rink 1'
  },
  'sssc-rink2': {
    id: 'sssc-rink2',
    facilityName: 'South Suburban Sports Complex',
    displayName: 'South Suburban Sports Complex (Highlands Ranch)',
    sourceUrl: 'https://ssprd.finnlyconnect.com/schedule/250',
    rinkName: 'Rink 2'
  },
  'sssc-rink3': {
    id: 'sssc-rink3',
    facilityName: 'South Suburban Sports Complex',
    displayName: 'South Suburban Sports Complex (Highlands Ranch)',
    sourceUrl: 'https://ssprd.finnlyconnect.com/schedule/250',
    rinkName: 'Rink 3'
  }
};

// Helper function to get configuration for a rink
export function getRinkConfig(rinkId: string): RinkConfiguration {
  const config = RINK_CONFIGURATIONS[rinkId];
  if (!config) {
    throw new Error(`Unknown rink ID: ${rinkId}`);
  }
  return config;
}

// Helper function for frontend UI groupings
export interface RinkInfo {
  id: string;
  name: string;
  sourceUrl: string;
  memberRinkIds?: string[];
}

export function getFrontendRinkConfig(): RinkInfo[] {
  return [
    {
      id: 'ice-ranch',
      name: getRinkConfig('ice-ranch').displayName,
      sourceUrl: getRinkConfig('ice-ranch').sourceUrl,
    },
    {
      id: 'big-bear',
      name: getRinkConfig('big-bear').displayName,
      sourceUrl: getRinkConfig('big-bear').sourceUrl,
    },
    {
      id: 'du-ritchie',
      name: getRinkConfig('du-ritchie').displayName,
      sourceUrl: getRinkConfig('du-ritchie').sourceUrl,
    },
    {
      id: 'foothills-edge',
      name: getRinkConfig('foothills-edge').displayName,
      sourceUrl: getRinkConfig('foothills-edge').sourceUrl,
    },
    {
      id: 'ssprd-family-sports',
      name: 'Family Sports Center (Englewood)',
      sourceUrl: getRinkConfig('fsc-avalanche').sourceUrl,
      memberRinkIds: ['fsc-avalanche', 'fsc-fixit'],
    },
    {
      id: 'ssprd-sports-complex',
      name: 'South Suburban Sports Complex (Highlands Ranch)',
      sourceUrl: getRinkConfig('sssc-rink1').sourceUrl,
      memberRinkIds: ['sssc-rink1', 'sssc-rink2', 'sssc-rink3'],
    },
  ];
}

export function getAllIndividualRinksForFiltering(): RinkInfo[] {
  return Object.values(RINK_CONFIGURATIONS).map(config => ({
    id: config.id,
    name: config.displayName,
    sourceUrl: config.sourceUrl
  }));
}
