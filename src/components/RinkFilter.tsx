import React from 'react';
import { RinkInfo, FilterMode } from '../types';

interface RinkFilterProps {
  allRinks: RinkInfo[];
  activeRinkIds: string[];
  rinkFilterMode: FilterMode;
  onRinkToggle: (rinkId: string) => void;
  onRinkFilterModeChange: (mode: FilterMode) => void;
  onToggleAllRinks: (selectAll: boolean) => void;
  getSelectAllRinksLabel: () => string;
  getDeselectAllRinksLabel: () => string;
}

const RinkFilter: React.FC<RinkFilterProps> = ({
  allRinks,
  activeRinkIds,
  rinkFilterMode,
  onRinkToggle,
  onRinkFilterModeChange,
  onToggleAllRinks,
  getSelectAllRinksLabel,
  getDeselectAllRinksLabel,
}) => (
  <div>
    <h3 className="text-lg font-medium text-sky-300 mb-2">🏒 Filter by Rink</h3>
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
            onChange={() => onRinkToggle(rink.id)}
          />
          <span className="text-sm text-slate-200">{rink.name}</span>
        </label>
      ))}
    </div>
  </div>
);

export default RinkFilter;
