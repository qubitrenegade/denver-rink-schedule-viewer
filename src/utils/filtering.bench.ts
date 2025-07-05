import { bench, describe } from 'vitest';
import { useCategoryFiltering } from '../hooks/useCategoryFiltering';
import { useDateFiltering } from '../hooks/useDateFiltering';

// Mock event data
const mockEvents = Array(1000).fill(null).map((_, i) => ({
  id: `event-${i}`,
  title: `Event ${i}`,
  start: new Date(2025, 6, Math.floor(i / 50) + 1, (i % 24)),
  end: new Date(2025, 6, Math.floor(i / 50) + 1, (i % 24) + 1),
  category: ['Public Skate', 'Stick & Puck', 'Drop-in Hockey', 'Figure Skating'][i % 4],
  rink: ['Apex Ice', 'Big Bear', 'Ice Ranch', 'Foothills Edge'][i % 4]
}));

describe('Filtering Benchmarks', () => {
  bench('Category filtering - single category', () => {
    const { filterEventsByCategory } = useCategoryFiltering();
    const selectedCategories = new Set(['Public Skate']);
    
    filterEventsByCategory(mockEvents, selectedCategories);
  });
  
  bench('Category filtering - multiple categories', () => {
    const { filterEventsByCategory } = useCategoryFiltering();
    const selectedCategories = new Set(['Public Skate', 'Drop-in Hockey']);
    
    filterEventsByCategory(mockEvents, selectedCategories);
  });
  
  bench('Date filtering - single day', () => {
    const { filterEventsByDateRange } = useDateFiltering();
    const startDate = new Date(2025, 6, 2);
    const endDate = new Date(2025, 6, 2);
    
    filterEventsByDateRange(mockEvents, startDate, endDate);
  });
  
  bench('Date filtering - week range', () => {
    const { filterEventsByDateRange } = useDateFiltering();
    const startDate = new Date(2025, 6, 1);
    const endDate = new Date(2025, 6, 7);
    
    filterEventsByDateRange(mockEvents, startDate, endDate);
  });
});
