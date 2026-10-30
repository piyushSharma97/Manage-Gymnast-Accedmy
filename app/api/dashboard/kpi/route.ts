// app/api/kpi/route.js
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // Define types for query results
    type TrialRow = { newtrial: number | bigint };
    type RegRow = { newreg: number | bigint };
    type DroppedRow = { dropped: number | bigint };
    type RevenueRow = { amount: number | bigint };

    // Queries
    const trialsQuery = await prisma.$queryRawUnsafe<TrialRow[]>(`
      SELECT COUNT(id) AS newtrial FROM trial WHERE trialDate BETWEEN DATE_FORMAT(NOW() ,'%Y-%m-01') AND NOW() GROUP BY MONTH(trialDate)
    `);

    const newRegQuery = await prisma.$queryRawUnsafe<RegRow[]>(`
      SELECT count(id) newreg FROM student WHERE (DATE_FORMAT(joinDate, '%Y-%m-%d') BETWEEN DATE_FORMAT(NOW() ,'%Y-%m-01') AND NOW())
    `);

    const droppedQuery = await prisma.$queryRawUnsafe<DroppedRow[]>(`
      SELECT COUNT(*) AS dropped FROM ( SELECT r.id AS id, COUNT(sessionDate) AS noofclasses FROM ( SELECT studentId, sessionDate FROM attendance a WHERE sessionDate BETWEEN DATE_FORMAT(NOW() - INTERVAL 1 MONTH, '%Y-%m-01') AND LAST_DAY(NOW() - INTERVAL 1 MONTH) UNION SELECT studentId, makeupDate AS session_date FROM makeupclass m WHERE makeupDate BETWEEN DATE_FORMAT(NOW() - INTERVAL 1 MONTH, '%Y-%m-01') AND LAST_DAY(NOW() - INTERVAL 1 MONTH) ) attendance RIGHT JOIN student r ON r.id = attendance.studentId WHERE nextduedate BETWEEN DATE_FORMAT( LAST_DAY(DATE_SUB(NOW(), INTERVAL 2 MONTH)), '%Y-%m-01' ) AND LAST_DAY(DATE_SUB(NOW(), INTERVAL 2 MONTH)) GROUP BY r.id ) bb WHERE noofclasses <= 1 ORDER BY noofclasses ASC
    `);

    const revenueQuery = await prisma.$queryRawUnsafe<RevenueRow[]>(`
      SELECT SUM(amount) amount 
      FROM payment 
      WHERE YEAR(receivedAt) = YEAR(CURDATE()) 
        AND MONTH(receivedAt) = MONTH(CURDATE()) 
      GROUP BY MONTH(receivedAt)
    `);

    // Convert query results safely (handle bigint)
    const items = [
      {
        logo: 'userX',
        info: trialsQuery?.[0]
          ? Number(trialsQuery[0].newtrial).toString()
          : '0',
        desc: 'No. of Trials Taken',
      },
      {
        logo: 'user',
        info: newRegQuery?.[0] ? Number(newRegQuery[0].newreg).toString() : '0',
        desc: 'New Registrations',
      },
      {
        logo: 'lineChart',
        info: droppedQuery?.[0]
          ? Number(droppedQuery[0].dropped).toString()
          : '0',
        desc: 'Dropped Last Month',
      },
      {
        logo: 'dollarSign',
        info: revenueQuery?.[0]
          ? Number(revenueQuery[0].amount).toString()
          : '0',
        desc: 'Revenue',
      },
    ];

    return NextResponse.json({ items });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Failed to fetch KPI stats' },
      { status: 500 },
    );
  }
}
