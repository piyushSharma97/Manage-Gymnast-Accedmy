'use client';

import { useEffect, useState } from 'react';
import { ApexOptions } from 'apexcharts';
import ApexChart from 'react-apexcharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Define proper types for the API response
interface SeriesData {
  name: string;
  data: number[];
}

interface ApiResponse {
  data: SeriesData[];
  categories: string[];
}

const DaysofWeek = () => {
  const [seriesData, setSeriesData] = useState<SeriesData[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  useEffect(() => {
    const fetchDaysOfWeekData = async () => {
      try {
        const response = await fetch('/api/dashboard/batch?type=daysofweek');

        if (!response.ok) {
          throw new Error(
            `Failed to fetch data: ${response.status} ${response.statusText}`,
          );
        }

        const result: ApiResponse = await response.json();

        // Set the series data and categories from API response
        setSeriesData(result.data || []);
        setCategories(result.categories || []);
      } catch (error) {
        console.error('Error fetching days of week data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDaysOfWeekData();
  }, []);

  const options: ApexOptions = {
    chart: {
      type: 'bar',
      height: 250,
      toolbar: { show: false },
    },
    xaxis: {
      categories: categories,
      title: {
        text: 'Day of week',
        style: { color: 'var(--color-muted-foreground)', fontSize: '12px' },
      },
      labels: {
        style: {
          colors: 'var(--color-secondary-foreground)',
          fontSize: '12px',
        },
      },
    },
    yaxis: {
      min: 0,
      tickAmount: 5,
      title: {
        text: 'Count',
        style: { color: 'var(--color-muted-foreground)', fontSize: '12px' },
      },
      labels: {
        formatter: (val) => val.toFixed(0),
        style: {
          colors: 'var(--color-secondary-foreground)',
          fontSize: '12px',
        },
      },
    },
    stroke: {
      show: true,
      width: 0.5,
      colors: ['var(--color-border)'],
    },
    plotOptions: {
      bar: {
        borderRadius: 4,
        columnWidth: '65%',
        dataLabels: {
          position: 'top',
        },
      },
    },
    dataLabels: {
      enabled: true,
      offsetY: -20,
      style: {
        fontSize: '10px',
        colors: ['var(--color-secondary-foreground)'],
      },
      formatter: (val) => val.toString(),
    },
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>No. Of Gymnasts/days of week</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col justify-end items-stretch grow px-3 py-1">
        {!loading ? (
          <ApexChart
            id="daysofweek_chart"
            options={options}
            series={seriesData}
            type="bar"
            height={250}
          />
        ) : (
          <p className="text-center text-sm">Loading chart...</p>
        )}
      </CardContent>
    </Card>
  );
};

export default DaysofWeek;
