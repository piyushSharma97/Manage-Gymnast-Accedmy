'use client';

import { useEffect, useState } from 'react';
import { ApexOptions } from 'apexcharts';
import ApexChart from 'react-apexcharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SeriesData {
  name: string;
  data: number[];
}

interface AmountperMonthProps {
  groupBy: 'week' | 'month';
}

const AmountperMonth = ({ groupBy }: AmountperMonthProps) => {
  const [chartData, setChartData] = useState<SeriesData[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [xAxisLabel, setXAxisLabel] = useState('Month');
  const [yAxisLabel, setYAxisLabel] = useState('Revenue (USD)');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/dashboard/finance/?type=amountpermonth&groupBy=${groupBy}`
        );
        if (!response.ok) throw new Error('Failed to fetch data');
        const result = await response.json();
        const data = result.data;
        setCategories(data.categories ?? []);
        setChartData(data.series ?? []);
        if (result.xAxisLabel) setXAxisLabel(result.xAxisLabel);
        if (result.yAxisLabel) setYAxisLabel(result.yAxisLabel);
      } catch (error) {
        console.error('Error fetching revenue data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [groupBy]);

  const options: ApexOptions = {
    chart: {
      type: 'line',
      height: 250,
      toolbar: { show: false },
      zoom: { enabled: false },
    },
    stroke: {
      curve: 'smooth',
      width: 3,
      lineCap: 'round',
    },
    xaxis: {
      categories,
      title: {
        text: xAxisLabel,
        style: {
          color: 'var(--color-muted-foreground)',
          fontSize: '12px',
        },
      },
      labels: {
        style: {
          colors: 'var(--color-secondary-foreground)',
          fontSize: '11px',
        },
      },
    },
    yaxis: {
      min: 0,
      tickAmount: 5,
      title: {
        text: yAxisLabel,
        style: {
          color: 'var(--color-muted-foreground)',
          fontSize: '12px',
        },
      },
      labels: {
        formatter: (val) => (Number(val) >= 1000 ? `${(Number(val) / 1000).toFixed(1)}k` : String(val)),
        style: {
          colors: 'var(--color-secondary-foreground)',
          fontSize: '12px',
        },
      },
    },
    markers: {
      size: 6,
      strokeWidth: 2,
      strokeColors: '#fff',
      hover: { size: 8 },
    },
    dataLabels: {
      enabled: true,
      offsetY: -10,
      style: {
        fontSize: '10px',
        colors: ['var(--color-secondary-foreground)'],
      },
      formatter: (val) => (Number(val) >= 1000 ? `$${(Number(val) / 1000).toFixed(1)}k` : `$${val}`),
      background: {
        enabled: true,
        foreColor: '#fff',
        borderRadius: 2,
        padding: 2,
        opacity: 0.8,
      },
    },
    colors: ['#008FFB', '#00E396', '#FEB019', '#FF4560', '#775DD0'],
    grid: {
      show: true,
      strokeDashArray: 3,
      borderColor: 'var(--color-border)',
    },
    legend: {
      show: true,
      position: 'bottom',
      horizontalAlign: 'center',
      floating: false,
      fontSize: '12px',
      itemMargin: { horizontal: 8, vertical: 5 },
      width: undefined,
      height: 30,
      offsetY: 0,
    },
    tooltip: {
      shared: true,
      intersect: false,
      y: { formatter: (val: number) => `$${Number(val).toLocaleString()}` },
      marker: { show: true },
    },
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>
          {groupBy === 'week' ? 'Revenue per week' : 'Monthly revenue trend'}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col justify-end items-stretch grow px-3 py-1">
        {!loading ? (
          <ApexChart
            id="amount_per_period_chart"
            options={options}
            series={chartData}
            type="line"
            height={250}
          />
        ) : (
          <p className="text-center text-sm">Loading chart...</p>
        )}
      </CardContent>
    </Card>
  );
};

export default AmountperMonth;
