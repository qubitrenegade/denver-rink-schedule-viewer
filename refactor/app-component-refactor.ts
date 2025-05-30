// 🔴 ISSUE: App.tsx is 700+ lines and has too many responsibilities
// 
// CURRENT PROBLEMS:
// 1. 10+ useState hooks making state management complex
// 2. Large useEffect blocks handling multiple concerns
// 3. Complex filtering logic mixed with component logic
// 4. URL state management scattered throughout
// 5. Data fetching logic embedded in component

// ✅ RECOMMENDED REFACTOR: Break into smaller pieces

// 1. Extract data fetching to custom hook
export const useEventData = () => {
  const [staticData, setStaticData] = useState<RawIceEventData[]>([]);
  const [facilityMetadata, setFacilityMetadata] = useState<Record<string, FacilityMetadata>>({});
  const [facilityErrors, setFacilityErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (forceRefresh = false) => {
    // Move all data fetching logic here
    // This removes 100+ lines from App.tsx
  }, []);

  return {
    staticData,
    facilityMetadata,
    facilityErrors,
    isLoading,
    error,
    refetch: fetchData
  };
};

// 2. Extract filtering logic to custom hook
export const useEventFiltering = (
  events: RawIceEventData[],
  filterSettings: FilterSettings,
  selectedRinkId: string
) => {
  return useMemo(() => {
    // Move all filtering logic here
    // This removes another 100+ lines from App.tsx
    return filterAndDisplayEvents(selectedRinkId, filterSettings, events);
  }, [events, filterSettings, selectedRinkId]);
};

// 3. Extract URL state management
export const useUrlState = () => {
  const [selectedRinkId, setSelectedRinkId] = useState<UrlViewType>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('view') || ALL_RINKS_TAB_ID;
  });

  const [filterSettings, setFilterSettings] = useState<FilterSettings>(() => {
    // Extract URL parsing logic
    return parseFiltersFromUrl();
  });

  // Handle URL updates
  useEffect(() => {
    updateUrlFromState(selectedRinkId, filterSettings);
  }, [selectedRinkId, filterSettings]);

  return {
    selectedRinkId,
    setSelectedRinkId,
    filterSettings,
    setFilterSettings
  };
};

// 4. Create smaller, focused components
const EventDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const eventData = useEventData();
  return (
    <EventDataContext.Provider value={eventData}>
      {children}
    </EventDataContext.Provider>
  );
};

const FilterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const urlState = useUrlState();
  return (
    <FilterContext.Provider value={urlState}>
      {children}
    </FilterContext.Provider>
  );
};

// 5. Simplified main App component
const App: React.FC = () => {
  return (
    <EventDataProvider>
      <FilterProvider>
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-700">
          <AppHeader />
          <MainContent />
          <AppFooter />
        </div>
      </FilterProvider>
    </EventDataProvider>
  );
};

// BENEFITS:
// - App.tsx reduced from 700+ to ~50 lines
// - Each hook has single responsibility
// - Easier testing of individual pieces
// - Better code reuse
// - Clearer separation of concerns