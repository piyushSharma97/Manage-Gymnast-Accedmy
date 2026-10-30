'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { API_PATHS } from '@/lib/api-paths';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { FileText, Upload, Download, Calendar, CheckCircle, XCircle, Trash2 } from 'lucide-react';
import { formatBytes } from '@/hooks/use-file-upload';
import { Alert, AlertContent, AlertDescription, AlertIcon, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

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

type Student = {
  id: string;
  firstName: string;
  lastName: string | null;
  registrationNo: string;
};

export interface StudentDocumentsDialogProps {
  open: boolean;
  closeDialog: () => void;
  student: Student | null;
}

const documentTypes = [
  { value: 'birth_certificate', label: 'Birth Certificate' },
  { value: 'medical_form', label: 'Medical Form' },
  { value: 'photo_consent', label: 'Photo Consent' },
  { value: 'waiver', label: 'Waiver' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'other', label: 'Other' },
];

export default function StudentDocumentsDialog({
  open,
  closeDialog,
  student,
}: StudentDocumentsDialogProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    documentType: '',
    documentName: '',
    notes: '',
    expiryDate: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);

  // Fetch documents
  const { data: documents, isLoading } = useQuery({
    queryKey: ['student-documents', student?.id],
    queryFn: async () => {
      if (!student?.id) return [];
      const response = await apiFetch(API_PATHS.student.documents(student.id));
      if (!response.ok) {
        const { message } = await response.json();
        throw new Error(message);
      }
      return response.json() as Promise<StudentDocument[]>;
    },
    enabled: open && !!student?.id,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      if (!student?.id) {
        throw new Error('Student ID is required');
      }

      const response = await apiFetch(
        API_PATHS.student.documentDelete(student.id, documentId),
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
      queryClient.invalidateQueries({ queryKey: ['student-documents', student?.id] });
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
      if (!student?.id || !selectedFile) {
        throw new Error('Student ID and file are required');
      }

      const formDataToSend = new FormData();
      formDataToSend.append('file', selectedFile);
      formDataToSend.append('documentType', formData.documentType);
      formDataToSend.append('documentName', formData.documentName);
      if (formData.notes) formDataToSend.append('notes', formData.notes);
      if (formData.expiryDate) formDataToSend.append('expiryDate', formData.expiryDate);

      const response = await apiFetch(API_PATHS.student.documents(student.id), {
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
      queryClient.invalidateQueries({ queryKey: ['student-documents', student?.id] });
      // Reset form
      setFormData({ documentType: '', documentName: '', notes: '', expiryDate: '' });
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

  useEffect(() => {
    if (!open) {
      // Reset form when dialog closes
      setFormData({ documentType: '', documentName: '', notes: '', expiryDate: '' });
      setSelectedFile(null);
      setError(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={closeDialog}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            Documents - {student?.firstName} {student?.lastName} ({student?.registrationNo})
          </DialogTitle>
          <DialogDescription>
            Upload and manage student documents
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Upload Form */}
          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="font-semibold text-sm">Upload New Document</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="documentType">Document Type *</Label>
                <Select
                  value={formData.documentType}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, documentType: value }))
                  }
                >
                  <SelectTrigger id="documentType">
                    <SelectValue placeholder="Select document type" />
                  </SelectTrigger>
                  <SelectContent>
                    {documentTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

              <div className="space-y-2">
                <Label htmlFor="expiryDate">Expiry Date (Optional)</Label>
                <Input
                  id="expiryDate"
                  type="date"
                  value={formData.expiryDate}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, expiryDate: e.target.value }))
                  }
                />
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

          {/* Documents List */}
          <div className="border rounded-lg">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-sm">Uploaded Documents</h3>
            </div>
            <ScrollArea className="h-[400px]">
              {isLoading ? (
                <div className="p-8 text-center text-muted-foreground">Loading documents...</div>
              ) : !documents || documents.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No documents uploaded yet
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>File</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead>Expiry</TableHead>
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
                          {doc.expiryDate ? (
                            <div className="flex items-center gap-1 text-xs">
                              <Calendar className="h-3 w-3" />
                              {formatDate(doc.expiryDate)}
                            </div>
                          ) : (
                            '-'
                          )}
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
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={closeDialog}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

