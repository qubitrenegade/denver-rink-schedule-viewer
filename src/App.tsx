import React, { useState, useEffect, useMemo } from 'react';
import { EventCategory, DisplayableIceEvent, FilterSettings, FilterMode, UrlViewType, RawIceEventData, DateFilterMode, TimeFilterMode } from './types';
import { RINKS_CONFIG, ALL_INDIVIDUAL_RINKS_FOR_FILTERING } from './rinkConfig';
import RinkTabs from './components/RinkTabs';
import EventList from './components/EventList';
import FilterControls from './components/FilterControls';
import { LoadingIcon, CalendarIcon, AdjustmentsHorizontalIcon } from './components/icons';
import { useEventData } from './hooks/useEventData';
import { useEventFiltering } from './hooks/useEventFiltering';
import { useUrlState } from './hooks/useUrlState';

export const ALL_RINKS_TAB_ID = 'all-rinks';

const App: React.FC = () => {
  // Use the new data hook
  const {
    staticData,
    facilityMetadata,
    facilityErrors,
    isLoading,
    error,
    refetch
  } = useEventData();

  // Use the new URL state hook
  const {
    selectedRinkId,
    setSelectedRinkId,
    filterSettings,
    setFilterSettings
  } = useUrlState();

  const [showFilters, setShowFilters] = useState(false);

  const allPossibleCategories = useMemo((): EventCategory[] => {
    const categories = new Set<EventCategory>();
    // Get categories from static data
    staticData.forEach((event: RawIceEventData) => categories.add(event.category));

    // Ensure we have common categories even if not in current data
    ['Public Skate', 'Stick & Puck', 'Hockey League', 'Learn to Skate', 'Figure Skating', 'Hockey Practice', 'Drop-In Hockey', 'Special Event'].forEach(cat => {
      categories.add(cat as EventCategory);
    });

    return Array.from(categories).sort();
  }, [staticData]);

  // Filter events when data or filters change
  // Use useEventFiltering to get filtered/sorted events
  const filteredEvents = useEventFiltering(staticData, filterSettings, selectedRinkId);

  const handleRinkSelect = (rinkId: UrlViewType) => {
    setSelectedRinkId(rinkId);
  };

  const handleFilterSettingsChange = (newFilterSettings: FilterSettings) => {
    setFilterSettings(newFilterSettings);
  };

  const selectedRinkTabInfo = selectedRinkId !== ALL_RINKS_TAB_ID ? RINKS_CONFIG.find(rink => rink.id === selectedRinkId) : null;

  const getLastUpdateInfo = () => {
    if (selectedRinkId === ALL_RINKS_TAB_ID) {
      let latestUpdate = '';
      RINKS_CONFIG.forEach(tab => {
        if (tab.memberRinkIds) {
          tab.memberRinkIds.forEach(rinkId => {
            const meta = facilityMetadata[rinkId] as { lastSuccessfulScrape?: string } | undefined;
            if (meta?.lastSuccessfulScrape) {
              if (!latestUpdate || meta.lastSuccessfulScrape > latestUpdate) {
                latestUpdate = meta.lastSuccessfulScrape;
              }
            }
          });
        } else {
          const meta = facilityMetadata[tab.id] as { lastSuccessfulScrape?: string } | undefined;
          if (meta?.lastSuccessfulScrape) {
            if (!latestUpdate || meta.lastSuccessfulScrape > latestUpdate) {
              latestUpdate = meta.lastSuccessfulScrape;
            }
          }
        }
      });
      return latestUpdate ? new Date(latestUpdate).toLocaleString() : 'Unknown';
    } else {
      const meta = facilityMetadata[selectedRinkId] as { lastSuccessfulScrape?: string } | undefined;
      return meta?.lastSuccessfulScrape ? new Date(meta.lastSuccessfulScrape).toLocaleString() : 'Unknown';
    }
  };

  // Helper function to describe current filter state
  const getFilterDescription = () => {
    const parts: string[] = [];

    // Date description
    if (filterSettings.dateFilterMode === 'next-days') {
      parts.push(`next ${filterSettings.numberOfDays || 4} days`);
    } else if (filterSettings.dateFilterMode === 'specific-day' && filterSettings.selectedDate) {
      const date = new Date(filterSettings.selectedDate + 'T00:00:00');
      parts.push(`${date.toLocaleDateString()}`);
    } else if (filterSettings.dateFilterMode === 'date-range' && filterSettings.dateRangeStart && filterSettings.dateRangeEnd) {
      const startDate = new Date(filterSettings.dateRangeStart + 'T00:00:00');
      const endDate = new Date(filterSettings.dateRangeEnd + 'T00:00:00');
      parts.push(`${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`);
    }

    // Time description
    if (filterSettings.timeFilterMode === 'after-time' && filterSettings.afterTime) {
      parts.push(`after ${filterSettings.afterTime}`);
    } else if (filterSettings.timeFilterMode === 'before-time' && filterSettings.beforeTime) {
      parts.push(`before ${filterSettings.beforeTime}`);
    } else if (filterSettings.timeFilterMode === 'time-range' && filterSettings.timeRangeStart && filterSettings.timeRangeEnd) {
      parts.push(`between ${filterSettings.timeRangeStart} and ${filterSettings.timeRangeEnd}`);
    }

    return parts.length > 0 ? `Showing events for ${parts.join(', ')}.` : 'Showing events with custom filtering.';
  };

  // Get error message if there are any facility errors
  const hasAnyErrors = Object.keys(facilityErrors).length > 0;

  React.useEffect(() => {
    refetch();
  }, [refetch]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-700 text-gray-100 p-4 sm:p-6 md:p-8">
      <header className="mb-6 text-center">
        <div className="max-w-6xl mx-auto mb-4">
          <img
            src="/images/header.webp"
            alt="Denver Rink Schedule"
            className="w-full max-h-48 object-contain rounded-lg shadow-lg"
          />
        </div>
        <div className="flex items-center justify-center mb-2">
          <CalendarIcon className="w-10 h-10 mr-3 text-sky-400" />
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-cyan-300">
            Denver Rink Schedule
          </h1>
        </div>
        <p className="text-sm text-slate-400 italic max-w-2xl mx-auto">
          {getFilterDescription()} Data is automatically updated twice daily via GitHub Actions.
        </p>
      </header>

      <div className="max-w-6xl mx-auto bg-slate-800 shadow-2xl rounded-lg overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-700">
          <RinkTabs
            rinks={RINKS_CONFIG}
            selectedRinkId={selectedRinkId}
            onSelectRink={handleRinkSelect}
            allRinksTabId={ALL_RINKS_TAB_ID}
          />
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center justify-center w-full sm:w-auto px-4 py-2 text-sm font-medium text-slate-200 bg-slate-700 hover:bg-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-75 transition-colors"
                aria-expanded={showFilters}
                aria-controls="filter-panel"
              >
                <AdjustmentsHorizontalIcon className="w-5 h-5 mr-2" />
                {showFilters ? 'Hide Filters' : 'Show Filters'}
                {((filterSettings.activeCategories.length > 0) ||
                  (filterSettings.activeRinkIds && filterSettings.activeRinkIds.length > 0) ||
                  (filterSettings.dateFilterMode !== 'next-days') ||
                  (filterSettings.numberOfDays !== 4) ||
                  (filterSettings.timeFilterMode !== 'all-times')) && !showFilters && (
                  <span className="ml-2 bg-sky-500 text-sky-100 text-xs font-bold px-2 py-0.5 rounded-full">
                    Active
                  </span>
                )}
              </button>

              <div className="flex items-center px-4 py-2 text-sm bg-green-600/20 text-green-300 rounded-md">
                <div className="w-2 h-2 rounded-full mr-2 bg-green-300" />
                Individual Metadata
                <span className="ml-2 text-xs opacity-75">
                  (Updated: {getLastUpdateInfo()})
                </span>
              </div>

              {/* Show facility errors if any */}
              {Object.keys(facilityErrors).length > 0 && (
                <div className="flex items-center px-4 py-2 text-sm bg-yellow-600/20 text-yellow-300 rounded-md">
                  <div className="w-2 h-2 rounded-full mr-2 bg-yellow-300" />
                  {Object.keys(facilityErrors).length} Facility Error{Object.keys(facilityErrors).length > 1 ? 's' : ''}
                </div>
              )}
            </div>
          </div>
          {showFilters && (
            <div id="filter-panel" className="mt-4 p-4 bg-slate-700/50 rounded-md">
              <FilterControls
                allRinks={ALL_INDIVIDUAL_RINKS_FOR_FILTERING}
                selectedRinkId={selectedRinkId}
                allCategories={allPossibleCategories}
                currentFilterSettings={filterSettings}
                onFilterSettingsChange={handleFilterSettingsChange}
              />
            </div>
          )}
        </div>

        <div className="p-6 min-h-[400px]">
          {selectedRinkTabInfo && (
            <div className="mb-6 p-4 border border-slate-700 rounded-lg bg-slate-700/50">
              <h2 className="text-2xl font-semibold text-sky-300 mb-1">
                {/* Use display name from metadata if available */}
                {(() => {
                  const facilityId = selectedRinkTabInfo.memberRinkIds
                    ? (selectedRinkTabInfo.memberRinkIds[0].startsWith('fsc-') ? 'ssprd-249' : 'ssprd-250')
                    : selectedRinkId;
                  const metadata = facilityMetadata[facilityId];
                  return metadata?.displayName || selectedRinkTabInfo.name;
                })()}
              </h2>
              <p className="text-sm text-slate-400">
                Source: <a href={selectedRinkTabInfo.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:text-sky-300 underline transition-colors">
                  {selectedRinkTabInfo.sourceUrl}
                </a>
                {selectedRinkTabInfo.memberRinkIds && selectedRinkTabInfo.memberRinkIds.length > 0 && (
                  <span className="ml-2 text-xs text-slate-500">(Showing events for {selectedRinkTabInfo.memberRinkIds.length} rinks)</span>
                )}
              </p>
            </div>
          )}
          {selectedRinkId === ALL_RINKS_TAB_ID && (
            <div className="mb-6 p-4 border border-slate-700 rounded-lg bg-slate-700/50">
              <h2 className="text-2xl font-semibold text-sky-300 mb-1">All Rinks View</h2>
              <p className="text-sm text-slate-400">
                Showing events from all Denver area ice rinks. Data automatically updated twice daily.
              </p>
              <p className="text-xs text-green-400 mt-1">
                📊 {staticData.length} total events loaded from {Object.keys(facilityMetadata).length} facilities
              </p>
            </div>
          )}

          {isLoading && (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <LoadingIcon className="w-12 h-12 mb-4" />
              <p className="text-lg">Loading schedule data...</p>
            </div>
          )}

          {!isLoading && (error || hasAnyErrors) && (
            <div className="flex flex-col items-center justify-center h-64 text-red-400 bg-red-900/20 p-6 rounded-md">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mb-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
              <p className="text-lg font-semibold">Error Loading Data</p>
              <p className="text-sm text-center">{error || 'Some facilities failed to load'}</p>
              <p className="text-xs text-slate-500 mt-2">Data updates automatically via GitHub Actions</p>
            </div>
          )}

          {!isLoading && !error && !hasAnyErrors && filteredEvents.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 mb-4 text-slate-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5v-.008ZM9.75 12h.008v.008H9.75v-.008ZM7.5 12h.008v.008H7.5v-.008ZM14.25 15h.008v.008H14.25v-.008ZM14.25 12h.008v.008H14.25v-.008ZM16.5 15h.008v.008H16.5v-.008ZM16.5 12h.008v.008H16.5v-.008Z" />
              </svg>
              <p className="text-lg">No events found for the selected criteria and date range.</p>
              <p className="text-sm text-slate-500">
                Try adjusting filters or check back later for updated data.
              </p>
            </div>
          )}

          {!isLoading && !error && !hasAnyErrors && filteredEvents.length > 0 && (
            <EventList events={filteredEvents} />
          )}
        </div>
      </div>
      <footer className="text-center mt-8 text-sm text-slate-500">
        <p>&copy; {new Date().getFullYear()} Denver Rink Schedule. Data updated automatically via GitHub Actions.</p>
        <p className="mt-1">
          Last data update: {getLastUpdateInfo()}
        </p>
      </footer>
    </div>
  );
};

export default App;