'use client';

import { useEffect, useState } from 'react';
import { ApexOptions } from 'apexcharts';
import ApexChart from 'react-apexcharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Define the series type for better type safety
interface SeriesData {
  name: string;
  data: number[];
}

const BatchAmount = () => {
  
  const [chartData, setChartData] = useState<SeriesData[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchTeamType = async () => {
      try {
        const response = await fetch('/api/dashboard/finance/?type=batchamount');
        if (!response.ok) throw new Error('Failed to fetch batchamount data');
        const result = await response.json();
  
        const data = result.data;
        
        // Extract categories (weekdays) and series data (course types)
        const weekdays = data.categories; // ['Monday', 'Tuesday', ...]
        const seriesData = data.series;    // [{name: 'Reg', data: [...]}, ...]
  
        setCategories(weekdays);
        setChartData(seriesData);
        
      } catch (error) {
        console.error('Error fetching enrollment data:', error);
      } finally {
        setLoading(false);
      }
    };
  
    fetchTeamType();
  }, []);

  const options: ApexOptions = {
    // Fix: Remove series from options - it should be passed separately
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
      tickAmount: 7,
      labels: {
        formatter: (val) => val.toFixed(0),
        style: {
          colors: 'var(--color-secondary-foreground)',
          fontSize: '12px',
        },
      },
    },
    plotOptions: {
      bar: {
        borderRadius: 1,
        columnWidth: '65%',        
      },
    },
    dataLabels: {
      enabled: false,      
    },
    // Add colors for different course types
    colors: ['#008FFB', '#00E396', '#FEB019'],
    // Add legend for multiple series - single row at bottom
    legend: {
      show: true,
      position: 'bottom',
      horizontalAlign: 'center',
      floating: false,
      fontSize: '12px',
      itemMargin: {
        horizontal: 4,
        vertical: 5,
      },
      // Force single row layout
      width: undefined,
      height: 25,
      offsetY: 0,
    },
    // Add tooltip formatter
    tooltip: {
      y: {
        formatter: function (val) {
          return "Rs. "+ val
        }
      }
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Amount collected/Batch</CardTitle>
        <div className="flex gap-5"></div>
      </CardHeader>
      <CardContent className="flex flex-col justify-end items-stretch grow px-3 py-1">
        {!loading ? (
          <ApexChart
            id="enrollment_chart"
            options={options}
            series={chartData} // Fix: Use chartData instead of options.series
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

export default BatchAmount;