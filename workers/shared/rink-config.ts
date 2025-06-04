// workers/shared/rink-config.ts - Shared configuration for both frontend and workers

export interface RinkConfiguration {
  id: string;
  facilityName: string;
  displayName: string;
  sourceUrl: string;
  rinkName: string;
  shortRinkName?: string; // For compact display on event cards
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
  'big-bear-north': {
    id: 'big-bear-north',
    facilityName: 'Big Bear Ice Arena',
    displayName: 'Big Bear Ice Arena (Lowry)',
    sourceUrl: 'https://bigbearicearena.ezfacility.com/Sessions',
    rinkName: 'North Rink',
    shortRinkName: 'North Rink'
  },
  'big-bear-south': {
    id: 'big-bear-south',
    facilityName: 'Big Bear Ice Arena',
    displayName: 'Big Bear Ice Arena (Lowry)',
    sourceUrl: 'https://bigbearicearena.ezfacility.com/Sessions',
    rinkName: 'South Rink',
    shortRinkName: 'South Rink'
  },
  'big-bear': {
    id: 'big-bear',
    facilityName: 'Big Bear Ice Arena',
    displayName: 'Big Bear Ice Arena (Lowry)',
    sourceUrl: 'https://bigbearicearena.ezfacility.com/Sessions',
    rinkName: 'Big Bear Ice Arena',
    memberRinkIds: ['big-bear-north', 'big-bear-south']
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
    rinkName: 'Avalanche Rink',
    shortRinkName: 'FSC Avalanche'
  },
  'fsc-fixit': {
    id: 'fsc-fixit',
    facilityName: 'Family Sports Center',
    displayName: 'Family Sports Center (Englewood)',
    sourceUrl: 'https://ssprd.finnlyconnect.com/schedule/249',
    rinkName: 'Fix-it 24/7 Rink',
    shortRinkName: 'FSC FixIt 24/7'
  },
  'sssc-rink1': {
    id: 'sssc-rink1',
    facilityName: 'South Suburban Sports Complex',
    displayName: 'South Suburban Sports Complex (Highlands Ranch)',
    sourceUrl: 'https://ssprd.finnlyconnect.com/schedule/250',
    rinkName: 'Rink 1',
    shortRinkName: 'SSSC 1'
  },
  'sssc-rink2': {
    id: 'sssc-rink2',
    facilityName: 'South Suburban Sports Complex',
    displayName: 'South Suburban Sports Complex (Highlands Ranch)',
    sourceUrl: 'https://ssprd.finnlyconnect.com/schedule/250',
    rinkName: 'Rink 2',
    shortRinkName: 'SSSC 2'
  },
  'sssc-rink3': {
    id: 'sssc-rink3',
    facilityName: 'South Suburban Sports Complex',
    displayName: 'South Suburban Sports Complex (Highlands Ranch)',
    sourceUrl: 'https://ssprd.finnlyconnect.com/schedule/250',
    rinkName: 'Rink 3',
    shortRinkName: 'SSSC 3'
  },
  'ssprd-fsc': {
    id: 'ssprd-fsc',
    facilityName: 'Family Sports Center',
    displayName: 'Family Sports Center (Englewood)',
    sourceUrl: 'https://ssprd.finnlyconnect.com/schedule/249',
    rinkName: 'Family Sports Center',
    memberRinkIds: ['fsc-avalanche', 'fsc-fixit']
  },
  'ssprd-sssc': {
    id: 'ssprd-sssc',
    facilityName: 'South Suburban Sports Complex',
    displayName: 'South Suburban Sports Complex (Highlands Ranch)',
    sourceUrl: 'https://ssprd.finnlyconnect.com/schedule/250',
    rinkName: 'South Suburban Sports Complex',
    memberRinkIds: ['sssc-rink1', 'sssc-rink2', 'sssc-rink3']
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
      memberRinkIds: ['big-bear-north', 'big-bear-south'],
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
      id: 'ssprd-fsc',
      name: 'Family Sports Center (Englewood)',
      sourceUrl: getRinkConfig('ssprd-fsc').sourceUrl,
      memberRinkIds: ['fsc-avalanche', 'fsc-fixit'],
    },
    {
      id: 'ssprd-sssc',
      name: 'South Suburban Sports Complex (Highlands Ranch)',
      sourceUrl: getRinkConfig('ssprd-sssc').sourceUrl,
      memberRinkIds: ['sssc-rink1', 'sssc-rink2', 'sssc-rink3'],
    },
  ];
}

export function getAllIndividualRinksForFiltering(): RinkInfo[] {
  return Object.values(RINK_CONFIGURATIONS).map(config => {
    // For individual rinks that are part of a multi-rink facility, include the specific rink name
    // For filtering purposes, use full descriptive names
    let name = config.displayName;
    if (config.rinkName && config.rinkName !== 'Main Rink' && config.rinkName !== config.facilityName) {
      if (config.shortRinkName) {
        name = `${config.displayName} - ${config.shortRinkName}`;
      } else {
        name = `${config.displayName} - ${config.rinkName}`;
      }
    }

    return {
      id: config.id,
      name,
      sourceUrl: config.sourceUrl
    };
  });
}
