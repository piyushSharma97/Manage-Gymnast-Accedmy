// File: app/api/dashboard/enrollment/route.ts

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');
  try {
    if (type === 'teamtype') {
      type TeamTypeStat = {
        NoofStudents: bigint;
        TeamType: string;
      };

      const stats = await prisma.$queryRawUnsafe<TeamTypeStat[]>(`
        SELECT COUNT(id) AS NoofStudents, team as TeamType FROM student WHERE status ='Active' GROUP BY team
      `);

      const teamType = stats.map((stat) => ({
        NoofStudents: Number(stat.NoofStudents), // convert bigint → number
        TeamType: stat.TeamType,
      }));

      return NextResponse.json({ data: teamType });
    }

    if (type === 'agewise') {
      type AgewiseStat = {
        NoofStudents: bigint;
        TeamType: string;
      };

      const ageStats = await prisma.$queryRawUnsafe<AgewiseStat[]>(`
        SELECT COUNT(id) AS NoofStudents, '4-6' AS TeamType FROM student 
        WHERE TIMESTAMPDIFF(YEAR, dob, CURDATE()) BETWEEN 4 AND 6
    
        UNION 
    
        SELECT COUNT(id), '7-8' FROM student 
        WHERE TIMESTAMPDIFF(YEAR, dob, CURDATE()) BETWEEN 7 AND 8
    
        UNION 
    
        SELECT COUNT(id), '9-10' FROM student 
        WHERE TIMESTAMPDIFF(YEAR, dob, CURDATE()) BETWEEN 9 AND 10
    
        UNION 
    
        SELECT COUNT(id), '11-12' FROM student 
        WHERE TIMESTAMPDIFF(YEAR, dob, CURDATE()) BETWEEN 11 AND 12
    
        UNION 
    
        SELECT COUNT(id), '13-14' FROM student 
        WHERE TIMESTAMPDIFF(YEAR, dob, CURDATE()) BETWEEN 13 AND 14
    
        UNION 
    
        SELECT COUNT(id), '>15' FROM student 
        WHERE TIMESTAMPDIFF(YEAR, dob, CURDATE()) > 15
      `);

      const agewise = ageStats.map((row) => ({
        NoofStudents: Number(row.NoofStudents), // convert bigint → number
        TeamType: row.TeamType,
      }));

      return NextResponse.json({ data: agewise });
    }

    //Gender Distribution by Team Type
    if (type === 'genderwise') {
      type GenderStat = {
        GenderCategory: 'Boys' | 'Girls' | 'Other/Unspecified';
        TeamType: string;
        NoOfStudents: bigint;
      };

      const genderStats = await prisma.$queryRawUnsafe<GenderStat[]>(`
        SELECT
            CASE
                WHEN gender = '1' THEN 'Boys'
                WHEN gender = '2' THEN 'Girls'
                ELSE 'Other/Unspecified'
            END AS GenderCategory,
            TeamType,
            COUNT(id) AS NoOfStudents
        FROM
            student
        WHERE
            isdeleted != 1
            AND status != 'Dormant'
            AND TeamType != 'RhythmNRhyme'
        GROUP BY
            TeamType,
            gender
        ORDER BY
            TeamType,
            gender;
      `);

      // Transform the data for a stacked bar chart
      const transformedData: Record<
        string,
        { TeamType: string; Boys: number; Girls: number; Total: number }
      > = {};

      genderStats.forEach((row) => {
        const teamType = row.TeamType;
        const genderCategory = row.GenderCategory;
        const noOfStudents = Number(row.NoOfStudents); // convert bigint → number

        if (!transformedData[teamType]) {
          transformedData[teamType] = {
            TeamType: teamType,
            Boys: 0,
            Girls: 0,
            Total: 0,
          };
        }

        if (genderCategory === 'Boys') {
          transformedData[teamType].Boys = noOfStudents;
        } else if (genderCategory === 'Girls') {
          transformedData[teamType].Girls = noOfStudents;
        }
        transformedData[teamType].Total += noOfStudents;
      });

      // Convert object back into array
      const stackedChartData = Object.values(transformedData);

      return NextResponse.json({ data: stackedChartData });
    }

    //Recreational
    if (type === 'recreational') {
      type RecreationalStat = {
        NoofStudents: bigint;
        gender: 'M' | 'F';
      };

      const ageStats = await prisma.$queryRawUnsafe<RecreationalStat[]>(`
        SELECT COUNT(id) AS NoofStudents, gender
        FROM student
        WHERE status != 'suspended'
        GROUP BY gender
      `);

      const recreational = ageStats.map((row) => ({
        NoofStudents: Number(row.NoofStudents), // convert bigint → number
        gender: row.gender,
      }));

      return NextResponse.json({ data: recreational });
    }

    //agewisefemale
    if (type === 'agewisefemale') {
      type AgewiseFemaleStat = {
        students: bigint;
        age: string;
      };

      const ageStats = await prisma.$queryRawUnsafe<AgewiseFemaleStat[]>(`
        SELECT COUNT(id) AS students, '4-6' AS age 
        FROM student 
        WHERE TIMESTAMPDIFF(YEAR, dob, CURDATE()) BETWEEN 4 AND 6 AND gender='2' 
        GROUP BY gender
    
        UNION 
    
        SELECT COUNT(id) AS students, '7-8' AS age 
        FROM student 
        WHERE TIMESTAMPDIFF(YEAR, dob, CURDATE()) BETWEEN 7 AND 8 AND gender='2' 
        GROUP BY gender
    
        UNION 
    
        SELECT COUNT(id) AS students, '9-10' AS age 
        FROM student 
        WHERE TIMESTAMPDIFF(YEAR, dob, CURDATE()) BETWEEN 9 AND 10 AND gender='2' 
        GROUP BY gender
    
        UNION 
    
        SELECT COUNT(id) AS students, '11-12' AS age 
        FROM student 
        WHERE TIMESTAMPDIFF(YEAR, dob, CURDATE()) BETWEEN 11 AND 12 AND gender='2' 
        GROUP BY gender
    
        UNION 
    
        SELECT COUNT(id) AS students, '13-14' AS age 
        FROM student 
        WHERE TIMESTAMPDIFF(YEAR, dob, CURDATE()) BETWEEN 13 AND 14 AND gender='2' 
        GROUP BY gender
    
        UNION 
    
        SELECT COUNT(id) AS students, '>15' AS age 
        FROM student 
        WHERE TIMESTAMPDIFF(YEAR, dob, CURDATE()) > 15 AND gender='2' 
        GROUP BY gender
        ORDER BY students
      `);

      const agewisefemale = ageStats.map((row) => ({
        students: Number(row.students), // convert bigint → number
        age: row.age,
      }));

      return NextResponse.json({ data: agewisefemale });
    }

    //agewisemale
    if (type === 'agewisemale') {
      type AgewiseMaleStat = {
        students: bigint;
        age: string;
      };

      const ageStats = await prisma.$queryRawUnsafe<AgewiseMaleStat[]>(`
        SELECT COUNT(id) AS students, '4-6' AS age 
        FROM student 
        WHERE TIMESTAMPDIFF(YEAR, dob, CURDATE()) BETWEEN 4 AND 6 AND gender='1' 
        GROUP BY gender
    
        UNION 
    
        SELECT COUNT(id) AS students, '7-8' AS age 
        FROM student 
        WHERE TIMESTAMPDIFF(YEAR, dob, CURDATE()) BETWEEN 7 AND 8 AND gender='1' 
        GROUP BY gender
    
        UNION 
    
        SELECT COUNT(id) AS students, '9-10' AS age 
        FROM student 
        WHERE TIMESTAMPDIFF(YEAR, dob, CURDATE()) BETWEEN 9 AND 10 AND gender='1' 
        GROUP BY gender
    
        UNION 
    
        SELECT COUNT(id) AS students, '11-12' AS age 
        FROM student 
        WHERE TIMESTAMPDIFF(YEAR, dob, CURDATE()) BETWEEN 11 AND 12 AND gender='1' 
        GROUP BY gender
    
        UNION 
    
        SELECT COUNT(id) AS students, '13-14' AS age 
        FROM student 
        WHERE TIMESTAMPDIFF(YEAR, dob, CURDATE()) BETWEEN 13 AND 14 AND gender='1' 
        GROUP BY gender
    
        UNION 
    
        SELECT COUNT(id) AS students, '>15' AS age 
        FROM student 
        WHERE TIMESTAMPDIFF(YEAR, dob, CURDATE()) > 15 AND gender='1' 
        GROUP BY gender
        ORDER BY students
      `);

      const agewisemale = ageStats.map((row) => ({
        students: Number(row.students), // convert bigint → number
        age: row.age,
      }));

      return NextResponse.json({ data: agewisemale });
    }
  } catch (error) {
    console.error('[GET /api/dashboard/enrollment] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch enrollment stats data' },
      { status: 500 },
    );
  }
}
