import { send } from '@actual-app/core/platform/client/connection';
import type {
  CategoryEntity,
  CategoryGroupEntity,
  RuleConditionEntity,
} from '@actual-app/core/types/models';
import { describe, expect, it, vi } from 'vitest';

import {
  fetchBudgetData,
  filterCategoriesByConditions,
} from './budgetDataQuery';

vi.mock('@actual-app/core/platform/client/connection', () => ({
  send: vi.fn(),
}));

const categoryGroups = [
  { id: 'group-bills', name: 'Bills' },
  { id: 'group-fun', name: 'Fun Money' },
  { id: 'group-savings', name: 'Savings' },
] as CategoryGroupEntity[];

const categories = [
  { id: 'cat-rent', name: 'Rent', group: 'group-bills' },
  { id: 'cat-electric', name: 'Electric', group: 'group-bills' },
  { id: 'cat-dining', name: 'Dining Out', group: 'group-fun' },
  { id: 'cat-emergency', name: 'Emergency Fund', group: 'group-savings' },
] as CategoryEntity[];

describe('filterCategoriesByConditions', () => {
  it('filters budget categories by category group', () => {
    const result = filterCategoriesByConditions(
      categories,
      categoryGroups,
      [
        {
          field: 'category_group',
          op: 'is',
          value: 'group-bills',
        } as RuleConditionEntity,
      ],
      'and',
    );

    expect(result.map(category => category.id)).toEqual([
      'cat-rent',
      'cat-electric',
    ]);
  });

  it('supports selecting one of multiple category groups', () => {
    const result = filterCategoriesByConditions(
      categories,
      categoryGroups,
      [
        {
          field: 'category_group',
          op: 'oneOf',
          value: ['group-fun', 'group-savings'],
        } as RuleConditionEntity,
      ],
      'and',
    );

    expect(result.map(category => category.id)).toEqual([
      'cat-dining',
      'cat-emergency',
    ]);
  });

  it('combines category and category group filters with and', () => {
    const result = filterCategoriesByConditions(
      categories,
      categoryGroups,
      [
        {
          field: 'category_group',
          op: 'is',
          value: 'group-bills',
        } as RuleConditionEntity,
        {
          field: 'category',
          op: 'is',
          value: 'cat-rent',
        } as RuleConditionEntity,
      ],
      'and',
    );

    expect(result.map(category => category.id)).toEqual(['cat-rent']);
  });

  it('matches text operators against category group names', () => {
    const result = filterCategoriesByConditions(
      categories,
      categoryGroups,
      [
        {
          field: 'category_group',
          op: 'contains',
          value: 'fun',
        } as RuleConditionEntity,
      ],
      'and',
    );

    expect(result.map(category => category.id)).toEqual(['cat-dining']);
  });
});

describe('fetchBudgetData', () => {
  const sheet = 'budget202611';
  vi.mocked(send).mockResolvedValue([
    { name: `${sheet}!budget-cat-rent`, value: 150000 },
    { name: `${sheet}!long-goal-cat-rent`, value: 1 },
    { name: `${sheet}!goal-cat-rent`, value: 120000 },
    { name: `${sheet}!budget-cat-dining`, value: 30000 },
    { name: `${sheet}!goal-cat-dining`, value: 0 },
  ]);

  const fetch = (cell?: 'budget' | 'goal') =>
    fetchBudgetData({
      startDate: '2026-11-01',
      endDate: '2026-11-30',
      interval: 'Monthly',
      categories,
      categoryGroups,
      cell,
    });

  it('reads the budgeted amount by default', async () => {
    const { assets } = await fetch();
    expect(assets.map(a => [a.category, a.amount])).toEqual([
      ['cat-rent', 150000],
      ['cat-dining', 30000],
    ]);
  });

  it('reads the goal, never the long-goal flag, and skips categories without one', async () => {
    const { assets } = await fetch('goal');
    expect(assets.map(a => [a.category, a.amount])).toEqual([
      ['cat-rent', 120000],
    ]);
  });
});
