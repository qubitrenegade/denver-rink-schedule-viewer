import { useMemo } from 'react';
import { FilterSettings, RawIceEventData, EventCategory } from '../types';
import { useEventData } from './useEventData';
import { useUrlState } from './useUrlState';
import { getFilterDescription, getLastUpdateInfo } from '../utils/filterUtils';
import { RINKS_CONFIG } from '../rinkConfig';
import { ALL_RINKS_TAB_ID } from '../App';

export function useAppHeader() {
  const { facilityMetadata, facilityErrors } = useEventData();
  const { selectedRinkId, filterSettings } = useUrlState();

  const filterDescription = useMemo(() => getFilterDescription(filterSettings), [filterSettings]);
  
  const lastUpdateInfo = useMemo(() => 
    getLastUpdateInfo(selectedRinkId, facilityMetadata, RINKS_CONFIG, ALL_RINKS_TAB_ID),
    [selectedRinkId, facilityMetadata]
  );

  const facilityErrorCount = Object.keys(facilityErrors).length;

  return {
    filterDescription,
    lastUpdateInfo,
    facilityErrorCount,
    filterSettings,
    selectedRinkId,
  };
}
