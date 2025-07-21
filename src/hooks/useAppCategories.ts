import { useMemo } from 'react';
import { RawIceEventData, EventCategory } from '../types';
import { useEventData } from './useEventData';

export function useAppCategories() {
  const { staticData } = useEventData();

  const allPossibleCategories = useMemo((): EventCategory[] => {
    const categories = new Set<EventCategory>();
    staticData.forEach((event: RawIceEventData) => categories.add(event.category));

    // Ensure common categories are always present
    ['Public Skate', 'Stick & Puck', 'Hockey League', 'Learn to Skate', 'Figure Skating', 'Hockey Practice', 'Drop-In Hockey', 'Special Event'].forEach(cat => {
      categories.add(cat as EventCategory);
    });

    return Array.from(categories).sort();
  }, [staticData]);

  return { allPossibleCategories };
}
