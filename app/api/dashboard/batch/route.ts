// File: app/api/dashboard/enrollment/route.ts

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');
  try {
    //coursetype
    if (type === 'coursetype') {
      type CourseType = 'Reg' | 'Elite' | 'Interm';
      type DayStat = {
        name: CourseType;
        Monday: bigint | number;
        Tuesday: bigint | number;
        Wednesday: bigint | number;
        Thursday: bigint | number;
        Friday: bigint | number;
        Saturday: bigint | number;
        Sunday: bigint | number;
      };

      const dayStats = await prisma.$queryRawUnsafe<DayStat[]>(`
        SELECT 'Reg' as name, ifnull(SUM(CASE WHEN monday NOT IN ('','NULL') THEN 1 END),0) Monday, ifnull(SUM(CASE WHEN tuesday NOT IN ('','NULL') THEN 1 END),0) Tuesday, ifnull(SUM(CASE WHEN wednesday NOT IN ('','NULL') THEN 1 END),0) Wednesday, ifnull(SUM(CASE WHEN thursday NOT IN ('','NULL') THEN 1 END),0) Thursday, ifnull(SUM(CASE WHEN friday NOT IN ('','NULL') THEN 1 END),0) Friday, ifnull(SUM(CASE WHEN saturday NOT IN ('','NULL') THEN 1 END),0) Saturday, ifnull(SUM(CASE WHEN sunday NOT IN ('','NULL') THEN 1 END),0) Sunday FROM student r inner join (Select * from enrollment where id in (select max(id) from enrollment group by studentId)) cj on r.courseId=cj.courseId and r.id=cj.studentId inner join course c on c.id=cj.courseId inner join batch b on b.courseId=c.id where r.status !='suspended' and (name like '2 Class%' or name like '3 Class%')
UNION SELECT 'Elite' as name, ifnull(SUM(CASE WHEN monday NOT IN ('','NULL') THEN 1 END),0) Monday, ifnull(SUM(CASE WHEN tuesday NOT IN ('','NULL') THEN 1 END),0) Tuesday, ifnull(SUM(CASE WHEN wednesday NOT IN ('','NULL') THEN 1 END),0) Wednesday, ifnull(SUM(CASE WHEN thursday NOT IN ('','NULL') THEN 1 END),0) Thursday, ifnull(SUM(CASE WHEN friday NOT IN ('','NULL') THEN 1 END),0) Friday, ifnull(SUM(CASE WHEN saturday NOT IN ('','NULL') THEN 1 END),0) Saturday, ifnull(SUM(CASE WHEN sunday NOT IN ('','NULL') THEN 1 END),0) Sunday FROM student r inner join (Select * from enrollment where id in (select max(id) from enrollment group by studentId)) cj on r.courseId=cj.courseId and r.id=cj.studentId inner join course c on c.id=cj.courseId inner join batch b on b.courseId=c.id where  r.status !='Dormant'  and name like 'Elite%'
                    UNION SELECT 'Interm' name, ifnull(SUM(CASE WHEN monday NOT IN ('','NULL') THEN 1 END),0) Monday, ifnull(SUM(CASE WHEN tuesday NOT IN ('','NULL') THEN 1 END),0) Tuesday, ifnull(SUM(CASE WHEN wednesday NOT IN ('','NULL') THEN 1 END),0) Wednesday, ifnull(SUM(CASE WHEN thursday NOT IN ('','NULL') THEN 1 END),0) Thursday, ifnull(SUM(CASE WHEN friday NOT IN ('','NULL') THEN 1 END),0) Friday, ifnull(SUM(CASE WHEN saturday NOT IN ('','NULL') THEN 1 END),0) Saturday, ifnull(SUM(CASE WHEN sunday NOT IN ('','NULL') THEN 1 END),0) Sunday FROM student r inner join (Select * from enrollment where id in (select max(id) from enrollment group by studentId)) cj on r.courseId=cj.courseId and r.id=cj.studentId inner join course c on c.id=cj.courseId inner join batch b on b.courseId=c.id where  r.status !='Dormant'  and name like 'Interm%'`);

      const weekdays = [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
      ] as const;

      // Define seriesData with strict typing
      const seriesData: Record<CourseType, number[]> = {
        Reg: new Array(weekdays.length).fill(0),
        Elite: new Array(weekdays.length).fill(0),
        Interm: new Array(weekdays.length).fill(0),
      };

      // Fill actual data
      dayStats.forEach((stat) => {
        const courseType = stat.name; // TS now knows it's CourseType
        weekdays.forEach((day, index) => {
          const value =
            typeof stat[day] === 'bigint' ? Number(stat[day]) : stat[day];
          seriesData[courseType][index] = value || 0;
        });
      });

      // Format for ApexCharts
      const chartData = {
        categories: weekdays,
        series: [
          { name: 'Reg', data: seriesData.Reg },
          { name: 'Elite', data: seriesData.Elite },
          { name: 'Interm', data: seriesData.Interm },
        ],
      };

      return NextResponse.json({ data: chartData });
    }

    //daysofweek
    // Inside your API route, if type === 'daysofweek'
    if (type === 'daysofweek') {
      // Get number of gymnasts attending classes per day
      const dayStats = await prisma.$queryRawUnsafe(`
       SELECT 
          'Reg' as gymnast, 
          IFNULL(SUM(CASE WHEN monday NOT IN ('', 'NULL') AND Monday IS NOT NULL THEN 1 END), 0) as Monday, 
          IFNULL(SUM(CASE WHEN tuesday NOT IN ('', 'NULL') AND Tuesday IS NOT NULL THEN 1 END), 0) as Tuesday, 
          IFNULL(SUM(CASE WHEN wednesday NOT IN ('', 'NULL') AND Wednesday IS NOT NULL THEN 1 END), 0) as Wednesday, 
          IFNULL(SUM(CASE WHEN thursday NOT IN ('', 'NULL') AND Thursday IS NOT NULL THEN 1 END), 0) as Thursday, 
          IFNULL(SUM(CASE WHEN friday NOT IN ('', 'NULL') AND Friday IS NOT NULL THEN 1 END), 0) as Friday, 
          IFNULL(SUM(CASE WHEN saturday NOT IN ('', 'NULL') AND Saturday IS NOT NULL THEN 1 END), 0) as Saturday, 
          IFNULL(SUM(CASE WHEN sunday NOT IN ('', 'NULL') AND Sunday IS NOT NULL THEN 1 END), 0) as Sunday 
        FROM student r 
        INNER JOIN (
          SELECT * FROM enrollment 
          WHERE id IN (
            SELECT MAX(id) FROM enrollment GROUP BY studentId
          )
        ) cj ON r.courseId = cj.batchId AND r.id = cj.studentId 
        INNER JOIN batch b ON b.id = cj.courseId 
        WHERE r.status != 'Dormant'
      `);

      const categories = [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
      ];

      // Define proper type for better type safety
      interface DayStatsRow {
        gymnast: string;
        Monday: number;
        Tuesday: number;
        Wednesday: number;
        Thursday: number;
        Friday: number;
        Saturday: number;
        Sunday: number;
      }

      const seriesData: ApexAxisChartSeries = [];

      (dayStats as DayStatsRow[]).forEach((row) => {
        const gymnast = row.gymnast;
        const data = categories.map((day) =>
          Number(row[day as keyof DayStatsRow]),
        );

        seriesData.push({
          name: gymnast,
          data: data,
        });
      });

      return NextResponse.json({
        data: seriesData,
        categories: categories,
      });
    }
    //classperweek
    if (type === 'classperweek') {
      type ClassPerWeekStat = {
        NoofStudents: bigint;
        dow: string; // day of week
      };

      const dayStats = await prisma.$queryRawUnsafe<ClassPerWeekStat[]>(`
        SELECT COUNT(r.id) AS NoofStudents, classFrequency as dow FROM student r INNER JOIN course c ON r.courseId = c.id WHERE status != 'Dormant' GROUP BY classFrequency ORDER BY classFrequency
      `);

      const classperWeek = dayStats.map((stat) => ({
        NoofStudents: Number(stat.NoofStudents), // convert bigint → number
        dow: stat.dow,
      }));

      return NextResponse.json({ data: classperWeek });
    }

    //paymentcycle
    if (type === 'paymentcycle') {
      type PaymentCycleStat = {
        NoofStudents: bigint;
        paymentcycle: string;
      };

      const dayStats = await prisma.$queryRawUnsafe<PaymentCycleStat[]>(`
        SELECT COUNT(r.id) AS NoofStudents, paymentCycle FROM student r INNER JOIN course c ON r.courseId = c.id WHERE status != 'Dormant' GROUP BY paymentCycle ORDER BY paymentCycle
      `);

      const classperWeek = dayStats.map((stat) => ({
        NoofStudents: Number(stat.NoofStudents), // convert bigint → number
        paymentcycle: stat.paymentcycle,
      }));

      return NextResponse.json({ data: classperWeek });
    }

    //batchopted
    if (type === 'batchopted') {
      type BatchOptedStat = {
        NoofStudents: bigint;
        batch: string;
      };

      const ageStats = await prisma.$queryRawUnsafe<BatchOptedStat[]>(`
        SELECT COUNT(*) AS NoofStudents, c.courseName AS batch FROM invoice sf INNER JOIN course c ON c.id = sf.courseId WHERE DATE_FORMAT(paidAt, '%Y-%m-%d') BETWEEN DATE_FORMAT(NOW(), '%Y-%m-01') AND DATE_FORMAT(NOW(), '%Y-%m-%d') GROUP BY courseName
      `);

      const batchopted = ageStats.map((row) => ({
        NoofStudents: Number(row.NoofStudents), // convert bigint → number
        batch: row.batch,
      }));

      return NextResponse.json({ data: batchopted });
    }

    // Unknown or missing type — always return JSON so client never gets empty body
    return NextResponse.json(
      { error: 'Missing or invalid type parameter. Use: coursetype, daysofweek, classperweek, paymentcycle, batchopted' },
      { status: 400 },
    );
  } catch (error) {
    console.error('[GET /api/dashboard/batch] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch batch stats data' },
      { status: 500 },
    );
  }
}
