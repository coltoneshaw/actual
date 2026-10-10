import React from 'react';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

import { styles } from '@actual-app/components/styles';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import type {
  BudgetVsTargetData,
  TargetAmounts,
} from '#components/reports/spreadsheets/budget-vs-target-spreadsheet';
import { Cell, Row, TableHeader } from '#components/table';
import { useFormat } from '#hooks/useFormat';

const AMOUNT_WIDTH = 110;

function differenceColor(difference: number) {
  if (difference < 0) {
    return theme.errorText;
  }
  return difference > 0 ? theme.noticeTextLight : theme.pageTextSubdued;
}

type AmountCellsProps = {
  amounts: TargetAmounts;
  /** Sinking funds are judged on what was assigned, so spending is context. */
  spentIsContext?: boolean;
};

function AmountCells({ amounts, spentIsContext }: AmountCellsProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const amountCell = (value: number, style?: CSSProperties) => (
    <Cell
      width={AMOUNT_WIDTH}
      textAlign="right"
      value={format(value, 'financial')}
      privacyFilter
      style={{ ...styles.tnum, ...style }}
    />
  );

  return (
    <>
      {amountCell(amounts.target)}
      {amountCell(amounts.budgeted)}
      {amountCell(
        amounts.spent,
        spentIsContext ? { color: theme.pageTextSubdued } : undefined,
      )}
      {amounts.difference === null ? (
        <Cell
          width={AMOUNT_WIDTH}
          textAlign="right"
          value={t('No target')}
          style={{ color: theme.pageTextSubdued }}
        />
      ) : (
        amountCell(amounts.difference, {
          color: differenceColor(amounts.difference),
          fontWeight: 500,
        })
      )}
    </>
  );
}

type BudgetVsTargetTableProps = {
  data: BudgetVsTargetData;
};

export function BudgetVsTargetTable({ data }: BudgetVsTargetTableProps) {
  const { t } = useTranslation();

  return (
    <View
      style={{
        border: `1px solid ${theme.tableBorder}`,
        borderRadius: 6,
        overflow: 'hidden',
      }}
    >
      <TableHeader
        headers={[
          { name: t('Category'), width: 'flex' },
          {
            name: t('Target'),
            width: AMOUNT_WIDTH,
            style: { textAlign: 'right' },
          },
          {
            name: t('Budgeted'),
            width: AMOUNT_WIDTH,
            style: { textAlign: 'right' },
          },
          {
            name: t('Spent'),
            width: AMOUNT_WIDTH,
            style: { textAlign: 'right' },
          },
          {
            name: t('Difference'),
            width: AMOUNT_WIDTH,
            style: { textAlign: 'right' },
          },
        ]}
      />
      {data.groups.map(group => (
        <View key={group.id}>
          <Row
            style={{
              backgroundColor: theme.tableRowHeaderBackground,
              color: theme.tableRowHeaderText,
              fontWeight: 600,
              borderTop: `1px solid ${theme.tableBorder}`,
            }}
          >
            <Cell width="flex" value={group.name} />
            <AmountCells amounts={group} />
          </Row>
          {group.categories.map(category => (
            <Row
              key={category.id}
              style={{
                backgroundColor: theme.tableBackground,
                color: theme.tableText,
                borderTop: `1px solid ${theme.tableBorder}`,
              }}
            >
              <Cell
                width="flex"
                style={{ paddingLeft: 15 }}
                value={
                  category.isSinkingFund
                    ? t('{{name}} (sinking fund)', { name: category.name })
                    : category.name
                }
              />
              <AmountCells
                amounts={category}
                spentIsContext={category.isSinkingFund}
              />
            </Row>
          ))}
        </View>
      ))}
      <Row
        style={{
          backgroundColor: theme.tableHeaderBackground,
          color: theme.tableHeaderText,
          fontWeight: 600,
          borderTop: `1px solid ${theme.tableBorder}`,
        }}
      >
        <Cell width="flex" value={t('Total')} />
        <AmountCells amounts={data} />
      </Row>
    </View>
  );
}
