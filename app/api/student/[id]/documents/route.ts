import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/api/tenant-helpers';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { jsonBigInt, getErrorMessage } from '@/types/api';
import type { DocumentType } from '@prisma/client';

// GET: Fetch all documents for a student
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantContext = await getTenantContext(request);
    if (!tenantContext) {
      return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    }
    if (!tenantContext.isOwner && !tenantContext.isAdmin && !tenantContext.isManager) {
      return NextResponse.json({ message: 'Insufficient permissions' }, { status: 403 });
    }

    const { id: idParam } = await params;
    const studentId = BigInt(idParam);

    // Verify student exists and belongs to tenant
    const student = await prisma.student.findFirst({
      where: { 
        id: studentId, 
        tenantId: tenantContext.tenantId 
      },
    });

    if (!student) {
      return NextResponse.json({ message: 'Student not found' }, { status: 404 });
    }

    // Fetch all documents for this student
    const documents = await prisma.studentDocument.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(jsonBigInt(documents));
  } catch (error: unknown) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

// POST: Upload a new document for a student
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantContext = await getTenantContext(request);
    if (!tenantContext) {
      return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    }
    if (!tenantContext.isOwner && !tenantContext.isAdmin && !tenantContext.isManager) {
      return NextResponse.json({ message: 'Insufficient permissions' }, { status: 403 });
    }

    const { id: idParam } = await params;
    const studentId = BigInt(idParam);

    // Verify student exists and belongs to tenant
    const student = await prisma.student.findFirst({
      where: { 
        id: studentId, 
        tenantId: tenantContext.tenantId 
      },
    });

    if (!student) {
      return NextResponse.json({ message: 'Student not found' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const documentType = formData.get('documentType') as string;
    const documentName = formData.get('documentName') as string;
    const notes = formData.get('notes') as string | null;
    const expiryDate = formData.get('expiryDate') as string | null;

    if (!file) {
      return NextResponse.json({ message: 'No file provided' }, { status: 400 });
    }

    if (!documentType || !documentName) {
      return NextResponse.json({ message: 'Document type and name are required' }, { status: 400 });
    }

    // Validate document type
    const validTypes = ['birth_certificate', 'medical_form', 'photo_consent', 'waiver', 'insurance', 'id_proof', 'other'];
    if (!validTypes.includes(documentType)) {
      return NextResponse.json({ message: 'Invalid document type' }, { status: 400 });
    }

    // Validate file size (max 10MB for documents)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { message: 'File size exceeds 10MB limit.' },
        { status: 400 }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const fileExtension = file.name.split('.').pop();
    const filename = `${timestamp}_${randomString}.${fileExtension}`;

    // Create uploads directory path in public folder
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'documents');
    
    // Create directory if it doesn't exist
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Save file
    const filePath = join(uploadDir, filename);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Return URL path (relative to public folder)
    const fileUrl = `/uploads/documents/${filename}`;

    // Create document record in database
    const document = await prisma.studentDocument.create({
      data: {
        studentId,
        documentType: documentType as DocumentType,
        documentName: documentName.trim(),
        fileUrl,
        fileSize: file.size,
        fileType: file.type || fileExtension || null,
        uploadDate: new Date(),
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        uploadedBy: tenantContext.user.id,
        notes: notes?.trim() || null,
        createdBy: tenantContext.user.id,
      },
    });

    return NextResponse.json(jsonBigInt(document));
  } catch (error: unknown) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

// DELETE: Delete a specific document
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantContext = await getTenantContext(request);
    if (!tenantContext) {
      return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    }
    if (!tenantContext.isOwner && !tenantContext.isAdmin && !tenantContext.isManager) {
      return NextResponse.json({ message: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');

    if (!documentId) {
      return NextResponse.json({ message: 'Document ID is required' }, { status: 400 });
    }

    const { id: idParam } = await params;
    const studentId = BigInt(idParam);
    const docId = BigInt(documentId);

    // Verify student exists and belongs to tenant
    const student = await prisma.student.findFirst({
      where: { 
        id: studentId, 
        tenantId: tenantContext.tenantId 
      },
    });

    if (!student) {
      return NextResponse.json({ message: 'Student not found' }, { status: 404 });
    }

    // Verify document exists and belongs to student
    const document = await prisma.studentDocument.findFirst({
      where: { 
        id: docId,
        studentId 
      },
    });

    if (!document) {
      return NextResponse.json({ message: 'Document not found' }, { status: 404 });
    }

    // Delete the file from filesystem if it exists
    if (document.fileUrl) {
      try {
        const { unlink } = await import('fs/promises');
        const filePath = join(process.cwd(), 'public', document.fileUrl);
        
        if (existsSync(filePath)) {
          await unlink(filePath);
        }
      } catch (fileError) {
        // Log error but don't fail the deletion if file doesn't exist
        console.warn('Failed to delete file:', fileError);
      }
    }

    // Delete the document record
    await prisma.studentDocument.delete({
      where: { id: docId },
    });

    return NextResponse.json({ success: true, message: 'Document deleted successfully' });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

