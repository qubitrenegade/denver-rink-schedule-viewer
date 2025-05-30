import React from 'react';
import { DateFilterMode } from '../types';

interface DateFilterProps {
  dateFilterMode: DateFilterMode;
  numberOfDays: number;
  selectedDate?: string;
  dateRangeStart?: string;
  dateRangeEnd?: string;
  onDateFilterModeChange: (mode: DateFilterMode) => void;
  onNumberOfDaysChange: (days: number) => void;
  onSelectedDateChange: (date: string) => void;
  onDateRangeChange: (start?: string, end?: string) => void;
}

const getTodayString = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

const getDateXDaysFromNow = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};

const DateFilter: React.FC<DateFilterProps> = ({
  dateFilterMode,
  numberOfDays,
  selectedDate,
  dateRangeStart,
  dateRangeEnd,
  onDateFilterModeChange,
  onNumberOfDaysChange,
  onSelectedDateChange,
  onDateRangeChange,
}) => (
  <div>
    <h3 className="text-lg font-medium text-sky-300 mb-3">📅 Filter by Date</h3>
    <div className="mb-4">
      <p className="text-sm text-slate-400 mb-2">Date Filter Mode:</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {(['next-days', 'specific-day', 'date-range'] as DateFilterMode[]).map((mode) => (
          <label key={mode} className="flex items-center space-x-2 cursor-pointer p-3 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors">
            <input
              type="radio"
              name="dateFilterMode"
              value={mode}
              checked={dateFilterMode === mode}
              onChange={() => onDateFilterModeChange(mode)}
              className="h-4 w-4 text-sky-500 border-slate-500 focus:ring-sky-400 bg-slate-600"
            />
            <span className="text-sm text-slate-300">
              {mode === 'next-days' ? 'Next X Days' : mode === 'specific-day' ? 'Specific Day' : 'Date Range'}
            </span>
          </label>
        ))}
      </div>
    </div>
    {dateFilterMode === 'next-days' && (
      <div className="bg-slate-800 p-4 rounded-md">
        <label className="block text-sm text-slate-300 mb-2">Number of days to show:</label>
        <div className="flex items-center space-x-4">
          <input
            type="range"
            min="1"
            max="14"
            value={numberOfDays}
            onChange={e => onNumberOfDaysChange(parseInt(e.target.value))}
            className="flex-1 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer slider"
          />
          <span className="text-sky-300 font-medium min-w-[3rem] text-center">
            {numberOfDays} {numberOfDays === 1 ? 'day' : 'days'}
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Showing events from today through {getDateXDaysFromNow(numberOfDays - 1)}
        </p>
      </div>
    )}
    {dateFilterMode === 'specific-day' && (
      <div className="bg-slate-800 p-4 rounded-md">
        <label className="block text-sm text-slate-300 mb-2">Select specific date:</label>
        <input
          type="date"
          value={selectedDate || getTodayString()}
          onChange={e => onSelectedDateChange(e.target.value)}
          className="w-full px-3 py-2 bg-slate-600 border border-slate-500 text-slate-200 rounded-md focus:ring-2 focus:ring-sky-400 focus:border-sky-400"
        />
      </div>
    )}
    {dateFilterMode === 'date-range' && (
      <div className="bg-slate-800 p-4 rounded-md space-y-3">
        <div>
          <label className="block text-sm text-slate-300 mb-2">Start date:</label>
          <input
            type="date"
            value={dateRangeStart || getTodayString()}
            onChange={e => onDateRangeChange(e.target.value, undefined)}
            className="w-full px-3 py-2 bg-slate-600 border border-slate-500 text-slate-200 rounded-md focus:ring-2 focus:ring-sky-400 focus:border-sky-400"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-2">End date:</label>
          <input
            type="date"
            value={dateRangeEnd || getDateXDaysFromNow(7)}
            onChange={e => onDateRangeChange(undefined, e.target.value)}
            className="w-full px-3 py-2 bg-slate-600 border border-slate-500 text-slate-200 rounded-md focus:ring-2 focus:ring-sky-400 focus:border-sky-400"
          />
        </div>
      </div>
    )}
  </div>
);

export default DateFilter;
