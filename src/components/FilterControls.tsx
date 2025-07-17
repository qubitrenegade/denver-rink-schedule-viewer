import React from 'react';
import { EventCategory, FilterSettings, RinkInfo, TimeFilterMode, DateFilterMode, RinkFilterType } from '../types';
import { ALL_RINKS_TAB_ID } from '../App';
import { RINKS_CONFIG } from '../rinkConfig';
import DateFilter from './DateFilter';
import TimeFilter from './TimeFilter';
import RinkFilter from './RinkFilter';
import CategoryFilter from './CategoryFilter';

// Props for FilterControls: manages all filter UI and state changes
interface FilterControlsProps {
  allRinks: RinkInfo[];
  selectedRinkId: string;
  allCategories: EventCategory[];
  currentFilterSettings: FilterSettings;
  onFilterSettingsChange: (newSettings: FilterSettings) => void;
}

const FilterControls: React.FC<FilterControlsProps> = ({
  allRinks,
  selectedRinkId,
  allCategories,
  currentFilterSettings,
  onFilterSettingsChange,
}) => {
  // Destructure filter settings for clarity
  const {
    activeCategories,
    filterMode,
    activeRinkIds = [],
    rinkFilterMode = 'exclude',
    rinkFilterType = 'facilities',
    dateFilterMode,
    numberOfDays = 4,
    selectedDate,
    dateRangeStart,
    dateRangeEnd,
    timeFilterMode,
    afterTime,
    beforeTime,
    timeRangeStart,
    timeRangeEnd
  } = currentFilterSettings;

  // Get facilities-only rinks list (no individual rinks)
  const facilitiesRinks = RINKS_CONFIG;

  // --- Rink filter handlers ---
  const handleRinkToggle = (rinkIdToToggle: string) => {
    // Toggle rink selection
    const newActiveRinkIds = activeRinkIds.includes(rinkIdToToggle)
      ? activeRinkIds.filter(id => id !== rinkIdToToggle)
      : [...activeRinkIds, rinkIdToToggle];
    onFilterSettingsChange({ ...currentFilterSettings, activeRinkIds: newActiveRinkIds });
  };
  const handleRinkFilterModeChange = (newMode: 'include' | 'exclude') => {
    onFilterSettingsChange({ ...currentFilterSettings, rinkFilterMode: newMode });
  };
  const handleRinkFilterTypeChange = (newType: RinkFilterType) => {
    // When switching filter types, clear current selections to avoid confusion
    onFilterSettingsChange({ 
      ...currentFilterSettings, 
      rinkFilterType: newType,
      activeRinkIds: [] 
    });
  };
  const handleToggleAllRinks = (selectAll: boolean) => {
    const rinksToUse = rinkFilterType === 'facilities' ? facilitiesRinks : allRinks;
    onFilterSettingsChange({
      ...currentFilterSettings,
      activeRinkIds: selectAll ? rinksToUse.map(r => r.id) : []
    });
  };
  const getSelectAllRinksLabel = () => rinkFilterMode === 'include' ? 'Include All Rinks' : 'Exclude No Rinks (Show All)';
  const getDeselectAllRinksLabel = () => rinkFilterMode === 'include' ? 'Include No Rinks' : 'Exclude All Rinks';

  // --- Time filter handlers ---
  const handleTimeFilterModeChange = (newMode: TimeFilterMode) => {
    const newSettings = { ...currentFilterSettings, timeFilterMode: newMode };
    
    // Set default times when switching to time-based modes
    if (newMode === 'after-time' && !currentFilterSettings.afterTime) {
      newSettings.afterTime = '18:00'; // Default to 6 PM
    } else if (newMode === 'before-time' && !currentFilterSettings.beforeTime) {
      newSettings.beforeTime = '12:00'; // Default to noon
    } else if (newMode === 'time-range') {
      if (!currentFilterSettings.timeRangeStart) {
        newSettings.timeRangeStart = '09:00'; // Default start: 9 AM
      }
      if (!currentFilterSettings.timeRangeEnd) {
        newSettings.timeRangeEnd = '21:00'; // Default end: 9 PM
      }
    }
    
    onFilterSettingsChange(newSettings);
  };
  const handleAfterTimeChange = (time: string) => {
    onFilterSettingsChange({ ...currentFilterSettings, afterTime: time });
  };
  const handleBeforeTimeChange = (time: string) => {
    onFilterSettingsChange({ ...currentFilterSettings, beforeTime: time });
  };
  const handleTimeRangeChange = (start?: string, end?: string) => {
    onFilterSettingsChange({
      ...currentFilterSettings,
      timeRangeStart: start ?? timeRangeStart,
      timeRangeEnd: end ?? timeRangeEnd
    });
  };

  // --- Date filter handlers ---
  const handleDateFilterModeChange = (newMode: DateFilterMode) => {
    onFilterSettingsChange({ ...currentFilterSettings, dateFilterMode: newMode });
  };
  const handleNumberOfDaysChange = (days: number) => {
    onFilterSettingsChange({ ...currentFilterSettings, numberOfDays: days });
  };
  const handleSelectedDateChange = (date: string) => {
    onFilterSettingsChange({ ...currentFilterSettings, selectedDate: date });
  };
  const handleDateRangeChange = (start?: string, end?: string) => {
    onFilterSettingsChange({
      ...currentFilterSettings,
      dateRangeStart: start ?? dateRangeStart,
      dateRangeEnd: end ?? dateRangeEnd
    });
  };

  // --- Category filter handlers ---
  const handleCategoryToggle = (category: EventCategory) => {
    // Toggle category selection
    const newActiveCategories = activeCategories.includes(category)
      ? activeCategories.filter(c => c !== category)
      : [...activeCategories, category];
    onFilterSettingsChange({ ...currentFilterSettings, activeCategories: newActiveCategories });
  };
  const handleCategoryModeChange = (newMode: 'include' | 'exclude') => {
    onFilterSettingsChange({ ...currentFilterSettings, filterMode: newMode });
  };
  const handleToggleAllCategories = (selectAll: boolean) => {
    onFilterSettingsChange({
      ...currentFilterSettings,
      activeCategories: selectAll ? [...allCategories] : []
    });
  };
  const getSelectAllCategoriesLabel = () => filterMode === 'include' ? 'Include All Categories' : 'Exclude No Categories (Show All)';
  const getDeselectAllCategoriesLabel = () => filterMode === 'include' ? 'Include No Categories' : 'Exclude All Categories';

  return (
    <div className="space-y-6">
      {/* Date Filter Section */}
      <DateFilter
        dateFilterMode={dateFilterMode}
        numberOfDays={numberOfDays}
        selectedDate={selectedDate}
        dateRangeStart={dateRangeStart}
        dateRangeEnd={dateRangeEnd}
        onDateFilterModeChange={handleDateFilterModeChange}
        onNumberOfDaysChange={handleNumberOfDaysChange}
        onSelectedDateChange={handleSelectedDateChange}
        onDateRangeChange={handleDateRangeChange}
      />
      {/* Time Filter Section */}
      <TimeFilter
        timeFilterMode={timeFilterMode}
        afterTime={afterTime}
        beforeTime={beforeTime}
        timeRangeStart={timeRangeStart}
        timeRangeEnd={timeRangeEnd}
        onTimeFilterModeChange={handleTimeFilterModeChange}
        onAfterTimeChange={handleAfterTimeChange}
        onBeforeTimeChange={handleBeforeTimeChange}
        onTimeRangeChange={handleTimeRangeChange}
      />
      {/* Rink Filter Section - only show for ALL_RINKS_TAB_ID */}
      {selectedRinkId === ALL_RINKS_TAB_ID && (
        <RinkFilter
          allRinks={allRinks}
          facilitiesRinks={facilitiesRinks}
          activeRinkIds={activeRinkIds}
          rinkFilterMode={rinkFilterMode}
          rinkFilterType={rinkFilterType}
          onRinkToggle={handleRinkToggle}
          onRinkFilterModeChange={handleRinkFilterModeChange}
          onRinkFilterTypeChange={handleRinkFilterTypeChange}
          onToggleAllRinks={handleToggleAllRinks}
          getSelectAllRinksLabel={getSelectAllRinksLabel}
          getDeselectAllRinksLabel={getDeselectAllRinksLabel}
        />
      )}
      {/* Category Filter Section */}
      <CategoryFilter
        allCategories={allCategories}
        activeCategories={activeCategories}
        filterMode={filterMode}
        onCategoryToggle={handleCategoryToggle}
        onCategoryModeChange={handleCategoryModeChange}
        onToggleAllCategories={handleToggleAllCategories}
        getSelectAllCategoriesLabel={getSelectAllCategoriesLabel}
        getDeselectAllCategoriesLabel={getDeselectAllCategoriesLabel}
      />
    </div>
  );
};

export default FilterControls;
