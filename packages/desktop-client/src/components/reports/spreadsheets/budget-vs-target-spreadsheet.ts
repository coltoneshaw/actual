import { send } from '@actual-app/core/platform/client/connection';
import type { CategoryEntity } from '@actual-app/core/types/models';
import type { Template } from '@actual-app/core/types/models/templates';

import type { useSpreadsheet } from '#hooks/useSpreadsheet';

import type { BudgetMonthCell } from './budgetMonthCell';

/**
 * Template types that save toward a future bill. Money assigned to these
 * categories is spoken for the moment it is budgeted, so it counts against
 * the plan when it is assigned rather than when the bill is finally paid.
 */
const SINKING_FUND_TEMPLATE_TYPES: ReadonlySet<Template['type']> = new Set([
  'by',
  'spend',
  'schedule',
]);

export type TargetAmounts = {
  target: number;
  budgeted: number;
  spent: number;
  /**
   * What is judged against the target: `budgeted` for sinking funds, else
   * `spent`. Only categories with a target contribute.
   */
  counted: number;
  /** Spending in categories without a target, kept visible but not judged. */
  untargetedSpent: number;
  /**
   * `target - counted`; negative means over target. `null` when there is no
   * target to compare against.
   */
  difference: number | null;
};

export type TargetCategoryRow = TargetAmounts & {
  id: string;
  name: string;
  isSinkingFund: boolean;
};

export type TargetGroup = TargetAmounts & {
  id: string;
  name: string;
  categories: TargetCategoryRow[];
};

export type BudgetVsTargetData = TargetAmounts & {
  month: string;
  groups: TargetGroup[];
  overTargetCount: number;
};

export function isSinkingFund(category: Pick<CategoryEntity, 'goal_def'>) {
  if (!category.goal_def) {
    return false;
  }
  try {
    const templates: Template[] = JSON.parse(category.goal_def);
    return templates.some(template =>
      SINKING_FUND_TEMPLATE_TYPES.has(template.type),
    );
  } catch {
    return false;
  }
}

function cellValue(cells: BudgetMonthCell[], name: string): number {
  // Cells are named `<sheet>!<name>`. Match the whole name so `goal-<id>`
  // never picks up `long-goal-<id>`.
  const cell = cells.find(c => c.name.endsWith(`!${name}`));
  return typeof cell?.value === 'number' ? cell.value : 0;
}

export function buildCategoryRow(
  category: Pick<CategoryEntity, 'id' | 'name' | 'goal_def'>,
  cells: BudgetMonthCell[],
): TargetCategoryRow {
  const target = cellValue(cells, `goal-${category.id}`);
  const budgeted = cellValue(cells, `budget-${category.id}`);
  // Spending is stored as a negative amount; `0 -` avoids a negative zero.
  const spent = 0 - cellValue(cells, `sum-amount-${category.id}`);
  const sinkingFund = isSinkingFund(category);
  const hasTarget = target !== 0;
  const counted = hasTarget ? (sinkingFund ? budgeted : spent) : 0;

  return {
    id: category.id,
    name: category.name,
    isSinkingFund: sinkingFund,
    target,
    budgeted,
    spent,
    counted,
    untargetedSpent: hasTarget ? 0 : spent,
    difference: hasTarget ? target - counted : null,
  };
}

export function sumAmounts(rows: TargetAmounts[]): TargetAmounts {
  const totals = {
    target: 0,
    budgeted: 0,
    spent: 0,
    counted: 0,
    untargetedSpent: 0,
  };
  for (const row of rows) {
    totals.target += row.target;
    totals.budgeted += row.budgeted;
    totals.spent += row.spent;
    totals.counted += row.counted;
    totals.untargetedSpent += row.untargetedSpent;
  }
  return {
    ...totals,
    difference: totals.target !== 0 ? totals.target - totals.counted : null,
  };
}

function hasActivity(row: TargetAmounts) {
  return row.target !== 0 || row.budgeted !== 0 || row.spent !== 0;
}

export function summarizeBudgetVsTarget(
  month: string,
  groups: Array<{
    id: string;
    name: string;
    categories: Array<Pick<CategoryEntity, 'id' | 'name' | 'goal_def'>>;
  }>,
  cells: BudgetMonthCell[],
): BudgetVsTargetData {
  const targetGroups: TargetGroup[] = groups
    .map(group => {
      const categories = group.categories
        .map(category => buildCategoryRow(category, cells))
        .filter(hasActivity);
      return {
        id: group.id,
        name: group.name,
        categories,
        ...sumAmounts(categories),
      };
    })
    .filter(group => group.categories.length > 0);

  return {
    month,
    groups: targetGroups,
    overTargetCount: targetGroups
      .flatMap(group => group.categories)
      .filter(row => row.difference !== null && row.difference < 0).length,
    ...sumAmounts(targetGroups),
  };
}

export function createBudgetVsTargetSpreadsheet({
  month,
  showHiddenCategories = false,
}: {
  month: string;
  showHiddenCategories?: boolean;
}) {
  return async (
    _spreadsheet: ReturnType<typeof useSpreadsheet>,
    setData: (data: BudgetVsTargetData) => void,
  ) => {
    const [{ grouped }, cells] = await Promise.all([
      send('get-categories'),
      send('envelope-budget-month', { month }),
    ]);

    const groups = grouped
      .filter(
        group => !group.is_income && (showHiddenCategories || !group.hidden),
      )
      .map(group => ({
        id: group.id,
        name: group.name,
        categories: (group.categories ?? []).filter(
          category => showHiddenCategories || !category.hidden,
        ),
      }));

    setData(summarizeBudgetVsTarget(month, groups, cells));
  };
}
