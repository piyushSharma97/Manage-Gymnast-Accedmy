// File: app/api/dashboard/attendance/route.ts

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');
  try {
    //activegymnast
    type ActiveGymnastStat = {
      NoofStudents: bigint;
      mth: number;
      yr: number;
    };
    if (type === 'activegymnast') {
      const stats = await prisma.$queryRawUnsafe<ActiveGymnastStat[]>(`
          Select count(distinct studentId) NoofStudents, MONTH(sessionDate)mth ,year(sessionDate)yr FROM attendance a inner join student r on r.id=a.studentId where (sessionDate between date_format(curdate() - interval 5 month,'%Y-%m-%d') AND NOW()) group by MONTH(sessionDate) order by sessionDate asc
        `);

      // Convert any BigInt values to Number
      // const teamType = stats.map((stat) => ({
      //   NoofStudents:
      //     typeof stat.NoofStudents === 'bigint'
      //       ? Number(stat.NoofStudents)
      //       : stat.NoofStudents,
      //   mthyr: stat.mth + '/' + stat.yr,
      // }));
      const teamType = stats.map((stat) => ({
        NoofStudents: Number(stat.NoofStudents),
        mthyr: `${stat.mth}/${stat.yr}`,
      }));

      return NextResponse.json({ data: teamType });
    }

    //Gymnast in Different Skills/Day
    if (type === 'skillsday') {
      type SkillsDayStat = {
        age_4_6: bigint;
        age_7_14: bigint;
        levels: bigint;
        teams: bigint;
        attendance_date: string;
        day_name: string;
      };
      const stats = await prisma.$queryRawUnsafe<SkillsDayStat[]>(`
      SELECT 
        COUNT(DISTINCT CASE WHEN TIMESTAMPDIFF(YEAR, dob, CURDATE()) BETWEEN 4 AND 6 THEN studentId END) as age_4_6,
        COUNT(DISTINCT CASE WHEN TIMESTAMPDIFF(YEAR, dob, CURDATE()) BETWEEN 7 AND 14 THEN studentId END) as age_7_14,
        COUNT(DISTINCT CASE WHEN currentSkillLevelId IN ('L1','L2','L3') THEN studentId END) as levels,
        COUNT(DISTINCT CASE WHEN team IN ('GoldTeam','PurpleTeam','AquaTeam','Blackpearls','Straddlers','Pinmyacademy') THEN studentId END) as teams,
        DATE_FORMAT(sessionDate, '%Y-%m-%d') as attendance_date,
        DAYNAME(sessionDate) as day_name
      FROM (
        SELECT studentId, sessionDate 
        FROM attendance a 
        WHERE sessionDate > NOW() - INTERVAL 1 MONTH 
        UNION 
        SELECT studentId, makeupDate as sessionDate 
        FROM makeupclass m 
        WHERE makeupDate > NOW() - INTERVAL 1 MONTH
      ) attendance 
      INNER JOIN students r ON r.id = attendance.studentId 
      GROUP BY DATE(sessionDate)
      ORDER BY sessionDate DESC
      LIMIT 30
    `);

      // Convert any BigInt values to Number and process the data
      const processedStats = stats.map((stat) => ({
        age_4_6: Number(stat.age_4_6),
        age_7_14: Number(stat.age_7_14),
        levels: Number(stat.levels),
        teams: Number(stat.teams),
        attendance_date: stat.attendance_date,
        day_name: stat.day_name,
      }));

      // Create categories (dates) for x-axis
      const categories = processedStats.map(
        (stat) =>
          `${stat.attendance_date.split('-')[2]}/${stat.attendance_date.split('-')[1]}`,
      );

      // Create series data for multiple bars
      const seriesData = [
        {
          name: 'Age 4-6',
          data: processedStats.map((stat) => stat.age_4_6),
        },
        {
          name: 'Age 7-14',
          data: processedStats.map((stat) => stat.age_7_14),
        },
        {
          name: 'Skill Levels (L1-L3)',
          data: processedStats.map((stat) => stat.levels),
        },
        {
          name: 'Team Members',
          data: processedStats.map((stat) => stat.teams),
        },
      ];

      // Format response for bar chart consumption
      const responseData = {
        categories: categories,
        series: seriesData,
      };

      return NextResponse.json({ data: responseData });
    }

    //Gymnast in Different Skills/Month
    if (type === 'skillsmonth') {
      type SkillsMonthStat = {
        age_4_6: bigint;
        age_7_14: bigint;
        levels: bigint;
        teams: bigint;
        mthyr: string;
      };

      const stats = await prisma.$queryRawUnsafe<SkillsMonthStat[]>(`
        SELECT COUNT(DISTINCT CASE WHEN TIMESTAMPDIFF(YEAR, dob, CURDATE()) BETWEEN 4 AND 6 THEN studentId END) as age_4_6, COUNT(DISTINCT CASE WHEN TIMESTAMPDIFF(YEAR, dob, CURDATE()) BETWEEN 7 AND 14 THEN studentId END) as age_7_14, COUNT(DISTINCT CASE WHEN current_skill_level_id IN ('L1','L2','L3') THEN studentId END) as levels, COUNT(DISTINCT CASE WHEN teamtype IN ('Flippers','GoldTeam','Gliders','PurpleTeam','AquaTeam','Blackpearls','Straddlers','Pinmyacademy') THEN studentId END) as teams, CONCAT(MONTH(sessionDate),'/',YEAR(sessionDate)) as mthyr FROM attendance a INNER JOIN students r ON r.id = a.studentId WHERE (sessionDate BETWEEN DATE_FORMAT(CURDATE() - INTERVAL 5 MONTH,'%Y-%m-%d') AND NOW()) GROUP BY MONTH(sessionDate) ORDER BY sessionDate ASC
      `);

      // Convert BigInt → Number safely
      const processedStats = stats.map((stat) => ({
        age_4_6: Number(stat.age_4_6),
        age_7_14: Number(stat.age_7_14),
        levels: Number(stat.levels),
        teams: Number(stat.teams),
        mthyr: stat.mthyr,
      }));

      const categories = processedStats.map((stat) => stat.mthyr);

      const seriesData = [
        { name: 'Age 4-6', data: processedStats.map((stat) => stat.age_4_6) },
        { name: 'Age 7-14', data: processedStats.map((stat) => stat.age_7_14) },
        {
          name: 'Skill Levels (L1-L3)',
          data: processedStats.map((stat) => stat.levels),
        },
        {
          name: 'Team Members',
          data: processedStats.map((stat) => stat.teams),
        },
      ];

      return NextResponse.json({
        data: {
          categories,
          series: seriesData,
        },
      });
    }
  } catch (error) {
    console.error('[GET /api/dashboard/attendance] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch batch stats data' },
      { status: 500 },
    );
  }
}
