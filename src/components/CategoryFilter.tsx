import React from 'react';
import { EventCategory, FilterMode } from '../types';
import FilterSection from './FilterSection';
import FilterModeSelector from './FilterModeSelector';

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
}) => {
  return (
    <FilterSection title="🏷️ Filter by Category">
      <FilterModeSelector
        name="category-filter-mode"
        modes={[
          { value: 'exclude', label: 'Exclude Selected' },
          { value: 'include', label: 'Include Selected' },
        ]}
        selectedValue={filterMode}
        onChange={onCategoryModeChange}
      />
      <div className="flex space-x-2">
        <button onClick={() => onToggleAllCategories(true)} className="text-xs text-sky-400 hover:underline">{getSelectAllCategoriesLabel()}</button>
        <button onClick={() => onToggleAllCategories(false)} className="text-xs text-sky-400 hover:underline">{getDeselectAllCategoriesLabel()}</button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {allCategories.map((category) => (
          <label key={category} className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={activeCategories.includes(category)}
              onChange={() => onCategoryToggle(category)}
              className="form-checkbox h-4 w-4 rounded text-sky-600 bg-slate-800 border-slate-600 focus:ring-sky-500"
            />
            <span className="text-sm text-slate-300">{category}</span>
          </label>
        ))}
      </div>
    </FilterSection>
  );
};

export default CategoryFilter;
