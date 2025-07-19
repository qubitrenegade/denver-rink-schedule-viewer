import React from 'react';
import { CalendarIcon } from './icons';
import HeaderActions from './HeaderActions';

interface AppHeaderProps {
  filterDescription: string;
  onShowAbout: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({ filterDescription, onShowAbout }) => {
  return (
    <header className="mb-6 text-center">
      <div className="max-w-6xl mx-auto mb-4">
        <img
          src="/images/header.webp"
          alt="Denver Rink Schedule"
          className="w-full max-h-48 object-contain rounded-lg shadow-lg"
        />
      </div>
      <div className="flex items-center justify-center mb-2">
        <CalendarIcon className="w-10 h-10 mr-3 text-sky-400" />
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-cyan-300">
          Denver Rink Schedule
        </h1>
      </div>
      <p className="text-sm text-slate-400 italic max-w-2xl mx-auto">
        {filterDescription} Data is refreshed regularly by our automated backend.
      </p>
      <HeaderActions onShowAbout={onShowAbout} />
    </header>
  );
};

export default AppHeader;