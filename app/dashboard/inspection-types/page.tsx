'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import {
  ClipboardList, Plus, ChevronRight, ChevronDown,
  Edit, Trash2, MoreVertical, Tag, GripVertical,
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

interface InspectionTypeGroup {
  id: number;
  name: string;
  description: string;
  sort_order: number;
  status: string;
  items: InspectionTypeItem[];
}

interface InspectionTypeItem {
  id: number;
  group_id: number;
  name: string;
  description: string;
  sort_order: number;
  status: string;
  group_name?: string;
}

type DialogMode = 'add-group' | 'edit-group' | 'add-item' | 'edit-item' | null;

export default function InspectionTypesPage() {
  const permissions = usePermissions();
  const [groups, setGroups] = useState<InspectionTypeGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());

  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [contextGroupId, setContextGroupId] = useState<number | null>(null);

  const [groupForm, setGroupForm] = useState({ name: '', description: '', sort_order: '0', status: 'active' });
  const [itemForm, setItemForm] = useState({ name: '', description: '', sort_order: '0', status: 'active' });

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch('/api/inspection-types');
      const data = await response.json();
      setGroups(data.groups || []);
    } catch (error) {
      console.error('Error fetching inspection types:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleGroup = (groupId: number) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  // --- Dialog handlers ---
  const openAddGroup = () => {
    setGroupForm({ name: '', description: '', sort_order: '0', status: 'active' });
    setDialogMode('add-group');
  };

  const openEditGroup = (group: InspectionTypeGroup) => {
    setEditingItem(group);
    setGroupForm({
      name: group.name,
      description: group.description || '',
      sort_order: String(group.sort_order),
      status: group.status,
    });
    setDialogMode('edit-group');
  };

  const openAddItem = (groupId: number) => {
    setContextGroupId(groupId);
    setItemForm({ name: '', description: '', sort_order: '0', status: 'active' });
    setDialogMode('add-item');
  };

  const openEditItem = (item: InspectionTypeItem) => {
    setEditingItem(item);
    setContextGroupId(item.group_id);
    setItemForm({
      name: item.name,
      description: item.description || '',
      sort_order: String(item.sort_order),
      status: item.status,
    });
    setDialogMode('edit-item');
  };

  const closeDialog = () => {
    setDialogMode(null);
    setEditingItem(null);
    setContextGroupId(null);
  };

  // --- CRUD ---
  const handleGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const isEdit = dialogMode === 'edit-group';
      const url = isEdit ? `/api/inspection-types/groups/${editingItem.id}` : '/api/inspection-types/groups';
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...groupForm, sort_order: parseInt(groupForm.sort_order) || 0 }),
      });

      if (response.ok) {
        closeDialog();
        fetchData();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to save category');
      }
    } catch (error) {
      console.error('Error saving category:', error);
      alert('Failed to save category');
    }
  };

  const handleItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const isEdit = dialogMode === 'edit-item';
      const url = isEdit ? `/api/inspection-types/items/${editingItem.id}` : '/api/inspection-types/items';
      const method = isEdit ? 'PUT' : 'POST';

      const payload = {
        ...itemForm,
        sort_order: parseInt(itemForm.sort_order) || 0,
        ...(isEdit ? {} : { group_id: contextGroupId }),
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        closeDialog();
        fetchData();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to save item');
      }
    } catch (error) {
      console.error('Error saving item:', error);
      alert('Failed to save item');
    }
  };

  const handleDeleteGroup = async (id: number) => {
    if (!confirm('Delete this category? All its inspection type items will also be deleted.')) return;
    try {
      const response = await fetch(`/api/inspection-types/groups/${id}`, { method: 'DELETE' });
      if (response.ok) fetchData();
      else {
        const data = await response.json();
        alert(data.error || 'Failed to delete category');
      }
    } catch (error) {
      console.error('Error deleting category:', error);
    }
  };

  const handleDeleteItem = async (id: number) => {
    if (!confirm('Delete this inspection type item?')) return;
    try {
      const response = await fetch(`/api/inspection-types/items/${id}`, { method: 'DELETE' });
      if (response.ok) fetchData();
      else {
        const data = await response.json();
        alert(data.error || 'Failed to delete item');
      }
    } catch (error) {
      console.error('Error deleting item:', error);
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

  const totalItems = groups.reduce((sum, g) => sum + (g.items?.length || 0), 0);

  if (!permissions.isAdmin()) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>Only administrators can manage inspection types.</CardDescription>
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
          <h2 className="text-3xl font-bold tracking-tight">Inspection Types</h2>
          <p className="text-base text-muted-foreground">
            Manage inspection type categories and their items
          </p>
        </div>
        <Button className="bg-[#1e3a5f] hover:bg-[#2a4d7a] text-white gap-2" onClick={openAddGroup}>
          <Plus className="h-4 w-4" />
          New Category
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-0 shadow-lg overflow-hidden bg-gradient-to-br from-violet-500 to-purple-700 dark:from-violet-600 dark:to-purple-900">
          <CardContent className="pt-5 pb-4 relative">
            <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-white/5 -translate-y-6 translate-x-6" />
            <div className="absolute bottom-0 left-0 w-16 h-16 rounded-full bg-white/5 translate-y-8 -translate-x-4" />
            <div className="relative">
              <div className="bg-white/20 p-2 rounded-lg w-fit mb-3 backdrop-blur-sm">
                <ClipboardList className="h-4 w-4 text-white" />
              </div>
              <div className="text-2xl font-bold text-white">{groups.length}</div>
              <p className="text-xs font-medium mt-0.5 text-violet-100">Categories</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-lg overflow-hidden bg-gradient-to-br from-teal-500 to-teal-700 dark:from-teal-600 dark:to-teal-900">
          <CardContent className="pt-5 pb-4 relative">
            <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-white/5 -translate-y-6 translate-x-6" />
            <div className="absolute bottom-0 left-0 w-16 h-16 rounded-full bg-white/5 translate-y-8 -translate-x-4" />
            <div className="relative">
              <div className="bg-white/20 p-2 rounded-lg w-fit mb-3 backdrop-blur-sm">
                <Tag className="h-4 w-4 text-white" />
              </div>
              <div className="text-2xl font-bold text-white">{totalItems}</div>
              <p className="text-xs font-medium mt-0.5 text-teal-100">Type Items</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Hierarchical Table */}
      <Card>
        <CardHeader>
          <CardTitle>Categories & Items</CardTitle>
          <CardDescription>
            Click on a category to expand and see its inspection type items
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : groups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No inspection type categories found. Create your first category to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50%]">Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((group) => {
                  const isExpanded = expandedGroups.has(group.id);
                  const items = group.items || [];

                  return (
                    <Fragment key={`group-${group.id}`}>
                      {/* Category Row */}
                      <TableRow className="bg-muted/30 hover:bg-muted/50">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0"
                              onClick={() => toggleGroup(group.id)}
                            >
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </Button>
                            <ClipboardList className="h-4 w-4 text-violet-600 shrink-0" />
                            <span className="font-semibold">{group.name}</span>
                            <Badge variant="outline" className="ml-1 text-xs">
                              {items.length} item{items.length !== 1 ? 's' : ''}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>{statusBadge(group.status)}</TableCell>
                        <TableCell className="text-muted-foreground">{group.sort_order}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Category Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => openAddItem(group.id)}>
                                <Plus className="mr-2 h-4 w-4" />Add Item
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEditGroup(group)}>
                                <Edit className="mr-2 h-4 w-4" />Edit Category
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDeleteGroup(group.id)}>
                                <Trash2 className="mr-2 h-4 w-4" />Delete Category
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>

                      {/* Item Rows */}
                      {isExpanded && (
                        items.length === 0 ? (
                          <TableRow key={`empty-items-${group.id}`}>
                            <TableCell colSpan={4} className="py-3">
                              <div className="flex items-center gap-2 pl-10 text-sm text-muted-foreground">
                                No items yet.
                                <Button variant="link" size="sm" className="p-0 h-auto" onClick={() => openAddItem(group.id)}>
                                  Add one
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : items.map((item) => (
                          <TableRow key={`item-${item.id}`} className="hover:bg-muted/20">
                            <TableCell>
                              <div className="flex items-center gap-2 pl-10">
                                <Tag className="h-4 w-4 text-teal-600 shrink-0" />
                                <span>{item.name}</span>
                              </div>
                            </TableCell>
                            <TableCell>{statusBadge(item.status)}</TableCell>
                            <TableCell className="text-muted-foreground">{item.sort_order}</TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>Item Actions</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => openEditItem(item)}>
                                    <Edit className="mr-2 h-4 w-4" />Edit Item
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDeleteItem(item.id)}>
                                    <Trash2 className="mr-2 h-4 w-4" />Delete Item
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Category Dialog */}
      <Dialog open={dialogMode === 'add-group' || dialogMode === 'edit-group'} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialogMode === 'edit-group' ? 'Edit Category' : 'New Category'}</DialogTitle>
            <DialogDescription>
              {dialogMode === 'edit-group' ? 'Update the inspection type category.' : 'Create a new category to organize inspection types.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleGroupSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="grp-name">Category Name *</Label>
                <Input id="grp-name" required value={groupForm.name} onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="grp-desc">Description</Label>
                <Textarea id="grp-desc" rows={3} value={groupForm.description} onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="grp-order">Sort Order</Label>
                  <Input id="grp-order" type="number" value={groupForm.sort_order} onChange={(e) => setGroupForm({ ...groupForm, sort_order: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="grp-status">Status</Label>
                  <Select value={groupForm.status} onValueChange={(v) => setGroupForm({ ...groupForm, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button type="submit">{dialogMode === 'edit-group' ? 'Save Changes' : 'Create Category'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Item Dialog */}
      <Dialog open={dialogMode === 'add-item' || dialogMode === 'edit-item'} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialogMode === 'edit-item' ? 'Edit Item' : 'New Item'}</DialogTitle>
            <DialogDescription>
              {dialogMode === 'edit-item' ? 'Update the inspection type item.' : 'Add a new inspection type item to the category.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleItemSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="itm-name">Item Name *</Label>
                <Input id="itm-name" required value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="itm-desc">Description</Label>
                <Textarea id="itm-desc" rows={3} value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="itm-order">Sort Order</Label>
                  <Input id="itm-order" type="number" value={itemForm.sort_order} onChange={(e) => setItemForm({ ...itemForm, sort_order: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="itm-status">Status</Label>
                  <Select value={itemForm.status} onValueChange={(v) => setItemForm({ ...itemForm, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button type="submit">{dialogMode === 'edit-item' ? 'Save Changes' : 'Add Item'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
