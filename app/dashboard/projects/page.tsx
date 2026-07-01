'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import {
  FolderKanban, Plus, Search, ChevronRight, ChevronDown,
  Edit, Trash2, MoreVertical, Cpu, Box, Layers, CircuitBoard, X,
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
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePermissions } from '@/lib/hooks/usePermissions';

interface Project {
  id: number;
  name: string;
  code: string;
  description: string;
  status: string;
  subsystem_count: string;
  lru_count: string;
  sru_count: string;
  created_by_name: string;
  created_at: string;
}

interface Subsystem {
  id: number;
  project_id: number;
  name: string;
  code: string;
  description: string;
  status: string;
  lru_count: string;
  project_name?: string;
  project_code?: string;
}

interface LRU {
  id: number;
  subsystem_id: number;
  name: string;
  code: string;
  part_number: string;
  description: string;
  status: string;
  sru_count: string;
  serial_numbers?: string;
  subsystem_name?: string;
  subsystem_code?: string;
}

interface SRU {
  id: number;
  lru_id: number;
  name: string;
  code: string;
  part_number: string;
  description: string;
  status: string;
  serial_numbers?: string;
  lru_name?: string;
  lru_code?: string;
}

type DialogMode = 'add-project' | 'edit-project' | 'add-subsystem' | 'edit-subsystem' | 'add-lru' | 'edit-lru' | 'add-sru' | 'edit-sru' | null;

export default function ProjectsPage() {
  const permissions = usePermissions();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set());
  const [expandedSubsystems, setExpandedSubsystems] = useState<Set<number>>(new Set());
  const [expandedLrus, setExpandedLrus] = useState<Set<number>>(new Set());

  const [subsystemsByProject, setSubsystemsByProject] = useState<Record<number, Subsystem[]>>({});
  const [lrusBySubsystem, setLrusBySubsystem] = useState<Record<number, LRU[]>>({});
  const [srusByLru, setSrusByLru] = useState<Record<number, SRU[]>>({});
  const [loadingSubsystems, setLoadingSubsystems] = useState<Set<number>>(new Set());
  const [loadingLrus, setLoadingLrus] = useState<Set<number>>(new Set());
  const [loadingSrus, setLoadingSrus] = useState<Set<number>>(new Set());

  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [contextProjectId, setContextProjectId] = useState<number | null>(null);
  const [contextSubsystemId, setContextSubsystemId] = useState<number | null>(null);
  const [contextLruId, setContextLruId] = useState<number | null>(null);

  const [projectForm, setProjectForm] = useState({ name: '', code: '', description: '', status: 'active' });
  const [subsystemForm, setSubsystemForm] = useState({ name: '', code: '', description: '', status: 'active' });
  const [lruForm, setLruForm] = useState({ name: '', code: '', part_number: '', description: '', status: 'active', serial_numbers: [] as string[] });
  const [sruForm, setSruForm] = useState({ name: '', code: '', part_number: '', description: '', status: 'active', serial_numbers: [] as string[] });
  const [lruSerialInput, setLruSerialInput] = useState('');
  const [sruSerialInput, setSruSerialInput] = useState('');

  const fetchProjects = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      const response = await fetch(`/api/projects?${params.toString()}`);
      const data = await response.json();
      setProjects(data.projects || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const fetchSubsystems = async (projectId: number) => {
    setLoadingSubsystems(prev => new Set(prev).add(projectId));
    try {
      const response = await fetch(`/api/subsystems?project_id=${projectId}`);
      const data = await response.json();
      setSubsystemsByProject(prev => ({ ...prev, [projectId]: data.subsystems || [] }));
    } catch (error) {
      console.error('Error fetching subsystems:', error);
    } finally {
      setLoadingSubsystems(prev => {
        const next = new Set(prev);
        next.delete(projectId);
        return next;
      });
    }
  };

  const fetchLrus = async (subsystemId: number) => {
    setLoadingLrus(prev => new Set(prev).add(subsystemId));
    try {
      const response = await fetch(`/api/lrus?subsystem_id=${subsystemId}`);
      const data = await response.json();
      setLrusBySubsystem(prev => ({ ...prev, [subsystemId]: data.lrus || [] }));
    } catch (error) {
      console.error('Error fetching LRUs:', error);
    } finally {
      setLoadingLrus(prev => {
        const next = new Set(prev);
        next.delete(subsystemId);
        return next;
      });
    }
  };

  const toggleProject = (projectId: number) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
        if (!subsystemsByProject[projectId]) {
          fetchSubsystems(projectId);
        }
      }
      return next;
    });
  };

  const toggleSubsystem = (subsystemId: number) => {
    setExpandedSubsystems(prev => {
      const next = new Set(prev);
      if (next.has(subsystemId)) {
        next.delete(subsystemId);
      } else {
        next.add(subsystemId);
        if (!lrusBySubsystem[subsystemId]) {
          fetchLrus(subsystemId);
        }
      }
      return next;
    });
  };

  const fetchSrus = async (lruId: number) => {
    setLoadingSrus(prev => new Set(prev).add(lruId));
    try {
      const response = await fetch(`/api/srus?lru_id=${lruId}`);
      const data = await response.json();
      setSrusByLru(prev => ({ ...prev, [lruId]: data.srus || [] }));
    } catch (error) {
      console.error('Error fetching SRUs:', error);
    } finally {
      setLoadingSrus(prev => {
        const next = new Set(prev);
        next.delete(lruId);
        return next;
      });
    }
  };

  const toggleLru = (lruId: number) => {
    setExpandedLrus(prev => {
      const next = new Set(prev);
      if (next.has(lruId)) {
        next.delete(lruId);
      } else {
        next.add(lruId);
        if (!srusByLru[lruId]) {
          fetchSrus(lruId);
        }
      }
      return next;
    });
  };

  // --- Dialog handlers ---

  const openAddProject = () => {
    setProjectForm({ name: '', code: '', description: '', status: 'active' });
    setDialogMode('add-project');
  };

  const openEditProject = (project: Project) => {
    setEditingItem(project);
    setProjectForm({ name: project.name, code: project.code, description: project.description || '', status: project.status });
    setDialogMode('edit-project');
  };

  const openAddSubsystem = (projectId: number) => {
    setContextProjectId(projectId);
    setSubsystemForm({ name: '', code: '', description: '', status: 'active' });
    setDialogMode('add-subsystem');
  };

  const openEditSubsystem = (subsystem: Subsystem) => {
    setEditingItem(subsystem);
    setContextProjectId(subsystem.project_id);
    setSubsystemForm({ name: subsystem.name, code: subsystem.code, description: subsystem.description || '', status: subsystem.status });
    setDialogMode('edit-subsystem');
  };

  const parseSerialNumbers = (val: any): string[] => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    try { const parsed = JSON.parse(val); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
  };

  const openAddLru = (subsystemId: number) => {
    setContextSubsystemId(subsystemId);
    setLruForm({ name: '', code: '', part_number: '', description: '', status: 'active', serial_numbers: [] });
    setLruSerialInput('');
    setDialogMode('add-lru');
  };

  const openEditLru = (lru: LRU) => {
    setEditingItem(lru);
    setContextSubsystemId(lru.subsystem_id);
    setLruForm({ name: lru.name, code: lru.code, part_number: lru.part_number || '', description: lru.description || '', status: lru.status, serial_numbers: parseSerialNumbers(lru.serial_numbers) });
    setLruSerialInput('');
    setDialogMode('edit-lru');
  };

  const openAddSru = (lruId: number) => {
    setContextLruId(lruId);
    setSruForm({ name: '', code: '', part_number: '', description: '', status: 'active', serial_numbers: [] });
    setSruSerialInput('');
    setDialogMode('add-sru');
  };

  const openEditSru = (sru: SRU) => {
    setEditingItem(sru);
    setContextLruId(sru.lru_id);
    setSruForm({ name: sru.name, code: sru.code, part_number: sru.part_number || '', description: sru.description || '', status: sru.status, serial_numbers: parseSerialNumbers(sru.serial_numbers) });
    setSruSerialInput('');
    setDialogMode('edit-sru');
  };

  const closeDialog = () => {
    setDialogMode(null);
    setEditingItem(null);
    setContextProjectId(null);
    setContextSubsystemId(null);
    setContextLruId(null);
  };

  // --- CRUD operations ---

  const handleProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const isEdit = dialogMode === 'edit-project';
      const url = isEdit ? `/api/projects/${editingItem.id}` : '/api/projects';
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectForm),
      });

      if (response.ok) {
        closeDialog();
        fetchProjects();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to save project');
      }
    } catch (error) {
      console.error('Error saving project:', error);
      alert('Failed to save project');
    }
  };

  const handleSubsystemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const isEdit = dialogMode === 'edit-subsystem';
      const url = isEdit ? `/api/subsystems/${editingItem.id}` : '/api/subsystems';
      const method = isEdit ? 'PUT' : 'POST';

      const payload = isEdit ? subsystemForm : { ...subsystemForm, project_id: contextProjectId };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        closeDialog();
        if (contextProjectId) fetchSubsystems(contextProjectId);
        fetchProjects();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to save subsystem');
      }
    } catch (error) {
      console.error('Error saving subsystem:', error);
      alert('Failed to save subsystem');
    }
  };

  const handleLruSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const isEdit = dialogMode === 'edit-lru';
      const url = isEdit ? `/api/lrus/${editingItem.id}` : '/api/lrus';
      const method = isEdit ? 'PUT' : 'POST';

      const payload = isEdit ? lruForm : { ...lruForm, subsystem_id: contextSubsystemId };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        closeDialog();
        if (contextSubsystemId) fetchLrus(contextSubsystemId);
        const subsystem = Object.entries(subsystemsByProject).find(([, subs]) =>
          subs.some(s => s.id === contextSubsystemId)
        );
        if (subsystem) fetchSubsystems(Number(subsystem[0]));
        fetchProjects();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to save LRU');
      }
    } catch (error) {
      console.error('Error saving LRU:', error);
      alert('Failed to save LRU');
    }
  };

  const handleDeleteProject = async (id: number) => {
    if (!confirm('Delete this project? All its subsystems and LRUs will also be deleted.')) return;
    try {
      const response = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (response.ok) {
        fetchProjects();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete project');
      }
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  };

  const handleDeleteSubsystem = async (subsystem: Subsystem) => {
    if (!confirm('Delete this subsystem? All its LRUs will also be deleted.')) return;
    try {
      const response = await fetch(`/api/subsystems/${subsystem.id}`, { method: 'DELETE' });
      if (response.ok) {
        fetchSubsystems(subsystem.project_id);
        fetchProjects();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete subsystem');
      }
    } catch (error) {
      console.error('Error deleting subsystem:', error);
    }
  };

  const handleDeleteLru = async (lru: LRU) => {
    if (!confirm('Delete this LRU? All its SRUs will also be deleted.')) return;
    try {
      const response = await fetch(`/api/lrus/${lru.id}`, { method: 'DELETE' });
      if (response.ok) {
        fetchLrus(lru.subsystem_id);
        const subsystem = Object.entries(subsystemsByProject).find(([, subs]) =>
          subs.some(s => s.id === lru.subsystem_id)
        );
        if (subsystem) fetchSubsystems(Number(subsystem[0]));
        fetchProjects();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete LRU');
      }
    } catch (error) {
      console.error('Error deleting LRU:', error);
    }
  };

  const handleSruSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const isEdit = dialogMode === 'edit-sru';
      const url = isEdit ? `/api/srus/${editingItem.id}` : '/api/srus';
      const method = isEdit ? 'PUT' : 'POST';

      const payload = isEdit ? sruForm : { ...sruForm, lru_id: contextLruId };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        closeDialog();
        if (contextLruId) fetchSrus(contextLruId);
        const lruEntry = Object.entries(lrusBySubsystem).find(([, lrus]) =>
          lrus.some(l => l.id === contextLruId)
        );
        if (lruEntry) fetchLrus(Number(lruEntry[0]));
        fetchProjects();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to save SRU');
      }
    } catch (error) {
      console.error('Error saving SRU:', error);
      alert('Failed to save SRU');
    }
  };

  const handleDeleteSru = async (sru: SRU) => {
    if (!confirm('Delete this SRU?')) return;
    try {
      const response = await fetch(`/api/srus/${sru.id}`, { method: 'DELETE' });
      if (response.ok) {
        fetchSrus(sru.lru_id);
        const lruEntry = Object.entries(lrusBySubsystem).find(([, lrus]) =>
          lrus.some(l => l.id === sru.lru_id)
        );
        if (lruEntry) fetchLrus(Number(lruEntry[0]));
        fetchProjects();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete SRU');
      }
    } catch (error) {
      console.error('Error deleting SRU:', error);
    }
  };

  const statusBadge = (status: string) => (
    <Badge
      variant={status === 'active' ? 'default' : 'secondary'}
      className={status === 'active' ? 'bg-green-500 hover:bg-green-600 text-white' : ''}
    >
      {status}
    </Badge>
  );

  const totalSubsystems = projects.reduce((sum, p) => sum + Number(p.subsystem_count || 0), 0);
  const totalLrus = projects.reduce((sum, p) => sum + Number(p.lru_count || 0), 0);
  const totalSrus = projects.reduce((sum, p) => sum + Number(p.sru_count || 0), 0);

  if (!permissions.isAdmin()) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You do not have permission to access this page. Only administrators can manage projects.</CardDescription>
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
          <h2 className="text-3xl font-bold tracking-tight">Projects</h2>
          <p className="text-base text-muted-foreground">
            Manage projects, subsystems, LRUs, and SRUs
          </p>
        </div>
        <Button className="bg-[#1e3a5f] hover:bg-[#2a4d7a] text-white gap-2" onClick={openAddProject}>
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-0 shadow-lg overflow-hidden bg-gradient-to-br from-blue-500 to-blue-700 dark:from-blue-600 dark:to-blue-900">
          <CardContent className="pt-5 pb-4 relative">
            <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-white/5 -translate-y-6 translate-x-6" />
            <div className="relative">
              <div className="bg-white/20 p-2 rounded-lg w-fit mb-3 backdrop-blur-sm">
                <FolderKanban className="h-4 w-4 text-white" />
              </div>
              <div className="text-2xl font-bold text-white">{projects.length}</div>
              <p className="text-xs font-medium mt-0.5 text-blue-100">Total Projects</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-lg overflow-hidden bg-gradient-to-br from-amber-500 to-orange-600 dark:from-amber-600 dark:to-orange-800">
          <CardContent className="pt-5 pb-4 relative">
            <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-white/5 -translate-y-6 translate-x-6" />
            <div className="relative">
              <div className="bg-white/20 p-2 rounded-lg w-fit mb-3 backdrop-blur-sm">
                <Layers className="h-4 w-4 text-white" />
              </div>
              <div className="text-2xl font-bold text-white">{totalSubsystems}</div>
              <p className="text-xs font-medium mt-0.5 text-amber-100">Total Subsystems</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-lg overflow-hidden bg-gradient-to-br from-emerald-500 to-emerald-700 dark:from-emerald-600 dark:to-emerald-900">
          <CardContent className="pt-5 pb-4 relative">
            <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-white/5 -translate-y-6 translate-x-6" />
            <div className="relative">
              <div className="bg-white/20 p-2 rounded-lg w-fit mb-3 backdrop-blur-sm">
                <Cpu className="h-4 w-4 text-white" />
              </div>
              <div className="text-2xl font-bold text-white">{totalLrus}</div>
              <p className="text-xs font-medium mt-0.5 text-emerald-100">Total LRUs</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-lg overflow-hidden bg-gradient-to-br from-violet-500 to-purple-700 dark:from-violet-600 dark:to-purple-900">
          <CardContent className="pt-5 pb-4 relative">
            <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-white/5 -translate-y-6 translate-x-6" />
            <div className="relative">
              <div className="bg-white/20 p-2 rounded-lg w-fit mb-3 backdrop-blur-sm">
                <CircuitBoard className="h-4 w-4 text-white" />
              </div>
              <div className="text-2xl font-bold text-white">{totalSrus}</div>
              <p className="text-xs font-medium mt-0.5 text-violet-100">Total SRUs</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search projects by name or code..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Hierarchical Tree Table */}
      <Card>
        <CardHeader>
          <CardTitle>Project Hierarchy</CardTitle>
          <CardDescription>
            Click on a project or subsystem to expand and view its children
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : projects.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No projects found. Create your first project to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[44%]">Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Children</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => {
                  const isExpanded = expandedProjects.has(project.id);
                  const subsystems = subsystemsByProject[project.id] || [];
                  const isLoadingSubs = loadingSubsystems.has(project.id);

                  return (
                    <Fragment key={`project-${project.id}`}>
                      {/* Project Row */}
                      <TableRow className="bg-muted/30 hover:bg-muted/50">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0"
                              onClick={() => toggleProject(project.id)}
                            >
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </Button>
                            <FolderKanban className="h-4 w-4 text-blue-600 shrink-0" />
                            <div className="flex flex-col gap-0.5 min-w-0">
                              <span className="font-semibold leading-tight">{project.name}</span>
                              <span className="text-xs font-mono text-muted-foreground">{project.code}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{statusBadge(project.status)}</TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {project.subsystem_count} subsystem{Number(project.subsystem_count) !== 1 ? 's' : ''}, {project.lru_count} LRU{Number(project.lru_count) !== 1 ? 's' : ''}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Project Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => openAddSubsystem(project.id)}>
                                <Plus className="mr-2 h-4 w-4" />Add Subsystem
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEditProject(project)}>
                                <Edit className="mr-2 h-4 w-4" />Edit Project
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDeleteProject(project.id)}>
                                <Trash2 className="mr-2 h-4 w-4" />Delete Project
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>

                      {/* Subsystem Rows */}
                      {isExpanded && (
                        isLoadingSubs ? (
                          <TableRow key={`loading-subs-${project.id}`}>
                            <TableCell colSpan={4} className="text-center py-3 text-sm text-muted-foreground">Loading subsystems...</TableCell>
                          </TableRow>
                        ) : subsystems.length === 0 ? (
                          <TableRow key={`empty-subs-${project.id}`}>
                            <TableCell colSpan={4} className="py-3">
                              <div className="flex items-center gap-2 pl-10 text-sm text-muted-foreground">
                                No subsystems yet.
                                <Button variant="link" size="sm" className="p-0 h-auto" onClick={() => openAddSubsystem(project.id)}>
                                  Add one
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : subsystems.map((subsystem) => {
                          const isSubExpanded = expandedSubsystems.has(subsystem.id);
                          const lrus = lrusBySubsystem[subsystem.id] || [];
                          const isLoadingLru = loadingLrus.has(subsystem.id);

                          return (
                            <Fragment key={`subsystem-${subsystem.id}`}>
                              <TableRow className="hover:bg-muted/30">
                                <TableCell>
                                  <div className="flex items-center gap-2 pl-8">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 shrink-0"
                                      onClick={() => toggleSubsystem(subsystem.id)}
                                    >
                                      {isSubExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                    </Button>
                                    <Layers className="h-4 w-4 text-amber-600 shrink-0" />
                                    <div className="flex flex-col gap-0.5 min-w-0">
                                      <span className="font-medium leading-tight">{subsystem.name}</span>
                                      <span className="text-xs font-mono text-muted-foreground">{subsystem.code}</span>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>{statusBadge(subsystem.status)}</TableCell>
                                <TableCell>
                                  <span className="text-sm text-muted-foreground">
                                    {subsystem.lru_count} LRU{Number(subsystem.lru_count) !== 1 ? 's' : ''}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuLabel>Subsystem Actions</DropdownMenuLabel>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => openAddLru(subsystem.id)}>
                                        <Plus className="mr-2 h-4 w-4" />Add LRU
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => openEditSubsystem(subsystem)}>
                                        <Edit className="mr-2 h-4 w-4" />Edit Subsystem
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDeleteSubsystem(subsystem)}>
                                        <Trash2 className="mr-2 h-4 w-4" />Delete Subsystem
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </TableRow>

                              {/* LRU Rows */}
                              {isSubExpanded && (
                                isLoadingLru ? (
                                  <TableRow key={`loading-lrus-${subsystem.id}`}>
                                    <TableCell colSpan={4} className="text-center py-3 text-sm text-muted-foreground">Loading LRUs...</TableCell>
                                  </TableRow>
                                ) : lrus.length === 0 ? (
                                  <TableRow key={`empty-lrus-${subsystem.id}`}>
                                    <TableCell colSpan={4} className="py-3">
                                      <div className="flex items-center gap-2 pl-20 text-sm text-muted-foreground">
                                        No LRUs yet.
                                        <Button variant="link" size="sm" className="p-0 h-auto" onClick={() => openAddLru(subsystem.id)}>
                                          Add one
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ) : lrus.map((lru) => {
                                  const isLruExpanded = expandedLrus.has(lru.id);
                                  const srus = srusByLru[lru.id] || [];
                                  const isLoadingSru = loadingSrus.has(lru.id);

                                  return (
                                    <Fragment key={`lru-${lru.id}`}>
                                      <TableRow className="hover:bg-muted/20">
                                        <TableCell>
                                          <div className="flex items-center gap-2 pl-16">
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-6 w-6 shrink-0"
                                              onClick={() => toggleLru(lru.id)}
                                            >
                                              {isLruExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                            </Button>
                                            <Cpu className="h-4 w-4 text-emerald-600 shrink-0" />
                                            <div className="flex flex-col gap-0.5 min-w-0">
                                              <span className="leading-tight">{lru.name}</span>
                                              <span className="text-xs font-mono text-muted-foreground">{lru.code}</span>
                                            </div>
                                          </div>
                                        </TableCell>
                                        <TableCell>{statusBadge(lru.status)}</TableCell>
                                        <TableCell>
                                          <span className="text-sm text-muted-foreground">
                                            {lru.part_number ? `P/N: ${lru.part_number}` : ''}
                                            {lru.part_number && Number(lru.sru_count) > 0 ? ' · ' : ''}
                                            {Number(lru.sru_count) > 0 ? `${lru.sru_count} SRU${Number(lru.sru_count) !== 1 ? 's' : ''}` : ''}
                                            {(() => { const sns = parseSerialNumbers(lru.serial_numbers); return sns.length > 0 ? `${lru.part_number || Number(lru.sru_count) > 0 ? ' · ' : ''}S/N: ${sns.length}` : ''; })()}
                                          </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                          <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                              <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                              <DropdownMenuLabel>LRU Actions</DropdownMenuLabel>
                                              <DropdownMenuSeparator />
                                              <DropdownMenuItem onClick={() => openAddSru(lru.id)}>
                                                <Plus className="mr-2 h-4 w-4" />Add SRU
                                              </DropdownMenuItem>
                                              <DropdownMenuItem onClick={() => openEditLru(lru)}>
                                                <Edit className="mr-2 h-4 w-4" />Edit LRU
                                              </DropdownMenuItem>
                                              <DropdownMenuSeparator />
                                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDeleteLru(lru)}>
                                                <Trash2 className="mr-2 h-4 w-4" />Delete LRU
                                              </DropdownMenuItem>
                                            </DropdownMenuContent>
                                          </DropdownMenu>
                                        </TableCell>
                                      </TableRow>

                                      {/* SRU Rows */}
                                      {isLruExpanded && (
                                        isLoadingSru ? (
                                          <TableRow key={`loading-srus-${lru.id}`}>
                                            <TableCell colSpan={4} className="text-center py-3 text-sm text-muted-foreground">Loading SRUs...</TableCell>
                                          </TableRow>
                                        ) : srus.length === 0 ? (
                                          <TableRow key={`empty-srus-${lru.id}`}>
                                            <TableCell colSpan={4} className="py-3">
                                              <div className="flex items-center gap-2 pl-28 text-sm text-muted-foreground">
                                                No SRUs yet.
                                                <Button variant="link" size="sm" className="p-0 h-auto" onClick={() => openAddSru(lru.id)}>
                                                  Add one
                                                </Button>
                                              </div>
                                            </TableCell>
                                          </TableRow>
                                        ) : srus.map((sru) => (
                                          <TableRow key={`sru-${sru.id}`} className="hover:bg-muted/10">
                                            <TableCell>
                                              <div className="flex items-center gap-2 pl-24">
                                                <CircuitBoard className="h-4 w-4 text-violet-600 shrink-0" />
                                                <div className="flex flex-col gap-0.5 min-w-0">
                                                  <span className="leading-tight">{sru.name}</span>
                                                  <span className="text-xs font-mono text-muted-foreground">{sru.code}</span>
                                                </div>
                                              </div>
                                            </TableCell>
                                            <TableCell>{statusBadge(sru.status)}</TableCell>
                                            <TableCell>
                                              <span className="text-sm text-muted-foreground">
                                                {sru.part_number ? `P/N: ${sru.part_number}` : ''}
                                                {(() => { const sns = parseSerialNumbers(sru.serial_numbers); return sns.length > 0 ? `${sru.part_number ? ' · ' : ''}S/N: ${sns.length}` : ''; })()}
                                              </span>
                                            </TableCell>
                                            <TableCell className="text-right">
                                              <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                  <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                  <DropdownMenuLabel>SRU Actions</DropdownMenuLabel>
                                                  <DropdownMenuSeparator />
                                                  <DropdownMenuItem onClick={() => openEditSru(sru)}>
                                                    <Edit className="mr-2 h-4 w-4" />Edit SRU
                                                  </DropdownMenuItem>
                                                  <DropdownMenuSeparator />
                                                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDeleteSru(sru)}>
                                                    <Trash2 className="mr-2 h-4 w-4" />Delete SRU
                                                  </DropdownMenuItem>
                                                </DropdownMenuContent>
                                              </DropdownMenu>
                                            </TableCell>
                                          </TableRow>
                                        ))
                                      )}
                                    </Fragment>
                                  );
                                })
                              )}
                            </Fragment>
                          );
                        })
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ---- Dialogs ---- */}

      {/* Project Dialog */}
      <Dialog open={dialogMode === 'add-project' || dialogMode === 'edit-project'} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialogMode === 'edit-project' ? 'Edit Project' : 'New Project'}</DialogTitle>
            <DialogDescription>
              {dialogMode === 'edit-project' ? 'Update the project details.' : 'Create a new project to organize subsystems and LRUs.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleProjectSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="proj-name">Project Name *</Label>
                <Input id="proj-name" required value={projectForm.name} onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="proj-code">Project Code *</Label>
                <Input id="proj-code" required placeholder="e.g. PROJ-001" value={projectForm.code} onChange={(e) => setProjectForm({ ...projectForm, code: e.target.value.toUpperCase() })} />
                <p className="text-xs text-muted-foreground">Unique identifier, auto-uppercased</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="proj-desc">Description</Label>
                <Textarea id="proj-desc" rows={3} value={projectForm.description} onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="proj-status">Status</Label>
                <Select value={projectForm.status} onValueChange={(v) => setProjectForm({ ...projectForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button type="submit">{dialogMode === 'edit-project' ? 'Save Changes' : 'Create Project'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Subsystem Dialog */}
      <Dialog open={dialogMode === 'add-subsystem' || dialogMode === 'edit-subsystem'} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialogMode === 'edit-subsystem' ? 'Edit Subsystem' : 'New Subsystem'}</DialogTitle>
            <DialogDescription>
              {dialogMode === 'edit-subsystem' ? 'Update the subsystem details.' : 'Add a new subsystem to the project.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubsystemSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="sub-name">Subsystem Name *</Label>
                <Input id="sub-name" required value={subsystemForm.name} onChange={(e) => setSubsystemForm({ ...subsystemForm, name: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sub-code">Subsystem Code *</Label>
                <Input id="sub-code" required placeholder="e.g. SS-001" value={subsystemForm.code} onChange={(e) => setSubsystemForm({ ...subsystemForm, code: e.target.value.toUpperCase() })} />
                <p className="text-xs text-muted-foreground">Unique within the parent project</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sub-desc">Description</Label>
                <Textarea id="sub-desc" rows={3} value={subsystemForm.description} onChange={(e) => setSubsystemForm({ ...subsystemForm, description: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sub-status">Status</Label>
                <Select value={subsystemForm.status} onValueChange={(v) => setSubsystemForm({ ...subsystemForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button type="submit">{dialogMode === 'edit-subsystem' ? 'Save Changes' : 'Add Subsystem'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* LRU Dialog */}
      <Dialog open={dialogMode === 'add-lru' || dialogMode === 'edit-lru'} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialogMode === 'edit-lru' ? 'Edit LRU' : 'New LRU'}</DialogTitle>
            <DialogDescription>
              {dialogMode === 'edit-lru' ? 'Update the LRU details.' : 'Add a new Line Replaceable Unit to the subsystem.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleLruSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="lru-name">LRU Name *</Label>
                <Input id="lru-name" required value={lruForm.name} onChange={(e) => setLruForm({ ...lruForm, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="lru-code">LRU Code</Label>
                  <Input id="lru-code" placeholder="Optional — e.g. LRU-001" value={lruForm.code} onChange={(e) => setLruForm({ ...lruForm, code: e.target.value.toUpperCase() })} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="lru-pn">Part Number</Label>
                  <Input id="lru-pn" placeholder="e.g. PN-12345" value={lruForm.part_number} onChange={(e) => setLruForm({ ...lruForm, part_number: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lru-desc">Description</Label>
                <Textarea id="lru-desc" rows={3} value={lruForm.description} onChange={(e) => setLruForm({ ...lruForm, description: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Serial Numbers</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter serial number"
                    value={lruSerialInput}
                    onChange={(e) => setLruSerialInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const val = lruSerialInput.trim();
                        if (val && !lruForm.serial_numbers.includes(val)) {
                          setLruForm({ ...lruForm, serial_numbers: [...lruForm.serial_numbers, val] });
                          setLruSerialInput('');
                        }
                      }
                    }}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => {
                    const val = lruSerialInput.trim();
                    if (val && !lruForm.serial_numbers.includes(val)) {
                      setLruForm({ ...lruForm, serial_numbers: [...lruForm.serial_numbers, val] });
                      setLruSerialInput('');
                    }
                  }}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {lruForm.serial_numbers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {lruForm.serial_numbers.map((sn, idx) => (
                      <Badge key={idx} variant="secondary" className="gap-1 pr-1">
                        {sn}
                        <button type="button" className="ml-1 hover:text-destructive" onClick={() => {
                          setLruForm({ ...lruForm, serial_numbers: lruForm.serial_numbers.filter((_, i) => i !== idx) });
                        }}>
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Type a serial number and press Enter or click + to add</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lru-status">Status</Label>
                <Select value={lruForm.status} onValueChange={(v) => setLruForm({ ...lruForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button type="submit">{dialogMode === 'edit-lru' ? 'Save Changes' : 'Add LRU'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* SRU Dialog */}
      <Dialog open={dialogMode === 'add-sru' || dialogMode === 'edit-sru'} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialogMode === 'edit-sru' ? 'Edit SRU' : 'New SRU'}</DialogTitle>
            <DialogDescription>
              {dialogMode === 'edit-sru' ? 'Update the SRU details.' : 'Add a new Shop Replaceable Unit to the LRU.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSruSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="sru-name">SRU Name *</Label>
                <Input id="sru-name" required value={sruForm.name} onChange={(e) => setSruForm({ ...sruForm, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="sru-code">SRU Code *</Label>
                  <Input id="sru-code" required placeholder="e.g. SRU-001" value={sruForm.code} onChange={(e) => setSruForm({ ...sruForm, code: e.target.value.toUpperCase() })} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="sru-pn">Part Number</Label>
                  <Input id="sru-pn" placeholder="e.g. PN-12345" value={sruForm.part_number} onChange={(e) => setSruForm({ ...sruForm, part_number: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sru-desc">Description</Label>
                <Textarea id="sru-desc" rows={3} value={sruForm.description} onChange={(e) => setSruForm({ ...sruForm, description: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Serial Numbers</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter serial number"
                    value={sruSerialInput}
                    onChange={(e) => setSruSerialInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const val = sruSerialInput.trim();
                        if (val && !sruForm.serial_numbers.includes(val)) {
                          setSruForm({ ...sruForm, serial_numbers: [...sruForm.serial_numbers, val] });
                          setSruSerialInput('');
                        }
                      }
                    }}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => {
                    const val = sruSerialInput.trim();
                    if (val && !sruForm.serial_numbers.includes(val)) {
                      setSruForm({ ...sruForm, serial_numbers: [...sruForm.serial_numbers, val] });
                      setSruSerialInput('');
                    }
                  }}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {sruForm.serial_numbers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {sruForm.serial_numbers.map((sn, idx) => (
                      <Badge key={idx} variant="secondary" className="gap-1 pr-1">
                        {sn}
                        <button type="button" className="ml-1 hover:text-destructive" onClick={() => {
                          setSruForm({ ...sruForm, serial_numbers: sruForm.serial_numbers.filter((_, i) => i !== idx) });
                        }}>
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Type a serial number and press Enter or click + to add</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sru-status">Status</Label>
                <Select value={sruForm.status} onValueChange={(v) => setSruForm({ ...sruForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button type="submit">{dialogMode === 'edit-sru' ? 'Save Changes' : 'Add SRU'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
