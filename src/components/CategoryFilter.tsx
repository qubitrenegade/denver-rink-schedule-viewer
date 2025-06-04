import React from 'react';
import { EventCategory, FilterMode } from '../types';

interface CategoryFilterProps {
  allCategories: EventCategory[];
  activeCategories: EventCategory[];
  filterMode: FilterMode;
  onCategoryToggle: (category: EventCategory) => void;
  onCategoryModeChange: (mode: FilterMode) => void;
  onToggleAllCategories: (selectAll: boolean) => void;
  getSelectAllCategoriesLabel: () => string;
  getDeselectAllCategoriesLabel: () => string;
}

const CategoryFilter: React.FC<CategoryFilterProps> = ({
  allCategories,
  activeCategories,
  filterMode,
  onCategoryToggle,
  onCategoryModeChange,
  onToggleAllCategories,
  getSelectAllCategoriesLabel,
  getDeselectAllCategoriesLabel,
}) => (
  <div>
    <h3 className="text-lg font-medium text-sky-300 mb-2">🏷️ Filter by Category</h3>
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
              onChange={() => onCategoryModeChange(mode)}
              className="h-4 w-4 text-sky-500 border-slate-500 focus:ring-sky-400 bg-slate-600"
            />
            <span className="text-sm text-slate-300">
              {mode === 'exclude' ? 'Exclude Selected' : 'Include Selected'}
            </span>
          </label>
        ))}
      </div>
    </div>
    <div className="flex space-x-2 mb-3">
      <button
        onClick={() => onToggleAllCategories(true)}
        className="px-3 py-1 text-xs font-medium text-sky-200 bg-sky-600/50 hover:bg-sky-500/50 rounded-md transition-colors"
      >
        {getSelectAllCategoriesLabel()}
      </button>
      <button
        onClick={() => onToggleAllCategories(false)}
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
        >
          <input
            type="checkbox"
            className="h-4 w-4 rounded text-sky-500 border-slate-500 focus:ring-sky-400 bg-slate-600 checked:bg-sky-500"
            checked={activeCategories.includes(category)}
            onChange={() => onCategoryToggle(category)}
          />
          <span className="text-sm text-slate-200">{category}</span>
        </label>
      ))}
    </div>
  </div>
);

export default CategoryFilter;
