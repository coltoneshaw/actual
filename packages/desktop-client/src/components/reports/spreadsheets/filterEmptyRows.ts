import type {
  balanceTypeOpType,
  GroupedEntity,
} from '@actual-app/core/types/models';

import { isBudgetBalanceType } from '#components/reports/ReportOptions';

export function filterEmptyRows({
  showEmpty,
  data,
  balanceTypeOp = 'totalDebts',
}: {
  showEmpty: boolean;
  data: GroupedEntity;
  balanceTypeOp?: balanceTypeOpType;
}): boolean {
  let showHide: boolean;
  if (balanceTypeOp === 'totalTotals' || isBudgetBalanceType(balanceTypeOp)) {
    showHide =
      data['totalDebts'] !== 0 ||
      data['totalAssets'] !== 0 ||
      data[balanceTypeOp] !== 0;
  } else {
    showHide = data[balanceTypeOp] !== 0;
  }
  return !showEmpty ? showHide : true;
}
