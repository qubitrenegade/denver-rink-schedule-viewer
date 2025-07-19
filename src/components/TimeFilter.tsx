import React from 'react';
import { TimeFilterMode } from '../types';
import FilterSection from './FilterSection';
import FilterModeSelector from './FilterModeSelector';
import EnhancedTimeInput from './EnhancedTimeInput';

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
}) => {
  const renderTimeControls = () => {
    switch (timeFilterMode) {
      case 'after-time':
        return (
          <EnhancedTimeInput
            value={afterTime || ''}
            onChange={(e) => onAfterTimeChange(e.target.value)}
          />
        );
      case 'before-time':
        return (
          <EnhancedTimeInput
            value={beforeTime || ''}
            onChange={(e) => onBeforeTimeChange(e.target.value)}
          />
        );
      case 'time-range':
        return (
          <div className="flex flex-col sm:flex-row gap-2">
            <EnhancedTimeInput
              value={timeRangeStart || ''}
              onChange={(e) => onTimeRangeChange(e.target.value, timeRangeEnd)}
              aria-label="Start Time"
            />
            <span className="text-slate-400 self-center">to</span>
            <EnhancedTimeInput
              value={timeRangeEnd || ''}
              onChange={(e) => onTimeRangeChange(timeRangeStart, e.target.value)}
              aria-label="End Time"
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <FilterSection title="🕐 Filter by Time">
      <FilterModeSelector
        name="time-filter-mode"
        modes={[
          { value: 'all-times', label: 'All Times' },
          { value: 'after-time', label: 'After' },
          { value: 'before-time', label: 'Before' },
          { value: 'time-range', label: 'Range' },
        ]}
        selectedValue={timeFilterMode}
        onChange={onTimeFilterModeChange}
      />
      <div className="pl-6">
        {renderTimeControls()}
      </div>
    </FilterSection>
  );
};

export default TimeFilter;
