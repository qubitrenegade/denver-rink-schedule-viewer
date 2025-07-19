import React from 'react';
import { DateFilterMode } from '../types';
import FilterSection from './FilterSection';
import FilterModeSelector from './FilterModeSelector';
import EnhancedTimeInput from './EnhancedTimeInput';

interface DateFilterProps {
  dateFilterMode: DateFilterMode;
  numberOfDays?: number;
  selectedDate?: string;
  dateRangeStart?: string;
  dateRangeEnd?: string;
  onDateFilterModeChange: (mode: DateFilterMode) => void;
  onNumberOfDaysChange: (days: number) => void;
  onSelectedDateChange: (date: string) => void;
  onDateRangeChange: (start?: string, end?: string) => void;
}

const DateFilter: React.FC<DateFilterProps> = ({
  dateFilterMode,
  numberOfDays = 4,
  selectedDate,
  dateRangeStart,
  dateRangeEnd,
  onDateFilterModeChange,
  onNumberOfDaysChange,
  onSelectedDateChange,
  onDateRangeChange,
}) => {
  const renderDateControls = () => {
    switch (dateFilterMode) {
      case 'next-days':
        return (
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={numberOfDays}
              onChange={(e) => onNumberOfDaysChange(parseInt(e.target.value, 10))}
              className="w-20 bg-slate-800 border-slate-600 rounded-md p-2 text-center"
              min="1"
              max="30"
            />
            <span className="text-slate-400">days</span>
          </div>
        );
      case 'specific-day':
        return (
          <EnhancedTimeInput
            type="date"
            value={selectedDate || ''}
            onChange={(e) => onSelectedDateChange(e.target.value)}
          />
        );
      case 'date-range':
        return (
          <div className="flex flex-col sm:flex-row gap-2">
            <EnhancedTimeInput
              type="date"
              value={dateRangeStart || ''}
              onChange={(e) => onDateRangeChange(e.target.value, dateRangeEnd)}
              aria-label="Start Date"
            />
            <span className="text-slate-400 self-center">to</span>
            <EnhancedTimeInput
              type="date"
              value={dateRangeEnd || ''}
              onChange={(e) => onDateRangeChange(dateRangeStart, e.target.value)}
              aria-label="End Date"
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <FilterSection title="📅 Filter by Date">
      <FilterModeSelector
        name="date-filter-mode"
        modes={[
          { value: 'next-days', label: 'Next X Days' },
          { value: 'specific-day', label: 'Specific Day' },
          { value: 'date-range', label: 'Date Range' },
        ]}
        selectedValue={dateFilterMode}
        onChange={onDateFilterModeChange}
      />
      <div className="pl-6">
        {renderDateControls()}
      </div>
    </FilterSection>
  );
};

export default DateFilter;
