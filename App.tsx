import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { RinkInfo, EventCategory, DisplayableIceEvent, FilterSettings, FilterMode, UrlViewType, RawIceEventData } from './types';
import { RINKS_CONFIG, MOCK_EVENTS_DATA } from './mockData';
import { RealRinkScraper } from './scraper';
import RinkTabs from './components/RinkTabs';
import EventList from './components/EventList';
import FilterControls from './components/FilterControls';
import { LoadingIcon, CalendarIcon, AdjustmentsHorizontalIcon, RefreshIcon } from './components/icons';

export const ALL_RINKS_TAB_ID = 'all-rinks';

const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [rinks] = useState<RinkInfo[]>(RINKS_CONFIG);
  const [useLiveData, setUseLiveData] = useState<boolean>(false);
  const [scraper] = useState(() => new RealRinkScraper());
  
  // Cache for scraped data
  const [scrapedDataCache, setScrapedDataCache] = useState<RawIceEventData[]>([]);
  const [lastScrapeTime, setLastScrapeTime] = useState<number>(0);

  const [selectedRinkId, setSelectedRinkId] = useState<UrlViewType>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('view') || ALL_RINKS_TAB_ID;
  });

  const [filterSettings, setFilterSettings] = useState<FilterSettings>(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode') as FilterMode | null;
    const categories = params.get('categories');
    console.log("Initial URL params for filters:", { mode, categories });
    return {
      activeCategories: categories ? categories.split(',') as EventCategory[] : [],
      filterMode: mode || 'exclude',
    };
  });
  
  const [events, setEvents] = useState<DisplayableIceEvent[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const allPossibleCategories = useMemo((): EventCategory[] => {
    const categories = new Set<EventCategory>();
    Object.values(MOCK_EVENTS_DATA).forEach(rinkEvents => {
      rinkEvents.forEach(event => categories.add(event.category));
    });
    return Array.from(categories).sort();
  }, []);

  // Function to scrape fresh data
  const scrapeData = useCallback(async (): Promise<RawIceEventData[]> => {
    console.log('🚀 Scraping fresh data...');
    const scrapedEvents = await scraper.scrapeAllRinks();
    setScrapedDataCache(scrapedEvents);
    setLastScrapeTime(Date.now());
    return scrapedEvents;
  }, [scraper]);

  // Function to filter cached data
  const filterAndDisplayEvents = useCallback((rinkId: UrlViewType, currentFilters: FilterSettings, sourceData: RawIceEventData[]) => {
    console.log("Filtering cached data for:", { rinkId, currentFilters, dataLength: sourceData.length });
    
    let rawEventsWithDates: Array<RawIceEventData & { rinkName?: string }> = [];

    if (rinkId === ALL_RINKS_TAB_ID) {
      rawEventsWithDates = sourceData.map(e => ({
        ...e,
        rinkName: rinks.find(r => r.id === e.rinkId)?.name
      }));
    } else {
      rawEventsWithDates = sourceData
        .filter(e => e.rinkId === rinkId)
        .map(e => ({
          ...e,
          rinkName: rinks.find(r => r.id === rinkId)?.name
        }));
    }

    // Filter out closed events for all-rinks view
    if (rinkId === ALL_RINKS_TAB_ID) {
      rawEventsWithDates = rawEventsWithDates.filter(event => 
        !event.title.toLowerCase().includes('(closed)')
      );
    }
    
    const processedEvents: DisplayableIceEvent[] = rawEventsWithDates.map(event => ({
      ...event,
      startTime: event.startTime.toISOString(),
      endTime: event.endTime.toISOString(),
    })).filter(event => {
      if (currentFilters.filterMode === 'include') {
        return currentFilters.activeCategories.length === 0 ? false : currentFilters.activeCategories.includes(event.category);
      } else { 
        return !currentFilters.activeCategories.includes(event.category);
      }
    });
    
    const sortedEvents = processedEvents.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    console.log("Setting filtered events:", sortedEvents.length);
    setEvents(sortedEvents);
  }, [rinks]);

  // Main data fetching function
  const fetchAndFilterEvents = useCallback(async (rinkId: UrlViewType, currentFilters: FilterSettings, forceRefresh: boolean = false) => {
    console.log("fetchAndFilterEvents called with:", { rinkId, currentFilters, useLiveData, forceRefresh });
    setIsLoading(true);
    setError(null);

    try {
      let sourceData: RawIceEventData[];

      if (useLiveData) {
        // Use cached data if available and not forcing refresh
        if (scrapedDataCache.length > 0 && !forceRefresh) {
          console.log('📋 Using cached scraped data...');
          sourceData = scrapedDataCache;
        } else {
          console.log('🚀 Fetching fresh live data...');
          sourceData = await scrapeData();
        }
      } else {
        // Use mock data
        console.log('📋 Using mock data...');
        const allMockEvents: RawIceEventData[] = [];
        rinks.forEach(rink => {
          const rinkEvents = MOCK_EVENTS_DATA[rink.id] || [];
          allMockEvents.push(...rinkEvents);
        });
        sourceData = allMockEvents;
      }

      // Filter and display the data
      filterAndDisplayEvents(rinkId, currentFilters, sourceData);

    } catch (err) {
      console.error("Error fetching or filtering events:", err);
      setError(`Failed to load event data: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, [rinks, useLiveData, scrapedDataCache, scrapeData, filterAndDisplayEvents]);

  // Effect for initial load and filter changes (not tab changes)
  useEffect(() => {
    console.log("Effect triggered for filters or live data toggle");
    fetchAndFilterEvents(selectedRinkId, filterSettings);
  }, [filterSettings, useLiveData]); // Removed selectedRinkId from deps

  // Separate effect for tab changes (just filter existing data)
  useEffect(() => {
    if (useLiveData && scrapedDataCache.length > 0) {
      console.log("Tab changed, filtering cached data...");
      filterAndDisplayEvents(selectedRinkId, filterSettings, scrapedDataCache);
    } else if (!useLiveData) {
      console.log("Tab changed in mock mode, re-filtering mock data...");
      const allMockEvents: RawIceEventData[] = [];
      rinks.forEach(rink => {
        const rinkEvents = MOCK_EVENTS_DATA[rink.id] || [];
        allMockEvents.push(...rinkEvents);
      });
      filterAndDisplayEvents(selectedRinkId, filterSettings, allMockEvents);
    }
  }, [selectedRinkId]); // Only selectedRinkId

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('view', selectedRinkId);

    if (filterSettings.filterMode !== 'exclude' || filterSettings.activeCategories.length > 0) {
      params.set('mode', filterSettings.filterMode);
    }
    if (filterSettings.activeCategories.length > 0) {
      params.set('categories', filterSettings.activeCategories.join(','));
    }

    const newSearchString = params.toString();
    let newUrlTarget: string;

    if (newSearchString) {
      newUrlTarget = `${window.location.pathname}?${newSearchString}`;
    } else {
      newUrlTarget = window.location.pathname;
    }
    
    const currentFullUrl = `${window.location.pathname}${window.location.search}`;

    if (currentFullUrl !== newUrlTarget) {
      const timeoutId = setTimeout(() => {
        try {
          window.history.replaceState(null, '', newUrlTarget);
        } catch (e: any) {
          console.error("Error updating URL:", e);
        }
      }, 0);

      return () => clearTimeout(timeoutId);
    }
  }, [selectedRinkId, filterSettings]);

  const handleRinkSelect = (rinkId: UrlViewType) => {
    setSelectedRinkId(rinkId);
  };

  const handleFilterSettingsChange = (newFilterSettings: FilterSettings) => {
    setFilterSettings(newFilterSettings);
  };
  
  const handleRefreshData = () => {
    // Force refresh by calling with forceRefresh=true
    fetchAndFilterEvents(selectedRinkId, filterSettings, true);
  };

  const handleToggleLiveData = () => {
    setUseLiveData(!useLiveData);
    // Clear cache when switching modes
    if (useLiveData) {
      setScrapedDataCache([]);
      setLastScrapeTime(0);
    }
  };

  const selectedRinkInfo = selectedRinkId !== ALL_RINKS_TAB_ID ? rinks.find(rink => rink.id === selectedRinkId) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-700 text-gray-100 p-4 sm:p-6 md:p-8">
      <header className="mb-6 text-center">
        <div className="flex items-center justify-center mb-2">
          <CalendarIcon className="w-10 h-10 mr-3 text-sky-400" />
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-cyan-300">
            Denver Rink Schedule
          </h1>
        </div>
        <p className="text-sm text-slate-400 italic max-w-2xl mx-auto">
          View and filter ice times. Toggle between mock data and live scraping.
        </p>
      </header>

      <div className="max-w-6xl mx-auto bg-slate-800 shadow-2xl rounded-lg overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-700">
          <RinkTabs
            rinks={rinks}
            selectedRinkId={selectedRinkId}
            onSelectRink={handleRinkSelect}
            allRinksTabId={ALL_RINKS_TAB_ID}
          />
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center justify-center w-full sm:w-auto px-4 py-2 text-sm font-medium text-slate-200 bg-slate-700 hover:bg-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-75 transition-colors"
                aria-expanded={showFilters}
                aria-controls="filter-panel"
              >
                <AdjustmentsHorizontalIcon className="w-5 h-5 mr-2" />
                {showFilters ? 'Hide Filters' : 'Show Filters'}
                {(filterSettings.activeCategories.length > 0) && !showFilters && (
                  <span className="ml-2 bg-sky-500 text-sky-100 text-xs font-bold px-2 py-0.5 rounded-full">
                    {filterSettings.activeCategories.length} active 
                  </span>
                )}
              </button>
              
              <button
                onClick={handleToggleLiveData}
                className={`flex items-center justify-center w-full sm:w-auto px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-opacity-75 transition-colors ${
                  useLiveData 
                    ? 'text-green-200 bg-green-600 hover:bg-green-500 focus:ring-green-500' 
                    : 'text-orange-200 bg-orange-600 hover:bg-orange-500 focus:ring-orange-500'
                }`}
                title={useLiveData ? 'Using live scraped data' : 'Using mock data'}
              >
                <div className={`w-2 h-2 rounded-full mr-2 ${useLiveData ? 'bg-green-300' : 'bg-orange-300'}`} />
                {useLiveData ? 'Live Data' : 'Mock Data'}
                {useLiveData && scrapedDataCache.length > 0 && (
                  <span className="ml-2 text-xs opacity-75">
                    (cached)
                  </span>
                )}
              </button>
            </div>

            <button
              onClick={handleRefreshData}
              disabled={isLoading}
              className="flex items-center justify-center w-full sm:w-auto px-4 py-2 text-sm font-medium text-sky-200 bg-sky-600 hover:bg-sky-500 disabled:bg-sky-800 disabled:text-sky-400 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-75 transition-colors"
              title={useLiveData ? "Force refresh from live websites" : "Refresh mock data"}
            >
              <RefreshIcon className={`w-5 h-5 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Loading...' : 'Refresh Data'}
            </button>
          </div>
            {showFilters && (
              <div id="filter-panel" className="mt-4 p-4 bg-slate-700/50 rounded-md">
                <FilterControls
                  allCategories={allPossibleCategories}
                  currentFilterSettings={filterSettings}
                  onFilterSettingsChange={handleFilterSettingsChange}
                />
              </div>
            )}
        </div>
        
        <div className="p-6 min-h-[400px]">
          {selectedRinkInfo && (
            <div className="mb-6 p-4 border border-slate-700 rounded-lg bg-slate-700/50">
              <h2 className="text-2xl font-semibold text-sky-300 mb-1">{selectedRinkInfo.name}</h2>
              <p className="text-sm text-slate-400">
                Source: <a href={selectedRinkInfo.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:text-sky-300 underline transition-colors">
                  {selectedRinkInfo.sourceUrl}
                </a>
              </p>
              {useLiveData && (
                <p className="text-xs text-green-400 mt-1">
                  🔄 Live data {scrapedDataCache.length > 0 ? `(cached ${Math.round((Date.now() - lastScrapeTime) / 60000)}m ago)` : ''}
                </p>
              )}
            </div>
          )}
           {selectedRinkId === ALL_RINKS_TAB_ID && (
             <div className="mb-6 p-4 border border-slate-700 rounded-lg bg-slate-700/50">
               <h2 className="text-2xl font-semibold text-sky-300 mb-1">All Rinks View</h2>
               <p className="text-sm text-slate-400">
                 Showing events from all configured rinks. {useLiveData ? 'Live scraped data' : 'Mock data for demonstration'}.
               </p>
               {useLiveData && scrapedDataCache.length > 0 && (
                 <p className="text-xs text-green-400 mt-1">
                   📊 {scrapedDataCache.length} total events cached
                 </p>
               )}
             </div>
           )}

          {isLoading && (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <LoadingIcon className="w-12 h-12 mb-4" />
              <p className="text-lg">{useLiveData ? 'Scraping live data...' : 'Loading schedule...'}</p>
              {useLiveData && <p className="text-sm text-slate-500">This may take a few seconds</p>}
            </div>
          )}

          {!isLoading && error && (
            <div className="flex flex-col items-center justify-center h-64 text-red-400 bg-red-900/20 p-6 rounded-md">
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mb-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
              <p className="text-lg font-semibold">Error Loading Data</p>
              <p className="text-sm">{error}</p>
              <button 
                onClick={() => setUseLiveData(false)}
                className="mt-2 px-3 py-1 text-xs bg-slate-600 hover:bg-slate-500 rounded"
              >
                Switch to Mock Data
              </button>
            </div>
          )}
          
          {!isLoading && !error && events.length === 0 && (
             <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 mb-4 text-slate-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5v-.008ZM9.75 12h.008v.008H9.75v-.008ZM7.5 12h.008v.008H7.5v-.008ZM14.25 15h.008v.008H14.25v-.008ZM14.25 12h.008v.008H14.25v-.008ZM16.5 15h.008v.008H16.5v-.008ZM16.5 12h.008v.008H16.5v-.008Z" />
              </svg>
              <p className="text-lg">No events found.</p>
              <p className="text-sm text-slate-500">
                {useLiveData ? 'Try switching to mock data or check if websites are accessible.' : 'Try adjusting filters or refreshing data.'}
              </p>
            </div>
          )}

          {!isLoading && !error && events.length > 0 && (
            <EventList events={events} />
          )}
        </div>
      </div>
      <footer className="text-center mt-8 text-sm text-slate-500">
        <p>&copy; {new Date().getFullYear()} Denver Rink Schedule. {useLiveData ? 'Live scraped data' : 'Mock data used'}.</p>
        <p className="mt-1">Frontend scraping powered by CORS proxy. Toggle between mock and live data above.</p>
      </footer>
    </div>
  );
};

export default App;
