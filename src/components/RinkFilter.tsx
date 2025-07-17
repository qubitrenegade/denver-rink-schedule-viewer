import React from 'react';
import { RinkInfo, FilterMode, RinkFilterType } from '../types';

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
    <div>
      <h3 className="text-lg font-medium text-sky-300 mb-2">🏒 Filter by Rink</h3>
      
      {/* Rink Filter Type Toggle */}
      <div className="mb-3">
        <p className="text-sm text-slate-400 mb-1">Filter Type:</p>
        <div className="flex space-x-2">
          {(['facilities', 'individual-rinks'] as RinkFilterType[]).map((type) => (
            <label key={`rink-type-${type}`} className="flex items-center space-x-1.5 cursor-pointer p-2 rounded-md hover:bg-slate-600/50 transition-colors">
              <input
                type="radio"
                name="rinkFilterType"
                value={type}
                checked={rinkFilterType === type}
                onChange={() => onRinkFilterTypeChange(type)}
                className="h-4 w-4 text-sky-500 border-slate-500 focus:ring-sky-400 bg-slate-600"
              />
              <span className="text-sm text-slate-300">
                {type === 'facilities' ? 'By Facility' : 'Individual Rinks'}
              </span>
            </label>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-1">
          {rinkFilterType === 'facilities' 
            ? 'Filter by entire facilities (e.g., all rinks at Apex Ice Arena)' 
            : 'Filter by specific individual rinks (e.g., Apex East Rink only)'}
        </p>
      </div>

      {/* Rink Filter Mode */}
      <div className="mb-3">
        <p className="text-sm text-slate-400 mb-1">Filter Mode:</p>
        <div className="flex space-x-2">
          {(['exclude', 'include'] as FilterMode[]).map((mode) => (
            <label key={`rink-mode-${mode}`} className="flex items-center space-x-1.5 cursor-pointer p-2 rounded-md hover:bg-slate-600/50 transition-colors">
              <input
                type="radio"
                name="rinkFilterMode"
                value={mode}
                checked={rinkFilterMode === mode}
                onChange={() => onRinkFilterModeChange(mode)}
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
      
      {/* Select/Deselect All Buttons */}
      <div className="flex space-x-2 mb-3">
        <button
          onClick={() => onToggleAllRinks(true)}
          className="px-3 py-1 text-xs font-medium text-sky-200 bg-sky-600/50 hover:bg-sky-500/50 rounded-md transition-colors"
        >
          {getSelectAllRinksLabel()}
        </button>
        <button
          onClick={() => onToggleAllRinks(false)}
          className="px-3 py-1 text-xs font-medium text-rose-200 bg-rose-600/50 hover:bg-rose-500/50 rounded-md transition-colors"
        >
          {getDeselectAllRinksLabel()}
        </button>
      </div>
      
      {/* Rink Selection Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {rinksToShow.map((rink) => (
          <label
            key={rink.id}
            className="flex items-center space-x-2 p-2 bg-slate-800 hover:bg-slate-600/50 rounded-md cursor-pointer transition-colors"
            title={rinkFilterMode === 'exclude' ? `Check to hide ${rink.name}` : `Check to include ${rink.name}`}
          >
            <input
              type="checkbox"
              className="h-4 w-4 rounded text-sky-500 border-slate-500 focus:ring-sky-400 bg-slate-600 checked:bg-sky-500"
              checked={activeRinkIds.includes(rink.id)}
              onChange={() => onRinkToggle(rink.id)}
            />
            <span className="text-sm text-slate-200">{rink.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
};

export default RinkFilter;
