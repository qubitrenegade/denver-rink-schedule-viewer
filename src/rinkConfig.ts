import { RinkInfo } from './types';
import { getFrontendRinkConfig, getAllIndividualRinksForFiltering } from '../workers/shared/rink-config';

// RINKS_CONFIG defines the rink tabs and groupings for the app UI
export const RINKS_CONFIG: RinkInfo[] = getFrontendRinkConfig();

// List of all individual rinks for filtering when "All Rinks" is selected
export const ALL_INDIVIDUAL_RINKS_FOR_FILTERING: RinkInfo[] = getAllIndividualRinksForFiltering();
