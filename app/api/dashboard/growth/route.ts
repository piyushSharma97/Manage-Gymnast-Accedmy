// File: app/api/dashboard/growth/route.ts

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');
  try {
    //New-Trial/Month
        
    if (type === 'newtrial') {
      type MonthlyStat = {
        noofstudents: number | bigint;
        mth: number | bigint;
        yr: number | bigint;
      };
      // Get new registrations data for last 6 months
      const newRegistrations = await prisma.$queryRawUnsafe<MonthlyStat[]>(`
        SELECT COUNT(*) as noofstudents, MONTH(joinDate) as mth, YEAR(joinDate) as yr 
        FROM student  
        WHERE joinDate BETWEEN DATE_FORMAT(CURDATE() - INTERVAL 5 MONTH,'%Y-%m-01') AND NOW() 
        GROUP BY MONTH(joinDate), YEAR(joinDate) 
        ORDER BY joinDate ASC
      `);
    
      // Get trial data for last 6 months
      const trialData = await prisma.$queryRawUnsafe<MonthlyStat[]>(`
        SELECT COUNT(*) as noofstudents, MONTH(trialDate) as mth, YEAR(trialDate) as yr FROM trial WHERE trialDate BETWEEN DATE_FORMAT(CURDATE() - INTERVAL 5 MONTH,'%Y-%m-01') AND NOW() GROUP BY MONTH(trialDate), YEAR(trialDate) ORDER BY trialDate ASC
      `);
    
      // Generate last 6 months array
      const months = [];
      const currentDate = new Date();
    
      for (let i = 5; i >= 0; i--) {
        const date = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() - i,
          1
        );
        months.push({
          month: date.getMonth() + 1,
          year: date.getFullYear(),
          monthName:
            date.toLocaleString('default', { month: 'short' }) +
            ' ' +
            date.getFullYear(),
        });
      }
    
      // Create data arrays for each series
      const registrationData: number[] = [];
      const trialSeriesData: number[] = [];
    
      months.forEach((monthInfo) => {
        // Find registration data for this month
        const regData = newRegistrations.find(
          (reg) =>
            Number(reg.mth) === monthInfo.month &&
            Number(reg.yr) === monthInfo.year
        );
        registrationData.push(
          regData ? Number(regData.noofstudents) : 0
        );
    
        // Find trial data for this month
        const trialInfo = trialData.find(
          (trial) =>
            Number(trial.mth) === monthInfo.month &&
            Number(trial.yr) === monthInfo.year
        );
        trialSeriesData.push(
          trialInfo ? Number(trialInfo.noofstudents) : 0
        );
      });
    
      // Format data for line chart
      const chartData = {
        categories: months.map((m) => m.monthName), // ["Apr 2024", "May 2024", ...]
        series: [
          {
            name: 'New Registrations',
            data: registrationData,
          },
          {
            name: 'Trials Taken',
            data: trialSeriesData,
          },
        ],
      };
    
      return NextResponse.json({ data: chartData });
    }
    

    if (type === 'dropped') {
      type MonthlyStat = {
        NoofStudents: number | bigint;
        mth: number | bigint;
        yr: number | bigint;
        month_name: string;
      };
      const stats = await prisma.$queryRawUnsafe<[MonthlyStat]>(`
          SELECT 
            COUNT(*) as NoofStudents, 
            MONTH(deactivateDate) as mth, 
            YEAR(deactivateDate) as yr,
            MONTHNAME(deactivateDate) as month_name
          FROM student  
          WHERE deactivateDate BETWEEN DATE_FORMAT(CURDATE() - INTERVAL 5 MONTH, '%Y-%m-01') AND NOW() 
          GROUP BY YEAR(deactivateDate), MONTH(deactivateDate)
          ORDER BY YEAR(deactivateDate), MONTH(deactivateDate)
        `);

      // Convert any BigInt values to Number and format data for line graph
      const processedStats = stats.map((stat) => ({
        NoofStudents:
          typeof stat.NoofStudents === 'bigint'
            ? Number(stat.NoofStudents)
            : stat.NoofStudents,
        mth: stat.mth,
        yr: stat.yr,
        month_name: stat.month_name,
      }));

      // Create categories (month labels) and series data for ApexCharts line graph
      const categories = processedStats.map(
        (stat) => `${stat.month_name} ${stat.yr}`,
      );

      const seriesData = [
        {
          name: 'Dropped Gymnasts',
          data: processedStats.map((stat) => stat.NoofStudents),
        },
      ];

      // Format response for line graph consumption
      const responseData = {
        categories: categories,
        series: seriesData,
      };

      return NextResponse.json({ data: responseData });
    }
  } catch (error) {
    console.error('[GET /api/dashboard/batch] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch batch stats data' },
      { status: 500 },
    );
  }
}
