'use client';

import { useEffect, useState } from 'react';
import { ApexOptions } from 'apexcharts';
import ApexChart from 'react-apexcharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Define the shape of the data you expect from your API
interface TeamGenderData {
  TeamType: string;
  Boys: number;
  Girls: number;
  Total?: number; // Optional, as it's not strictly needed for the chart rendering itself
}

const GenderwiseChart = () => {
  const [chartSeries, setChartSeries] = useState<ApexAxisChartSeries>([]); // This will hold our stacked series data
  const [categories, setCategories] = useState<string[]>([]); // This will hold our TeamType labels
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchGenderwiseData = async () => {
      try {
        const response = await fetch('/api/dashboard/enrollment?type=genderwise');
        if (!response.ok) throw new Error('Failed to fetch enrollment data');

        const result = await response.json();
        const data: TeamGenderData[] = result.data; // Type assertion for clarity

        // Extract categories (Team Types)
        const teamCategories = data.map(item => item.TeamType);

        // Extract data for 'Boys' and 'Girls' series
        const boysData = data.map(item => item.Boys);
        const girlsData = data.map(item => item.Girls);

        // Prepare the series array for ApexCharts stacked bar chart
        const series: ApexAxisChartSeries = [
          {
            name: 'Boys',
            data: boysData,
          },
          {
            name: 'Girls',
            data: girlsData,
          },
        ];

        setChartSeries(series);
        setCategories(teamCategories);
      } catch (error) {
        console.error('Error fetching enrollment data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGenderwiseData();
  }, []);

  const options: ApexOptions = {
    chart: {
      type: 'bar',
      height: 300,
      stacked: true, // Crucial for a stacked bar chart
      toolbar: { show: false },
    },
    xaxis: {
      categories: categories, // Use teamCategories for x-axis labels
      
    },
    yaxis: {
      title: {
        text: 'Number of Students',
      },
      min: 0,
      max: 400, // Set the maximum value for the y-axis
      tickAmount: 10, // (max - min) / interval = (400 - 0) / 20 = 20 intervals, so 21 ticks
      labels: {
        formatter: function (val) {
          return Math.round(val).toString();
        }
      },
    },
    plotOptions: {
      bar: {
        horizontal: false, // Vertical bars are typical for stacked
      },
    },
    legend: {
        show: false, // Position legend nicely
    },
    tooltip: {
      y: {
        formatter: (value: number) => `${value} students`,
      },
    },
    fill: {
      opacity: 1,
    },
    // Optional: Define specific colors for Boys and Girls for consistency
    colors: ['#008FFB', '#FF4560'], // Example colors: blue for boys, red for girls
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Gender Distribution by Team Type</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col justify-end items-stretch grow px-3 py-1">
        {!loading ? (        
            <ApexChart
              id="genderwise_stacked_bar_chart" // Changed ID for uniqueness
              options={options}
              series={chartSeries} // Pass the structured series data
              type="bar"
              height={300}
            />         
        ) : (
          <p className="text-center text-sm">Loading chart...</p>
        )}
      </CardContent>
    </Card>
  );
};

export default GenderwiseChart;