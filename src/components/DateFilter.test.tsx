import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DateFilter from './DateFilter';

describe('DateFilter', () => {
  it('calls onSelectedDateChange when a date is selected', () => {
    const onSelectedDateChange = vi.fn();
    render(
      <DateFilter
        dateFilterMode="specific-day"
        numberOfDays={4}
        selectedDate="2025-06-01"
        onDateFilterModeChange={() => {}}
        onNumberOfDaysChange={() => {}}
        onSelectedDateChange={onSelectedDateChange}
        onDateRangeChange={() => {}}
      />
    );
    const input = screen.getByLabelText(/select specific date/i);
    fireEvent.change(input, { target: { value: '2025-06-02' } });
    expect(onSelectedDateChange).toHaveBeenCalledWith('2025-06-02');
  });
});
