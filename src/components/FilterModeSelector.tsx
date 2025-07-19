import React from 'react';

interface FilterModeSelectorProps<T extends string> {
  modes: { value: T; label: string }[];
  selectedValue: T;
  onChange: (value: T) => void;
  name?: string;
}

function FilterModeSelector<T extends string>({
  modes,
  selectedValue,
  onChange,
  name = 'filter-mode'
}: FilterModeSelectorProps<T>) {
  return (
    <div className="flex flex-wrap gap-2">
      {modes.map(mode => (
        <label key={mode.value} className="flex items-center space-x-2 cursor-pointer">
          <input
            type="radio"
            name={name}
            value={mode.value}
            checked={selectedValue === mode.value}
            onChange={() => onChange(mode.value)}
            className="form-radio h-4 w-4 text-sky-600 bg-slate-800 border-slate-600 focus:ring-sky-500"
          />
          <span className="text-sm text-slate-300">{mode.label}</span>
        </label>
      ))}
    </div>
  );
}

export default FilterModeSelector;
