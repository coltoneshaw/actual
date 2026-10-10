import {
  buildCategoryRow,
  isSinkingFund,
  summarizeBudgetVsTarget,
} from './budget-vs-target-spreadsheet';
import type { BudgetMonthCell } from './budgetMonthCell';

const SHEET = 'budget202611';

function cells(
  values: Record<string, { goal?: number; budget?: number; spent?: number }>,
): BudgetMonthCell[] {
  return Object.entries(values).flatMap(([id, v]) => [
    { name: `${SHEET}!goal-${id}`, value: v.goal ?? 0 },
    { name: `${SHEET}!long-goal-${id}`, value: 0 },
    { name: `${SHEET}!budget-${id}`, value: v.budget ?? 0 },
    // Spending is stored as a negative amount.
    { name: `${SHEET}!sum-amount-${id}`, value: -(v.spent ?? 0) },
  ]);
}

const sinkingGoalDef = JSON.stringify([
  {
    type: 'by',
    amount: 1200,
    month: '2027-04',
    directive: 'template',
    priority: 0,
  },
]);
const simpleGoalDef = JSON.stringify([
  { type: 'simple', monthly: 300, directive: 'template', priority: 0 },
]);

describe('isSinkingFund', () => {
  it('is true for by, spend and schedule templates', () => {
    expect(isSinkingFund({ goal_def: sinkingGoalDef })).toBe(true);
    expect(
      isSinkingFund({
        goal_def: JSON.stringify([
          { type: 'schedule', name: 'Insurance', directive: 'template' },
        ]),
      }),
    ).toBe(true);
  });

  it('is false for other templates, no templates, or bad JSON', () => {
    expect(isSinkingFund({ goal_def: simpleGoalDef })).toBe(false);
    expect(isSinkingFund({ goal_def: undefined })).toBe(false);
    expect(isSinkingFund({ goal_def: 'not json' })).toBe(false);
  });
});

describe('buildCategoryRow', () => {
  it('judges a spending category on what was spent, not what was funded', () => {
    // Target 400, covered with an extra 50, spent 450: covered but over.
    const row = buildCategoryRow(
      { id: 'bulk', name: 'Bulk order', goal_def: simpleGoalDef },
      cells({ bulk: { goal: 40000, budget: 45000, spent: 45000 } }),
    );
    expect(row).toMatchObject({
      target: 40000,
      budgeted: 45000,
      spent: 45000,
      counted: 45000,
      difference: -5000,
      isSinkingFund: false,
    });
  });

  it('judges a sinking fund on what was assigned, not what was spent', () => {
    const row = buildCategoryRow(
      { id: 'tax', name: 'Taxes', goal_def: sinkingGoalDef },
      cells({ tax: { goal: 10000, budget: 10000, spent: 0 } }),
    );
    expect(row).toMatchObject({ counted: 10000, difference: 0 });
  });

  it('does not read long-goal as the target', () => {
    const row = buildCategoryRow({ id: 'c1', name: 'Groceries' }, [
      { name: `${SHEET}!long-goal-c1`, value: 1 },
      { name: `${SHEET}!goal-c1`, value: 50000 },
    ]);
    expect(row.target).toBe(50000);
  });
});

describe('summarizeBudgetVsTarget', () => {
  const groups = [
    {
      id: 'g1',
      name: 'Everyday',
      categories: [
        { id: 'food', name: 'Eating out', goal_def: simpleGoalDef },
        { id: 'bulk', name: 'Bulk order', goal_def: simpleGoalDef },
        { id: 'idle', name: 'Unused' },
      ],
    },
    {
      id: 'g2',
      name: 'Bills',
      categories: [{ id: 'tax', name: 'Taxes', goal_def: sinkingGoalDef }],
    },
  ];

  const data = summarizeBudgetVsTarget(
    '2026-11',
    groups,
    cells({
      // Under by 50, and that 50 was moved to bulk order.
      food: { goal: 30000, budget: 25000, spent: 25000 },
      bulk: { goal: 40000, budget: 45000, spent: 45000 },
      tax: { goal: 10000, budget: 10000, spent: 0 },
    }),
  );

  it('totals groups and the month against the plan', () => {
    expect(data.groups.map(g => [g.id, g.difference])).toEqual([
      ['g1', 0],
      ['g2', 0],
    ]);
    expect(data).toMatchObject({
      target: 80000,
      counted: 80000,
      difference: 0,
    });
  });

  it('still flags the category that went over even when the month nets out', () => {
    expect(data.overTargetCount).toBe(1);
  });

  it('leaves out categories with no target, budget or spending', () => {
    expect(data.groups[0].categories.map(c => c.id)).toEqual(['food', 'bulk']);
  });
});

describe('categories without a target', () => {
  const data = summarizeBudgetVsTarget(
    '2026-11',
    [
      {
        id: 'g1',
        name: 'Bills',
        categories: [
          { id: 'food', name: 'Eating out', goal_def: simpleGoalDef },
          { id: 'rent', name: 'Rent' },
        ],
      },
    ],
    cells({
      food: { goal: 30000, budget: 30000, spent: 25000 },
      rent: { budget: 120000, spent: 120000 },
    }),
  );
  const rent = data.groups[0].categories.find(c => c.id === 'rent');

  it('are listed but not judged', () => {
    expect(rent).toMatchObject({ difference: null, untargetedSpent: 120000 });
    expect(data.overTargetCount).toBe(0);
  });

  it('do not move the month against the plan, but stay visible', () => {
    expect(data).toMatchObject({
      difference: 5000,
      untargetedSpent: 120000,
    });
  });

  it('give no verdict when nothing has a target', () => {
    const empty = summarizeBudgetVsTarget(
      '2026-11',
      [{ id: 'g1', name: 'Bills', categories: [{ id: 'rent', name: 'Rent' }] }],
      cells({ rent: { spent: 100 } }),
    );
    expect(empty.difference).toBeNull();
  });

  it('never show a negative zero for no spending', () => {
    const row = buildCategoryRow({ id: 'x', name: 'X' }, cells({ x: {} }));
    expect(Object.is(row.spent, 0)).toBe(true);
  });
});
