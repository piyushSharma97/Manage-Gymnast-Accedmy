'use client';

import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import PaymentsperMonth from './paymentspermonth';
import AmountperMonth from './amountpermonth';

export default function FinanceTimeCharts() {
  const [groupBy, setGroupBy] = useState<'week' | 'month'>('month');

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">
          View by week or month. X-axis: time period · Y-axis: value.
        </span>
        <Select
          value={groupBy}
          onValueChange={(v) => setGroupBy(v as 'week' | 'month')}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Group by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">By week</SelectItem>
            <SelectItem value="month">By month</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid lg:grid-cols-4 gap-5 lg:gap-7.5 items-stretch">
        <div className="lg:col-span-2">
          <PaymentsperMonth groupBy={groupBy} />
        </div>
        <div className="lg:col-span-2">
          <AmountperMonth groupBy={groupBy} />
        </div>
      </div>
    </>
  );
}
