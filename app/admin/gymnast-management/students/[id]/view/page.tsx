'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { API_PATHS, withParams } from '@/lib/api-paths';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  User,
  FileText,
  Calendar,
  DollarSign,
  Trophy,
  ArrowLeft,
  Download,
  Mail,
  Phone,
  MapPin,
  School,
  Users,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

type Student = {
  id: string;
  registrationNo: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  gender: string;
  status: string;
  dob: string | null;
  joinDate: string | null;
  profilePhotoUrl: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  schoolName: string | null;
  gradeClass: string | null;
  bloodGroup: string | null;
  teamName: string | null;
  skillLevelName: string | null;
  location: {
    id: number;
    centerName: string;
  } | null;
  studentguardians: Array<{
    guardian: {
      firstName: string;
      lastName: string | null;
      email: string | null;
      phone: string | null;
    };
    isPrimary: boolean;
  }>;
};

type StudentDocument = {
  id: string;
  documentType: string;
  documentName: string;
  fileUrl: string;
  uploadDate: string | null;
  isVerified: boolean;
  verifiedAt: string | null;
};

type AttendanceRecord = {
  id: string;
  sessionDate: string;
  locationName: string;
  createdAt: string;
};

type Payment = {
  id: string;
  amount: number;
  amountPaid: number;
  receivedAt: string;
  orderid: string | null;
  invoice: {
    invoiceno: string;
  } | null;
};

type Invoice = {
  id: string;
  invoiceno: string;
  amount: number;
  status: string;
  createdAt: string;
  dueDate: string | null;
};

type EventRegistration = {
  id: number;
  event: {
    id: number;
    name: string;
    event_type: string | null;
    startdate: string | null;
    enddate: string | null;
  };
  Fees: number | null;
  Total: number | null;
  Status: string | null;
  createdAt: string;
};

export default function StudentViewPage() {
  const router = useRouter();
  const params = useParams();
  const studentId = params.id as string;

  // Fetch student info
  const { data: student, isLoading: isLoadingStudent } = useQuery({
    queryKey: ['student', studentId],
    queryFn: async () => {
      const response = await apiFetch(API_PATHS.student.byId(studentId));
      if (!response.ok) {
        throw new Error('Failed to fetch student');
      }
      return response.json() as Promise<Student>;
    },
    enabled: !!studentId,
  });

  // Fetch documents
  const { data: documents, isLoading: isLoadingDocuments } = useQuery({
    queryKey: ['student-documents', studentId],
    queryFn: async () => {
      const response = await apiFetch(API_PATHS.student.documents(studentId));
      if (!response.ok) {
        return [];
      }
      return response.json() as Promise<StudentDocument[]>;
    },
    enabled: !!studentId,
  });

  // Fetch attendance
  const { data: attendanceData, isLoading: isLoadingAttendance } = useQuery({
    queryKey: ['student-attendance', studentId],
    queryFn: async () => {
      const response = await apiFetch(withParams(API_PATHS.reports.attendance.student, `studentId=${studentId}&limit=50`));
      if (!response.ok) {
        return { data: [] };
      }
      return response.json() as Promise<{ data: AttendanceRecord[] }>;
    },
    enabled: !!studentId,
  });

  // Fetch payments
  const { data: paymentsData, isLoading: isLoadingPayments } = useQuery({
    queryKey: ['student-payments', studentId],
    queryFn: async () => {
      const response = await apiFetch(withParams(API_PATHS.fees.payments.list, `studentId=${studentId}&limit=50`));
      if (!response.ok) {
        return { data: [] };
      }
      return response.json() as Promise<{ data: Payment[] }>;
    },
    enabled: !!studentId,
  });

  // Fetch invoices
  const { data: invoicesData, isLoading: isLoadingInvoices } = useQuery({
    queryKey: ['student-invoices', studentId],
    queryFn: async () => {
      const response = await apiFetch(withParams(API_PATHS.fees.invoice.list, `studentId=${studentId}&limit=50`));
      if (!response.ok) {
        return { data: [] };
      }
      return response.json() as Promise<{ data: Invoice[] }>;
    },
    enabled: !!studentId,
  });

  // Fetch events
  const { data: eventsData, isLoading: isLoadingEvents } = useQuery({
    queryKey: ['student-events', studentId],
    queryFn: async () => {
      const response = await apiFetch(withParams(API_PATHS.eventManagement.registerGymnast.list, `studentId=${studentId}&limit=50`));
      if (!response.ok) {
        return { data: [] };
      }
      return response.json() as Promise<{ data: EventRegistration[] }>;
    },
    enabled: !!studentId,
  });

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return '-';
    return `Rs. ${amount.toLocaleString('en-IN')}`;
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      ACTIVE: 'bg-green-100 text-green-800',
      INACTIVE: 'bg-gray-100 text-gray-800',
      BLOCKED: 'bg-red-100 text-red-800',
    };
    return (
      <Badge className={statusColors[status] || 'bg-gray-100 text-gray-800'}>
        {status}
      </Badge>
    );
  };

  if (isLoadingStudent) {
    return (
      <Container>
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading student information...</p>
        </div>
      </Container>
    );
  }

  if (!student) {
    return (
      <Container>
        <div className="flex items-center justify-center py-12">
          <p className="text-destructive">Student not found</p>
        </div>
      </Container>
    );
  }

  const primaryGuardian = student.studentguardians?.find((g) => g.isPrimary) || student.studentguardians?.[0];

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
                <BreadcrumbPage>
                  {student.firstName} {student.lastName}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <ToolbarTitle>
            Student View - {student.firstName} {student.lastName} ({student.registrationNo})
          </ToolbarTitle>
        </ToolbarHeading>
        <ToolbarActions>
          <Button variant="outline" asChild>
            <Link href={`/admin/gymnast-management/students/${studentId}`}>
              <User className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </ToolbarActions>
      </Toolbar>

      <div className="mt-6 space-y-6">
        {/* Student Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Student Information</CardTitle>
            <CardDescription>Complete profile details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Profile Photo */}
              <div className="flex flex-col items-center">
                {student.profilePhotoUrl ? (
                  <div className="relative w-32 h-32 rounded-full overflow-hidden border-2 border-border">
                    <Image
                      src={student.profilePhotoUrl}
                      alt={`${student.firstName} ${student.lastName}`}
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-32 h-32 rounded-full bg-muted flex items-center justify-center border-2 border-border">
                    <User className="h-16 w-16 text-muted-foreground" />
                  </div>
                )}
                <div className="mt-4 text-center">
                  <h3 className="text-lg font-semibold">
                    {student.firstName} {student.lastName}
                  </h3>
                  <p className="text-sm text-muted-foreground">{student.registrationNo}</p>
                  <div className="mt-2">{getStatusBadge(student.status)}</div>
                </div>
              </div>

              {/* Personal Details */}
              <div className="space-y-4">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase">Personal Details</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      <strong>Gender:</strong> {student.gender}
                    </span>
                  </div>
                  {student.dob && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        <strong>Date of Birth:</strong> {formatDate(student.dob)}
                      </span>
                    </div>
                  )}
                  {student.bloodGroup && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm">
                        <strong>Blood Group:</strong> {student.bloodGroup}
                      </span>
                    </div>
                  )}
                  {student.joinDate && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        <strong>Join Date:</strong> {formatDate(student.joinDate)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Contact & Academic */}
              <div className="space-y-4">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase">Contact & Academic</h4>
                <div className="space-y-2">
                  {student.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{student.email}</span>
                    </div>
                  )}
                  {student.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{student.phone}</span>
                    </div>
                  )}
                  {student.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{student.location.centerName}</span>
                    </div>
                  )}
                  {student.schoolName && (
                    <div className="flex items-center gap-2">
                      <School className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {student.schoolName}
                        {student.gradeClass && ` - ${student.gradeClass}`}
                      </span>
                    </div>
                  )}
                  {student.teamName && (
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        <strong>Team:</strong> {student.teamName}
                      </span>
                    </div>
                  )}
                  {student.skillLevelName && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm">
                        <strong>Skill Level:</strong> {student.skillLevelName}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Address */}
            {(student.addressLine1 || student.city || student.state) && (
              <div className="mt-6 pt-6 border-t">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase mb-2">Address</h4>
                <div className="text-sm">
                  {student.addressLine1 && <p>{student.addressLine1}</p>}
                  {student.addressLine2 && <p>{student.addressLine2}</p>}
                  <p>
                    {[student.city, student.state, student.postalCode].filter(Boolean).join(', ')}
                  </p>
                </div>
              </div>
            )}

            {/* Guardian Info */}
            {primaryGuardian && (
              <div className="mt-6 pt-6 border-t">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase mb-2">Guardian Information</h4>
                <div className="space-y-2 text-sm">
                  <p>
                    <strong>Name:</strong> {primaryGuardian.guardian.firstName}{' '}
                    {primaryGuardian.guardian.lastName}
                  </p>
                  {primaryGuardian.guardian.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{primaryGuardian.guardian.email}</span>
                    </div>
                  )}
                  {primaryGuardian.guardian.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{primaryGuardian.guardian.phone}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabs for Documents, Attendance, Fees, Events */}
        <Tabs defaultValue="documents" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="documents">
              <FileText className="mr-2 h-4 w-4" />
              Documents ({documents?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="attendance">
              <Calendar className="mr-2 h-4 w-4" />
              Attendance ({attendanceData?.data?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="fees">
              Fees & Payments
            </TabsTrigger>
            <TabsTrigger value="events">
              <Trophy className="mr-2 h-4 w-4" />
              Events ({eventsData?.data?.length || 0})
            </TabsTrigger>
          </TabsList>

          {/* Documents Tab */}
          <TabsContent value="documents">
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
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Document Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Uploaded</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {documents.map((doc) => (
                        <TableRow key={doc.id}>
                          <TableCell className="font-medium">{doc.documentName}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{doc.documentType}</Badge>
                          </TableCell>
                          <TableCell>{formatDate(doc.uploadDate)}</TableCell>
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
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(doc.fileUrl, '_blank')}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Attendance Tab */}
          <TabsContent value="attendance">
            <Card>
              <CardHeader>
                <CardTitle>Attendance Records</CardTitle>
                <CardDescription>Recent attendance history</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingAttendance ? (
                  <div className="p-8 text-center text-muted-foreground">Loading attendance...</div>
                ) : !attendanceData?.data || attendanceData.data.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    No attendance records found
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendanceData.data.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>{formatDate(record.sessionDate)}</TableCell>
                          <TableCell>{record.locationName}</TableCell>
                          <TableCell>
                            <Badge variant="success">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Present
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Fees Tab */}
          <TabsContent value="fees">
            <div className="space-y-6">
              {/* Invoices */}
              <Card>
                <CardHeader>
                  <CardTitle>Invoices</CardTitle>
                  <CardDescription>All invoices for this student</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingInvoices ? (
                    <div className="p-8 text-center text-muted-foreground">Loading invoices...</div>
                  ) : !invoicesData?.data || invoicesData.data.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      No invoices found
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Invoice No</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead>Created</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoicesData.data.map((invoice) => (
                          <TableRow key={invoice.id}>
                            <TableCell className="font-medium">{invoice.invoiceno}</TableCell>
                            <TableCell>{formatCurrency(invoice.amount)}</TableCell>
                            <TableCell>
                              <Badge
                                className={
                                  invoice.status === 'Paid'
                                    ? 'bg-green-100 text-green-800'
                                    : invoice.status === 'Pending'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-red-100 text-red-800'
                                }
                              >
                                {invoice.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                            <TableCell>{formatDate(invoice.createdAt)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Payments */}
              <Card>
                <CardHeader>
                  <CardTitle>Payments</CardTitle>
                  <CardDescription>Payment history</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingPayments ? (
                    <div className="p-8 text-center text-muted-foreground">Loading payments...</div>
                  ) : !paymentsData?.data || paymentsData.data.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      No payments found
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Order ID</TableHead>
                          <TableHead>Invoice No</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Amount Paid</TableHead>
                          <TableHead>Received Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paymentsData.data.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell className="font-medium">
                              {payment.orderid || '-'}
                            </TableCell>
                            <TableCell>
                              {payment.invoice?.invoiceno || '-'}
                            </TableCell>
                            <TableCell>{formatCurrency(payment.amount)}</TableCell>
                            <TableCell>{formatCurrency(payment.amountPaid)}</TableCell>
                            <TableCell>{formatDate(payment.receivedAt)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Events Tab */}
          <TabsContent value="events">
            <Card>
              <CardHeader>
                <CardTitle>Events Participated</CardTitle>
                <CardDescription>All events this student has registered for</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingEvents ? (
                  <div className="p-8 text-center text-muted-foreground">Loading events...</div>
                ) : !eventsData?.data || eventsData.data.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    No events found
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Event Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Start Date</TableHead>
                        <TableHead>End Date</TableHead>
                        <TableHead>Fees</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {eventsData.data.map((event) => (
                        <TableRow key={event.id}>
                          <TableCell className="font-medium">{event.event.name}</TableCell>
                          <TableCell>
                            {event.event.event_type && (
                              <Badge variant="outline">{event.event.event_type}</Badge>
                            )}
                          </TableCell>
                          <TableCell>{formatDate(event.event.startdate)}</TableCell>
                          <TableCell>{formatDate(event.event.enddate)}</TableCell>
                          <TableCell>{formatCurrency(event.Fees)}</TableCell>
                          <TableCell>{formatCurrency(event.Total)}</TableCell>
                          <TableCell>
                            {event.Status && (
                              <Badge
                                className={
                                  event.Status === 'Confirmed'
                                    ? 'bg-green-100 text-green-800'
                                    : event.Status === 'Pending'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-gray-100 text-gray-800'
                                }
                              >
                                {event.Status}
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Container>
  );
}

