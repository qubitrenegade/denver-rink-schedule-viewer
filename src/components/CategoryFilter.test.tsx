import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CategoryFilter from './CategoryFilter';
import { EventCategory, FilterMode } from '../types';

describe('CategoryFilter', () => {
  it('calls onCategoryToggle when a category is selected', () => {
    const allCategories: EventCategory[] = ['Public Skate', 'Stick & Puck'];
    const activeCategories: EventCategory[] = ['Public Skate'];
    const onCategoryToggle = vi.fn();
    const onCategoryModeChange = vi.fn();
    const onToggleAllCategories = vi.fn();
    const getSelectAllCategoriesLabel = () => 'Select All';
    const getDeselectAllCategoriesLabel = () => 'Deselect All';
    render(
      <CategoryFilter
        allCategories={allCategories}
        activeCategories={activeCategories}
        filterMode={'include'}
        onCategoryToggle={onCategoryToggle}
        onCategoryModeChange={onCategoryModeChange}
        onToggleAllCategories={onToggleAllCategories}
        getSelectAllCategoriesLabel={getSelectAllCategoriesLabel}
        getDeselectAllCategoriesLabel={getDeselectAllCategoriesLabel}
      />
    );
    // Simulate clicking the Stick & Puck checkbox
    const stickPuckCheckbox = screen.getByLabelText('Stick & Puck');
    fireEvent.click(stickPuckCheckbox);
    expect(onCategoryToggle).toHaveBeenCalledWith('Stick & Puck');
  });
});
