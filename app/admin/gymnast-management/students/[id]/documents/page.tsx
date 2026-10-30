'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { API_PATHS } from '@/lib/api-paths';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FileText, Upload, Download, Calendar, CheckCircle, XCircle, Trash2, ArrowLeft } from 'lucide-react';
import { formatBytes } from '@/hooks/use-file-upload';
import { Alert, AlertContent, AlertDescription, AlertIcon, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Container } from '@/components/common/container';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
  ToolbarTitle,
} from '@/components/common/toolbar';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

type StudentDocument = {
  id: string;
  studentId: string;
  documentType: string;
  documentName: string;
  fileUrl: string;
  fileSize: number | null;
  fileType: string | null;
  uploadDate: string | null;
  expiryDate: string | null;
  uploadedBy: string | null;
  isVerified: boolean;
  verifiedBy: string | null;
  verifiedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

const documentTypes = [
  { value: 'id_proof', label: 'ID Proof' },
];

export default function StudentDocumentsPage() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const studentId = params.id as string;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    documentType: 'id_proof',
    documentName: '',
    notes: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);

  // Fetch student info
  const { data: student, isLoading: isLoadingStudent } = useQuery({
    queryKey: ['student', studentId],
    queryFn: async () => {
      const response = await apiFetch(API_PATHS.student.byId(studentId));
      if (!response.ok) {
        throw new Error('Failed to fetch student');
      }
      return response.json();
    },
    enabled: !!studentId,
  });

  // Fetch documents
  const { data: documents, isLoading: isLoadingDocuments } = useQuery({
    queryKey: ['student-documents', studentId],
    queryFn: async () => {
      if (!studentId) return [];
      const response = await apiFetch(API_PATHS.student.documents(studentId));
      if (!response.ok) {
        const { message } = await response.json();
        throw new Error(message);
      }
      return response.json() as Promise<StudentDocument[]>;
    },
    enabled: !!studentId,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      if (!studentId) {
        throw new Error('Student ID is required');
      }

      const response = await apiFetch(
        API_PATHS.student.documentDelete(studentId, documentId),
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const { message } = await response.json();
        throw new Error(message);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-documents', studentId] });
      setDeletingDocId(null);
    },
    onError: (error: unknown) => {
      setError(error instanceof Error ? error.message : 'Failed to delete document');
      setDeletingDocId(null);
    },
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!studentId || !selectedFile) {
        throw new Error('Student ID and file are required');
      }

      const formDataToSend = new FormData();
      formDataToSend.append('file', selectedFile);
      formDataToSend.append('documentType', formData.documentType);
      formDataToSend.append('documentName', formData.documentName);
      if (formData.notes) formDataToSend.append('notes', formData.notes);

      const response = await apiFetch(API_PATHS.student.documents(studentId), {
        method: 'POST',
        body: formDataToSend,
      });

      if (!response.ok) {
        const { message } = await response.json();
        throw new Error(message);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-documents', studentId] });
      // Reset form
      setFormData({ documentType: 'id_proof', documentName: '', notes: '' });
      setSelectedFile(null);
      setError(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    onError: (error: unknown) => {
      setError(error instanceof Error ? error.message : 'Failed to upload document');
    },
    onSettled: () => {
      setUploading(false);
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
      // Auto-fill document name if empty
      if (!formData.documentName) {
        setFormData((prev) => ({ ...prev, documentName: file.name }));
      }
    }
  };

  const handleUpload = () => {
    if (!selectedFile) {
      setError('Please select a file');
      return;
    }
    if (!formData.documentType) {
      setError('Please select a document type');
      return;
    }
    if (!formData.documentName.trim()) {
      setError('Please enter a document name');
      return;
    }

    setUploading(true);
    setError(null);
    uploadMutation.mutate();
  };

  const handleDownload = (fileUrl: string, documentName: string) => {
    window.open(fileUrl, '_blank');
  };

  const handleDelete = (documentId: string, documentName: string) => {
    if (window.confirm(`Are you sure you want to delete "${documentName}"? This action cannot be undone.`)) {
      setDeletingDocId(documentId);
      setError(null);
      deleteMutation.mutate(documentId);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  const getDocumentTypeLabel = (type: string) => {
    return documentTypes.find((dt) => dt.value === type)?.label || type;
  };

  if (isLoadingStudent) {
    return (
      <Container>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <Toolbar>
        <ToolbarHeading>
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/admin/gymnast-management/students">Students</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href={`/admin/gymnast-management/students/${studentId}`}>
                    {student?.firstName} {student?.lastName}
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Documents</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <ToolbarTitle>
            Documents - {student?.firstName} {student?.lastName} ({student?.registrationNo})
          </ToolbarTitle>
        </ToolbarHeading>
        <ToolbarActions>
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </ToolbarActions>
      </Toolbar>

      <div className="space-y-6 mt-6">
        {/* Upload Form */}
        <Card>
          <CardHeader>
            <CardTitle>Upload New Document</CardTitle>
            <CardDescription>Add a new document for this student</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="documentType">Document Type *</Label>
                  <Input
                    id="documentType"
                    value="ID Proof"
                    disabled
                    className="bg-muted"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="documentName">Document Name *</Label>
                  <Input
                    id="documentName"
                    value={formData.documentName}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, documentName: e.target.value }))
                    }
                    placeholder="Enter document name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="file">File *</Label>
                  <Input
                    id="file"
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept="*/*"
                  />
                  {selectedFile && (
                    <p className="text-xs text-muted-foreground">
                      Selected: {selectedFile.name} ({formatBytes(selectedFile.size)})
                    </p>
                  )}
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, notes: e.target.value }))
                    }
                    placeholder="Add any additional notes..."
                    rows={2}
                  />
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertIcon>
                    <XCircle className="h-4 w-4" />
                  </AlertIcon>
                  <AlertContent>
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </AlertContent>
                </Alert>
              )}

              <Button
                onClick={handleUpload}
                disabled={uploading || !selectedFile || !formData.documentType || !formData.documentName.trim()}
                className="w-full"
              >
                <Upload className="mr-2 h-4 w-4" />
                {uploading ? 'Uploading...' : 'Upload Document'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Documents List */}
        <Card>
          <CardHeader>
            <CardTitle>Uploaded Documents</CardTitle>
            <CardDescription>All documents uploaded for this student</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingDocuments ? (
              <div className="p-8 text-center text-muted-foreground">Loading documents...</div>
            ) : !documents || documents.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No documents uploaded yet
              </div>
            ) : (
              <ScrollArea className="h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>File</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documents.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell>
                          <Badge variant="outline">
                            {getDocumentTypeLabel(doc.documentType)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{doc.documentName}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {doc.fileType || 'Unknown'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {doc.fileSize ? formatBytes(doc.fileSize) : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-xs">
                            <Calendar className="h-3 w-3" />
                            {formatDate(doc.uploadDate || doc.createdAt)}
                          </div>
                        </TableCell>
                        <TableCell>
                          {doc.isVerified ? (
                            <Badge variant="success">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Verified
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Pending</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownload(doc.fileUrl, doc.documentName)}
                              title="Download"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(doc.id, doc.documentName)}
                              disabled={deletingDocId === doc.id}
                              title="Delete"
                              className="text-destructive hover:text-destructive"
                            >
                              {deletingDocId === doc.id ? (
                                <XCircle className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}

