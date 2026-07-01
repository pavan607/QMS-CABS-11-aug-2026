'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  UserCircle, Loader2, Save, Upload, Image as ImageIcon, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { SYSTEM_ROLE_OPTIONS } from '@/lib/user-roles';

const OS_DIRECTOR_DESIGNATION = 'OS & Director';

const DEPARTMENTS = [
  { value: 'User/Designer Department', label: 'User/Designer Department' },
  { value: 'R&QA', label: 'R&QA' },
  { value: 'ORDAQA', label: 'ORDAQA' },
  { value: 'SQAD', label: 'SQAD' },
];

const DESIGNATIONS = [
  { value: 'OS & Director', label: 'OS & Director' },
  { value: 'GD', label: 'Group Director (GD)' },
  { value: 'DGD', label: 'Deputy Group Director (DGD)' },
  { value: 'DH', label: 'Division Head (DH)' },
  { value: 'TH', label: 'Team Head (TH)' },
  { value: 'Inspector', label: 'Inspector' },
  { value: 'Designer', label: 'Designer' },
];

interface ProfileUser {
  id: number;
  employee_id: string;
  email: string | null;
  name: string;
  role: string;
  designation: string | null;
  scientist_rank: string | null;
  status: string;
  phone: string | null;
  department: string | null;
  position: string | null;
  contact_number: string | null;
  signature_path: string | null;
  reporting_to: number | null;
  reporting_to_name: string | null;
  reporting_to_employee_id: string | null;
}

interface ManagerOption {
  id: number;
  employee_id: string;
  name: string;
  designation: string | null;
  status: string;
}

type FormState = {
  employee_id: string;
  name: string;
  email: string;
  password: string;
  role: string;
  designation: string;
  scientist_rank: string;
  department: string;
  reporting_to: string;
  status: string;
  contact_number: string;
};

function normalizeDesignation(value: string | null): string {
  if (value && DESIGNATIONS.some((d) => d.value === value)) return value;
  return '';
}

function userToForm(u: ProfileUser): FormState {
  const des = normalizeDesignation(u.designation);
  return {
    employee_id: u.employee_id || '',
    name: u.name || '',
    email: u.email || '',
    password: '',
    role: u.role || 'initiator',
    designation: des,
    scientist_rank: u.scientist_rank || '',
    department: des === OS_DIRECTOR_DESIGNATION ? '' : u.department || '',
    reporting_to: u.reporting_to ? String(u.reporting_to) : '',
    status: u.status || 'active',
    contact_number: u.contact_number || '',
  };
}

export default function ProfilePage() {
  const { data: session, update } = useSession();
  const permissions = usePermissions();
  const isAdmin = permissions.isAdmin();

  const userId = session?.user?.id ? String(session.user.id) : '';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [profile, setProfile] = useState<ProfileUser | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [baseline, setBaseline] = useState<FormState | null>(null);
  const [allUsers, setAllUsers] = useState<ManagerOption[]>([]);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
  const [signatureFilePreviewUrl, setSignatureFilePreviewUrl] = useState<string | null>(null);

  const possibleManagers = useMemo(
    () => allUsers.filter((u) => u.status === 'active' && String(u.id) !== userId),
    [allUsers, userId]
  );

  useEffect(() => {
    if (!signatureFile) {
      setSignatureFilePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(signatureFile);
    setSignatureFilePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [signatureFile]);

  const loadProfile = useCallback(async (opts?: { silent?: boolean }) => {
    if (!userId) return;
    const silent = opts?.silent === true;
    if (!silent) {
      setError('');
      setLoading(true);
    }
    try {
      const [profRes, usersRes] = await Promise.all([
        fetch('/api/users/profile'),
        fetch('/api/users'),
      ]);
      const profData = await profRes.json();
      if (!profRes.ok) {
        if (!silent) {
          setError(profData.error || 'Failed to load profile');
          setProfile(null);
          setForm(null);
          setBaseline(null);
        }
        return;
      }
      const u = profData.user as ProfileUser;
      setProfile(u);
      const f = userToForm(u);
      setForm(f);
      setBaseline(f);
      setSignatureFile(null);
      setSignaturePreview(u.signature_path || null);

      const ud = await usersRes.json();
      if (usersRes.ok) {
        setAllUsers(
          (ud.users || []).map((x: ManagerOption) => ({
            id: x.id,
            employee_id: x.employee_id,
            name: x.name,
            designation: x.designation,
            status: x.status,
          }))
        );
      }
    } catch {
      if (!silent) {
        setError('Failed to load profile');
        setProfile(null);
        setForm(null);
        setBaseline(null);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const resetForm = () => {
    if (baseline) {
      setForm({ ...baseline, password: '' });
      setSignatureFile(null);
      setSignaturePreview(profile?.signature_path || null);
    }
    setSuccess('');
    setError('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !userId) return;
    setError('');
    setSuccess('');

    const trimmedName = form.name.trim();
    if (!trimmedName) {
      setError('Full name is required');
      return;
    }
    if (isAdmin && !form.employee_id.trim()) {
      setError('Employee ID is required');
      return;
    }
    if (isAdmin && !form.designation) {
      setError('Designation is required');
      return;
    }
    if (form.designation !== OS_DIRECTOR_DESIGNATION && !form.department) {
      setError('Department is required for your designation');
      return;
    }
    if (form.password && form.password.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }

    const emailNorm = form.email.trim() || null;
    const payload: Record<string, unknown> = {
      name: trimmedName,
      email: emailNorm,
      scientist_rank: form.scientist_rank.trim() || null,
      contact_number: form.contact_number.trim() || null,
      department: form.designation === OS_DIRECTOR_DESIGNATION ? null : form.department || null,
    };

    if (form.password.trim()) {
      payload.password = form.password;
    }

    if (isAdmin) {
      payload.employee_id = form.employee_id.trim().toUpperCase();
      payload.role = form.role;
      payload.designation = form.designation || null;
      payload.status = form.status;
      payload.reporting_to = form.reporting_to ? parseInt(form.reporting_to, 10) : null;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not save profile');
        return;
      }

      const updated = data.user as ProfileUser;
      await update({
        name: updated.name,
        email: updated.email ?? undefined,
      });

      if (signatureFile) {
        try {
          setUploadingSignature(true);
          const fd = new FormData();
          fd.append('signature', signatureFile);
          const sigRes = await fetch(`/api/users/${userId}/signature`, { method: 'POST', body: fd });
          const sigData = await sigRes.json();
          if (!sigRes.ok) {
            setError(sigData.error || 'Profile saved but signature upload failed');
          }
        } catch {
          setError('Profile saved but signature upload failed');
        } finally {
          setUploadingSignature(false);
          setSignatureFile(null);
        }
      }

      await loadProfile({ silent: true });
      setSuccess('Profile updated successfully');
    } catch {
      setError('Could not save profile');
    } finally {
      setSaving(false);
    }
  };

  const removeSignature = async () => {
    if (!userId || !signaturePreview) return;
    if (!confirm('Remove your scanned signature?')) return;
    try {
      const res = await fetch(`/api/users/${userId}/signature`, { method: 'DELETE' });
      if (res.ok) {
        setSignaturePreview(null);
        setProfile((p) => (p ? { ...p, signature_path: null } : p));
        setSuccess('Signature removed');
      } else {
        const d = await res.json();
        setError(d.error || 'Failed to remove signature');
      }
    } catch {
      setError('Failed to remove signature');
    }
  };

  if (!userId) {
    return (
      <div className="flex justify-center py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#1e3a5f] dark:text-sky-400 flex items-center gap-2">
          <UserCircle className="h-7 w-7 shrink-0" />
          My profile
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Update your account details, contact information, and scanned signature. Employee ID is used to sign in.
        </p>
      </div>

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading profile…
          </CardContent>
        </Card>
      ) : !form ? (
        <Card>
          <CardContent className="py-8 text-center text-destructive text-sm">{error || 'Unable to load profile.'}</CardContent>
        </Card>
      ) : (
        <Card className="border-gray-200 dark:border-gray-800 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl">Profile</CardTitle>
            <CardDescription>
              {isAdmin
                ? 'You can edit all fields including hierarchy and role. Other users see a smaller set and must ask an administrator for structural changes.'
                : 'Role, designation, reporting line, and status are set by an administrator. You can update your name, email, rank/grade, department, contact, password, and signature.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                  {error}
                </div>
              )}
              {success && (
                <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
                  {success}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Employee ID *</Label>
                  <Input
                    required={isAdmin}
                    readOnly={!isAdmin}
                    className={!isAdmin ? 'bg-muted' : undefined}
                    placeholder="e.g. EMP001"
                    value={form.employee_id}
                    onChange={(e) => setForm({ ...form, employee_id: e.target.value.toUpperCase() })}
                  />
                  <p className="text-xs text-muted-foreground">Used as login ID</p>
                </div>
                <div className="grid gap-2">
                  <Label>Full Name *</Label>
                  <Input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    autoComplete="name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="e.g. user@example.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>New password (leave blank to keep)</Label>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="At least 6 characters"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Designation *</Label>
                  <Select
                    value={form.designation || undefined}
                    disabled={!isAdmin}
                    onValueChange={(v) =>
                      setForm({
                        ...form,
                        designation: v,
                        ...(v === OS_DIRECTOR_DESIGNATION ? { department: '' } : {}),
                      })
                    }
                  >
                    <SelectTrigger className={!isAdmin ? 'bg-muted' : undefined}>
                      <SelectValue placeholder="Select designation..." />
                    </SelectTrigger>
                    <SelectContent>
                      {DESIGNATIONS.map((d) => (
                        <SelectItem key={d.value} value={d.value}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Scientist rank / grade</Label>
                  <Input
                    placeholder="e.g. Sc-E, Sc-F, Sc-G"
                    value={form.scientist_rank}
                    onChange={(e) => setForm({ ...form, scientist_rank: e.target.value })}
                  />
                </div>
              </div>

              {form.designation === OS_DIRECTOR_DESIGNATION ? (
                <div className="rounded-md border border-dashed bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Department</span>
                  <p className="mt-1 text-xs leading-relaxed">
                    Not applicable — OS &amp; Director is the principal and is not assigned to a department.
                  </p>
                </div>
              ) : (
                <div className="grid gap-2">
                  <Label>Department *</Label>
                  <Select
                    value={form.department}
                    onValueChange={(v) => setForm({ ...form, department: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select department..." />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map((d) => (
                        <SelectItem key={d.value} value={d.value}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>System role *</Label>
                  <Select
                    value={form.role}
                    disabled={!isAdmin}
                    onValueChange={(v) => setForm({ ...form, role: v })}
                  >
                    <SelectTrigger className={!isAdmin ? 'bg-muted' : undefined}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SYSTEM_ROLE_OPTIONS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Status *</Label>
                  <Select
                    value={form.status}
                    disabled={!isAdmin}
                    onValueChange={(v) => setForm({ ...form, status: v })}
                  >
                    <SelectTrigger className={!isAdmin ? 'bg-muted' : undefined}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Reports to</Label>
                <Select
                  value={form.reporting_to || 'none'}
                  disabled={!isAdmin}
                  onValueChange={(v) => setForm({ ...form, reporting_to: v === 'none' ? '' : v })}
                >
                  <SelectTrigger className={!isAdmin ? 'bg-muted' : undefined}>
                    <SelectValue placeholder="Select manager..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (top level)</SelectItem>
                    {possibleManagers.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.employee_id} — {u.name}
                        {u.designation ? ` (${u.designation})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                <div className="grid gap-2">
                  <Label>Contact number</Label>
                  <Input
                    placeholder="e.g. 9876543210"
                    value={form.contact_number}
                    onChange={(e) => setForm({ ...form, contact_number: e.target.value })}
                    autoComplete="tel"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Scanned signature</Label>
                  {signaturePreview && !signatureFile ? (
                    <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
                      <ImageIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <img src={signaturePreview} alt="Signature" className="h-8 max-w-[120px] object-contain" />
                      <span className="flex-1" />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={removeSignature}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : signatureFile ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                        <ImageIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="flex-1 truncate">{signatureFile.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => setSignatureFile(null)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="rounded-md border bg-white dark:bg-gray-900 p-2">
                        {signatureFilePreviewUrl ? (
                          <img
                            src={signatureFilePreviewUrl}
                            alt="Preview"
                            className="h-12 max-w-[200px] object-contain"
                          />
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <label className="flex items-center gap-2 rounded-md border border-dashed px-3 py-2.5 text-sm cursor-pointer hover:bg-muted/30 transition-colors">
                      <Upload className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">Upload signature (PNG/JPEG, max 2MB)</span>
                      <input
                        type="file"
                        className="hidden"
                        accept=".png,.jpg,.jpeg"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          if (!['image/png', 'image/jpeg', 'image/jpg'].includes(f.type)) {
                            setError('Only PNG and JPEG images are allowed');
                            return;
                          }
                          if (f.size > 2 * 1024 * 1024) {
                            setError('Signature file must be under 2MB');
                            return;
                          }
                          setSignatureFile(f);
                          setError('');
                        }}
                      />
                    </label>
                  )}
                  <p className="text-xs text-muted-foreground">PNG or JPEG only, max 2MB</p>
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2 pt-2 border-t">
                <Button type="button" variant="outline" onClick={resetForm} disabled={saving || uploadingSignature}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saving || uploadingSignature}
                  className="bg-[#1e3a5f] hover:bg-[#2a4d7a] text-white"
                >
                  {saving || uploadingSignature ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {uploadingSignature ? 'Uploading…' : 'Saving…'}
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save changes
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
