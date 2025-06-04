import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TimeFilter from './TimeFilter';

describe('TimeFilter', () => {
  it('calls onChange when a time range is selected', () => {
    const onChange = vi.fn();
    render(
      <TimeFilter
        timeFilterMode="time-range"
        onTimeFilterModeChange={() => { /* no-op for test */ }}
        timeRangeStart="08:00"
        timeRangeEnd="10:00"
        onTimeRangeChange={onChange}
        afterTime={undefined}
        beforeTime={undefined}
        onAfterTimeChange={() => { /* no-op for test */ }}
        onBeforeTimeChange={() => { /* no-op for test */ }}
      />
    );
    const startInput = screen.getByLabelText(/start time/i);
    fireEvent.change(startInput, { target: { value: '09:00' } });
    expect(onChange).toHaveBeenCalled();
  });
});
