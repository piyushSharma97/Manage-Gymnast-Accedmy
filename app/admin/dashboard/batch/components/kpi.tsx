'use client';

import { Fragment,useEffect, useState,ReactElement  } from 'react';
import { API_PATHS } from '@/lib/api-paths';
import { toAbsoluteUrl } from '@/lib/helpers';
import { Card, CardContent } from '@/components/ui/card';
import { User, LineChart,IndianRupee   ,UserX } from "lucide-react";

interface IChannelStatsItem {
  logo: string;
  info: string;
  desc: string;
}

const iconMap: Record<string, ReactElement> = {
    userX: <UserX className="dark:hidden w-7 mt-4 ms-5" />,
    user: <User className="dark:hidden w-7 mt-4 ms-5" />,
    lineChart: <LineChart className="dark:hidden w-7 mt-4 ms-5" />,
    dollarSign: <IndianRupee  className="dark:hidden w-7 mt-4 ms-5" />,
  };
type IChannelStatsItems = Array<IChannelStatsItem>;

const KPIStats = () => {
  const [items, setItems] = useState<IChannelStatsItems>([]);
  useEffect(() => {
    const fetchItems = async () => {
      try {
        const res = await fetch(API_PATHS.dashboard.kpi, { cache: 'no-store' });
        if (!res.ok) {
          throw new Error(`Failed to fetch: ${res.status} ${res.statusText}`);
        }
        const data = await res.json();
        // Expecting { items: [...] }
        setItems(Array.isArray(data.items) ? data.items : []);
      } catch (err) {
        console.error('Error loading KPI data:', err);
        setItems([]); // fallback to empty
      }
    };

    fetchItems();
  }, []);
  const renderItem = (item: IChannelStatsItem, index: number) => {
    // Remove $ sign from revenue display
    const displayValue = item.desc === 'Revenue' 
      ? item.info.replace(/\$/g, '') 
      : item.info;
    
    return (
      <Card key={index}>
        <CardContent className="p-0 flex flex-col justify-between gap-6 h-full bg-cover rtl:bg-[left_top_-1.7rem] bg-[right_top_-1.7rem] bg-no-repeat channel-stats-bg">
        {iconMap[item.logo] || null}
          <div className="flex flex-col gap-1 pb-4 px-5">
            <span className="text-3xl font-semibold text-mono">
              {displayValue}
            </span>
            <span className="text-sm font-normal text-muted-forehead">
              {item.desc}
            </span>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <Fragment>
      <style>
        {`
          .channel-stats-bg {
            background-image: url('${toAbsoluteUrl('/media/images/2600x1600/bg-3.png')}');
          }
          .dark .channel-stats-bg {
            background-image: url('${toAbsoluteUrl('/media/images/2600x1600/bg-3-dark.png')}');
          }
        `}
      </style>

      {items.map((item, index) => {
        return renderItem(item, index);
      })}
    </Fragment>
  );
};

export default KPIStats;
export type { IChannelStatsItem, IChannelStatsItems };
