'use client';

import { useState, useEffect, useCallback, Fragment, useRef } from 'react';
import {
  Users, Plus, Search, ChevronRight, ChevronDown,
  Edit, Trash2, MoreVertical, IdCard, Shield, Crown, UserCheck, UserCog, Pen, ClipboardCheck,
  Upload, X, Image, Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { SYSTEM_ROLE_OPTIONS } from '@/lib/user-roles';
import { cn } from '@/lib/utils';

interface User {
  id: number;
  employee_id: string;
  name: string;
  email: string;
  role: string;
  designation: string;
  scientist_rank: string;
  department: string;
  status: string;
  reporting_to: number | null;
  reporting_to_name: string;
  reporting_to_employee_id: string;
  contact_number: string;
  signature_path: string;
  direct_report_count: string;
  last_active: string;
  created_at: string;
}

const DEPARTMENTS = [
  { value: 'User/Designer Department', label: 'User/Designer Department' },
  { value: 'R&QA', label: 'R&QA' },
  { value: 'ORDAQA', label: 'ORDAQA' },
  { value: 'SQAD', label: 'SQAD' },
];

const DESIGNATIONS = [
  { value: 'OS & Director', label: 'OS & Director', icon: Building2 },
  { value: 'GD', label: 'Group Director (GD)', icon: Crown },
  { value: 'DGD', label: 'Deputy Group Director (DGD)', icon: Shield },
  { value: 'DH', label: 'Division Head (DH)', icon: UserCog },
  { value: 'TH', label: 'Team Head (TH)', icon: UserCheck },
  { value: 'Inspector', label: 'Inspector', icon: ClipboardCheck },
  { value: 'Designer', label: 'Designer', icon: Pen },
];

const DESIGNATION_COLORS: Record<string, string> = {
  'GD': 'bg-purple-600 hover:bg-purple-700',
  'DGD': 'bg-indigo-500 hover:bg-indigo-600',
  'DH': 'bg-blue-500 hover:bg-blue-600',
  'TH': 'bg-teal-500 hover:bg-teal-600',
  'Inspector': 'bg-emerald-500 hover:bg-emerald-600',
  'Designer': 'bg-slate-500 hover:bg-slate-600',
  'OS & Director': 'bg-violet-500 hover:bg-violet-600',
};

const DESIGNATION_ICON_COLORS: Record<string, string> = {
  'GD': 'text-purple-600',
  'DGD': 'text-indigo-500',
  'DH': 'text-blue-500',
  'TH': 'text-teal-500',
  'Inspector': 'text-emerald-500',
  'Designer': 'text-slate-500',
  'OS & Director': 'text-violet-500',
};

/** Stored designation value — principal has no department. */
const OS_DIRECTOR_DESIGNATION = 'OS & Director';

function formatUserDepartmentCell(designation: string, department: string) {
  if (designation === OS_DIRECTOR_DESIGNATION) {
    return (
      <span className="text-sm text-muted-foreground italic" title="Principal — not assigned to a department">
        —
      </span>
    );
  }
  return <span className="text-sm">{department || '—'}</span>;
}

type DialogMode = 'add-user' | 'edit-user' | 'add-report' | null;

function ReportsToSearchSelect({
  managers,
  value,
  onChange,
  excludeUserId,
  placeholder = 'Type to search manager...',
}: {
  managers: User[];
  value: string;
  onChange: (userId: string) => void;
  excludeUserId?: number;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const options = managers.filter((u) => excludeUserId == null || u.id !== excludeUserId);
  const selected = value ? options.find((u) => String(u.id) === value) : undefined;

  const selectedLabel = selected
    ? `${selected.employee_id} - ${selected.name}${selected.designation ? ` (${selected.designation})` : ''}`
    : '';

  const closeList = () => {
    setOpen(false);
    setQuery('');
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeList();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = options.filter((u) => {
    if (!q) return true;
    return (
      (u.name || '').toLowerCase().includes(q) ||
      (u.employee_id || '').toLowerCase().includes(q) ||
      (u.designation || '').toLowerCase().includes(q)
    );
  });

  const pick = (userId: string) => {
    onChange(userId);
    closeList();
    inputRef.current?.blur();
  };

  const inputPlaceholder = !value ? 'None (Top Level) — type to search' : placeholder;

  return (
    <div ref={containerRef} className="relative">
      <div
        className={cn(
          'flex h-10 w-full items-center rounded-md border border-input bg-background ring-offset-background',
          open && 'ring-2 ring-ring ring-offset-2'
        )}
      >
        <Input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          className="h-full flex-1 border-0 bg-transparent px-3 py-2 text-sm shadow-none focus-visible:ring-0"
          placeholder={inputPlaceholder}
          value={open ? query : selectedLabel}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setQuery('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') closeList();
          }}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label="Toggle manager list"
          className="flex h-full w-9 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (open) {
              closeList();
            } else {
              setOpen(true);
              setQuery('');
              inputRef.current?.focus();
            }
          }}
        >
          <ChevronDown className={cn('h-4 w-4 opacity-50 transition-transform', open && 'rotate-180')} />
        </button>
      </div>
      {open && (
        <div
          className="absolute z-[100] mt-1 w-full min-w-[280px] rounded-md border bg-popover text-popover-foreground shadow-md"
          role="listbox"
        >
          <div className="max-h-[min(280px,40vh)] overflow-y-auto p-1">
            <button
              type="button"
              role="option"
              aria-selected={!value}
              className={cn(
                'flex w-full items-center rounded-sm px-2 py-2 text-left text-sm hover:bg-accent',
                !value && 'bg-accent'
              )}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick('')}
            >
              None (Top Level)
            </button>
            {filtered.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">No matches</div>
            ) : (
              filtered.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  role="option"
                  aria-selected={String(u.id) === value}
                  className={cn(
                    'flex w-full flex-col items-start rounded-sm px-2 py-2 text-left text-sm hover:bg-accent',
                    String(u.id) === value && 'bg-accent'
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(String(u.id))}
                >
                  <span className="font-medium">{u.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {u.employee_id}
                    {u.designation ? ` · ${u.designation}` : ''}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}


export default function UsersPage() {
  const permissions = usePermissions();
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [topLevelUsers, setTopLevelUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<User[] | null>(null);

  const [expandedUsers, setExpandedUsers] = useState<Set<number>>(new Set());
  const [reportsByManager, setReportsByManager] = useState<Record<number, User[]>>({});
  const [loadingReports, setLoadingReports] = useState<Set<number>>(new Set());

  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [contextManagerId, setContextManagerId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    employee_id: '',
    name: '',
    email: '',
    password: '',
    role: 'initiator',
    designation: '',
    scientist_rank: '',
    department: '',
    reporting_to: '',
    status: 'active',
    contact_number: '',
  });
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
  const [uploadingSignature, setUploadingSignature] = useState(false);

  const fetchAllUsers = useCallback(async () => {
    try {
      const response = await fetch('/api/users');
      const data = await response.json();
      setAllUsers(data.users || []);
    } catch (error) {
      console.error('Error fetching all users:', error);
    }
  }, []);

  const fetchTopLevelUsers = useCallback(async () => {
    try {
      const response = await fetch('/api/users?reporting_to=null');
      const data = await response.json();
      setTopLevelUsers(data.users || []);
    } catch (error) {
      console.error('Error fetching top-level users:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTopLevelUsers();
    fetchAllUsers();
  }, [fetchTopLevelUsers, fetchAllUsers]);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults(null);
      return;
    }
    const term = searchTerm.toLowerCase();
    const filtered = allUsers.filter(u =>
      u.name?.toLowerCase().includes(term) ||
      u.employee_id?.toLowerCase().includes(term) ||
      u.email?.toLowerCase().includes(term) ||
      u.designation?.toLowerCase().includes(term)
    );
    setSearchResults(filtered);
  }, [searchTerm, allUsers]);

  const fetchDirectReports = async (managerId: number) => {
    setLoadingReports(prev => new Set(prev).add(managerId));
    try {
      const response = await fetch(`/api/users?reporting_to=${managerId}`);
      const data = await response.json();
      setReportsByManager(prev => ({ ...prev, [managerId]: data.users || [] }));
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoadingReports(prev => {
        const next = new Set(prev);
        next.delete(managerId);
        return next;
      });
    }
  };

  const toggleUser = (userId: number) => {
    setExpandedUsers(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
        if (!reportsByManager[userId]) {
          fetchDirectReports(userId);
        }
      }
      return next;
    });
  };

  const refreshAll = () => {
    fetchTopLevelUsers();
    fetchAllUsers();
    setReportsByManager({});
    expandedUsers.forEach(id => fetchDirectReports(id));
  };

  const openAddUser = () => {
    resetForm();
    setContextManagerId(null);
    setDialogMode('add-user');
  };

  const openAddReport = (managerId: number) => {
    resetForm();
    setContextManagerId(managerId);
    setFormData(prev => ({ ...prev, reporting_to: String(managerId) }));
    setDialogMode('add-report');
  };

  const openEditUser = (user: User) => {
    setEditingUser(user);
    const des = user.designation || '';
    setFormData({
      employee_id: user.employee_id || '',
      name: user.name,
      email: user.email || '',
      password: '',
      role: user.role,
      designation: des,
      scientist_rank: user.scientist_rank || '',
      department: des === OS_DIRECTOR_DESIGNATION ? '' : user.department || '',
      reporting_to: user.reporting_to ? String(user.reporting_to) : '',
      status: user.status,
      contact_number: user.contact_number || '',
    });
    setSignatureFile(null);
    setSignaturePreview(user.signature_path || null);
    setDialogMode('edit-user');
  };

  const closeDialog = () => {
    setDialogMode(null);
    setEditingUser(null);
    setContextManagerId(null);
  };

  const resetForm = () => {
    setFormData({
      employee_id: '',
      name: '',
      email: '',
      password: '',
      role: 'initiator',
      designation: '',
      scientist_rank: '',
      department: '',
      reporting_to: '',
      status: 'active',
      contact_number: '',
    });
    setSignatureFile(null);
    setSignaturePreview(null);
  };

  const handleSubmitUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const isEdit = dialogMode === 'edit-user';
      const url = isEdit ? `/api/users/${editingUser!.id}` : '/api/users';
      const method = isEdit ? 'PUT' : 'POST';

      const emailNorm = formData.email.trim() || null;
      const payload: any = {
        ...formData,
        email: emailNorm,
        reporting_to: formData.reporting_to ? parseInt(formData.reporting_to) : null,
      };
      if (formData.designation === OS_DIRECTOR_DESIGNATION) {
        payload.department = null;
      }
      if (isEdit && !formData.password) delete payload.password;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        const userId = data.user?.id;

        if (signatureFile && userId) {
          try {
            setUploadingSignature(true);
            const fd = new FormData();
            fd.append('signature', signatureFile);
            await fetch(`/api/users/${userId}/signature`, { method: 'POST', body: fd });
          } catch (err) {
            console.error('Signature upload failed:', err);
          } finally {
            setUploadingSignature(false);
          }
        }

        closeDialog();
        refreshAll();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to save user');
      }
    } catch (error) {
      console.error('Error saving user:', error);
      alert('Failed to save user');
    }
  };

  const handleDeleteUser = async (user: User) => {
    const reportCount = Number(user.direct_report_count || 0);
    const msg = reportCount > 0
      ? `Delete ${user.name}? This user has ${reportCount} direct report(s). Their reporting will be unlinked.`
      : `Delete ${user.name}?`;
    if (!confirm(msg)) return;
    try {
      const response = await fetch(`/api/users/${user.id}`, { method: 'DELETE' });
      if (response.ok) {
        refreshAll();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete user');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

  const getDesignationIcon = (designation: string) => {
    const entry = DESIGNATIONS.find(d => d.value === designation);
    if (!entry) return <Users className="h-4 w-4 text-muted-foreground shrink-0" />;
    const Icon = entry.icon;
    return <Icon className={`h-4 w-4 ${DESIGNATION_ICON_COLORS[designation] || 'text-muted-foreground'} shrink-0`} />;
  };

  const getDesignationBadge = (designation: string) => {
    if (!designation) return <span className="text-muted-foreground text-xs">--</span>;
    const color = DESIGNATION_COLORS[designation] || 'bg-gray-500';
    return <Badge className={`${color} text-white font-medium`}>{designation}</Badge>;
  };

  const totalUsers = allUsers.length;
  const designationCounts = DESIGNATIONS.map(d => ({
    ...d,
    count: allUsers.filter(u => u.designation === d.value).length,
  }));

  const possibleManagers = allUsers.filter(u => u.status === 'active');

  const renderUserRow = (user: User, depth: number) => {
    const isExpanded = expandedUsers.has(user.id);
    const reports = reportsByManager[user.id] || [];
    const isLoadingReps = loadingReports.has(user.id);
    const reportCount = Number(user.direct_report_count || 0);
    const paddingLeft = depth * 32;

    return (
      <Fragment key={`user-${user.id}`}>
        <TableRow className={depth === 0 ? 'bg-muted/30 hover:bg-muted/50' : 'hover:bg-muted/20'}>
          <TableCell>
            <div className="flex items-center gap-2" style={{ paddingLeft }}>
              {reportCount > 0 ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => toggleUser(user.id)}
                >
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              ) : (
                <div className="h-6 w-6 shrink-0" />
              )}
              {getDesignationIcon(user.designation)}
              <div>
                <span className="font-semibold">{user.name}</span>
                {user.email && <div className="text-xs text-muted-foreground">{user.email}</div>}
              </div>
            </div>
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-1.5">
              <IdCard className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-mono text-sm font-medium">{user.employee_id || '--'}</span>
            </div>
          </TableCell>
          <TableCell>{getDesignationBadge(user.designation)}</TableCell>
          <TableCell>
            <span className="text-sm">{user.scientist_rank || '--'}</span>
          </TableCell>
          <TableCell>{formatUserDepartmentCell(user.designation, user.department)}</TableCell>
          <TableCell>
            <Badge
              variant={user.status === 'active' ? 'default' : 'secondary'}
              className={user.status === 'active' ? 'bg-green-500 hover:bg-green-600 text-white font-medium' : 'font-medium'}
            >
              {user.status}
            </Badge>
          </TableCell>
          <TableCell>
            {reportCount > 0 ? (
              <span className="text-sm text-muted-foreground">
                {reportCount} report{reportCount !== 1 ? 's' : ''}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">--</span>
            )}
          </TableCell>
          <TableCell className="text-right">
            {permissions.isAdmin() && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>User Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => openAddReport(user.id)}>
                    <Plus className="mr-2 h-4 w-4" />Add Report
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openEditUser(user)}>
                    <Edit className="mr-2 h-4 w-4" />Edit User
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDeleteUser(user)}>
                    <Trash2 className="mr-2 h-4 w-4" />Delete User
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </TableCell>
        </TableRow>

        {isExpanded && (
          isLoadingReps ? (
            <TableRow key={`loading-${user.id}`}>
              <TableCell colSpan={8} className="text-center py-3 text-sm text-muted-foreground">
                Loading reports...
              </TableCell>
            </TableRow>
          ) : reports.length === 0 ? (
            <TableRow key={`empty-${user.id}`}>
              <TableCell colSpan={8} className="py-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground" style={{ paddingLeft: paddingLeft + 40 }}>
                  No direct reports.
                  {permissions.isAdmin() && (
                    <Button variant="link" size="sm" className="p-0 h-auto" onClick={() => openAddReport(user.id)}>
                      Add one
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ) : reports.map(report => renderUserRow(report, depth + 1))
        )}
      </Fragment>
    );
  };

  if (!permissions.isAdmin()) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You do not have permission to manage users. Only administrators can access this page.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Users</h2>
          <p className="text-base text-muted-foreground">
            Manage users, designations, and reporting hierarchy
          </p>
        </div>
        {permissions.isAdmin() && (
          <Button className="bg-[#1e3a5f] hover:bg-[#2a4d7a] text-white gap-2" onClick={openAddUser}>
            <Plus className="h-4 w-4" />
            New User
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card className="border-0 shadow-lg overflow-hidden bg-gradient-to-br from-blue-500 to-blue-700 dark:from-blue-600 dark:to-blue-900">
          <CardContent className="pt-5 pb-4 relative">
            <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-white/5 -translate-y-6 translate-x-6" />
            <div className="relative">
              <div className="bg-white/20 p-2 rounded-lg w-fit mb-3 backdrop-blur-sm">
                <Users className="h-4 w-4 text-white" />
              </div>
              <div className="text-2xl font-bold text-white">{totalUsers}</div>
              <p className="text-xs font-medium mt-0.5 text-blue-100">Total</p>
            </div>
          </CardContent>
        </Card>
        {designationCounts.map(d => {
          const gradients: Record<string, string> = {
            'GD': 'from-purple-500 to-purple-700 dark:from-purple-600 dark:to-purple-900',
            'DGD': 'from-indigo-500 to-indigo-700 dark:from-indigo-600 dark:to-indigo-900',
            'DH': 'from-sky-500 to-sky-700 dark:from-sky-600 dark:to-sky-900',
            'TH': 'from-teal-500 to-teal-700 dark:from-teal-600 dark:to-teal-900',
            'Inspector': 'from-emerald-500 to-emerald-700 dark:from-emerald-600 dark:to-emerald-900',
            'Designer': 'from-slate-500 to-slate-700 dark:from-slate-600 dark:to-slate-900',
            'OS & Director': 'from-violet-500 to-violet-700 dark:from-violet-600 dark:to-violet-900',
          };
          const labelColors: Record<string, string> = {
            'GD': 'text-purple-100', 'DGD': 'text-indigo-100', 'DH': 'text-sky-100',
            'TH': 'text-teal-100', 'Inspector': 'text-emerald-100', 'Designer': 'text-slate-200',
            'OS & Director': 'text-violet-100',
          };
          return (
            <Card key={d.value} className={`border-0 shadow-lg overflow-hidden bg-gradient-to-br ${gradients[d.value] || 'from-gray-500 to-gray-700'}`}>
              <CardContent className="pt-5 pb-4 relative">
                <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-white/5 -translate-y-6 translate-x-6" />
                <div className="relative">
                  <div className="bg-white/20 p-2 rounded-lg w-fit mb-3 backdrop-blur-sm">
                    <d.icon className="h-4 w-4 text-white" />
                  </div>
                  <div className="text-2xl font-bold text-white">{d.count}</div>
                  <p className={`text-xs font-medium mt-0.5 ${labelColors[d.value] || 'text-gray-100'}`}>{d.value}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search users by name, employee ID, or email..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Search Results (flat table) */}
      {searchResults !== null && (
        <Card>
          <CardHeader>
            <CardTitle>Search Results</CardTitle>
            <CardDescription>{searchResults.length} user{searchResults.length !== 1 ? 's' : ''} found</CardDescription>
          </CardHeader>
          <CardContent>
            {searchResults.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No matching users.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Rank/Grade</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Reports To</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {searchResults.map(user => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getDesignationIcon(user.designation)}
                          <div>
                            <div className="font-semibold">{user.name}</div>
                            {user.email && <div className="text-xs text-muted-foreground">{user.email}</div>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><span className="font-mono text-sm font-medium">{user.employee_id}</span></TableCell>
                      <TableCell>{getDesignationBadge(user.designation)}</TableCell>
                      <TableCell>{user.scientist_rank || '--'}</TableCell>
                      <TableCell>{formatUserDepartmentCell(user.designation, user.department)}</TableCell>
                      <TableCell>
                        {user.reporting_to_name
                          ? <span className="text-sm">{user.reporting_to_employee_id} - {user.reporting_to_name}</span>
                          : <span className="text-xs text-muted-foreground">Top Level</span>
                        }
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={user.status === 'active' ? 'default' : 'secondary'}
                          className={user.status === 'active' ? 'bg-green-500 hover:bg-green-600 text-white font-medium' : 'font-medium'}
                        >
                          {user.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {permissions.isAdmin() && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditUser(user)}><Edit className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteUser(user)}><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Hierarchical Tree Table */}
      {searchResults === null && (
        <Card>
          <CardHeader>
            <CardTitle>Organizational Hierarchy</CardTitle>
            <CardDescription>
              Click on a user to expand and view their direct reports
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : topLevelUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No top-level users found. Create your first user to get started.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[25%]">Name</TableHead>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Rank/Grade</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reports</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topLevelUsers.map(user => renderUserRow(user, 0))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Designation Legend */}
      <Card>
        <CardHeader>
          <CardTitle>Designation Hierarchy</CardTitle>
          <CardDescription>Organizational designations from top to bottom</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            {DESIGNATIONS.filter(d => !['Inspector', 'Designer'].includes(d.value)).map((d, i, arr) => (
              <div key={d.value} className="flex items-center gap-2">
                <d.icon className={`h-4 w-4 ${DESIGNATION_ICON_COLORS[d.value]}`} />
                <Badge className={`${DESIGNATION_COLORS[d.value]} text-white`}>{d.value}</Badge>
                <span className="text-sm text-muted-foreground">{d.label}</span>
                {i < arr.length - 1 && <span className="text-muted-foreground ml-2">&rarr;</span>}
              </div>
            ))}
            <span className="text-muted-foreground ml-2">&rarr;</span>
            <div className="flex flex-col gap-1.5 border rounded-lg px-3 py-2 bg-muted/30">
              {DESIGNATIONS.filter(d => ['Inspector', 'Designer'].includes(d.value)).map(d => (
                <div key={d.value} className="flex items-center gap-2">
                  <d.icon className={`h-4 w-4 ${DESIGNATION_ICON_COLORS[d.value]}`} />
                  <Badge className={`${DESIGNATION_COLORS[d.value]} text-white`}>{d.value}</Badge>
                  <span className="text-sm text-muted-foreground">{d.label}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add / Edit User Dialog */}
      <Dialog open={dialogMode !== null} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>
              {dialogMode === 'edit-user' ? 'Edit User' : dialogMode === 'add-report' ? 'Add Direct Report' : 'New User'}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === 'edit-user'
                ? 'Update user details, designation, and reporting.'
                : dialogMode === 'add-report'
                ? 'Add a new team member reporting to the selected manager.'
                : 'Create a new user account with designation and hierarchy.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitUser} className="flex flex-col min-h-0 flex-1">
            <div className="grid gap-4 py-4 overflow-y-auto flex-1 pr-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Employee ID *</Label>
                  <Input
                    required
                    placeholder="e.g. EMP001"
                    value={formData.employee_id}
                    onChange={(e) => setFormData({ ...formData, employee_id: e.target.value.toUpperCase() })}
                  />
                  <p className="text-xs text-muted-foreground">Used as login ID</p>
                </div>
                <div className="grid gap-2">
                  <Label>Full Name *</Label>
                  <Input
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="e.g. user@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>{dialogMode === 'edit-user' ? 'New Password (leave blank to keep)' : 'Password *'}</Label>
                  <Input
                    type="password"
                    required={dialogMode !== 'edit-user'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Designation *</Label>
                  <Select
                    value={formData.designation}
                    onValueChange={(v) =>
                      setFormData({
                        ...formData,
                        designation: v,
                        ...(v === OS_DIRECTOR_DESIGNATION ? { department: '' } : {}),
                      })
                    }
                  >
                    <SelectTrigger><SelectValue placeholder="Select designation..." /></SelectTrigger>
                    <SelectContent>
                      {DESIGNATIONS.map(d => (
                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Scientist Rank / Grade</Label>
                  <Input
                    placeholder="e.g. Sc-E, Sc-F, Sc-G"
                    value={formData.scientist_rank}
                    onChange={(e) => setFormData({ ...formData, scientist_rank: e.target.value })}
                  />
                </div>
              </div>
              {formData.designation === OS_DIRECTOR_DESIGNATION ? (
                <div className="rounded-md border border-dashed bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Department</span>
                  <p className="mt-1 text-xs leading-relaxed">
                    Not applicable — OS &amp; Director is the principal and is not assigned to a department.
                  </p>
                </div>
              ) : (
                <div className="grid gap-2">
                  <Label>Department *</Label>
                  <Select value={formData.department} onValueChange={(v) => setFormData({ ...formData, department: v })}>
                    <SelectTrigger><SelectValue placeholder="Select department..." /></SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map(d => (
                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>System Role *</Label>
                  <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
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
                  <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Reports To</Label>
                <ReportsToSearchSelect
                  managers={possibleManagers}
                  value={formData.reporting_to}
                  onChange={(v) => setFormData({ ...formData, reporting_to: v })}
                  excludeUserId={editingUser?.id}
                />
              </div>

              <div className="grid grid-cols-2 gap-4 items-start">
                <div className="grid gap-2">
                  <Label>Contact Number</Label>
                  <Input
                    placeholder="e.g. 9876543210"
                    value={formData.contact_number}
                    onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Scanned Signature</Label>
                  {signaturePreview && !signatureFile ? (
                    <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
                      <Image className="h-4 w-4 text-muted-foreground shrink-0" />
                      <img src={signaturePreview} alt="Signature" className="h-8 max-w-[120px] object-contain" />
                      <span className="flex-1" />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={async () => {
                          if (editingUser && confirm('Remove signature?')) {
                            await fetch(`/api/users/${editingUser.id}/signature`, { method: 'DELETE' });
                            setSignaturePreview(null);
                          }
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : signatureFile ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                        <Image className="h-4 w-4 text-muted-foreground shrink-0" />
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
                      <div className="rounded-md border bg-white p-2">
                        <img src={URL.createObjectURL(signatureFile)} alt="Signature preview" className="h-12 max-w-[200px] object-contain" />
                      </div>
                    </div>
                  ) : (
                    <label className="flex items-center gap-2 rounded-md border border-dashed px-3 py-2.5 text-sm cursor-pointer hover:bg-muted/30 transition-colors">
                      <Upload className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Upload signature (PNG/JPEG, max 2MB)</span>
                      <input
                        type="file"
                        className="hidden"
                        accept=".png,.jpg,.jpeg"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            if (!['image/png', 'image/jpeg', 'image/jpg'].includes(f.type)) {
                              alert('Only PNG and JPEG images are allowed');
                              return;
                            }
                            if (f.size > 2 * 1024 * 1024) {
                              alert('File size must be under 2MB');
                              return;
                            }
                            setSignatureFile(f);
                          }
                        }}
                      />
                    </label>
                  )}
                  <p className="text-xs text-muted-foreground">PNG or JPEG only, max 2MB</p>
                </div>
              </div>
            </div>
            <DialogFooter className="shrink-0 border-t pt-4 mt-4">
              <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button type="submit" disabled={uploadingSignature}>
                {uploadingSignature ? 'Uploading...' : dialogMode === 'edit-user' ? 'Save Changes' : 'Create User'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
