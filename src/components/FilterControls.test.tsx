import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import FilterControls from './FilterControls';
import { FilterSettings, RinkInfo, EventCategory } from '../types';

describe('FilterControls', () => {
  it('renders all filter sections', () => {
    const allRinks: RinkInfo[] = [
      { id: 'ice-ranch', name: 'Ice Ranch', sourceUrl: '' },
      { id: 'big-bear', name: 'Big Bear', sourceUrl: '' },
    ];
    const allCategories: EventCategory[] = ['Public Skate', 'Stick & Puck'];
    const currentFilterSettings: FilterSettings = {
      activeCategories: ['Public Skate'],
      filterMode: 'include',
      activeRinkIds: ['ice-ranch'],
      rinkFilterMode: 'include',
      dateFilterMode: 'specific-day',
      selectedDate: '2025-06-01',
      timeFilterMode: 'all-times',
    };
    render(
      <FilterControls
        allRinks={allRinks}
        selectedRinkId="all-rinks"
        allCategories={allCategories}
        currentFilterSettings={currentFilterSettings}
        onFilterSettingsChange={() => {}}
      />
    );
    expect(screen.getByText(/filter by date/i)).toBeInTheDocument();
    expect(screen.getByText(/filter by time/i)).toBeInTheDocument();
    expect(screen.getByText(/filter by rink/i)).toBeInTheDocument();
    expect(screen.getByText(/filter by category/i)).toBeInTheDocument();
  });
});
