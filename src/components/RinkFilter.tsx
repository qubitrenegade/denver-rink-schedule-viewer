import React from 'react';
import { RinkInfo, FilterMode, RinkFilterType } from '../types';
import FilterSection from './FilterSection';
import FilterModeSelector from './FilterModeSelector';

interface RinkFilterProps {
  allRinks: RinkInfo[];
  facilitiesRinks: RinkInfo[];
  activeRinkIds: string[];
  rinkFilterMode: FilterMode;
  rinkFilterType: RinkFilterType;
  onRinkToggle: (rinkId: string) => void;
  onRinkFilterModeChange: (mode: FilterMode) => void;
  onRinkFilterTypeChange: (type: RinkFilterType) => void;
  onToggleAllRinks: (selectAll: boolean) => void;
  getSelectAllRinksLabel: () => string;
  getDeselectAllRinksLabel: () => string;
}

const RinkFilter: React.FC<RinkFilterProps> = ({
  allRinks,
  facilitiesRinks,
  activeRinkIds,
  rinkFilterMode,
  rinkFilterType,
  onRinkToggle,
  onRinkFilterModeChange,
  onRinkFilterTypeChange,
  onToggleAllRinks,
  getSelectAllRinksLabel,
  getDeselectAllRinksLabel,
}) => {
  const rinksToShow = rinkFilterType === 'facilities' ? facilitiesRinks : allRinks;

  return (
    <FilterSection title="🏒 Filter by Rink">
      <FilterModeSelector
        name="rink-type-mode"
        modes={[
          { value: 'facilities', label: 'By Facility' },
          { value: 'individual-rinks', label: 'By Individual Rink' },
        ]}
        selectedValue={rinkFilterType}
        onChange={onRinkFilterTypeChange}
      />
      <div className="pl-6">
        <FilterModeSelector
          name="rink-filter-mode"
          modes={[
            { value: 'exclude', label: 'Exclude Selected' },
            { value: 'include', label: 'Include Selected' },
          ]}
          selectedValue={rinkFilterMode}
          onChange={onRinkFilterModeChange}
        />
      </div>
      <div className="flex space-x-2">
        <button onClick={() => onToggleAllRinks(true)} className="text-xs text-sky-400 hover:underline">{getSelectAllRinksLabel()}</button>
        <button onClick={() => onToggleAllRinks(false)} className="text-xs text-sky-400 hover:underline">{getDeselectAllRinksLabel()}</button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {rinksToShow.map((rink) => (
          <label key={rink.id} className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={activeRinkIds.includes(rink.id)}
              onChange={() => onRinkToggle(rink.id)}
              className="form-checkbox h-4 w-4 rounded text-sky-600 bg-slate-800 border-slate-600 focus:ring-sky-500"
            />
            <span className="text-sm text-slate-300">{rink.name}</span>
          </label>
        ))}
      </div>
    </FilterSection>
  );
};

export default RinkFilter;
