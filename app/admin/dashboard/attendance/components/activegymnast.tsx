'use client';

import { useEffect, useState } from 'react';
import { ApexOptions } from 'apexcharts';
import ApexChart from 'react-apexcharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const ActiveGymnastChart = () => {
  const [chartData, setChartData] = useState<number[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  type AttendanceData = {
    NoofStudents: number;
    mthyr: string;
  };
  
  useEffect(() => {
    const fetchTeamType = async () => {
      try {
        const response = await fetch('/api/dashboard/attendance?type=activegymnast');

        if (!response.ok) throw new Error('Failed to fetch enrollment data');
        const result = await response.json();

        const data: AttendanceData[] = result.data;
        const values = data.map((item) => item.NoofStudents);
        const labels = data.map((item) => item.mthyr);

        setChartData(values);
        setCategories(labels);
      } catch (error) {
        console.error('Error fetching enrollment data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTeamType();
  }, []);

  const options: ApexOptions = {
    series: [
      {
        name: 'Students',
        data: chartData,
      },
    ],
    chart: {
      type: 'bar',
      height: 250,
      toolbar: { show: false },
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
      tickAmount: 5,
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
        columnWidth: '55%',
      },
    },
    dataLabels: {
      enabled: false,
    },
    legend: {
      show: false,
    },
    
    tooltip: {
      enabled: true,
      y: {
        formatter: (value) => `${value} students`,
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
        <CardTitle>Attendance/Month</CardTitle>
        <div className="flex gap-5"></div>
      </CardHeader>
      <CardContent className="flex flex-col justify-end items-stretch grow px-3 py-1">
        {!loading ? (
          <ApexChart
            id="enrollment_chart"
            options={options}
            series={options.series}
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

export default ActiveGymnastChart;
