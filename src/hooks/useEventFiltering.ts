import { RawIceEventData, FilterSettings, DisplayableIceEvent } from '../types';
import { useDateFiltering } from './useDateFiltering';
import { useTimeFiltering } from './useTimeFiltering';
import { useRinkFiltering } from './useRinkFiltering';
import { useCategoryFiltering } from './useCategoryFiltering';
import { useEventDeduplication } from './useEventDeduplication';

export function useEventFiltering(
  events: RawIceEventData[],
  filterSettings: FilterSettings,
  selectedRinkId: string
): DisplayableIceEvent[] {
  // Apply filters in sequence using focused hooks
  const rinkFiltered = useRinkFiltering(events, filterSettings, selectedRinkId);
  const dateFiltered = useDateFiltering(rinkFiltered, filterSettings);
  const timeFiltered = useTimeFiltering(dateFiltered, filterSettings);
  const categoryFiltered = useCategoryFiltering(timeFiltered, filterSettings);
  
  // Convert to DisplayableIceEvent and deduplicate
  const finalEvents = useEventDeduplication(categoryFiltered);
  
  return finalEvents;
}