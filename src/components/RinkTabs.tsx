import React from 'react';
import { RinkInfo } from '../types';

interface RinkTabsProps {
  rinks: RinkInfo[];
  selectedRinkId: string | null;
  onSelectRink: (rinkId: string) => void;
  allRinksTabId: string;
}

// Tab navigation for rink selection
const RinkTabs: React.FC<RinkTabsProps> = ({ rinks, selectedRinkId, onSelectRink, allRinksTabId }) => {
  // Compose tab list: All Rinks + individual rinks
  const tabs = [
    { id: allRinksTabId, name: 'All Rinks' },
    ...rinks,
  ];

  return (
    <div className="border-b border-slate-600">
      <nav className="-mb-px flex space-x-1 sm:space-x-2 px-1 sm:px-0 overflow-x-auto" aria-label="Tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onSelectRink(tab.id)}
            className={`
              whitespace-nowrap shrink-0 py-3 px-3 sm:py-4 sm:px-4 border-b-2 font-medium text-sm sm:text-base transition-all duration-150 ease-in-out
              focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50 rounded-t-md
              ${
                selectedRinkId === tab.id
                  ? 'border-sky-400 text-sky-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-500'
              }
            `}
            aria-current={selectedRinkId === tab.id ? 'page' : undefined}
          >
            {tab.name}
          </button>
        ))}
      </nav>
    </div>
  );
};

export default RinkTabs;
