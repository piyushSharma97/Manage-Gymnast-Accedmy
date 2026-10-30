'use client';

import { useEffect, useState } from 'react';
import { ApexOptions } from 'apexcharts';
import ApexChart from 'react-apexcharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const RecreationalChart = () => {
  const [chartData, setChartData] = useState<number[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  type BatchData = {
    NoofStudents: number;
    gender: string;
  };

  useEffect(() => {
    const fetchAgewiseData = async () => {
      try {
        const response = await fetch('/api/dashboard/enrollment?type=recreational');
        if (!response.ok) throw new Error('Failed to fetch enrollment data');

        const result = await response.json();
        const data: BatchData[] = result.data;
        const values = data.map((item) => item.NoofStudents);
        const labels = data.map((item) => item.gender);

        setChartData(values);
        setCategories(labels);
      } catch (error) {
        console.error('Error fetching enrollment data:', error);
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
      horizontalAlign: 'left',
      floating: false,
      fontSize: '10px',
      itemMargin: {
        horizontal: 6,
        vertical: 0,
      },
      markers: {
        size: 5,
        strokeWidth: 2,
      },
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
    colors: ['#008FFB', '#FF4560'],
  };

  return (
    <Card className="h-full w-full">
      <CardHeader>
        <CardTitle>Gender ratio</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center px-3 py-2 overflow-x-auto">
        {!loading ? (
        
            <ApexChart
              id="agewise_pie_chart"
              options={options}
              series={chartData}
              type="pie"
              height={300}
            />
        ) : (
          <p className="text-center text-sm">Loading chart...</p>
        )}
      </CardContent>
    </Card>
  );
};

export default RecreationalChart;