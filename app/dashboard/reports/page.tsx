'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Download, Eye, Loader2, FileText, Search,
  CalendarDays, X, BarChart3, ClipboardList, Printer, Sheet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { formatCalendarDateDisplay, formatDateTimeDisplay } from '@/lib/inspection-display';
import {
  resolveInspectorNames,
  resolveStartCompleteInspectorName,
  shouldHighlightInspectorName,
} from '@/lib/report-inspector-display';

interface SelectOption { id: number; name: string; code?: string; designation?: string; }

const STATUS_OPTIONS = [
  { value: 'draft,pending,pending_request_approval,request_approved', label: 'Pending', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
  { value: 'assigned,in_progress', label: 'In Progress', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
  { value: 'inspection_completed,completed,approved,closed', label: 'Completed', color: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
  { value: 'rejected', label: 'Rejected', color: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
];

export default function ReportsPage() {
  const router = useRouter();

  const [reportType, setReportType] = useState('inspection_requests');
  const [outputFormat, setOutputFormat] = useState('onscreen');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDesigner, setFilterDesigner] = useState('');
  const [filterProject, setFilterProject] = useState('');

  const [designers, setDesigners] = useState<SelectOption[]>([]);
  const [projects, setProjects] = useState<SelectOption[]>([]);

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [reportData, setReportData] = useState<any>(null);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    fetch('/api/inspection-requests/initiators').then(r => r.json()).then(d => {
      setDesigners((d.initiators || []).map((u: any) => ({ id: u.id, name: u.name, designation: u.designation })));
    }).catch(() => {});
    fetch('/api/projects').then(r => r.json()).then(d => {
      setProjects((d.projects || []).map((p: any) => ({ id: p.id, name: p.name, code: p.code })));
    }).catch(() => {});
  }, []);

  const activeFilters = [filterStatus, filterDesigner, filterProject, startDate, endDate].filter(Boolean);

  const buildFilters = () => {
    const f: any = {};
    if (startDate) f.start_date = startDate;
    if (endDate) f.end_date = endDate;
    if (filterStatus) f.status = filterStatus;
    if (filterDesigner) f.initiator_id = parseInt(filterDesigner);
    if (filterProject) f.project_id = parseInt(filterProject);
    return f;
  };

  const clearFilters = () => {
    setFilterStatus('');
    setFilterDesigner('');
    setFilterProject('');
    setStartDate('');
    setEndDate('');
  };

  const buildPrintUrl = () => {
    const params = new URLSearchParams();
    params.set('type', reportType);
    const f = buildFilters();
    if (f.start_date) params.set('start_date', f.start_date);
    if (f.end_date) params.set('end_date', f.end_date);
    if (f.status) params.set('status', f.status);
    if (f.initiator_id) params.set('initiator_id', String(f.initiator_id));
    if (f.project_id) params.set('project_id', String(f.project_id));
    return `/print/report?${params.toString()}`;
  };

  const generate = async () => {
    setError('');
    setShowReport(false);
    setReportData(null);
    setGenerating(true);

    try {
      if (outputFormat === 'pdf') {
        window.open(buildPrintUrl(), '_blank');
        setGenerating(false);
        return;
      }

      const fmt = outputFormat === 'onscreen' ? 'json' : outputFormat;
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_type: reportType, format: fmt, filters: buildFilters() }),
      });

      if (!res.ok) {
        const text = await res.text();
        try { throw new Error(JSON.parse(text).error); } catch { throw new Error(text || 'Failed to generate report'); }
      }

      if (outputFormat === 'onscreen') {
        const data = await res.json();
        setReportData(data.report);
        setShowReport(true);
      } else {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ext = outputFormat === 'word' ? 'doc' : outputFormat === 'excel' ? 'xlsx' : outputFormat;
        a.download = `${reportType}_report.${ext}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate report.');
    } finally {
      setGenerating(false);
    }
  };

  const handleExport = async (fmt: 'pdf' | 'word' | 'excel') => {
    if (fmt === 'pdf') {
      window.open(buildPrintUrl(), '_blank');
      return;
    }
    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_type: reportType, format: fmt, filters: buildFilters() }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${reportType}_report.${fmt === 'word' ? 'doc' : 'xlsx'}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        setError(`Failed to export ${fmt === 'word' ? 'Word' : 'Excel'}`);
      }
    } catch {
      setError(`Failed to export ${fmt === 'word' ? 'Word' : 'Excel'}`);
    }
  };

  const STATUS_COLOR_MAP: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    pending_request_approval: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    request_approved: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
    assigned: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    in_progress: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
    inspection_completed: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
    completed: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    rejected: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    closed: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  };
const STATUS_LABEL_MAP: Record<string, string> = {
  draft: 'Draft', pending: 'Pending', pending_request_approval: 'Pending Part-1 Approval',
  request_approved: 'Forwarded', assigned: 'Assigned', in_progress: 'In Progress',
  inspection_completed: 'Inspection Done', completed: 'Completed',
  approved: 'Approved', rejected: 'Rejected', closed: 'Closed',
};

function InspectorNamesCell({ row }: { row: Record<string, unknown> }) {
  const names = resolveInspectorNames(row);
  if (names.length === 0) {
    return <span className="text-muted-foreground italic text-xs">Unassigned</span>;
  }

  const startCompleteInspector = resolveStartCompleteInspectorName(row);

  return (
    <>
      {names.map((name, index) => {
        const highlighted = shouldHighlightInspectorName(name, row, startCompleteInspector);
        return (
          <span key={`${name}-${index}`}>
            {index > 0 && ', '}
            {highlighted ? (
              <span className="font-semibold text-emerald-800 bg-emerald-100 dark:text-emerald-200 dark:bg-emerald-900/50 px-1.5 py-0.5 rounded">
                {name}
              </span>
            ) : (
              name
            )}
          </span>
        );
      })}
    </>
  );
}
  const statusColor = (s: string) => STATUS_COLOR_MAP[s] || 'bg-gray-100 text-gray-700';
  const statusLabel = (s: string) => STATUS_LABEL_MAP[s] || s.replace(/_/g, ' ');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="bg-[#1e3a5f]/10 p-2.5 rounded-xl">
          <BarChart3 className="h-6 w-6 text-[#1e3a5f]" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Reports</h2>
          <p className="text-sm text-muted-foreground">Generate and view inspection reports</p>
        </div>
      </div>

      {/* Report Configuration */}
      <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-950 dark:to-slate-900/50">
        <CardContent className="pt-6 space-y-5">
          {error && (
            <div className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-lg border border-red-200 dark:border-red-900">
              {error}
            </div>
          )}

          {/* Report Type & Format */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Report Type</Label>
              <Select value={reportType} onValueChange={setReportType} disabled={generating}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inspection_requests">Inspection Requests</SelectItem>
                  <SelectItem value="inspection_summary">Inspection Summary</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Output Format</Label>
              <Select value={outputFormat} onValueChange={setOutputFormat} disabled={generating}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="onscreen">View On Screen</SelectItem>
                  <SelectItem value="pdf">Download PDF</SelectItem>
                  <SelectItem value="excel">Download Excel</SelectItem>
                  <SelectItem value="word">Download Word</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Filters */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Filters</p>
              {activeFilters.length > 0 && (
                <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                  <X className="h-3 w-3" /> Clear all
                </button>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Project</Label>
                <Select value={filterProject || '_all'} onValueChange={v => setFilterProject(v === '_all' ? '' : v)} disabled={generating}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All Projects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All Projects</SelectItem>
                    {projects.map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.code ? `${p.name} — ${p.code}` : p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Designer / Initiator</Label>
                <Select value={filterDesigner || '_all'} onValueChange={v => setFilterDesigner(v === '_all' ? '' : v)} disabled={generating}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All Designers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All Designers</SelectItem>
                    {designers.map(d => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        {d.name}{d.designation ? ` (${d.designation})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={filterStatus || '_all'} onValueChange={v => setFilterStatus(v === '_all' ? '' : v)} disabled={generating}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All Statuses</SelectItem>
                    {STATUS_OPTIONS.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" /> From Date
                </Label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} disabled={generating} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" /> To Date
                </Label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} disabled={generating} className="h-9" />
              </div>
            </div>
          </div>

          {/* Generate Button */}
          <Button
            className="w-full bg-[#1e3a5f] hover:bg-[#2a4d7a] text-white h-11 text-sm font-semibold gap-2"
            onClick={generate}
            disabled={generating}
          >
            {generating ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
            ) : (
              <><Search className="h-4 w-4" /> Generate Report</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {showReport && reportData && (
        <Card className="border-0 shadow-sm overflow-hidden">
          {/* Results Header */}
          <CardHeader className="bg-gradient-to-r from-[#1e3a5f] to-[#2a5d8f] text-white pb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <ClipboardList className="h-5 w-5 opacity-80" />
                <div>
                  <CardTitle className="text-base text-white">{reportData.name}</CardTitle>
                  <p className="text-xs text-white/70 mt-0.5">
                    {formatDateTimeDisplay(reportData.generated_at, reportData.generated_at)}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" className="h-8 text-xs gap-1.5" onClick={() => handleExport('pdf')}>
                  <Download className="h-3.5 w-3.5" /> PDF
                </Button>
                <Button size="sm" variant="secondary" className="h-8 text-xs gap-1.5" onClick={() => handleExport('excel')}>
                  <Sheet className="h-3.5 w-3.5" /> Excel
                </Button>
                <Button size="sm" variant="secondary" className="h-8 text-xs gap-1.5" onClick={() => handleExport('word')}>
                  <Download className="h-3.5 w-3.5" /> Word
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs text-white/80 hover:text-white hover:bg-white/10" onClick={() => setShowReport(false)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Active Filter Badges */}
            {activeFilters.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {filterProject && (
                  <Badge variant="outline" className="text-[11px] bg-white/10 text-white/90 border-white/20 max-w-[min(100%,20rem)] truncate">
                    {(() => {
                      const p = projects.find(x => String(x.id) === filterProject);
                      if (!p) return 'Project';
                      return p.code ? `${p.name} — ${p.code}` : p.name;
                    })()}
                  </Badge>
                )}
                {filterDesigner && (
                  <Badge variant="outline" className="text-[11px] bg-white/10 text-white/90 border-white/20">
                    {designers.find(d => String(d.id) === filterDesigner)?.name || 'Designer'}
                  </Badge>
                )}
                {filterStatus && (
                  <Badge variant="outline" className="text-[11px] bg-white/10 text-white/90 border-white/20">
                    {STATUS_OPTIONS.find(o => o.value === filterStatus)?.label || filterStatus}
                  </Badge>
                )}
                {startDate && <Badge variant="outline" className="text-[11px] bg-white/10 text-white/90 border-white/20">From: {startDate}</Badge>}
                {endDate && <Badge variant="outline" className="text-[11px] bg-white/10 text-white/90 border-white/20">To: {endDate}</Badge>}
              </div>
            )}
          </CardHeader>

          <CardContent className="p-0">
            {/* Summary Cards */}
            {reportData.data?.summary && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4">
                {Object.entries(reportData.data.summary).map(([key, value]: [string, any], idx: number) => {
                  const gradients = [
                    'from-blue-500 to-blue-700 dark:from-blue-600 dark:to-blue-900',
                    'from-emerald-500 to-emerald-700 dark:from-emerald-600 dark:to-emerald-900',
                    'from-amber-500 to-orange-600 dark:from-amber-600 dark:to-orange-800',
                    'from-violet-500 to-purple-700 dark:from-violet-600 dark:to-purple-900',
                    'from-teal-500 to-teal-700 dark:from-teal-600 dark:to-teal-900',
                    'from-red-500 to-rose-700 dark:from-red-600 dark:to-rose-900',
                  ];
                  const labelColors = ['text-blue-100', 'text-emerald-100', 'text-amber-100', 'text-violet-100', 'text-teal-100', 'text-red-100'];
                  const g = gradients[idx % gradients.length];
                  const lc = labelColors[idx % labelColors.length];
                  return (
                    <div key={key} className={`rounded-xl bg-gradient-to-br ${g} px-4 py-4 text-center relative overflow-hidden shadow-md`}>
                      <div className="absolute top-0 right-0 w-16 h-16 rounded-full bg-white/5 -translate-y-4 translate-x-4" />
                      <div className="relative">
                        <p className="text-2xl font-bold text-white">
                          {typeof value === 'number' ? (Number.isInteger(value) ? value : value.toFixed(1)) : value}
                        </p>
                        <p className={`text-[11px] font-medium mt-0.5 leading-tight ${lc}`}>
                          {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Data Table */}
            {reportData.data?.all_requests && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/50 border-b text-xs text-muted-foreground uppercase tracking-wider">
                      <th className="px-4 py-3 text-left font-medium">IR No.</th>
                      <th className="px-4 py-3 text-left font-medium">Title</th>
                      <th className="px-4 py-3 text-left font-medium">Project</th>
                      <th className="px-4 py-3 text-center font-medium">Status</th>
                      <th className="px-4 py-3 text-left font-medium">Initiator</th>
                      <th className="px-4 py-3 text-left font-medium">Inspector</th>
                      <th className="px-4 py-3 text-left font-medium">Due Date</th>
                      <th className="px-4 py-3 text-center font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {reportData.data.all_requests.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                          No records found matching the selected filters.
                        </td>
                      </tr>
                    )}
                    {reportData.data.all_requests.map((row: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs font-semibold whitespace-nowrap text-[#1e3a5f] dark:text-blue-400">
                          {row.request_number || '—'}
                        </td>
                        <td className="px-4 py-3 max-w-[180px]">
                          <p className="font-medium truncate text-sm">{row.title || '—'}</p>
                          {row.item && <p className="text-xs text-muted-foreground truncate mt-0.5">{row.item}</p>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          {row.project_name ? (
                            <span>
                              <span className="font-medium">{row.project_name}</span>
                              {row.project_code && (
                                <span className="text-muted-foreground font-mono text-[11px] ml-1.5">— {row.project_code}</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge className={`text-[11px] font-medium ${statusColor(row.status)}`}>
                            {statusLabel(row.status)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">{row.initiator_name || '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          <InspectorNamesCell row={row} />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm tabular-nums">
                          {row.due_date ? formatCalendarDateDisplay(row.due_date) : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-[#1e3a5f]"
                              title="View Details"
                              onClick={() => router.push(`/dashboard/inspections/${row.id}`)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                              title="Print CABS PDF"
                              onClick={() => window.open(`/print/inspection/${row.id}`, '_blank')}
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Footer */}
            <div className="px-4 py-3 border-t bg-slate-50/50 dark:bg-slate-900/30 text-center">
              <p className="text-xs text-muted-foreground">
                {reportData.data?.all_requests?.length || 0} record{(reportData.data?.all_requests?.length || 0) !== 1 ? 's' : ''} found
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
