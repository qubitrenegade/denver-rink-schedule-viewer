
import React from 'react';
import { EventCategory, FilterSettings, FilterMode, RinkInfo } from '../types';
import { ALL_RINKS_TAB_ID } from '../App'; // Import for comparison

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
  const { activeCategories, filterMode, activeRinkIds = [], rinkFilterMode = 'exclude' } = currentFilterSettings;

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

  const handleCategoryModeChange = (newMode: FilterMode) => {
    onFilterSettingsChange({ ...currentFilterSettings, filterMode: newMode });
  };
  
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

  const handleRinkFilterModeChange = (newMode: FilterMode) => {
    onFilterSettingsChange({ ...currentFilterSettings, rinkFilterMode: newMode });
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
  }

  const getDeselectAllCategoriesLabel = () => {
    if (filterMode === 'include') return 'Include No Categories';
    return 'Exclude All Categories';
  }

  const handleToggleAllRinks = (selectAll: boolean) => {
    onFilterSettingsChange({
        ...currentFilterSettings,
        activeRinkIds: selectAll ? allRinks.map(r => r.id) : []
    });
  };

  const getSelectAllRinksLabel = () => {
    if (rinkFilterMode === 'include') return 'Include All Rinks';
    return 'Exclude No Rinks (Show All)';
  }

  const getDeselectAllRinksLabel = () => {
      if (rinkFilterMode === 'include') return 'Include No Rinks';
      return 'Exclude All Rinks';
  }


  return (
    <div className="space-y-6">
      {/* Rink Filter Section - Conditional Rendering */}
      {selectedRinkId === ALL_RINKS_TAB_ID && (
        <div>
          <h3 className="text-lg font-medium text-sky-300 mb-2">Filter by Rink</h3>
           <div className="mb-3">
            <p className="text-sm text-slate-400 mb-1">Rink Filter Mode:</p>
            <div className="flex space-x-2">
                {(['exclude', 'include'] as FilterMode[]).map((mode) => (
                    <label key={`rink-mode-${mode}`} className="flex items-center space-x-1.5 cursor-pointer p-2 rounded-md hover:bg-slate-600/50 transition-colors">
                        <input
                            type="radio"
                            name="rinkFilterMode"
                            value={mode}
                            checked={rinkFilterMode === mode}
                            onChange={() => handleRinkFilterModeChange(mode)}
                            className="h-4 w-4 text-sky-500 border-slate-500 focus:ring-sky-400 bg-slate-600"
                        />
                        <span className="text-sm text-slate-300">
                            {mode === 'exclude' ? 'Exclude Selected' : 'Include Selected'}
                        </span>
                    </label>
                ))}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {rinkFilterMode === 'exclude' ? 'Check a rink to HIDE its events.' : 'Check a rink to ONLY SHOW its events.'}
            </p>
          </div>
          <div className="flex space-x-2 mb-3">
            <button 
                onClick={() => handleToggleAllRinks(true)}
                className="px-3 py-1 text-xs font-medium text-sky-200 bg-sky-600/50 hover:bg-sky-500/50 rounded-md transition-colors"
            >
                {getSelectAllRinksLabel()}
            </button>
            <button 
                onClick={() => handleToggleAllRinks(false)}
                className="px-3 py-1 text-xs font-medium text-rose-200 bg-rose-600/50 hover:bg-rose-500/50 rounded-md transition-colors"
            >
                {getDeselectAllRinksLabel()}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {allRinks.map((rink) => (
              <label
                key={rink.id}
                className="flex items-center space-x-2 p-2 bg-slate-800 hover:bg-slate-600/50 rounded-md cursor-pointer transition-colors"
                title={rinkFilterMode === 'exclude' ? `Check to hide ${rink.name}` : `Check to include ${rink.name}`}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded text-sky-500 border-slate-500 focus:ring-sky-400 bg-slate-600 checked:bg-sky-500"
                  checked={activeRinkIds.includes(rink.id)}
                  onChange={() => handleRinkToggle(rink.id)}
                  aria-labelledby={`filter-rink-${rink.id}`}
                />
                <span id={`filter-rink-${rink.id}`} className="text-sm text-slate-300 select-none truncate" title={rink.name}>
                  {rink.name}
                </span>
              </label>
            ))}
          </div>
          {activeRinkIds.length > 0 && (
            <p className="text-xs text-slate-500 mt-3">
                {activeRinkIds.length} rink{activeRinkIds.length === 1 ? ' is' : 's are'} active in the rink filter.
            </p>
          )}
        </div>
      )}

      {/* Category Filter Section */}
      <div>
        <h3 className="text-lg font-medium text-sky-300 mb-2">Filter by Category</h3>
        <div className="mb-3">
            <p className="text-sm text-slate-400 mb-1">Category Filter Mode:</p>
            <div className="flex space-x-2">
                {(['exclude', 'include'] as FilterMode[]).map((mode) => (
                    <label key={`cat-mode-${mode}`} className="flex items-center space-x-1.5 cursor-pointer p-2 rounded-md hover:bg-slate-600/50 transition-colors">
                        <input
                            type="radio"
                            name="categoryFilterMode"
                            value={mode}
                            checked={filterMode === mode}
                            onChange={() => handleCategoryModeChange(mode)}
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
         <div className="flex space-x-2 mb-3">
            <button 
                onClick={() => handleToggleAllCategories(true)}
                className="px-3 py-1 text-xs font-medium text-sky-200 bg-sky-600/50 hover:bg-sky-500/50 rounded-md transition-colors"
            >
                {getSelectAllCategoriesLabel()}
            </button>
            <button 
                onClick={() => handleToggleAllCategories(false)}
                className="px-3 py-1 text-xs font-medium text-rose-200 bg-rose-600/50 hover:bg-rose-500/50 rounded-md transition-colors"
            >
                {getDeselectAllCategoriesLabel()}
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
                checked={activeCategories.includes(category)}
                onChange={() => handleCategoryToggle(category)}
                aria-labelledby={`filter-category-${category}`}
                />
                <span id={`filter-category-${category}`} className="text-sm text-slate-300 select-none">
                {category}
                </span>
            </label>
            ))}
        </div>
        {activeCategories.length > 0 && (
            <p className="text-xs text-slate-500 mt-3">
                {activeCategories.length} categor{activeCategories.length === 1 ? 'y is' : 'ies are'} active in the category filter.
            </p>
        )}
      </div>
    </div>
  );
};

export default FilterControls;