'use client';

import { useEffect, useState } from 'react';
import { ApexOptions } from 'apexcharts';
import ApexChart from 'react-apexcharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const BatchOpted = () => {
  const [chartData, setChartData] = useState<number[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  type BatchData = {
    NoofStudents: number;
    batch: string;
  };
  useEffect(() => {
    const fetchAgewiseData = async () => {
      try {
        const response = await fetch('/api/dashboard/batch?type=batchopted');
        if (!response.ok) throw new Error('Failed to fetch batch data');

        const text = await response.text();
        if (!text?.trim()) {
          setChartData([]);
          setCategories([]);
          return;
        }
        const result = JSON.parse(text);
        const data: BatchData[] = result?.data ?? [];
        const values = data.map((item) => item.NoofStudents);
        const labels = data.map((item) => item.batch);

        setChartData(values);
        setCategories(labels);
      } catch (error) {
        console.error('Error fetching batch data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAgewiseData();
  }, []);

  const options: ApexOptions = {
    chart: {
      type: 'pie',
      height: 300,
      width: '100%',
      toolbar: { show: false },
    },
    labels: categories,
    plotOptions: {
      pie: {
        customScale: 1.1,
      },
    },
    legend: {
      show: true,
      position: 'bottom',
      horizontalAlign: 'center',
      floating: false,
      fontSize: '6px',
      itemMargin: {
        horizontal: 3,
        vertical: 0,
      },
      // markers: {
      //  height: 8,
      // },
      // Add these properties to force horizontal layout
      width: undefined, // Allow full width
      height: 30, // Set a fixed height for the legend area
      offsetY: 0,
      formatter: function(seriesName) {
        return seriesName; // Keep original labels
      }
    },
    tooltip: {
      y: {
        formatter: (value: number) => `${value} students`,
      },
    },
    stroke: {
      show: true,
      colors: ['#fff'],
    },
    // Add responsive configuration
    responsive: [{
      breakpoint: 480,
      options: {
        legend: {
          fontSize: '6px',
          itemMargin: {
            horizontal: 3,
            vertical: 0,
          },
          markers: {
            width: 6,
            height: 6,
          }
        }
      }
    }]
  };

  return (
    <Card className="h-full w-full">
      <CardHeader>
        <CardTitle>Enrollment funnel (inquiry → trial → enrollment conversion)</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center px-3 py-2 overflow-x-auto w-full">
        {!loading ? (
          <div className="w-full min-w-fit">
            {' '}
            {/* Add this wrapper */}
            <ApexChart
              id="agewise_pie_chart"
              options={options}
              series={chartData}
              type="pie"
              height={300}
            />
          </div>
        ) : (
          <p className="text-center text-sm">Loading chart...</p>
        )}
      </CardContent>
    </Card>
  );
};

export default BatchOpted;
