// 🔴 CURRENT ISSUES WITH FilterControls.tsx:
// 1. 300+ line component with too many responsibilities
// 2. Repetitive form handling patterns
// 3. Complex nested conditionals for UI state
// 4. Duplicated validation logic
// 5. Hard to test individual filter types

// ✅ PROPOSED REFACTOR: Break into smaller, focused components

// 1. Create reusable form components
interface FilterSectionProps {
  title: string;
  icon: string;
  children: React.ReactNode;
}

const FilterSection: React.FC<FilterSectionProps> = ({ title, icon, children }) => (
  <div className="space-y-4">
    <h3 className="text-lg font-medium text-sky-300 mb-3">
      {icon} {title}
    </h3>
    {children}
  </div>
);

// 2. Date filter as separate component
interface DateFilterProps {
  dateFilterMode: DateFilterMode;
  numberOfDays?: number;
  selectedDate?: string;
  dateRangeStart?: string;
  dateRangeEnd?: string;
  onChange: (updates: Partial<FilterSettings>) => void;
}

const DateFilter: React.FC<DateFilterProps> = ({ 
  dateFilterMode, 
  numberOfDays = 4,
  selectedDate,
  dateRangeStart,
  dateRangeEnd,
  onChange 
}) => {
  const handleModeChange = (mode: DateFilterMode) => {
    onChange({ dateFilterMode: mode });
  };

  const renderDateControls = () => {
    switch (dateFilterMode) {
      case 'next-days':
        return <NextDaysControl value={numberOfDays} onChange={(days) => onChange({ numberOfDays: days })} />;
      case 'specific-day':
        return <SpecificDayControl value={selectedDate} onChange={(date) => onChange({ selectedDate: date })} />;
      case 'date-range':
        return (
          <DateRangeControl 
            startDate={dateRangeStart}
            endDate={dateRangeEnd}
            onChange={(start, end) => onChange({ dateRangeStart: start, dateRangeEnd: end })}
          />
        );
      default:
        return null;
    }
  };

  return (
    <FilterSection title="Filter by Date" icon="📅">
      <FilterModeSelector 
        modes={[
          { value: 'next-days', label: 'Next X Days' },
          { value: 'specific-day', label: 'Specific Day' },
          { value: 'date-range', label: 'Date Range' }
        ]}
        value={dateFilterMode}
        onChange={handleModeChange}
      />
      {renderDateControls()}
    </FilterSection>
  );
};

// 3. Reusable mode selector component
interface FilterMode {
  value: string;
  label: string;
}

interface FilterModeSelectorProps<T> {
  modes: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  name?: string;
}

function FilterModeSelector<T extends string>({ 
  modes, 
  value, 
  onChange, 
  name = 'filterMode' 
}: FilterModeSelectorProps<T>) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      {modes.map((mode) => (
        <label 
          key={mode.value} 
          className="flex items-center space-x-2 cursor-pointer p-3 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors"
        >
          <input
            type="radio"
            name={name}
            value={mode.value}
            checked={value === mode.value}
            onChange={() => onChange(mode.value)}
            className="h-4 w-4 text-sky-500 border-slate-500 focus:ring-sky-400 bg-slate-600"
          />
          <span className="text-sm text-slate-300">{mode.label}</span>
        </label>
      ))}
    </div>
  );
}

// 4. Extract individual control components
const NextDaysControl: React.FC<{ value: number; onChange: (value: number) => void }> = ({ 
  value, 
  onChange 
}) => (
  <div className="bg-slate-800 p-4 rounded-md">
    <label className="block text-sm text-slate-300 mb-2">
      Number of days to show:
    </label>
    <div className="flex items-center space-x-4">
      <input
        type="range"
        min="1"
        max="14"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="flex-1 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer slider"
      />
      <span className="text-sky-300 font-medium min-w-[3rem] text-center">
        {value} {value === 1 ? 'day' : 'days'}
      </span>
    </div>
  </div>
);

// 5. Custom hook for filter logic
export const useFilterState = (initialFilters: FilterSettings) => {
  const [filters, setFilters] = useState(initialFilters);

  const updateFilter = useCallback((updates: Partial<FilterSettings>) => {
    setFilters(prev => ({ ...prev, ...updates }));
  }, []);

  const toggleCategory = useCallback((category: EventCategory) => {
    setFilters(prev => ({
      ...prev,
      activeCategories: prev.activeCategories.includes(category)
        ? prev.activeCategories.filter(c => c !== category)
        : [...prev.activeCategories, category]
    }));
  }, []);

  const toggleAllCategories = useCallback((selectAll: boolean) => {
    setFilters(prev => ({
      ...prev,
      activeCategories: selectAll ? ALL_CATEGORIES : []
    }));
  }, []);

  return {
    filters,
    updateFilter,
    toggleCategory,
    toggleAllCategories
  };
};

// 6. Main FilterControls becomes a simple composition
const FilterControls: React.FC<FilterControlsProps> = ({
  allRinks,
  selectedRinkId,
  allCategories,
  currentFilterSettings,
  onFilterSettingsChange,
}) => {
  const { updateFilter, toggleCategory, toggleAllCategories } = useFilterLogic(
    currentFilterSettings,
    onFilterSettingsChange
  );

  return (
    <div className="space-y-6">
      <DateFilter
        dateFilterMode={currentFilterSettings.dateFilterMode}
        numberOfDays={currentFilterSettings.numberOfDays}
        selectedDate={currentFilterSettings.selectedDate}
        dateRangeStart={currentFilterSettings.dateRangeStart}
        dateRangeEnd={currentFilterSettings.dateRangeEnd}
        onChange={updateFilter}
      />

      <TimeFilter
        timeFilterMode={currentFilterSettings.timeFilterMode}
        afterTime={currentFilterSettings.afterTime}
        beforeTime={currentFilterSettings.beforeTime}
        timeRangeStart={currentFilterSettings.timeRangeStart}
        timeRangeEnd={currentFilterSettings.timeRangeEnd}
        onChange={updateFilter}
      />

      {selectedRinkId === ALL_RINKS_TAB_ID && (
        <RinkFilter
          rinks={allRinks}
          activeRinkIds={currentFilterSettings.activeRinkIds || []}
          filterMode={currentFilterSettings.rinkFilterMode || 'exclude'}
          onChange={updateFilter}
        />
      )}

      <CategoryFilter
        categories={allCategories}
        activeCategories={currentFilterSettings.activeCategories}
        filterMode={currentFilterSettings.filterMode}
        onToggleCategory={toggleCategory}
        onToggleAll={toggleAllCategories}
        onModeChange={(mode) => updateFilter({ filterMode: mode })}
      />
    </div>
  );
};

// BENEFITS:
// - FilterControls.tsx reduced from 300+ to ~50 lines
// - Each filter type is independently testable
// - Reusable components for similar filter patterns
// - Better separation of concerns
// - Easier to add new filter types
// - More maintainable and readable code