import { useState, useEffect } from 'react';
import { FilterSettings, FilterMode, DateFilterMode, TimeFilterMode, UrlViewType, EventCategory } from '../types';
import { ALL_RINKS_TAB_ID } from '../App';

function parseFiltersFromUrl(): FilterSettings {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode') as FilterMode | null;
  const categories = params.get('categories');
  const rinkIdsParam = params.get('rinkIds');
  const rinkModeParam = params.get('rinkMode') as FilterMode | null;
  const dateFilterMode = (params.get('dateMode') as DateFilterMode) || 'next-days';
  const numberOfDays = parseInt(params.get('days') || '4');
  const selectedDate = params.get('date') || undefined;
  const dateRangeStart = params.get('dateStart') || undefined;
  const dateRangeEnd = params.get('dateEnd') || undefined;
  const timeFilterMode = (params.get('timeMode') as TimeFilterMode) || 'all-times';
  const afterTime = params.get('afterTime') || undefined;
  const beforeTime = params.get('beforeTime') || undefined;
  const timeRangeStart = params.get('timeStart') || undefined;
  const timeRangeEnd = params.get('timeEnd') || undefined;
  return {
    activeCategories: categories ? categories.split(',') as EventCategory[] : [],
    filterMode: mode || 'exclude',
    activeRinkIds: rinkIdsParam ? rinkIdsParam.split(',') : [],
    rinkFilterMode: rinkModeParam || 'exclude',
    dateFilterMode,
    numberOfDays,
    selectedDate,
    dateRangeStart,
    dateRangeEnd,
    timeFilterMode,
    afterTime,
    beforeTime,
    timeRangeStart,
    timeRangeEnd,
  };
}

function updateUrlFromState(selectedRinkId: string, filterSettings: FilterSettings) {
  const params = new URLSearchParams();
  params.set('view', selectedRinkId);

  if (filterSettings.filterMode !== 'exclude' || filterSettings.activeCategories.length > 0) {
    params.set('mode', filterSettings.filterMode);
  }
  if (filterSettings.activeCategories.length > 0) {
    params.set('categories', filterSettings.activeCategories.join(','));
  }
  if (filterSettings.rinkFilterMode !== 'exclude' || (filterSettings.activeRinkIds && filterSettings.activeRinkIds.length > 0)) {
    params.set('rinkMode', filterSettings.rinkFilterMode || 'exclude');
  }
  if (filterSettings.activeRinkIds && filterSettings.activeRinkIds.length > 0) {
    params.set('rinkIds', filterSettings.activeRinkIds.join(','));
  }

  // Date filtering URL params
  if (filterSettings.dateFilterMode !== 'next-days') {
    params.set('dateMode', filterSettings.dateFilterMode);
  }
  if (filterSettings.dateFilterMode === 'next-days' && filterSettings.numberOfDays !== 4) {
    params.set('days', filterSettings.numberOfDays?.toString() || '4');
  }
  if (filterSettings.dateFilterMode === 'specific-day' && filterSettings.selectedDate) {
    params.set('date', filterSettings.selectedDate);
  }
  if (filterSettings.dateFilterMode === 'date-range') {
    if (filterSettings.dateRangeStart) params.set('dateStart', filterSettings.dateRangeStart);
    if (filterSettings.dateRangeEnd) params.set('dateEnd', filterSettings.dateRangeEnd);
  }

  // Time filtering URL params
  if (filterSettings.timeFilterMode !== 'all-times') {
    params.set('timeMode', filterSettings.timeFilterMode);
  }
  if (filterSettings.timeFilterMode === 'after-time' && filterSettings.afterTime) {
    params.set('afterTime', filterSettings.afterTime);
  }
  if (filterSettings.timeFilterMode === 'before-time' && filterSettings.beforeTime) {
    params.set('beforeTime', filterSettings.beforeTime);
  }
  if (filterSettings.timeFilterMode === 'time-range') {
    if (filterSettings.timeRangeStart) params.set('timeStart', filterSettings.timeRangeStart);
    if (filterSettings.timeRangeEnd) params.set('timeEnd', filterSettings.timeRangeEnd);
  }

  const newSearchString = params.toString();
  const newUrlTarget = newSearchString ? `${window.location.pathname}?${newSearchString}` : window.location.pathname;
  const currentFullUrl = `${window.location.pathname}${window.location.search}`;

  if (currentFullUrl !== newUrlTarget) {
    const timeoutId = setTimeout(() => {
      try {
        window.history.replaceState(null, '', newUrlTarget);
      } catch (e: any) {
        console.error('Error updating URL:', e);
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }
}

export function useUrlState() {
  const [selectedRinkId, setSelectedRinkId] = useState<UrlViewType>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('view') || ALL_RINKS_TAB_ID;
  });
  const [filterSettings, setFilterSettings] = useState<FilterSettings>(() => parseFiltersFromUrl());
  useEffect(() => {
    updateUrlFromState(selectedRinkId, filterSettings);
  }, [selectedRinkId, filterSettings]);
  return {
    selectedRinkId,
    setSelectedRinkId,
    filterSettings,
    setFilterSettings
  };
}
