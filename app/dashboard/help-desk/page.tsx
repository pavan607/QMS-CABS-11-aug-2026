'use client';

import { useEffect, useState } from 'react';
import {
  BookOpen,
  Download,
  Edit,
  FileText,
  LifeBuoy,
  Loader2,
  MoreVertical,
  Plus,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { usePermissions } from '@/lib/hooks/usePermissions';

interface HelpDeskResource {
  id: number;
  title: string;
  description: string | null;
  content: string | null;
  category: 'definition' | 'guideline' | 'procedure' | 'reference';
  file_name: string | null;
  file_path: string | null;
  file_type: string | null;
  file_size: number | null;
  status: string;
  created_at: string;
  uploaded_by_name: string | null;
}

const CATEGORY_LABELS: Record<HelpDeskResource['category'], string> = {
  definition: 'Definition',
  guideline: 'Guideline',
  procedure: 'Procedure',
  reference: 'Reference',
};

const emptyForm = {
  title: '',
  description: '',
  content: '',
  category: 'definition' as HelpDeskResource['category'],
  status: 'active',
};

function formatFileSize(bytes: number | null) {
  if (!bytes && bytes !== 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function HelpDeskPage() {
  const permissions = usePermissions();
  const canManage = permissions.canCreate('help_desk');

  const [resources, setResources] = useState<HelpDeskResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [editing, setEditing] = useState<HelpDeskResource | null>(null);
  const [viewing, setViewing] = useState<HelpDeskResource | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [removeFile, setRemoveFile] = useState(false);

  useEffect(() => {
    fetchResources();
  }, [searchTerm, selectedCategory]);

  const fetchResources = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (selectedCategory && selectedCategory !== 'all') params.append('category', selectedCategory);
      params.append('status', 'active');

      const response = await fetch(`/api/help-desk?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load help desk');
      setResources(data.resources || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load help desk');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setFile(null);
    setRemoveFile(false);
    setError('');
  };

  const openAdd = () => {
    setEditing(null);
    resetForm();
    setIsAddOpen(true);
  };

  const openEdit = (resource: HelpDeskResource) => {
    setEditing(resource);
    setFormData({
      title: resource.title,
      description: resource.description || '',
      content: resource.content || '',
      category: resource.category,
      status: resource.status || 'active',
    });
    setFile(null);
    setRemoveFile(false);
    setError('');
    setIsEditOpen(true);
  };

  const openView = (resource: HelpDeskResource) => {
    setViewing(resource);
    setIsViewOpen(true);
  };

  const buildFormData = () => {
    const body = new FormData();
    body.append('title', formData.title.trim());
    body.append('description', formData.description.trim());
    body.append('content', formData.content.trim());
    body.append('category', formData.category);
    body.append('status', formData.status);
    if (file) body.append('file', file);
    if (removeFile) body.append('remove_file', 'true');
    return body;
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const response = await fetch('/api/help-desk', {
        method: 'POST',
        body: buildFormData(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to add resource');
      setIsAddOpen(false);
      resetForm();
      fetchResources();
    } catch (err: any) {
      setError(err.message || 'Failed to add resource');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setError('');
    setSaving(true);
    try {
      const response = await fetch(`/api/help-desk/${editing.id}`, {
        method: 'PUT',
        body: buildFormData(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update resource');
      setIsEditOpen(false);
      setEditing(null);
      resetForm();
      fetchResources();
    } catch (err: any) {
      setError(err.message || 'Failed to update resource');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this help desk resource?')) return;
    try {
      const response = await fetch(`/api/help-desk/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to delete');
      fetchResources();
    } catch (err: any) {
      alert(err.message || 'Failed to delete resource');
    }
  };

  const categoryBadgeClass = (category: HelpDeskResource['category']) => {
    switch (category) {
      case 'definition':
        return 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950 dark:text-sky-200 dark:border-sky-800';
      case 'guideline':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800';
      case 'procedure':
        return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700';
    }
  };

  const ResourceFormFields = (
    <>
      <div className="space-y-2">
        <Label htmlFor="hd-title">Title *</Label>
        <Input
          id="hd-title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="e.g. Flight Critical"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="hd-category">Category *</Label>
        <Select
          value={formData.category}
          onValueChange={(value) =>
            setFormData({ ...formData, category: value as HelpDeskResource['category'] })
          }
        >
          <SelectTrigger id="hd-category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="definition">Definition</SelectItem>
            <SelectItem value="guideline">Guideline</SelectItem>
            <SelectItem value="procedure">Procedure</SelectItem>
            <SelectItem value="reference">Reference</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="hd-description">Short description</Label>
        <Input
          id="hd-description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Brief summary shown in the list"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="hd-content">Definition / guideline text</Label>
        <Textarea
          id="hd-content"
          value={formData.content}
          onChange={(e) => setFormData({ ...formData, content: e.target.value })}
          placeholder="Enter the full definition or guideline text (optional if uploading a file)"
          rows={6}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="hd-file">Upload file (PDF, Word, images — max 10MB)</Label>
        <Input
          id="hd-file"
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt"
          onChange={(e) => {
            setFile(e.target.files?.[0] || null);
            if (e.target.files?.[0]) setRemoveFile(false);
          }}
        />
        {editing?.file_name && !removeFile && !file && (
          <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
            <span className="truncate text-muted-foreground">Current: {editing.file_name}</span>
            <Button type="button" variant="ghost" size="sm" onClick={() => setRemoveFile(true)}>
              Remove
            </Button>
          </div>
        )}
        {removeFile && !file && (
          <p className="text-xs text-amber-600">Existing file will be removed on save.</p>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <LifeBuoy className="h-8 w-8 text-[#1e3a5f] dark:text-sky-400" />
            Help Desk
          </h2>
          <p className="text-muted-foreground">
            Definitions (e.g. Flight Critical), guidelines, and reference documents
          </p>
        </div>
        {canManage && (
          <Button className="bg-[#1e3a5f] hover:bg-[#2a4d7a] text-white gap-2" onClick={openAdd}>
            <Plus className="h-4 w-4" />
            Add Resource
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Definitions</CardDescription>
            <CardTitle className="text-2xl">
              {resources.filter((r) => r.category === 'definition').length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Guidelines</CardDescription>
            <CardTitle className="text-2xl">
              {resources.filter((r) => r.category === 'guideline').length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Procedures & references</CardDescription>
            <CardTitle className="text-2xl">
              {resources.filter((r) => r.category === 'procedure' || r.category === 'reference').length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search definitions, guidelines, or file names..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                <SelectItem value="definition">Definitions</SelectItem>
                <SelectItem value="guideline">Guidelines</SelectItem>
                <SelectItem value="procedure">Procedures</SelectItem>
                <SelectItem value="reference">References</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Knowledge Base
          </CardTitle>
          <CardDescription>
            Browse uploaded definitions and guidelines. QA administrators can add or update entries.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading...
            </div>
          ) : resources.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground space-y-2">
              <Upload className="h-10 w-10 mx-auto opacity-40" />
              <p>No help desk resources yet.</p>
              {canManage && (
                <p className="text-sm">Add definitions such as Flight Critical, or upload guideline documents.</p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead>Uploaded by</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resources.map((resource) => (
                  <TableRow key={resource.id}>
                    <TableCell>
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1e3a5f]/10">
                          <FileText className="h-5 w-5 text-[#1e3a5f] dark:text-sky-400" />
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">{resource.title}</div>
                          {resource.description && (
                            <div className="text-sm text-muted-foreground line-clamp-1">
                              {resource.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={categoryBadgeClass(resource.category)}>
                        {CATEGORY_LABELS[resource.category]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-foreground/70 text-sm">
                      {resource.file_name ? (
                        <span>
                          {resource.file_name}
                          <span className="block text-xs text-muted-foreground">
                            {formatFileSize(resource.file_size)}
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Text only</span>
                      )}
                    </TableCell>
                    <TableCell className="text-foreground/70">{formatDate(resource.created_at)}</TableCell>
                    <TableCell className="text-foreground/70">{resource.uploaded_by_name || '—'}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => openView(resource)}>
                            <BookOpen className="mr-2 h-4 w-4" />
                            View
                          </DropdownMenuItem>
                          {resource.file_path && (
                            <DropdownMenuItem asChild>
                              <a href={resource.file_path} target="_blank" rel="noopener noreferrer">
                                <Download className="mr-2 h-4 w-4" />
                                Download
                              </a>
                            </DropdownMenuItem>
                          )}
                          {permissions.canUpdate('help_desk') && (
                            <DropdownMenuItem onClick={() => openEdit(resource)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                          )}
                          {permissions.canDelete('help_desk') && (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDelete(resource.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleAdd}>
            <DialogHeader>
              <DialogTitle>Add Help Desk Resource</DialogTitle>
              <DialogDescription>
                Add a definition (e.g. Flight Critical) or upload a guideline document.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">{ResourceFormFields}</div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-[#1e3a5f] hover:bg-[#2a4d7a] text-white" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleEdit}>
            <DialogHeader>
              <DialogTitle>Edit Help Desk Resource</DialogTitle>
              <DialogDescription>Update the definition, guideline text, or attached file.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">{ResourceFormFields}</div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-[#1e3a5f] hover:bg-[#2a4d7a] text-white" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Update
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewing?.title}</DialogTitle>
            <DialogDescription>
              {viewing ? `${CATEGORY_LABELS[viewing.category]} resource` : 'Help desk resource details'}
            </DialogDescription>
            {viewing && (
              <div>
                <Badge variant="outline" className={categoryBadgeClass(viewing.category)}>
                  {CATEGORY_LABELS[viewing.category]}
                </Badge>
              </div>
            )}
          </DialogHeader>
          {viewing && (
            <div className="space-y-4 py-2">
              {viewing.description && (
                <p className="text-sm text-muted-foreground">{viewing.description}</p>
              )}
              {viewing.content ? (
                <div className="rounded-md border bg-muted/30 p-4 whitespace-pre-wrap text-sm leading-relaxed">
                  {viewing.content}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No text content — see attached file.</p>
              )}
              {viewing.file_path && (
                <Button asChild variant="outline" className="gap-2">
                  <a href={viewing.file_path} target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4" />
                    Download {viewing.file_name}
                  </a>
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                Uploaded by {viewing.uploaded_by_name || 'Unknown'} · {formatDate(viewing.created_at)}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
