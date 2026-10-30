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

const DepositCount = () => {
 
  const [chartData, setChartData] = useState<SeriesData[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchTeamType = async () => {
      try {
        const response = await fetch('/api/dashboard/finance/?type=depositcount');
        if (!response.ok) throw new Error('Failed to fetch Finance data');
        const result = await response.json();
           
        const data = result.data;
                 
        const weekdays = data.categories;
        const seriesData = data.series;
               
        setCategories(weekdays);
        setChartData(seriesData);
               
      } catch (error) {
        console.error('Error fetching Dropped data:', error);
      } finally {
        setLoading(false);
      }
    };
       
    fetchTeamType();
  }, []);
  
  const options: ApexOptions = {
    chart: {
      type: 'line',
      height: 250,
      toolbar: { show: false },
      zoom: {
        enabled: false
      }
    },
    stroke: {
      curve: 'smooth',
      width: 2,
      lineCap: "square"
    },
    xaxis: {
      categories: categories,
      title: {
        text: 'Day of month',
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
      tickAmount: 4,
      title: {
        text: 'Number of payments',
        style: { color: 'var(--color-muted-foreground)', fontSize: '12px' },
      },
    },
    markers: {
      size: 6,
      strokeWidth: 2,
      strokeColors: '#fff',
      hover: {
        size: 8,
      }
    },
    
    // Colors for different series lines
    colors: ['#2b3b97', '#008FFB', '#e83822','#FF4560', '#775DD0'],
    // Grid styling for better line graph appearance
    grid: {
      show: true,
      strokeDashArray: 3,
      borderColor: 'var(--color-border)',
      
    },
    // Legend configuration
    legend: {
      show: true,
      position: 'bottom',
      horizontalAlign: 'center',
      floating: false,
      fontSize: '12px',
      itemMargin: {
        horizontal: 8,
        vertical: 5,
      },
      width: undefined,
      height: 30,
      offsetY: 0,
    },
    // Enhanced tooltip for line graph
    tooltip: {
      shared: true,
      intersect: false,
      y: {
        formatter: function (val) {
          return val + " deposit"
        }
      },
      marker: {
        show: true,
      }
    },    
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>No. of fees deposits/Day</CardTitle>
        <div className="flex gap-5"></div>
      </CardHeader>
      <CardContent className="flex flex-col justify-end items-stretch grow px-3 py-1">
        {!loading ? (
          <ApexChart
            id="enrollment_chart"
            options={options}
            series={chartData} // Fix: Use chartData instead of options.series
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

export default DepositCount;