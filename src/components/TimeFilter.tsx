import React from 'react';
import { TimeFilterMode } from '../types';

interface TimeFilterProps {
  timeFilterMode: TimeFilterMode;
  afterTime?: string;
  beforeTime?: string;
  timeRangeStart?: string;
  timeRangeEnd?: string;
  onTimeFilterModeChange: (mode: TimeFilterMode) => void;
  onAfterTimeChange: (time: string) => void;
  onBeforeTimeChange: (time: string) => void;
  onTimeRangeChange: (start?: string, end?: string) => void;
}

const TimeFilter: React.FC<TimeFilterProps> = ({
  timeFilterMode,
  afterTime,
  beforeTime,
  timeRangeStart,
  timeRangeEnd,
  onTimeFilterModeChange,
  onAfterTimeChange,
  onBeforeTimeChange,
  onTimeRangeChange,
}) => (
  <div>
    <h3 className="text-lg font-medium text-sky-300 mb-3">🕐 Filter by Time</h3>
    <div className="mb-4">
      <p className="text-sm text-slate-400 mb-2">Time Filter Mode:</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {(['all-times', 'after-time', 'before-time', 'time-range'] as TimeFilterMode[]).map((mode) => (
          <label key={mode} className="flex items-center space-x-2 cursor-pointer p-3 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors">
            <input
              type="radio"
              name="timeFilterMode"
              value={mode}
              checked={timeFilterMode === mode}
              onChange={() => onTimeFilterModeChange(mode)}
              className="h-4 w-4 text-sky-500 border-slate-500 focus:ring-sky-400 bg-slate-600"
            />
            <span className="text-xs text-slate-300">
              {mode === 'all-times' ? 'All Times' : 
               mode === 'after-time' ? 'After Time' : 
               mode === 'before-time' ? 'Before Time' :
               'Time Range'}
            </span>
          </label>
        ))}
      </div>
    </div>
    {timeFilterMode === 'after-time' && (
      <div className="bg-slate-800 p-4 rounded-md">
        <label className="block text-sm text-slate-300 mb-2">Show events starting after:</label>
        <input
          type="time"
          value={afterTime || '15:00'}
          onChange={e => onAfterTimeChange(e.target.value)}
          className="w-full px-3 py-2 bg-slate-600 border border-slate-500 text-slate-200 rounded-md focus:ring-2 focus:ring-sky-400 focus:border-sky-400"
        />
        <p className="text-xs text-slate-500 mt-2">
          Only events starting at or after {afterTime || '15:00'} will be shown
        </p>
      </div>
    )}
    {timeFilterMode === 'before-time' && (
      <div className="bg-slate-800 p-4 rounded-md">
        <label className="block text-sm text-slate-300 mb-2">Show events starting before:</label>
        <input
          type="time"
          value={beforeTime || '18:00'}
          onChange={e => onBeforeTimeChange(e.target.value)}
          className="w-full px-3 py-2 bg-slate-600 border border-slate-500 text-slate-200 rounded-md focus:ring-2 focus:ring-sky-400 focus:border-sky-400"
        />
        <p className="text-xs text-slate-500 mt-2">
          Only events starting before {beforeTime || '18:00'} will be shown
        </p>
      </div>
    )}
    {timeFilterMode === 'time-range' && (
      <div className="bg-slate-800 p-4 rounded-md space-y-3">
        <div>
          <label className="block text-sm text-slate-300 mb-2">Start time:</label>
          <input
            type="time"
            value={timeRangeStart || '10:00'}
            onChange={e => onTimeRangeChange(e.target.value, undefined)}
            className="w-full px-3 py-2 bg-slate-600 border border-slate-500 text-slate-200 rounded-md focus:ring-2 focus:ring-sky-400 focus:border-sky-400"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-2">End time:</label>
          <input
            type="time"
            value={timeRangeEnd || '15:00'}
            onChange={e => onTimeRangeChange(undefined, e.target.value)}
            className="w-full px-3 py-2 bg-slate-600 border border-slate-500 text-slate-200 rounded-md focus:ring-2 focus:ring-sky-400 focus:border-sky-400"
          />
        </div>
        <p className="text-xs text-slate-500">
          Only events starting between {timeRangeStart || '10:00'} and {timeRangeEnd || '15:00'} will be shown
        </p>
      </div>
    )}
  </div>
);

export default TimeFilter;
