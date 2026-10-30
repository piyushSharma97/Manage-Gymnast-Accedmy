// File: app/api/dashboard/finance/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantContext } from '@/lib/api/tenant-helpers';
import { startOfWeek, endOfWeek, format, subWeeks } from 'date-fns';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');
  const groupBy = (searchParams.get('groupBy') || 'month') as 'week' | 'month';

  // Optional: scope to academy (tenant) when user is admin/manager
  let tenantId: number | undefined;
  try {
    const tenantContext = await getTenantContext(req);
    if (tenantContext?.tenantId) tenantId = tenantContext.tenantId;
  } catch {
    // continue without tenant filter
  }

  try {
    //depositcount
    if (type === 'depositcount') {
      type CurrentMonthStat = {
        students: number | bigint;
        receivedAt: string;
        sort_date: string;
        day_num: number | bigint;
      };
      // Current Month Data
      const currentMonth = await prisma.$queryRawUnsafe<CurrentMonthStat[]>(`
          SELECT 
            COUNT(id) as students, 
            DATE_FORMAT(receivedAt, '%d-%m-%Y') as receivedAt,
            DATE_FORMAT(receivedAt, '%Y-%m-%d') as sort_date,
            DAY(receivedAt) as day_num
          FROM payment 
          WHERE DATE_FORMAT(receivedAt, '%Y-%m-%d') BETWEEN 
            DATE_FORMAT(NOW(), '%Y-%m-01') AND 
            DATE_FORMAT(NOW(), '%Y-%m-%d') 
          GROUP BY DATE_FORMAT(receivedAt, '%Y-%m-%d') 
          ORDER BY receivedAt ASC
        `);

      // Previous Month Data (1 month ago)
      type PrevMonthStat = {
        students: number | bigint;
        receivedAt: string;
        sort_date: string;
        day_num: number | bigint;
      };
      const previousMonth = await prisma.$queryRawUnsafe<PrevMonthStat[]>(`
          SELECT 
            COUNT(id) as students, 
            DATE_FORMAT(receivedAt, '%d-%m-%Y') as receivedAt,
            DATE_FORMAT(receivedAt, '%Y-%m-%d') as sort_date,
            DAY(receivedAt) as day_num
          FROM payment 
          WHERE DATE_FORMAT(receivedAt, '%Y-%m-%d') BETWEEN 
            (DATE_FORMAT(CURDATE() - INTERVAL 1 MONTH, '%Y-%m-01')) AND 
            (DATE_FORMAT(LAST_DAY(CURDATE() - INTERVAL 1 MONTH), '%Y-%m-%d')) 
          GROUP BY DATE_FORMAT(receivedAt, '%Y-%m-%d') 
          ORDER BY receivedAt ASC
        `);

      // Two Months Ago Data
      type TwoMonthStat = {
        students: number | bigint;
        receivedAt: string;
        sort_date: string;
        day_num: number | bigint;
      };
      const twoMonthsAgo = await prisma.$queryRawUnsafe<TwoMonthStat[]>(`
          SELECT 
            COUNT(id) as students, 
            DATE_FORMAT(receivedAt, '%d-%m-%Y') as receivedAt,
            DATE_FORMAT(receivedAt, '%Y-%m-%d') as sort_date,
            DAY(receivedAt) as day_num
          FROM payment 
          WHERE DATE_FORMAT(receivedAt, '%Y-%m-%d') BETWEEN 
            (DATE_FORMAT(CURDATE() - INTERVAL 2 MONTH, '%Y-%m-01')) AND 
            (DATE_FORMAT(LAST_DAY(CURDATE() - INTERVAL 2 MONTH), '%Y-%m-%d')) 
          GROUP BY DATE_FORMAT(receivedAt, '%Y-%m-%d') 
          ORDER BY receivedAt ASC
        `);

      // Convert BigInt values to Numbers
      const processCurrentMonth = currentMonth.map((stat) => ({
        students:
          typeof stat.students === 'bigint'
            ? Number(stat.students)
            : stat.students,
        receivedAt: stat.receivedAt,
        sort_date: stat.sort_date,
        day_num:
          typeof stat.day_num === 'bigint'
            ? Number(stat.day_num)
            : stat.day_num,
      }));

      const processPreviousMonth = previousMonth.map((stat) => ({
        students:
          typeof stat.students === 'bigint'
            ? Number(stat.students)
            : stat.students,
        receivedAt: stat.receivedAt,
        sort_date: stat.sort_date,
        day_num:
          typeof stat.day_num === 'bigint'
            ? Number(stat.day_num)
            : stat.day_num,
      }));

      const processTwoMonthsAgo = twoMonthsAgo.map((stat) => ({
        students:
          typeof stat.students === 'bigint'
            ? Number(stat.students)
            : stat.students,
        receivedAt: stat.receivedAt,
        sort_date: stat.sort_date,
        day_num:
          typeof stat.day_num === 'bigint'
            ? Number(stat.day_num)
            : stat.day_num,
      }));

      // Create a comprehensive day range (1-31) for consistent x-axis
      const allDays = Array.from({ length: 31 }, (_, i) => i + 1);

      // Create data arrays for each month, filling missing days with 0
      const currentMonthData = allDays.map((day) => {
        const found = processCurrentMonth.find((item) => item.day_num === day);
        return found ? found.students : 0;
      });

      const previousMonthData = allDays.map((day) => {
        const found = processPreviousMonth.find((item) => item.day_num === day);
        return found ? found.students : 0;
      });

      const twoMonthsAgoData = allDays.map((day) => {
        const found = processTwoMonthsAgo.find((item) => item.day_num === day);
        return found ? found.students : 0;
      });

      // Get month names for series labels
      const currentDate = new Date();
      const currentMonthName = currentDate.toLocaleString('default', {
        month: 'long',
        year: 'numeric',
      });

      const prevDate = new Date();
      prevDate.setMonth(prevDate.getMonth() - 1);
      const prevMonthName = prevDate.toLocaleString('default', {
        month: 'long',
        year: 'numeric',
      });

      const twoMonthsDate = new Date();
      twoMonthsDate.setMonth(twoMonthsDate.getMonth() - 2);
      const twoMonthsName = twoMonthsDate.toLocaleString('default', {
        month: 'long',
        year: 'numeric',
      });

      // Create categories (days 1-31)
      const categories = allDays.map((day) => day.toString());

      // Create series data for line graph
      const seriesData = [
        {
          name: twoMonthsName,
          data: twoMonthsAgoData,
        },
        {
          name: prevMonthName,
          data: previousMonthData,
        },
        {
          name: currentMonthName,
          data: currentMonthData,
        },
      ];

      // Format response for line graph
      const chartData = {
        categories: categories,
        series: seriesData,
      };

      return NextResponse.json({ data: chartData });
    }

    if (type === 'depositamount') {
      // Current Month Data
      type CurrentMonthStat = {
        totalpaid: number | bigint;
        receivedAt: string;
        sort_date: string;
        day_num: number | bigint;
      };
      const currentMonth = await prisma.$queryRawUnsafe<CurrentMonthStat[]>(`
            SELECT 
              sum(amount) as totalpaid, 
              DATE_FORMAT(receivedAt, '%d-%m-%Y') as receivedAt,
              DATE_FORMAT(receivedAt, '%Y-%m-%d') as sort_date,
              DAY(receivedAt) as day_num
            FROM payment 
            WHERE DATE_FORMAT(receivedAt, '%Y-%m-%d') BETWEEN 
              DATE_FORMAT(NOW(), '%Y-%m-01') AND 
              DATE_FORMAT(NOW(), '%Y-%m-%d') 
            GROUP BY DATE_FORMAT(receivedAt, '%Y-%m-%d') 
            ORDER BY receivedAt ASC
          `);

      // Previous Month Data (1 month ago)
      type PrevMonthStat = {
        totalpaid: number | bigint;
        receivedAt: string;
        sort_date: string;
        day_num: number | bigint;
      };
      const previousMonth = await prisma.$queryRawUnsafe<PrevMonthStat[]>(`
            SELECT 
               sum(amount) as totalpaid, 
              DATE_FORMAT(receivedAt, '%d-%m-%Y') as receivedAt,
              DATE_FORMAT(receivedAt, '%Y-%m-%d') as sort_date,
              DAY(receivedAt) as day_num
            FROM payment 
            WHERE DATE_FORMAT(receivedAt, '%Y-%m-%d') BETWEEN 
              (DATE_FORMAT(CURDATE() - INTERVAL 1 MONTH, '%Y-%m-01')) AND 
              (DATE_FORMAT(LAST_DAY(CURDATE() - INTERVAL 1 MONTH), '%Y-%m-%d')) 
            GROUP BY DATE_FORMAT(receivedAt, '%Y-%m-%d') 
            ORDER BY receivedAt ASC
          `);

      // Two Months Ago Data
      type TwoMonthStat = {
        totalpaid: number | bigint;
        receivedAt: string;
        sort_date: string;
        day_num: number | bigint;
      };
      const twoMonthsAgo = await prisma.$queryRawUnsafe<TwoMonthStat[]>(`
            SELECT 
            sum(amount) as totalpaid,
              DATE_FORMAT(receivedAt, '%d-%m-%Y') as receivedAt,
              DATE_FORMAT(receivedAt, '%Y-%m-%d') as sort_date,
              DAY(receivedAt) as day_num
            FROM payment 
            WHERE DATE_FORMAT(receivedAt, '%Y-%m-%d') BETWEEN 
              (DATE_FORMAT(CURDATE() - INTERVAL 2 MONTH, '%Y-%m-01')) AND 
              (DATE_FORMAT(LAST_DAY(CURDATE() - INTERVAL 2 MONTH), '%Y-%m-%d')) 
            GROUP BY DATE_FORMAT(receivedAt, '%Y-%m-%d') 
            ORDER BY receivedAt ASC
          `);

      // Convert BigInt values to Numbers

      const processCurrentMonth = currentMonth.map((stat) => ({
        totalpaid:
          typeof stat.totalpaid === 'bigint'
            ? Number(stat.totalpaid)
            : stat.totalpaid,
        date: stat.receivedAt,
        day_num:
          typeof stat.day_num === 'bigint'
            ? Number(stat.day_num)
            : stat.day_num,
      }));

      const processPreviousMonth = previousMonth.map((stat) => ({
        totalpaid:
          typeof stat.totalpaid === 'bigint'
            ? Number(stat.totalpaid)
            : stat.totalpaid,
        date: stat.receivedAt,
        day_num:
          typeof stat.day_num === 'bigint'
            ? Number(stat.day_num)
            : stat.day_num,
      }));

      const processTwoMonthsAgo = twoMonthsAgo.map((stat) => ({
        totalpaid:
          typeof stat.totalpaid === 'bigint'
            ? Number(stat.totalpaid)
            : stat.totalpaid,
        date: stat.receivedAt,
        day_num:
          typeof stat.day_num === 'bigint'
            ? Number(stat.day_num)
            : stat.day_num,
      }));

      // Create a comprehensive day range (1-31) for consistent x-axis
      const allDays = Array.from({ length: 31 }, (_, i) => i + 1);

      // Create data arrays for each month, filling missing days with 0
      const currentMonthData = allDays.map((day) => {
        const found = processCurrentMonth.find((item) => item.day_num === day);
        return found ? found.totalpaid : 0;
      });

      const previousMonthData = allDays.map((day) => {
        const found = processPreviousMonth.find((item) => item.day_num === day);
        return found ? found.totalpaid : 0;
      });

      const twoMonthsAgoData = allDays.map((day) => {
        const found = processTwoMonthsAgo.find((item) => item.day_num === day);
        return found ? found.totalpaid : 0;
      });

      // Get month names for series labels
      const currentDate = new Date();
      const currentMonthName = currentDate.toLocaleString('default', {
        month: 'long',
        year: 'numeric',
      });

      const prevDate = new Date();
      prevDate.setMonth(prevDate.getMonth() - 1);
      const prevMonthName = prevDate.toLocaleString('default', {
        month: 'long',
        year: 'numeric',
      });

      const twoMonthsDate = new Date();
      twoMonthsDate.setMonth(twoMonthsDate.getMonth() - 2);
      const twoMonthsName = twoMonthsDate.toLocaleString('default', {
        month: 'long',
        year: 'numeric',
      });

      // Create categories (days 1-31)
      const categories = allDays.map((day) => day.toString());

      // Create series data for line graph
      const seriesData = [
        {
          name: twoMonthsName,
          data: twoMonthsAgoData,
        },
        {
          name: prevMonthName,
          data: previousMonthData,
        },
        {
          name: currentMonthName,
          data: currentMonthData,
        },
      ];

      // Format response for line graph
      const chartData = {
        categories: categories,
        series: seriesData,
      };

      return NextResponse.json({ data: chartData });
    }

    //teamamount
    if (type === 'teamamount') {
      type teamamountStat = {
        CURRENTTP: number | bigint;
        LASTTP: number | bigint;
        TWO_MONTHS_AGO: number | bigint;
        TeamType: string;
      };
      const stats = await prisma.$queryRawUnsafe<teamamountStat[]>(`
         SELECT team as TeamType, IFNULL(SUM(CASE WHEN lastfeesdate BETWEEN DATE_FORMAT(CURDATE(), '%Y-%m-01') AND CURDATE() THEN lastfeesamt END), 0) AS CURRENTTP, IFNULL(SUM(CASE WHEN lastfeesdate BETWEEN DATE_FORMAT(CURDATE() - INTERVAL 1 MONTH, '%Y-%m-01') AND LAST_DAY(CURDATE() - INTERVAL 1 MONTH) THEN lastfeesamt END), 0) AS LASTTP, IFNULL(SUM(CASE WHEN lastfeesdate BETWEEN DATE_FORMAT(CURDATE() - INTERVAL 2 MONTH, '%Y-%m-01') AND LAST_DAY(CURDATE() - INTERVAL 2 MONTH) THEN lastfeesamt END), 0) AS TWO_MONTHS_AGO FROM student r WHERE r.status != 'Dormant' AND team NOT IN ('AdultsGymnastics', 'GoldTeam', 'RhythmNRhyme', 'Recreational') GROUP BY team ORDER BY team
        `);

      // Convert any BigInt values to Number and process the data

      const processedStats = stats.map((stat) => ({
        CURRENT_MONTH:
          typeof stat.CURRENTTP === 'bigint'
            ? Number(stat.CURRENTTP)
            : stat.CURRENTTP,
        LAST_MONTH:
          typeof stat.LASTTP === 'bigint' ? Number(stat.LASTTP) : stat.LASTTP,
        TWO_MONTHS_AGO:
          typeof stat.TWO_MONTHS_AGO === 'bigint'
            ? Number(stat.TWO_MONTHS_AGO)
            : stat.TWO_MONTHS_AGO,
        TeamType: stat.TeamType,
      }));

      // Create categories (dates) for x-axis
      const categories = processedStats.map((stat) => `${stat.TeamType}`);

      // Create series data for multiple bars
      const seriesData = [
        {
          name: 'CM',
          data: processedStats.map((stat) => stat.CURRENT_MONTH),
        },
        {
          name: 'CM-1',
          data: processedStats.map((stat) => stat.LAST_MONTH),
        },
        {
          name: 'CM-2',
          data: processedStats.map((stat) => stat.TWO_MONTHS_AGO),
        },
      ];

      // Format response for bar chart consumption
      const responseData = {
        categories: categories,
        series: seriesData,
      };

      return NextResponse.json({ data: responseData });
    }

    //Beginners
    if (type === 'beginneramount') {
      type BeginnerStat = {
        CURRENTTP: number | bigint;
        TWO_MONTHS_AGO: number | bigint;
        SkillLevel: string;
        LASTTP: number | bigint;
      };
      const stats = await prisma.$queryRawUnsafe<BeginnerStat[]>(`
         SELECT currentSkillLevelId as SkillLevel, ifnull(SUM(CASE WHEN lastfeesdate BETWEEN DATE_FORMAT( NOW() , '%Y-%m-01' ) AND NOW( ) THEN lastfeesamt END),0) CURRENTTP, ifnull(SUM(CASE WHEN lastfeesdate BETWEEN (DATE_FORMAT( CURDATE() - INTERVAL 1 MONTH,'%Y-%m-01' )) AND (DATE_FORMAT( LAST_DAY( CURDATE() - INTERVAL 1 MONTH ),'%Y-%m-%d')) THEN lastfeesamt END ),0)LASTTP ,ifnull(SUM(CASE WHEN lastfeesdate BETWEEN (DATE_FORMAT( CURDATE() - INTERVAL 2 MONTH,'%Y-%m-01' )) AND (DATE_FORMAT( LAST_DAY( CURDATE() - INTERVAL 2 MONTH ),'%Y-%m-%d')) THEN lastfeesamt END ),0)TWO_MONTHS_AGO FROM student r where r.status !='Dormant' and team in ('Recreational') GROUP by currentSkillLevelId ORDER by currentSkillLevelId
        `);

      // Convert any BigInt values to Number and process the data
      const processedStats = stats.map((stat) => ({
        CURRENT_MONTH:
          typeof stat.CURRENTTP === 'bigint'
            ? Number(stat.CURRENTTP)
            : stat.CURRENTTP,
        LAST_MONTH:
          typeof stat.LASTTP === 'bigint' ? Number(stat.LASTTP) : stat.LASTTP,
        TWO_MONTHS_AGO:
          typeof stat.TWO_MONTHS_AGO === 'bigint'
            ? Number(stat.TWO_MONTHS_AGO)
            : stat.TWO_MONTHS_AGO,
        SkillLevel: stat.SkillLevel,
      }));

      // Create categories (dates) for x-axis
      const categories = processedStats.map((stat) => `${stat.SkillLevel}`);

      // Create series data for multiple bars
      const seriesData = [
        {
          name: 'CM',
          data: processedStats.map((stat) => stat.CURRENT_MONTH),
        },
        {
          name: 'CM-1',
          data: processedStats.map((stat) => stat.LAST_MONTH),
        },
        {
          name: 'CM-2',
          data: processedStats.map((stat) => stat.TWO_MONTHS_AGO),
        },
      ];

      // Format response for bar chart consumption
      const responseData = {
        categories: categories,
        series: seriesData,
      };

      return NextResponse.json({ data: responseData });
    }

    //Batch Amount
    if (type === 'batchamount') {
      type BatchStat = {
        CURRENTTP: number | bigint;
        TWO_MONTHS_AGO: number | bigint;
        cp1: string;
        LASTTP: number | bigint;
      };
      const stats = await prisma.$queryRawUnsafe<[BatchStat]>(`
          SELECT C.courseName cp1, ifnull(SUM(CASE WHEN paidAt BETWEEN DATE_FORMAT( NOW( ) , '%Y-%m-01' ) AND NOW( ) THEN sf.amount END),0) CURRENTTP, ifnull(SUM(CASE WHEN paidAt BETWEEN (DATE_FORMAT( CURDATE( ) - INTERVAL 1 MONTH,'%Y-%m-01' )) AND (DATE_FORMAT( LAST_DAY( CURDATE( ) - INTERVAL 1 MONTH ),'%Y-%m-%d')) THEN sf.amount END ),0)LASTTP ,ifnull(SUM(CASE WHEN paidAt BETWEEN (DATE_FORMAT( CURDATE( ) - INTERVAL 2 MONTH,'%Y-%m-01' )) AND (DATE_FORMAT( LAST_DAY( CURDATE( ) - INTERVAL 2 MONTH ),'%Y-%m-%d')) THEN sf.amount END ),0)TWO_MONTHS_AGO FROM invoice SF INNER JOIN course C ON SF.courseId=C.ID where isActive = 1 GROUP BY C.courseName
        `);

      // Convert any BigInt values to Number and process the data
      const processedStats = stats.map((stat) => ({
        CURRENT_MONTH:
          typeof stat.CURRENTTP === 'bigint'
            ? Number(stat.CURRENTTP)
            : stat.CURRENTTP,
        LAST_MONTH:
          typeof stat.LASTTP === 'bigint' ? Number(stat.LASTTP) : stat.LASTTP,
        TWO_MONTHS_AGO:
          typeof stat.TWO_MONTHS_AGO === 'bigint'
            ? Number(stat.TWO_MONTHS_AGO)
            : stat.TWO_MONTHS_AGO,
        cp1: stat.cp1,
      }));

      // Create categories (dates) for x-axis
      const categories = processedStats.map((stat) => `${stat.cp1}`);

      // Create series data for multiple bars
      const seriesData = [
        {
          name: 'CM',
          data: processedStats.map((stat) => stat.CURRENT_MONTH),
        },
        {
          name: 'CM-1',
          data: processedStats.map((stat) => stat.LAST_MONTH),
        },
        {
          name: 'CM-2',
          data: processedStats.map((stat) => stat.TWO_MONTHS_AGO),
        },
      ];

      // Format response for bar chart consumption
      const responseData = {
        categories: categories,
        series: seriesData,
      };

      return NextResponse.json({ data: responseData });
    }
    //PaymentsperMonth (supports groupBy=week|month and tenant scoping)
    if (type === 'paymentspermonth') {
      const tenantClause = tenantId != null ? ` AND tenantId = ${tenantId}` : '';

      if (groupBy === 'week') {
        const end = new Date();
        const bucket = new Map<number, number>();
        // Build 12 weeks in order (Monday start)
        for (let i = 11; i >= 0; i--) {
          const weekStart = startOfWeek(subWeeks(end, i), { weekStartsOn: 1 });
          bucket.set(weekStart.getTime(), 0);
        }
        const start = new Date(Math.min(...Array.from(bucket.keys())));
        const payments = await prisma.payment.findMany({
          where: {
            receivedAt: { gte: start, lte: end },
            ...(tenantId != null ? { tenantId } : {}),
          },
          select: { receivedAt: true },
        });
        payments.forEach((p) => {
          const wStart = startOfWeek(p.receivedAt, { weekStartsOn: 1 });
          const k = wStart.getTime();
          if (bucket.has(k)) bucket.set(k, (bucket.get(k) ?? 0) + 1);
        });
        const sortedKeys = Array.from(bucket.keys()).sort((a, b) => a - b);
        const categories = sortedKeys.map((ts) => {
          const wStart = new Date(ts);
          const wEnd = endOfWeek(wStart, { weekStartsOn: 1 });
          return `${format(wStart, 'dd MMM')} - ${format(wEnd, 'dd MMM')}`;
        });
        const seriesData = [
          { name: 'Payments per Week', data: sortedKeys.map((ts) => bucket.get(ts) ?? 0) },
        ];
        return NextResponse.json({
          data: { categories, series: seriesData },
          xAxisLabel: 'Week',
          yAxisLabel: 'Number of payments',
        });
      }

      type PaymentStat = {
        NoofStudents: number | bigint;
        mth: string;
        yr: string;
        month_name: string;
      };
      const stats = await prisma.$queryRawUnsafe<PaymentStat[]>(`
              SELECT COUNT(*) NoofStudents, MONTH(receivedAt) mth, YEAR(receivedAt) yr,
                CONCAT(LPAD(MONTH(receivedAt),2,'0'),'-',YEAR(receivedAt)) month_name
              FROM payment
              WHERE receivedAt BETWEEN DATE_FORMAT(CURDATE() - INTERVAL 11 MONTH,'%Y-%m-01') AND NOW()
              ${tenantClause}
              GROUP BY YEAR(receivedAt), MONTH(receivedAt)
              ORDER BY yr ASC, mth ASC
            `);

      const processedStats = stats.map((stat) => ({
        NoofStudents: typeof stat.NoofStudents === 'bigint' ? Number(stat.NoofStudents) : stat.NoofStudents,
        mth: stat.mth,
        yr: stat.yr,
        month_name: stat.month_name,
      }));

      // Use "Jan 2025" style labels
      const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const categories = processedStats.map((s) => `${monthNames[Number(s.mth) - 1]} ${s.yr}`);
      const seriesData = [
        { name: 'Payments per Month', data: processedStats.map((stat) => stat.NoofStudents) },
      ];

      return NextResponse.json({
        data: { categories, series: seriesData },
        xAxisLabel: 'Month',
        yAxisLabel: 'Number of payments',
      });
    }

    //amountpermonth (supports groupBy=week|month and tenant scoping)
    if (type === 'amountpermonth') {
      const tenantClause = tenantId != null ? ` AND tenantId = ${tenantId}` : '';

      if (groupBy === 'week') {
        const end = new Date();
        const bucket = new Map<number, number>();
        for (let i = 11; i >= 0; i--) {
          const weekStart = startOfWeek(subWeeks(end, i), { weekStartsOn: 1 });
          bucket.set(weekStart.getTime(), 0);
        }
        const start = new Date(Math.min(...Array.from(bucket.keys())));
        const payments = await prisma.payment.findMany({
          where: {
            receivedAt: { gte: start, lte: end },
            ...(tenantId != null ? { tenantId } : {}),
          },
          select: { receivedAt: true, amount: true },
        });
        payments.forEach((p) => {
          const wStart = startOfWeek(p.receivedAt, { weekStartsOn: 1 });
          const k = wStart.getTime();
          if (bucket.has(k)) bucket.set(k, (bucket.get(k) ?? 0) + Number(p.amount));
        });
        const sortedKeys = Array.from(bucket.keys()).sort((a, b) => a - b);
        const categories = sortedKeys.map((ts) => {
          const wStart = new Date(ts);
          const wEnd = endOfWeek(wStart, { weekStartsOn: 1 });
          return `${format(wStart, 'dd MMM')} - ${format(wEnd, 'dd MMM')}`;
        });
        const seriesData = [
          { name: 'Revenue', data: sortedKeys.map((ts) => Math.round((bucket.get(ts) ?? 0) * 100) / 100) },
        ];
        return NextResponse.json({
          data: { categories, series: seriesData },
          xAxisLabel: 'Week',
          yAxisLabel: 'Revenue (USD)',
        });
      }

      type AmountpermonthStat = {
        NoofStudents: number | bigint;
        mth: string;
        yr: string;
        month_name: string;
      };
      const stats = await prisma.$queryRawUnsafe<AmountpermonthStat[]>(`
         SELECT SUM(amount) NoofStudents, MONTH(receivedAt) mth, YEAR(receivedAt) yr,
           CONCAT(LPAD(MONTH(receivedAt),2,'0'),'-',YEAR(receivedAt)) month_name
         FROM payment
         WHERE receivedAt BETWEEN DATE_FORMAT(CURDATE() - INTERVAL 11 MONTH,'%Y-%m-01') AND NOW()
         ${tenantClause}
         GROUP BY YEAR(receivedAt), MONTH(receivedAt)
         ORDER BY yr ASC, mth ASC
        `);

      const processedStats = stats.map((stat) => ({
        NoofStudents: typeof stat.NoofStudents === 'bigint' ? Number(stat.NoofStudents) : stat.NoofStudents,
        mth: stat.mth,
        yr: stat.yr,
        month_name: stat.month_name,
      }));

      const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const categories = processedStats.map((s) => `${monthNames[Number(s.mth) - 1]} ${s.yr}`);
      const seriesData = [
        { name: 'Revenue', data: processedStats.map((stat) => Number(stat.NoofStudents)) },
      ];

      return NextResponse.json({
        data: { categories, series: seriesData },
        xAxisLabel: 'Month',
        yAxisLabel: 'Revenue (USD)',
      });
    }
  } catch (error) {
    console.error('[GET /api/dashboard/finance] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch finance stats data' },
      { status: 500 },
    );
  }
}
