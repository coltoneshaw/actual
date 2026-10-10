import React, { useEffect, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useParams } from 'react-router';

import { AlignedText } from '@actual-app/components/aligned-text';
import { Block } from '@actual-app/components/block';
import { Button } from '@actual-app/components/button';
import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { Paragraph } from '@actual-app/components/paragraph';
import { Select } from '@actual-app/components/select';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import * as monthUtils from '@actual-app/core/shared/months';
import type { BudgetVsTargetWidget } from '@actual-app/core/types/models';

import { EditablePageHeaderTitle } from '#components/EditablePageHeaderTitle';
import { FinancialText } from '#components/FinancialText';
import { MobileBackButton } from '#components/mobile/MobileBackButton';
import { MobilePageHeader, Page, PageHeader } from '#components/Page';
import { PrivacyFilter } from '#components/PrivacyFilter';
import { BudgetVsTargetTable } from '#components/reports/graphs/BudgetVsTargetTable';
import { LoadingIndicator } from '#components/reports/LoadingIndicator';
import { createBudgetVsTargetSpreadsheet } from '#components/reports/spreadsheets/budget-vs-target-spreadsheet';
import { useReport } from '#components/reports/useReport';
import { useDashboardWidget } from '#hooks/useDashboardWidget';
import { useFormat } from '#hooks/useFormat';
import { useLocale } from '#hooks/useLocale';
import { useNavigate } from '#hooks/useNavigate';
import { addNotification } from '#notifications/notificationsSlice';
import { useDispatch } from '#redux';
import { useUpdateDashboardWidgetMutation } from '#reports/mutations';

export function BudgetVsTarget() {
  const params = useParams();
  const { data: widget, isPending } = useDashboardWidget<BudgetVsTargetWidget>({
    id: params.id,
    type: 'budget-vs-target-card',
  });

  if (isPending) {
    return <LoadingIndicator />;
  }

  return <BudgetVsTargetInternal widget={widget} />;
}

type BudgetVsTargetInternalProps = {
  widget?: BudgetVsTargetWidget;
};

function BudgetVsTargetInternal({ widget }: BudgetVsTargetInternalProps) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const format = useFormat();
  const locale = useLocale();
  const navigate = useNavigate();
  const { isNarrowWidth } = useResponsive();

  const [month, setMonth] = useState(
    widget?.meta?.month ?? monthUtils.currentMonth(),
  );
  const [months, setMonths] = useState<string[] | null>(null);

  useEffect(() => {
    void send('get-budget-bounds').then(({ start, end }) => {
      setMonths(monthUtils.rangeInclusive(start, end).reverse());
    });
  }, []);

  const getData = useMemo(
    () => createBudgetVsTargetSpreadsheet({ month }),
    [month],
  );
  const data = useReport('default', getData);

  const updateDashboardWidgetMutation = useUpdateDashboardWidgetMutation();

  const title = widget?.meta?.name || t('Budget vs Target');

  function onSaveWidget() {
    if (!widget) {
      throw new Error('No widget that could be saved.');
    }
    updateDashboardWidgetMutation.mutate(
      { widget: { id: widget.id, meta: { ...(widget.meta ?? {}), month } } },
      {
        onSuccess: () => {
          dispatch(
            addNotification({
              notification: {
                type: 'message',
                message: t('Dashboard widget successfully saved.'),
              },
            }),
          );
        },
      },
    );
  }

  function onSaveWidgetName(newName: string) {
    if (!widget) {
      throw new Error('No widget that could be saved.');
    }
    updateDashboardWidgetMutation.mutate({
      widget: {
        id: widget.id,
        meta: {
          ...(widget.meta ?? {}),
          name: newName || t('Budget vs Target'),
        },
      },
    });
  }

  if (!data || !months) {
    return <LoadingIndicator />;
  }

  const summaryRow = (label: string, amount: number) => (
    <AlignedText
      style={{ marginBottom: 5, minWidth: 210 }}
      left={<Block>{label}</Block>}
      right={
        <FinancialText style={{ fontWeight: 600 }}>
          <PrivacyFilter>{format(amount, 'financial')}</PrivacyFilter>
        </FinancialText>
      }
    />
  );

  return (
    <Page
      header={
        isNarrowWidth ? (
          <MobilePageHeader
            title={title}
            leftContent={
              <MobileBackButton onPress={() => navigate('/reports')} />
            }
          />
        ) : (
          <PageHeader
            title={
              widget ? (
                <EditablePageHeaderTitle
                  title={title}
                  onSave={onSaveWidgetName}
                />
              ) : (
                title
              )
            }
          />
        )
      }
      padding={0}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          padding: 20,
          paddingTop: 0,
        }}
      >
        <Select
          value={month}
          onChange={setMonth}
          options={months.map(
            m => [m, monthUtils.format(m, 'MMMM yyyy', locale)] as const,
          )}
          style={{ width: 150 }}
          popoverStyle={{ width: 150 }}
        />
        <View style={{ flex: 1 }} />
        {widget && (
          <Button variant="primary" onPress={onSaveWidget}>
            <Trans>Save widget</Trans>
          </Button>
        )}
      </View>
      <View
        style={{
          backgroundColor: theme.tableBackground,
          padding: 20,
          flex: '1 0 auto',
          overflowY: 'auto',
          gap: 20,
        }}
      >
        <View style={{ alignItems: 'flex-end', color: theme.pageText }}>
          {summaryRow(t('Target:'), data.target)}
          {summaryRow(t('Counted against target:'), data.counted)}
          {data.difference !== null && (
            <AlignedText
              style={{ marginBottom: 5, minWidth: 210 }}
              left={
                <Block>
                  {data.difference < 0 ? (
                    <Trans>Over plan:</Trans>
                  ) : (
                    <Trans>Under plan:</Trans>
                  )}
                </Block>
              }
              right={
                <FinancialText
                  style={{
                    fontWeight: 600,
                    color:
                      data.difference < 0
                        ? theme.errorText
                        : theme.noticeTextLight,
                  }}
                >
                  <PrivacyFilter>
                    {format(data.difference, 'financial')}
                  </PrivacyFilter>
                </FinancialText>
              }
            />
          )}
          {data.untargetedSpent !== 0 &&
            summaryRow(t('Spent without a target:'), data.untargetedSpent)}
        </View>

        {data.groups.length > 0 ? (
          <BudgetVsTargetTable data={data} />
        ) : (
          <Paragraph style={{ color: theme.pageTextSubdued }}>
            <Trans>
              No targets, budgeted amounts or spending for this month.
            </Trans>
          </Paragraph>
        )}

        <View>
          <Trans>
            <Paragraph>
              <strong>Understanding the report</strong>
              <br />• <strong>Target:</strong> the goal set by each
              category&apos;s budget templates for this month
              <br />• <strong>Budgeted:</strong> what you actually assigned,
              including money moved in to cover spending
              <br />• <strong>Spent:</strong> spending in the category this
              month
              <br />• <strong>Difference:</strong> target minus what counts
              against it. Negative means the category went over its target, even
              if you covered the spending by moving money in. Categories without
              a target are listed but not judged; their spending is totalled
              separately as spending without a target.
            </Paragraph>
            <Paragraph>
              <strong>Sinking funds</strong> are categories saving toward a
              future bill with a <code>by</code>, <code>spend</code> or{' '}
              <code>schedule</code> template. What counts against their target
              is what you assigned, not what you spent, so a large bill paid
              from savings does not show as overspending.
            </Paragraph>
          </Trans>
        </View>
      </View>
    </Page>
  );
}
