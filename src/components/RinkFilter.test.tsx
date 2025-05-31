import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import RinkFilter from './RinkFilter';
import { RinkInfo, FilterMode } from '../types';

describe('RinkFilter', () => {
  it('calls onRinkToggle when a rink is selected', () => {
    const allRinks: RinkInfo[] = [
      { id: 'ice-ranch', name: 'Ice Ranch', sourceUrl: '' },
      { id: 'big-bear', name: 'Big Bear', sourceUrl: '' },
    ];
    const activeRinkIds = ['ice-ranch'];
    const onRinkToggle = vi.fn();
    const onRinkFilterModeChange = vi.fn();
    const onToggleAllRinks = vi.fn();
    const getSelectAllRinksLabel = () => 'Select All';
    const getDeselectAllRinksLabel = () => 'Deselect All';
    render(
      <RinkFilter
        allRinks={allRinks}
        activeRinkIds={activeRinkIds}
        rinkFilterMode={'include'}
        onRinkToggle={onRinkToggle}
        onRinkFilterModeChange={onRinkFilterModeChange}
        onToggleAllRinks={onToggleAllRinks}
        getSelectAllRinksLabel={getSelectAllRinksLabel}
        getDeselectAllRinksLabel={getDeselectAllRinksLabel}
      />
    );
    // Simulate clicking the Big Bear checkbox
    const bigBearCheckbox = screen.getByLabelText('Big Bear');
    fireEvent.click(bigBearCheckbox);
    expect(onRinkToggle).toHaveBeenCalledWith('big-bear');
  });
});
