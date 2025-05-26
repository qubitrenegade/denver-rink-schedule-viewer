
import React from 'react';
import { EventCategory, FilterSettings, FilterMode } from '../types';

interface FilterControlsProps {
  allCategories: EventCategory[];
  currentFilterSettings: FilterSettings;
  onFilterSettingsChange: (newSettings: FilterSettings) => void;
}

const FilterControls: React.FC<FilterControlsProps> = ({
  allCategories,
  currentFilterSettings,
  onFilterSettingsChange,
}) => {
  const { activeCategories, filterMode } = currentFilterSettings;

  const handleCategoryToggle = (category: EventCategory) => {
    const newActiveCategories = [...activeCategories];
    const index = newActiveCategories.indexOf(category);
    if (index > -1) {
      newActiveCategories.splice(index, 1); // Remove if exists
    } else {
      newActiveCategories.push(category); // Add if doesn't exist
    }
    onFilterSettingsChange({ ...currentFilterSettings, activeCategories: newActiveCategories });
  };

  const handleModeChange = (newMode: FilterMode) => {
    onFilterSettingsChange({ ...currentFilterSettings, filterMode: newMode });
  };

  const handleToggleAllCategories = (selectAll: boolean) => {
    if (selectAll) {
      onFilterSettingsChange({ ...currentFilterSettings, activeCategories: [...allCategories] }); // Use spread for new array
    } else {
      onFilterSettingsChange({ ...currentFilterSettings, activeCategories: [] }); // Empty array
    }
  };
  
  const getSelectAllButtonLabel = () => {
    if (filterMode === 'include') return 'Include All';
    return 'Exclude None (Show All)';
  }

  const getDeselectAllButtonLabel = () => {
    if (filterMode === 'include') return 'Include None (Clear)';
    return 'Exclude All';
  }


  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium text-sky-300 mb-2">Filter Options</h3>
        <div className="mb-3">
            <p className="text-sm text-slate-400 mb-1">Filter Mode:</p>
            <div className="flex space-x-2">
                {(['exclude', 'include'] as FilterMode[]).map((mode) => (
                    <label key={mode} className="flex items-center space-x-1.5 cursor-pointer p-2 rounded-md hover:bg-slate-600/50 transition-colors">
                        <input
                            type="radio"
                            name="filterMode"
                            value={mode}
                            checked={filterMode === mode}
                            onChange={() => handleModeChange(mode)}
                            className="h-4 w-4 text-sky-500 border-slate-500 focus:ring-sky-400 bg-slate-600"
                        />
                        <span className="text-sm text-slate-300">
                            {mode === 'exclude' ? 'Exclude Selected' : 'Include Selected'}
                        </span>
                    </label>
                ))}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {filterMode === 'exclude' ? 'Check a category to HIDE its events.' : 'Check a category to ONLY SHOW its events.'}
            </p>
        </div>
        <p className="text-sm text-slate-400 mb-3">Categories:</p>
      </div>
      <div className="flex space-x-2 mb-3">
        <button 
            onClick={() => handleToggleAllCategories(true)}
            className="px-3 py-1 text-xs font-medium text-sky-200 bg-sky-600/50 hover:bg-sky-500/50 rounded-md transition-colors"
        >
            {getSelectAllButtonLabel()}
        </button>
        <button 
            onClick={() => handleToggleAllCategories(false)}
            className="px-3 py-1 text-xs font-medium text-rose-200 bg-rose-600/50 hover:bg-rose-500/50 rounded-md transition-colors"
        >
            {getDeselectAllButtonLabel()}
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {allCategories.map((category) => (
          <label
            key={category}
            className="flex items-center space-x-2 p-2 bg-slate-800 hover:bg-slate-600/50 rounded-md cursor-pointer transition-colors"
            title={filterMode === 'exclude' ? `Check to hide ${category}` : `Check to include ${category}`}
          >
            <input
              type="checkbox"
              className="h-4 w-4 rounded text-sky-500 border-slate-500 focus:ring-sky-400 bg-slate-600 checked:bg-sky-500"
              checked={activeCategories.includes(category)} // Changed from .has()
              onChange={() => handleCategoryToggle(category)}
              aria-labelledby={`filter-category-${category}`}
            />
            <span id={`filter-category-${category}`} className="text-sm text-slate-300 select-none">
              {category}
            </span>
          </label>
        ))}
      </div>
       {activeCategories.length > 0 && ( // Changed from .size
        <p className="text-xs text-slate-500 mt-3">
            {activeCategories.length} categor{activeCategories.length === 1 ? 'y is' : 'ies are'} active in the filter.
        </p>
      )}
    </div>
  );
};

export default FilterControls;