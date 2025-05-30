import React from 'react';
import { EventCategory, FilterSettings, FilterMode, RinkInfo, TimeFilterMode } from '../types';
import { ALL_RINKS_TAB_ID } from '../App'; // Import for comparison
import DateFilter from './DateFilter';
import TimeFilter from './TimeFilter';
import RinkFilter from './RinkFilter';
import CategoryFilter from './CategoryFilter';

interface FilterControlsProps {
  allRinks: RinkInfo[]; // All available rinks
  selectedRinkId: string; // Currently selected tab ID from App
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
  const { 
    activeCategories, 
    filterMode, 
    activeRinkIds = [], 
    rinkFilterMode = 'exclude',
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

  // Rink filter handlers
  const handleRinkToggle = (rinkIdToToggle: string) => {
    const newActiveRinkIds = [...activeRinkIds];
    const index = newActiveRinkIds.indexOf(rinkIdToToggle);
    if (index > -1) {
      newActiveRinkIds.splice(index, 1);
    } else {
      newActiveRinkIds.push(rinkIdToToggle);
    }
    onFilterSettingsChange({ ...currentFilterSettings, activeRinkIds: newActiveRinkIds });
  };
  const handleRinkFilterModeChange = (newMode: any) => {
    onFilterSettingsChange({ ...currentFilterSettings, rinkFilterMode: newMode });
  };
  const handleToggleAllRinks = (selectAll: boolean) => {
    onFilterSettingsChange({
      ...currentFilterSettings,
      activeRinkIds: selectAll ? allRinks.map(r => r.id) : []
    });
  };
  const getSelectAllRinksLabel = () => {
    if (rinkFilterMode === 'include') return 'Include All Rinks';
    return 'Exclude No Rinks (Show All)';
  };
  const getDeselectAllRinksLabel = () => {
    if (rinkFilterMode === 'include') return 'Include No Rinks';
    return 'Exclude All Rinks';
  }

  // Time filter handlers
  const handleTimeFilterModeChange = (newMode: any) => {
    onFilterSettingsChange({ ...currentFilterSettings, timeFilterMode: newMode });
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
      timeRangeStart: start || timeRangeStart,
      timeRangeEnd: end || timeRangeEnd
    });
  };

  // Date filtering handlers
  const handleDateFilterModeChange = (newMode: any) => {
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
      dateRangeStart: start || dateRangeStart,
      dateRangeEnd: end || dateRangeEnd
    });
  };

  // Category filter handlers
  const handleCategoryToggle = (category: EventCategory) => {
    const newActiveCategories = [...activeCategories];
    const index = newActiveCategories.indexOf(category);
    if (index > -1) {
      newActiveCategories.splice(index, 1);
    } else {
      newActiveCategories.push(category);
    }
    onFilterSettingsChange({ ...currentFilterSettings, activeCategories: newActiveCategories });
  };
  const handleCategoryModeChange = (newMode: any) => {
    onFilterSettingsChange({ ...currentFilterSettings, filterMode: newMode });
  };
  const handleToggleAllCategories = (selectAll: boolean) => {
    onFilterSettingsChange({ 
      ...currentFilterSettings, 
      activeCategories: selectAll ? [...allCategories] : [] 
    });
  };
  const getSelectAllCategoriesLabel = () => {
    if (filterMode === 'include') return 'Include All Categories';
    return 'Exclude No Categories (Show All)';
  };
  const getDeselectAllCategoriesLabel = () => {
    if (filterMode === 'include') return 'Include No Categories';
    return 'Exclude All Categories';
  };

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
      {/* Rink Filter Section - Conditional Rendering */}
      {selectedRinkId === ALL_RINKS_TAB_ID && (
        <RinkFilter
          allRinks={allRinks}
          activeRinkIds={activeRinkIds}
          rinkFilterMode={rinkFilterMode}
          onRinkToggle={handleRinkToggle}
          onRinkFilterModeChange={handleRinkFilterModeChange}
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
