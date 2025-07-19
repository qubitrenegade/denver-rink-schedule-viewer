import React from 'react';

interface FilterSectionProps {
  title: string;
  children: React.ReactNode;
}

const FilterSection: React.FC<FilterSectionProps> = ({ title, children }) => (
  <div className="p-4 bg-slate-700/50 rounded-lg">
    <h3 className="text-lg font-semibold text-sky-300 mb-3">{title}</h3>
    <div className="space-y-3">
      {children}
    </div>
  </div>
);

export default FilterSection;
