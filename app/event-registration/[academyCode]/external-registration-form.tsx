'use client';

import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { format, isValid } from 'date-fns';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Info,
  LoaderCircleIcon,
  Mail,
  Phone,
  User,
} from 'lucide-react';
import { formatDate } from '@/lib/helpers';
import { toast } from 'sonner';

type EventOption = {
  id: number;
  name: string;
  description: string;
  fees: number;
  time: string | null;
  startdate: string;
  enddate: string;
};

type Props = {
  academyCode: string;
};


/** Readable field styling: strong text, visible focus, autofill not washed out */
const fieldClass =
  'h-11 rounded-md border-slate-300 bg-white text-base text-slate-900 placeholder:text-slate-400 shadow-sm transition-[color,box-shadow] focus-visible:border-[#007bff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007bff]/30 [&:-webkit-autofill]:shadow-[inset_0_0_0px_1000px_rgb(255_255_255)] [&:-webkit-autofill]:[-webkit-text-fill-color:#0f172a]';

function eventLabel(ev: EventOption): string {
  const n = ev.name?.trim();
  return n || `Event #${ev.id}`;
}

/** Local calendar date from yyyy-MM-dd (avoids UTC parseISO off-by-one). */
function parseDobToDate(iso: string): Date | undefined {
  if (!iso) return undefined;
  const [y, m, d] = iso.split('-').map((x) => parseInt(x, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return undefined;
  const dt = new Date(y, m - 1, d);
  return isValid(dt) ? dt : undefined;
}

function ReqLabel({
  htmlFor,
  icon: Icon,
  children,
}: {
  htmlFor: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <Label
      htmlFor={htmlFor}
      className="flex items-center gap-2 text-sm font-medium leading-none text-slate-800"
    >
      <Icon className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
      <span>{children}</span>
      <span className="text-red-500">*</span>
    </Label>
  );
}

export function ExternalRegistrationForm({ academyCode }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [academyName, setAcademyName] = useState('');
  const [events, setEvents] = useState<EventOption[]>([]);

  const [eventId, setEventId] = useState<string>('');
  const [studentName, setStudentName] = useState('');
  const [parentName, setParentName] = useState('');
  const [dob, setDob] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [dobOpen, setDobOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const qs = new URLSearchParams({ academyCode });
        const res = await apiFetch(`/api/public/event-registration/events?${qs.toString()}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(typeof data?.message === 'string' ? data.message : 'Could not load events');
        }
        if (cancelled) return;
        setAcademyName(String(data.academyName || ''));
        setEvents(Array.isArray(data.events) ? data.events : []);
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Could not load events');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [academyCode]);

  const selected = events.find((e) => String(e.id) === eventId);
  const dobDate = parseDobToDate(dob);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const eid = Number.parseInt(eventId, 10);
    if (!Number.isFinite(eid) || eid <= 0) {
      const msg = 'Please select an event.';
      setSubmitError(msg);
      toast.error(msg);
      return;
    }
    if (!dob.trim()) {
      const msg = 'Please select date of birth.';
      setSubmitError(msg);
      toast.error(msg);
      return;
    }

    setSubmitting(true);
    /** Avoid resetting state in `finally` while posting to PayU — that re-render can cancel navigation in some browsers. */
    let leavingForPayu = false;
    try {
      const qs = new URLSearchParams({ academyCode });
      const res = await apiFetch(`/api/public/event-registration/checkout?${qs.toString()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: studentName.trim(),
          parentName: parentName.trim(),
          dob: dob.trim(),
          phone: phone.trim(),
          email: email.trim(),
          eventId: eid,
        }),
      });
      const raw = await res.text();
      let data: Record<string, unknown> = {};
      try {
        data = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      } catch {
        throw new Error(
          res.ok ? 'Invalid response from server. If this continues, contact the academy.' : 'Registration failed',
        );
      }
      if (!res.ok) {
        const msg =
          typeof data.message === 'string' ? data.message : `Registration failed (${res.status}).`;
        throw new Error(msg);
      }
      if (data.skipPayment) {
        router.push('/event-registration/success');
        return;
      }
      const action = data.action as string | undefined;
      const fields = data.fields as Record<string, string> | undefined;
      if (!action || !fields || typeof action !== 'string') {
        throw new Error('Payment could not be started. Please try again or contact the academy.');
      }
      const payuForm = document.createElement('form');
      payuForm.method = 'POST';
      payuForm.action = action;
      payuForm.style.display = 'none';
      payuForm.setAttribute('accept-charset', 'UTF-8');
      for (const [k, v] of Object.entries(fields)) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = k;
        input.value = String(v ?? '');
        payuForm.appendChild(input);
      }
      document.body.appendChild(payuForm);
      leavingForPayu = true;
      toast.message('Redirecting to secure payment…', { duration: 2500 });
      window.setTimeout(() => {
        payuForm.submit();
      }, 0);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setSubmitError(msg);
      toast.error(msg);
    } finally {
      if (!leavingForPayu) setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full rounded-2xl border border-slate-200/80 bg-white p-12 shadow-lg">
        <div className="flex flex-col items-center justify-center gap-3">
          <LoaderCircleIcon className="h-10 w-10 animate-spin text-[#007bff]" />
          <p className="text-sm text-slate-500">Loading…</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="w-full rounded-2xl border border-slate-200/80 bg-white p-8 shadow-lg">
        <h2 className="text-lg font-semibold text-red-600">Registration unavailable</h2>
        <p className="mt-2 text-sm text-slate-600">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xl">
      {/* Header — bright blue #007bff, icon + title left-aligned */}
      <div className="flex items-start gap-4 rounded-t-2xl bg-[#007bff] px-6 py-5 text-white sm:px-8 sm:py-6">
        <ClipboardList className="mt-0.5 h-7 w-7 shrink-0 text-white sm:h-8 sm:w-8" aria-hidden />
        <div className="min-w-0 flex-1 text-left">
  
          {academyName ? (
            <p className="mt-1.5 text-sm text-white/90">{academyName}</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-6 px-6 py-8 sm:px-10 sm:py-9">
        {selected ? (
          <div className="space-y-3 rounded-lg border border-slate-100 bg-slate-50/90 px-4 py-3">
            <p className="text-sm leading-relaxed text-slate-800">{selected.description}</p>
            <dl className="grid gap-2 text-sm text-slate-900">
              {selected.time?.trim() ? (
                <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                  <dt className="font-semibold text-slate-700">Session time</dt>
                  <dd className="tabular-nums">{selected.time.trim()}</dd>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                <dt className="font-semibold text-slate-700">Event dates</dt>
                <dd>
                  {formatDate(selected.startdate) === formatDate(selected.enddate)
                    ? formatDate(selected.startdate)
                    : `${formatDate(selected.startdate)} – ${formatDate(selected.enddate)}`}
                </dd>
              </div>
            </dl>
          </div>
        ) : (
          <div className="space-y-3">
            {events.length === 0 ? (
              <p className="text-sm text-slate-600">No events are open for registration right now.</p>
            ) : (
              <p className="text-sm text-slate-600">
                Select an event in the form to view the schedule and fee for your session.
              </p>
            )}
          </div>
        )}

        <form noValidate onSubmit={onSubmit} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <ReqLabel htmlFor="eventId" icon={CalendarDays}>
                Select Event
              </ReqLabel>
              <Select value={eventId || undefined} onValueChange={setEventId} required>
                <SelectTrigger
                  id="eventId"
                  size="lg"
                  className={cn(
                    'h-11 w-full rounded-md border-slate-300 bg-white text-base font-normal text-slate-900',
                    'shadow-sm focus-visible:border-[#007bff] focus-visible:ring-2 focus-visible:ring-[#007bff]/30',
                    'data-placeholder:text-slate-500 [&_[data-slot=select-value]]:text-slate-900',
                  )}
                >
                  <SelectValue placeholder="-- Choose an event --" />
                </SelectTrigger>
                <SelectContent>
                  {events.map((ev) => (
                    <SelectItem key={ev.id} value={String(ev.id)}>
                      {eventLabel(ev)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <ReqLabel htmlFor="studentName" icon={User}>
                Student Name
              </ReqLabel>
              <Input
                id="studentName"
                placeholder="Student name"
                variant="lg"
                className={fieldClass}
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <ReqLabel htmlFor="parentName" icon={User}>
                Parent Name
              </ReqLabel>
              <Input
                id="parentName"
                placeholder="Parent name"
                variant="lg"
                className={fieldClass}
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <ReqLabel htmlFor="dob-trigger" icon={CalendarDays}>
                Date of Birth
              </ReqLabel>
              <Popover open={dobOpen} onOpenChange={setDobOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="dob-trigger"
                    type="button"
                    variant="outline"
                    className={cn(
                      fieldClass,
                      'w-full justify-start gap-2 font-normal',
                      !dobDate && 'text-slate-500',
                    )}
                    aria-expanded={dobOpen}
                    aria-haspopup="dialog"
                  >
                    <CalendarDays className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                    {dobDate ? format(dobDate, 'MMMM d, yyyy') : 'Select date of birth'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dobDate}
                    onSelect={(d) => {
                      setDob(d ? format(d, 'yyyy-MM-dd') : '');
                      setDobOpen(false);
                    }}
                    disabled={(date) => date > new Date()}
                    defaultMonth={dobDate ?? new Date(new Date().getFullYear() - 8, 0)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <ReqLabel htmlFor="phone" icon={Phone}>
                Phone
              </ReqLabel>
              <Input
                id="phone"
                type="tel"
                placeholder="10-digit number"
                variant="lg"
                className={fieldClass}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                autoComplete="tel"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <ReqLabel htmlFor="email" icon={Mail}>
                Email Address
              </ReqLabel>
              <Input
                id="email"
                type="email"
                placeholder="Email address"
                variant="lg"
                className={fieldClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
          </div>

          {submitError && <p className="text-sm text-red-600">{submitError}</p>}

          <Button
            type="submit"
            size="lg"
            className="h-12 w-full rounded-lg bg-[#6f42c1] text-base font-semibold text-white shadow-sm hover:bg-[#5e3aa8]"
            disabled={submitting || events.length === 0 || !eventId}
          >
            {submitting ? (
              <>
                <LoaderCircleIcon className="mr-2 h-5 w-5 animate-spin" />
                Please wait…
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-5 w-5" />
                Register for Event
              </>
            )}
          </Button>

          <div className="flex items-start gap-2.5 text-left text-xs leading-relaxed text-slate-500">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#007bff]" aria-hidden />
            <span>
              After submitting, you&apos;ll be redirected to payment. A confirmation email with your registration details
              and receipt will follow.
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
 