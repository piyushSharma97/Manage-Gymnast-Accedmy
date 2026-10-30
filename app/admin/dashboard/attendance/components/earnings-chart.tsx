'use client';

import { useEffect, useState } from 'react';
import { ApexOptions } from 'apexcharts';
import ApexChart from 'react-apexcharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

const EarningsChart = () => {
  const [chartData, setChartData] = useState<number[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const categories: string[] = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  useEffect(() => {
    const fetchEarnings = async () => {
      try {
        const response = await fetch('/api/dashboard/earnings'); // Update this endpoint as per your backend
        if (!response.ok) throw new Error('Failed to fetch earnings data');
        const result = await response.json();
        setChartData(result.data); // assuming API returns { data: [58, 64, ...] }
      } catch (error) {
        console.error('Error fetching earnings data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEarnings();
  }, []);

  const maxValue = Math.max(...chartData);
  const maxRounded = Math.ceil(maxValue / 100000) * 100000; // Round up to nearest lakh
  const tickCount = maxRounded / 100000;

  const options: ApexOptions = {
    series: [
      {
        name: 'Earnings',
        data: chartData ?? [],
      },
    ],
    chart: {
      type: 'bar',
      height: 250,
      toolbar: { show: false },
    },
    stroke: {
      show: true,
      width: 0.5,
      colors: ['var(--color-border)'],
    },
    plotOptions: {
      bar: {
        borderRadius: 4,
        columnWidth: '55%',
      },
    },
    dataLabels: {
      enabled: false,
    },
    legend: {
      show: false,
    },
    xaxis: {
      categories: categories,
      labels: {
        style: {
          colors: 'var(--color-secondary-foreground)',
          fontSize: '12px',
        },
      },
    },
    yaxis: {
      min: 0,
      max: maxRounded,
      tickAmount: tickCount,
      labels: {
        formatter: (val) =>
          new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
            currencyDisplay: 'code', // to avoid showing ₹ symbol, we can use plain number instead by omitting style and currency
          }).format(val),
        style: {
          colors: 'var(--color-secondary-foreground)',
          fontSize: '12px',
        },
      },     
    },
    tooltip: {
      enabled: true,
      y: {
        formatter: (value) =>
          new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
          }).format(value),
      },
    },
    fill: {
      opacity: 1,
    },
    grid: {
      borderColor: 'var(--color-border)',
      strokeDashArray: 5,
      yaxis: {
        lines: { show: true },
      },
      xaxis: {
        lines: { show: false },
      },
    },
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Earnings</CardTitle>
        <div className="flex gap-5">
          <div className="flex items-center gap-2">
            <Label htmlFor="auto-update" className="text-sm">
              Referrals only
            </Label>
            <Switch id="auto-update" defaultChecked size="sm" />
          </div>
          <Select defaultValue="1">
            <SelectTrigger className="w-28">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent className="w-28">
              <SelectItem value="1">1 month</SelectItem>
              <SelectItem value="3">3 months</SelectItem>
              <SelectItem value="6">6 months</SelectItem>
              <SelectItem value="12">12 months</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col justify-end items-stretch grow px-3 py-1">
        {!loading ? (
          <ApexChart
            id="earnings_chart"
            options={options}
            series={options.series}
            type="bar"
            max-width="694"
            height="250"
          />
        ) : (
          <p className="text-center text-sm">Loading chart...</p>
        )}
      </CardContent>
    </Card>
  );
};

export default EarningsChart;
