import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { findActiveTenantByAcademyCode } from '@/lib/public-external-event';

type RouteCtx = { params: Promise<{ academyCode: string }> };

export async function POST(request: NextRequest, context: RouteCtx) {
  try {
    const { academyCode: raw } = await context.params;
    const academyCode = decodeURIComponent(raw);
    const tenant = await findActiveTenantByAcademyCode(academyCode);
    if (!tenant) {
      return NextResponse.json({ message: 'Invalid or unknown academy code.' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const directory = (formData.get('directory') as string) || 'students';

    if (!file) {
      return NextResponse.json({ message: 'No file provided' }, { status: 400 });
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ message: 'Invalid file type. Only images are allowed.' }, { status: 400 });
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ message: 'File size exceeds 5MB limit.' }, { status: 400 });
    }

    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const fileExtension = file.name.split('.').pop();
    const filename = `${timestamp}_${randomString}.${fileExtension}`;
    const safeDir = directory.replace(/[^a-zA-Z0-9/_-]/g, '') || 'students';
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'student-register', String(tenant.id), safeDir);
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    const filePath = join(uploadDir, filename);
    const bytes = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));

    const fileUrl = `/uploads/student-register/${tenant.id}/${safeDir}/${filename}`.replace(/\/+/g, '/');
    return NextResponse.json({ url: fileUrl });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to upload file';
    console.error('public student-register upload:', error);
    return NextResponse.json({ message }, { status: 500 });
  }
}
