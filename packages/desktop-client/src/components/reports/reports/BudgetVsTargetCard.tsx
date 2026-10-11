import React, { useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Block } from '@actual-app/components/block';
import { styles } from '@actual-app/components/styles';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';
import type { BudgetVsTargetWidget } from '@actual-app/core/types/models';

import { FinancialText } from '#components/FinancialText';
import { PrivacyFilter } from '#components/PrivacyFilter';
import { LoadingIndicator } from '#components/reports/LoadingIndicator';
import { ReportCard } from '#components/reports/ReportCard';
import { ReportCardName } from '#components/reports/ReportCardName';
import { createBudgetVsTargetSpreadsheet } from '#components/reports/spreadsheets/budget-vs-target-spreadsheet';
import { useReport } from '#components/reports/useReport';
import { useFormat } from '#hooks/useFormat';
import { useLocale } from '#hooks/useLocale';

type BudgetVsTargetCardProps = {
  widgetId: string;
  isEditing?: boolean;
  meta?: BudgetVsTargetWidget['meta'];
  onMetaChange: (newMeta: BudgetVsTargetWidget['meta']) => void;
};

export function BudgetVsTargetCard({
  widgetId,
  isEditing,
  meta = {},
  onMetaChange,
}: BudgetVsTargetCardProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const locale = useLocale();

  const [isCardHovered, setIsCardHovered] = useState(false);
  const [nameMenuOpen, setNameMenuOpen] = useState(false);

  // Without a saved month the card follows the current month.
  const month = meta?.month ?? monthUtils.currentMonth();
  const getData = useMemo(
    () => createBudgetVsTargetSpreadsheet({ month }),
    [month],
  );
  const data = useReport('default', getData);

  return (
    <ReportCard
      widgetId={widgetId}
      isEditing={isEditing}
      disableClick={nameMenuOpen}
      to={`/reports/budget-vs-target/${widgetId}`}
      onRename={() => setNameMenuOpen(true)}
    >
      <View
        style={{ flex: 1, padding: 20 }}
        onPointerEnter={() => setIsCardHovered(true)}
        onPointerLeave={() => setIsCardHovered(false)}
      >
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1 }}>
            <ReportCardName
              name={meta?.name || t('Budget vs Target')}
              isEditing={nameMenuOpen}
              onChange={newName => {
                onMetaChange({ ...meta, name: newName });
                setNameMenuOpen(false);
              }}
              onClose={() => setNameMenuOpen(false)}
            />
            <Block style={{ color: theme.pageTextSubdued }}>
              {monthUtils.format(month, 'MMMM yyyy', locale)}
            </Block>
          </View>
          {data && data.difference !== null && (
            <View style={{ textAlign: 'right' }}>
              <Block
                style={{
                  ...styles.mediumText,
                  fontWeight: 500,
                  marginBottom: 5,
                  color:
                    data.difference < 0
                      ? theme.errorText
                      : theme.noticeTextLight,
                }}
              >
                <FinancialText>
                  <PrivacyFilter activationFilters={[!isCardHovered]}>
                    {format(data.difference, 'financial')}
                  </PrivacyFilter>
                </FinancialText>
              </Block>
              <Block style={{ color: theme.pageTextSubdued }}>
                {data.difference < 0 ? (
                  <Trans>over plan</Trans>
                ) : (
                  <Trans>under plan</Trans>
                )}
              </Block>
            </View>
          )}
        </View>
        {data ? (
          <Block style={{ marginTop: 'auto', color: theme.pageTextSubdued }}>
            {data.difference === null ? (
              <Trans>No targets set for this month.</Trans>
            ) : (
              <Trans count={data.overTargetCount}>
                {{ count: data.overTargetCount }} categories over target
              </Trans>
            )}
          </Block>
        ) : (
          <LoadingIndicator />
        )}
      </View>
    </ReportCard>
  );
}
