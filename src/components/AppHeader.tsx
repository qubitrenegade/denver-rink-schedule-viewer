import React from 'react';
import { CalendarIcon, AdjustmentsHorizontalIcon } from './icons';

interface AppHeaderProps {
  showFilters: boolean;
  onToggleFilters: () => void;
  onToggleAbout: () => void;
  hasActiveFilters: boolean;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  showFilters,
  onToggleFilters,
  onToggleAbout,
  hasActiveFilters
}) => {
  return (
    <header className="bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-6">
          <div className="flex items-center">
            <CalendarIcon className="h-8 w-8 mr-3" />
            <h1 className="text-2xl font-bold">Denver Rink Schedule Viewer</h1>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={onToggleFilters}
              className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                showFilters
                  ? 'bg-blue-700 text-white'
                  : hasActiveFilters
                  ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              <AdjustmentsHorizontalIcon className="h-5 w-5 mr-2" />
              Filters
              {hasActiveFilters && !showFilters && (
                <span className="ml-2 px-2 py-1 text-xs bg-white text-yellow-600 rounded-full">
                  Active
                </span>
              )}
            </button>
            <button
              onClick={onToggleAbout}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              About
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;