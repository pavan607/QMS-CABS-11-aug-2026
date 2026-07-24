'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { 
  Menu, X, Home, FileText, Users, Settings, 
  BarChart, CheckSquare, LogOut, Search,
  PanelLeftClose, PanelLeft, FolderKanban, ClipboardList, KeyRound, Loader2, Eye, EyeOff,
  UserCircle,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { IdleTimeoutHandler } from '@/components/idle-timeout';
import { ThemeToggle } from '@/components/theme-toggle';
import { NotificationDropdown } from '@/components/notification-dropdown';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const permissions = usePermissions();

  const rawRole = (session?.user as { role?: string })?.role || '';
  const showObservationChats = [
    'inspector',
    'ordaqa_inspector',
    'initiator',
    'request_approver',
    'qa_approver',
    'qa_head',
    'ordaqa_head',
    'administrator',
  ].includes(rawRole);

  const [pwDialogOpen, setPwDialogOpen] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [headerMenusMounted, setHeaderMenusMounted] = useState(false);

  useEffect(() => setHeaderMenusMounted(true), []);

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push('/login');
  };

  const handleChangePassword = async () => {
    setPwError('');
    setPwSuccess('');
    if (!pwForm.current) { setPwError('Current password is required'); return; }
    if (pwForm.newPw.length < 6) { setPwError('New password must be at least 6 characters'); return; }
    if (pwForm.newPw !== pwForm.confirm) { setPwError('New passwords do not match'); return; }
    setPwLoading(true);
    try {
      const res = await fetch('/api/users/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: pwForm.current, new_password: pwForm.newPw }),
      });
      const data = await res.json();
      if (!res.ok) { setPwError(data.error || 'Failed to change password'); }
      else { setPwSuccess('Password changed successfully'); setPwForm({ current: '', newPw: '', confirm: '' }); }
    } catch { setPwError('Failed to change password'); }
    setPwLoading(false);
  };

  const allMenuItems = [
    { icon: Home, label: 'Dashboard', href: '/dashboard', requiresPermission: null },
    { icon: CheckSquare, label: 'Inspection Request', href: '/dashboard/inspections', requiresPermission: 'inspection_request:read' },
    ...(showObservationChats
      ? [{ icon: MessageSquare, label: 'Observation Chats', href: '/dashboard/observation-chats', requiresPermission: null as string | null }]
      : []),
    // { icon: FileText, label: 'Documents', href: '/dashboard/documents', requiresPermission: 'document:read' },
    // Quality Checks removed per CABS workflow redesign
    // { icon: ShieldCheck, label: 'Quality Checks', href: '/dashboard/quality-checks', requiresPermission: null },
    { icon: BarChart, label: 'Reports', href: '/dashboard/reports', requiresPermission: null },
    { icon: UserCircle, label: 'Profile', href: '/dashboard/profile', requiresPermission: null },
    { icon: FolderKanban, label: 'Projects', href: '/dashboard/projects', requiresPermission: 'admin_only' },
    { icon: ClipboardList, label: 'Inspection Types', href: '/dashboard/inspection-types', requiresPermission: 'admin_only' },
    { icon: Users, label: 'Users', href: '/dashboard/users', requiresPermission: 'user:read' },
    { icon: Settings, label: 'Settings', href: '/dashboard/settings', requiresPermission: 'admin_only' },
  ];

  // Filter menu items based on permissions
  const menuItems = allMenuItems.filter(item => {
    if (!item.requiresPermission) return true;
    if (item.requiresPermission === 'admin_only') return permissions.isAdmin();
    const [resource, action] = item.requiresPermission.split(':');
    return permissions.checkPermission(resource, action);
  });

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-[#f0f2f5] dark:bg-gray-950">
      <IdleTimeoutHandler />
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#1e3a5f] shadow-md dark:bg-[#0f1b2d]">
        <div className="flex h-14 items-center justify-between px-4 md:px-6">

          {/* Left: Logo & Toggle */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-white/70 hover:text-white hover:bg-white/10"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <Link href="/dashboard" className="flex items-center gap-3">
              <Image
                src="/logo.png"
                alt="Quality Management System"
                width={32}
                height={32}
                className="h-8 w-8 shrink-0 object-contain"
              />
              <div className="hidden md:block">
                <div className="text-[15px] font-bold leading-none tracking-tight text-white">Quality Management System</div>
                <div className="text-[10px] font-medium text-sky-300/80 mt-0.5 tracking-wider uppercase">Centre for Airborne Systems (CABS)</div>
              </div>
            </Link>
          </div>

          {/* Center: Search */}
          <div className="flex-1 px-4 md:px-8 max-w-xl">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
              <input
                type="search"
                placeholder="Search..."
                className="w-full rounded-md bg-white/10 border border-white/10 py-1.5 pl-9 pr-3 text-sm text-white placeholder:text-white/40 outline-none focus:bg-white/15 focus:border-white/25 focus:ring-1 focus:ring-white/20 transition-all"
              />
            </div>
          </div>

          {/* Right: Notifications & Profile */}
          <div className="flex items-center gap-1 ml-auto">
            <ThemeToggle />
            <NotificationDropdown />

            <div className="w-px h-6 bg-white/15 mx-2" />

            {!headerMenusMounted ? (
              <Button
                type="button"
                variant="ghost"
                className="relative h-9 gap-2 px-2 hover:bg-white/10"
                disabled
                aria-hidden
                tabIndex={-1}
              >
                <Avatar className="h-8 w-8 ring-2 ring-white/20">
                  <AvatarFallback className="bg-sky-500 text-white text-xs font-bold">
                    {session?.user?.name ? getInitials(session.user.name) : 'AD'}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:flex flex-col items-start text-left">
                  <span className="text-[13px] font-semibold leading-none text-white">
                    {session?.user?.name || 'Admin User'}
                  </span>
                  <span className="text-[11px] text-white/50" suppressHydrationWarning>
                    {(session?.user as any)?.designation || (session?.user as any)?.role || 'administrator'}
                  </span>
                </div>
              </Button>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 gap-2 px-2 hover:bg-white/10">
                    <Avatar className="h-8 w-8 ring-2 ring-white/20">
                      <AvatarFallback className="bg-sky-500 text-white text-xs font-bold">
                        {session?.user?.name ? getInitials(session.user.name) : 'AD'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden md:flex flex-col items-start text-left">
                      <span className="text-[13px] font-semibold leading-none text-white">
                        {session?.user?.name || 'Admin User'}
                      </span>
                      <span className="text-[11px] text-white/50" suppressHydrationWarning>
                        {(session?.user as any)?.designation || (session?.user as any)?.role || 'administrator'}
                      </span>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">{session?.user?.name}</p>
                      <p className="text-xs text-muted-foreground">{session?.user?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/profile">
                      <UserCircle className="mr-2 h-4 w-4" />
                      My Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setPwError(''); setPwSuccess(''); setPwForm({ current: '', newPw: '', confirm: '' }); setPwDialogOpen(true); }}>
                    <KeyRound className="mr-2 h-4 w-4" />
                    Change Password
                  </DropdownMenuItem>
                  {permissions.isAdmin() && (
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard/settings">
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={cn(
            "fixed left-0 top-14 z-30 h-[calc(100vh-3.5rem)] bg-white border-r border-gray-200 transition-all duration-300 md:sticky md:block dark:bg-[#111827] dark:border-gray-800",
            sidebarOpen ? "w-60" : "w-0 md:w-14"
          )}
        >
          <div className="flex h-full flex-col">
            <nav className="flex-1 flex flex-col gap-1 px-2.5 pt-3 pb-2 overflow-y-auto">
              {menuItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link key={item.href} href={item.href}>
                    <div
                      className={cn(
                        "flex items-center gap-3 h-9 px-3 rounded-md text-[13px] font-medium transition-all cursor-pointer",
                        isActive && "bg-[#1e3a5f] text-white shadow-sm dark:bg-sky-600",
                        !isActive && "text-gray-600 hover:text-[#1e3a5f] hover:bg-gray-100 dark:text-gray-400 dark:hover:text-sky-400 dark:hover:bg-gray-800",
                        !sidebarOpen && "md:justify-center md:px-0"
                      )}
                      title={!sidebarOpen ? item.label : undefined}
                    >
                      <item.icon className={cn(
                        "h-[17px] w-[17px] flex-shrink-0",
                        isActive ? "text-white" : "text-gray-400 dark:text-gray-500"
                      )} />
                      <span className={cn(sidebarOpen ? "block" : "hidden")}>
                        {item.label}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </nav>

            {/* Collapse Toggle — pinned to bottom */}
            <div className="hidden md:block border-t border-gray-200 dark:border-gray-800 p-2.5">
              <div
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className={cn(
                  "flex items-center h-8 rounded-md text-gray-400 hover:text-[#1e3a5f] hover:bg-gray-100 dark:text-gray-500 dark:hover:text-sky-400 dark:hover:bg-gray-800 transition-colors cursor-pointer",
                  sidebarOpen ? "gap-2 px-3" : "justify-center px-0"
                )}
                title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              >
                {sidebarOpen ? (
                  <>
                    <PanelLeftClose className="h-4 w-4 shrink-0" />
                    <span className="text-[11px] font-medium">Collapse</span>
                  </>
                ) : (
                  <PanelLeft className="h-4 w-4" />
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          <div className="container py-6 px-4 md:px-6 space-y-6">
            {children}
          </div>

          {/* Footer */}
          <footer className="mt-12 border-t border-gray-200 bg-white dark:bg-[#111827] dark:border-gray-800">
            <div className="container py-4 px-4 md:px-6 space-y-2.5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="text-[12px] text-gray-400 dark:text-gray-500" suppressHydrationWarning>
                  © {new Date().getFullYear()} Quality Management System. All rights reserved.
                </div>
                <div className="flex gap-5 text-[12px]">
                  <Link href="#" className="text-gray-400 hover:text-[#1e3a5f] dark:text-gray-500 dark:hover:text-sky-400 transition-colors">
                    Privacy
                  </Link>
                  <Link href="#" className="text-gray-400 hover:text-[#1e3a5f] dark:text-gray-500 dark:hover:text-sky-400 transition-colors">
                    Terms
                  </Link>
                  <Link href="#" className="text-gray-400 hover:text-[#1e3a5f] dark:text-gray-500 dark:hover:text-sky-400 transition-colors">
                    Support
                  </Link>
                </div>
              </div>
              <div className="text-center text-[13px] font-medium text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800 pt-2.5">
                Jointly designed and developed by CABS and Techfluent Solutions Pvt Ltd
              </div>
            </div>
          </footer>
        </main>
      </div>

      {/* Change Password Dialog */}
      <Dialog open={pwDialogOpen} onOpenChange={setPwDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-[#1e3a5f]" />
              Change Password
            </DialogTitle>
            <DialogDescription>
              Enter your current password and choose a new one.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {pwError && (
              <div className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 text-sm px-3 py-2 rounded-md border border-red-200 dark:border-red-900">
                {pwError}
              </div>
            )}
            {pwSuccess && (
              <div className="bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 text-sm px-3 py-2 rounded-md border border-green-200 dark:border-green-900">
                {pwSuccess}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="pw-current">Current Password</Label>
              <div className="relative">
                <Input
                  id="pw-current"
                  type={showCurrent ? 'text' : 'password'}
                  value={pwForm.current}
                  onChange={e => setPwForm({ ...pwForm, current: e.target.value })}
                  placeholder="Enter current password"
                />
                <button type="button" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowCurrent(!showCurrent)}>
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw-new">New Password</Label>
              <div className="relative">
                <Input
                  id="pw-new"
                  type={showNew ? 'text' : 'password'}
                  value={pwForm.newPw}
                  onChange={e => setPwForm({ ...pwForm, newPw: e.target.value })}
                  placeholder="At least 6 characters"
                />
                <button type="button" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowNew(!showNew)}>
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw-confirm">Confirm New Password</Label>
              <Input
                id="pw-confirm"
                type="password"
                value={pwForm.confirm}
                onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })}
                placeholder="Re-enter new password"
                onKeyDown={e => { if (e.key === 'Enter' && !pwLoading) handleChangePassword(); }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwDialogOpen(false)} disabled={pwLoading}>
              Cancel
            </Button>
            <Button onClick={handleChangePassword} disabled={pwLoading} className="bg-[#1e3a5f] hover:bg-[#2a4d7a] text-white">
              {pwLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Changing...</> : 'Change Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

