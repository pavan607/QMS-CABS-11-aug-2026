import { query } from './db';

export interface ReportFilters {
  startDate?: string;
  endDate?: string;
  status?: string;
  inspectorId?: number;
  initiatorId?: number;
  projectId?: number;
}

/** Comma-separated Part II inspector names from `inspector_ids` JSON array. */
const INSPECTOR_NAMES_SQL = `(
  SELECT string_agg(u2.name, ', ' ORDER BY s.ord)
  FROM jsonb_array_elements_text(COALESCE(ir.inspector_ids, '[]')::jsonb) WITH ORDINALITY AS s(id_txt, ord)
  JOIN users u2 ON u2.id = s.id_txt::int
)`;

/** Inspector who started the inspection (first `started` activity). */
const INSPECTION_STARTED_BY_SQL = `(
  SELECT u.name
  FROM inspection_activities ia
  JOIN users u ON u.id = ia.user_id
  WHERE ia.inspection_request_id = ir.id AND ia.activity_type = 'started'
  ORDER BY ia.created_at ASC
  LIMIT 1
)`;

/** Inspector who completed the inspection (latest `inspection_completed` activity). */
const INSPECTION_COMPLETED_BY_SQL = `(
  SELECT u.name
  FROM inspection_activities ia
  JOIN users u ON u.id = ia.user_id
  WHERE ia.inspection_request_id = ir.id AND ia.activity_type = 'inspection_completed'
  ORDER BY ia.created_at DESC
  LIMIT 1
)`;

function withInspectorDisplayNames<T extends Record<string, unknown>>(rows: T[]): T[] {
  return rows.map((row) => ({
    ...row,
    inspector_name:
      (typeof row.inspector_names === 'string' && row.inspector_names.trim())
        ? row.inspector_names
        : (typeof row.inspector_name === 'string' && row.inspector_name.trim())
          ? row.inspector_name
          : null,
  }));
}

/**
 * Generate inspection summary report data
 */
export async function generateInspectionSummaryReport(filters: ReportFilters = {}) {
  const { startDate, endDate, status, inspectorId, initiatorId, projectId } = filters;

  let sql = `
    SELECT 
      ir.id,
      ir.request_number,
      ir.title,
      ir.description,
      ir.location,
      ir.item,
      ir.inspection_type,
      ir.status,
      ir.due_date,
      ir.request_date,
      ir.scheduled_date,
      ir.completed_date,
      ir.created_at,
      initiator.name as initiator_name,
      initiator.email as initiator_email,
      inspector.name as inspector_name,
      ${INSPECTOR_NAMES_SQL} as inspector_names,
      ${INSPECTION_STARTED_BY_SQL} as inspection_started_by_name,
      ${INSPECTION_COMPLETED_BY_SQL} as inspection_completed_by_name,
      part4_user.name as part4_completed_by_name,
      inspector.email as inspector_email,
      approver.name as approver_name,
      (SELECT COUNT(*) FROM inspection_checklists WHERE inspection_request_id = ir.id) as checklist_count,
      (SELECT COUNT(*) FROM attachments WHERE entity_type = 'inspection_request' AND entity_id = ir.id) as attachment_count,
      p.name as project_name,
      p.code as project_code,
      CASE 
        WHEN ir.completed_date IS NOT NULL THEN 
          EXTRACT(EPOCH FROM (ir.completed_date - ir.created_at)) / 86400
        ELSE NULL
      END as duration_days
    FROM inspection_requests ir
    LEFT JOIN users initiator ON ir.initiator_id = initiator.id
    LEFT JOIN users inspector ON ir.inspector_id = inspector.id
    LEFT JOIN users approver ON ir.approver_id = approver.id
    LEFT JOIN users part4_user ON ir.part4_completed_by = part4_user.id
    LEFT JOIN projects p ON ir.project_id = p.id
    WHERE 1=1
  `;
  
  const params: any[] = [];
  let paramIndex = 1;

  if (startDate) {
    sql += ` AND ir.created_at >= $${paramIndex}`;
    params.push(startDate);
    paramIndex++;
  }

  if (endDate) {
    sql += ` AND ir.created_at <= $${paramIndex}`;
    params.push(endDate);
    paramIndex++;
  }

  if (status) {
    const statuses = status.split(',').map((s: string) => s.trim()).filter(Boolean);
    if (statuses.length === 1) {
      sql += ` AND ir.status = $${paramIndex}`;
      params.push(statuses[0]);
      paramIndex++;
    } else if (statuses.length > 1) {
      sql += ` AND ir.status = ANY($${paramIndex}::text[])`;
      params.push(statuses);
      paramIndex++;
    }
  }

  if (inspectorId) {
    sql += ` AND (ir.inspector_id = $${paramIndex} OR COALESCE(ir.inspector_ids, '[]')::jsonb @> to_jsonb($${paramIndex}::int))`;
    params.push(inspectorId);
    paramIndex++;
  }

  if (initiatorId) {
    sql += ` AND ir.initiator_id = $${paramIndex}`;
    params.push(initiatorId);
    paramIndex++;
  }

  if (projectId) {
    sql += ` AND ir.project_id = $${paramIndex}`;
    params.push(projectId);
    paramIndex++;
  }

  sql += ' ORDER BY ir.created_at DESC';

  const result = await query(sql, params);
  const allRequests = withInspectorDisplayNames(result.rows);

  // Separate into completed and pending
  const completed = allRequests.filter(r => ['completed', 'approved', 'closed'].includes(r.status));
  const pending = allRequests.filter(r => ['pending', 'assigned', 'in_progress'].includes(r.status));
  const rejected = allRequests.filter(r => r.status === 'rejected');

  // Summary statistics
  const summary = {
    total_requests: allRequests.length,
    completed_count: completed.length,
    pending_count: pending.length,
    rejected_count: rejected.length,
    avg_completion_days: completed.length > 0 
      ? completed.reduce((sum, r) => sum + (parseFloat(r.duration_days) || 0), 0) / completed.length 
      : 0,
  };

  return {
    summary,
    all_requests: allRequests,
    completed_inspections: completed,
    pending_inspections: pending,
    rejected_inspections: rejected,
  };
}

/**
 * Generate statistical analysis report
 */
export async function generateStatisticsReport(filters: ReportFilters = {}) {
  const { startDate, endDate } = filters;

  let baseFilter = 'WHERE 1=1';
  const params: any[] = [];
  let paramIndex = 1;

  if (startDate) {
    baseFilter += ` AND created_at >= $${paramIndex}`;
    params.push(startDate);
    paramIndex++;
  }

  if (endDate) {
    baseFilter += ` AND created_at <= $${paramIndex}`;
    params.push(endDate);
    paramIndex++;
  }

  // Status distribution
  const statusResult = await query(
    `SELECT status, COUNT(*) as count 
     FROM inspection_requests 
     ${baseFilter}
     GROUP BY status`,
    params
  );

  // Type distribution
  const typeResult = await query(
    `SELECT inspection_type, COUNT(*) as count 
     FROM inspection_requests 
     ${baseFilter}
     GROUP BY inspection_type`,
    params
  );

  // Inspector performance
  const inspectorResult = await query(
    `SELECT 
      u.name as inspector_name,
      COUNT(*) as total_inspections,
      COUNT(*) FILTER (WHERE ir.status = 'completed') as completed,
      COUNT(*) FILTER (WHERE ir.status = 'approved') as approved,
      AVG(EXTRACT(EPOCH FROM (ir.completed_date - ir.created_at)) / 86400) as avg_completion_days
     FROM inspection_requests ir
     LEFT JOIN users u ON ir.inspector_id = u.id
     ${baseFilter}
     AND ir.inspector_id IS NOT NULL
     GROUP BY u.id, u.name`,
    params
  );

  // Compliance rate (if checklist items exist)
  const complianceResult = await query(
    `SELECT 
      COUNT(*) as total_items,
      COUNT(*) FILTER (WHERE status = 'pass') as passed,
      COUNT(*) FILTER (WHERE status = 'fail') as failed,
      COUNT(*) FILTER (WHERE status = 'na') as not_applicable
     FROM checklist_items ci
     LEFT JOIN inspection_checklists ic ON ci.checklist_id = ic.id
     LEFT JOIN inspection_requests ir ON ic.inspection_request_id = ir.id
     ${baseFilter.replace('WHERE 1=1 AND', 'WHERE ir.')}`,
    params
  );

  return {
    statusDistribution: statusResult.rows,
    typeDistribution: typeResult.rows,
    inspectorPerformance: inspectorResult.rows,
    complianceRate: complianceResult.rows[0] || {
      total_items: 0,
      passed: 0,
      failed: 0,
      not_applicable: 0,
    },
  };
}

/**
 * Generate overdue inspections report
 */
export async function generateOverdueReport() {
  const result = await query(
    `SELECT 
      ir.*,
      initiator.name as initiator_name,
      initiator.email as initiator_email,
      inspector.name as inspector_name,
      ${INSPECTOR_NAMES_SQL} as inspector_names,
      inspector.email as inspector_email,
      CURRENT_DATE - ir.due_date as days_overdue
    FROM inspection_requests ir
    LEFT JOIN users initiator ON ir.initiator_id = initiator.id
    LEFT JOIN users inspector ON ir.inspector_id = inspector.id
    WHERE ir.due_date < CURRENT_DATE
    AND ir.status IN ('pending', 'assigned', 'in_progress')
    ORDER BY days_overdue DESC`
  );

  return withInspectorDisplayNames(result.rows);
}

/**
 * Generate compliance report
 */
export async function generateComplianceReport(filters: ReportFilters = {}) {
  const { startDate, endDate } = filters;

  let baseFilter = 'WHERE 1=1';
  const params: any[] = [];
  let paramIndex = 1;

  if (startDate) {
    baseFilter += ` AND ir.created_at >= $${paramIndex}`;
    params.push(startDate);
    paramIndex++;
  }

  if (endDate) {
    baseFilter += ` AND ir.created_at <= $${paramIndex}`;
    params.push(endDate);
    paramIndex++;
  }

  const result = await query(
    `SELECT 
      ir.request_number,
      ir.title,
      ir.location,
      ir.inspection_type,
      ir.status,
      ic.name as checklist_name,
      ci.item_number,
      ci.description as item_description,
      ci.status as item_status,
      ci.is_compliant,
      ci.findings,
      ci.corrective_action,
      u.name as checked_by_name,
      ci.checked_at
    FROM checklist_items ci
    LEFT JOIN inspection_checklists ic ON ci.checklist_id = ic.id
    LEFT JOIN inspection_requests ir ON ic.inspection_request_id = ir.id
    LEFT JOIN users u ON ci.checked_by = u.id
    ${baseFilter}
    AND ci.status != 'pending'
    ORDER BY ir.request_number, ic.id, ci.item_number`,
    params
  );

  return result.rows;
}

/**
 * Generate quality checks report data
 */
export async function generateQualityChecksReport(filters: ReportFilters = {}) {
  const { startDate, endDate, status, inspectorId } = filters;

  let sql = `
    SELECT 
      qc.id,
      qc.name,
      qc.check_date,
      qc.score,
      qc.result,
      qc.notes,
      qc.findings,
      qc.created_at,
      inspector.name as inspector_name,
      inspector.email as inspector_email,
      creator.name as created_by_name,
      qct.name as template_name,
      ir.request_number,
      ir.title as inspection_title,
      ir.status as inspection_status
    FROM quality_checks qc
    LEFT JOIN users inspector ON qc.inspector_id = inspector.id
    LEFT JOIN users creator ON qc.created_by = creator.id
    LEFT JOIN quality_check_templates qct ON qc.template_id = qct.id
    LEFT JOIN inspection_requests ir ON qc.inspection_request_id = ir.id
    WHERE 1=1
  `;

  const params: any[] = [];
  let paramIndex = 1;

  if (startDate) {
    sql += ` AND qc.check_date >= $${paramIndex}`;
    params.push(startDate);
    paramIndex++;
  }

  if (endDate) {
    sql += ` AND qc.check_date <= $${paramIndex}`;
    params.push(endDate);
    paramIndex++;
  }

  if (status) {
    sql += ` AND qc.result = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  if (inspectorId) {
    sql += ` AND qc.inspector_id = $${paramIndex}`;
    params.push(inspectorId);
    paramIndex++;
  }

  sql += ' ORDER BY qc.check_date DESC';

  const result = await query(sql, params);
  const allChecks = result.rows;

  // Generate summary statistics
  const summary = {
    total_checks: allChecks.length,
    passed_count: allChecks.filter(c => c.result === 'passed').length,
    failed_count: allChecks.filter(c => c.result === 'failed').length,
    pending_count: allChecks.filter(c => c.result === 'pending').length,
    average_score: allChecks.filter(c => c.score !== null)
      .reduce((sum, c) => sum + parseFloat(c.score), 0) / allChecks.filter(c => c.score !== null).length || 0,
  };

  return {
    summary,
    all_checks: allChecks,
    passed_checks: allChecks.filter(c => c.result === 'passed'),
    failed_checks: allChecks.filter(c => c.result === 'failed'),
    pending_checks: allChecks.filter(c => c.result === 'pending'),
  };
}

/**
 * Generate quality checklist report data
 */
export async function generateQualityChecklistReport(filters: ReportFilters = {}) {
  const { startDate, endDate } = filters;

  let sql = `
    SELECT 
      ic.id,
      ic.name as checklist_name,
      ic.description,
      ic.is_completed,
      ic.completed_at,
      ic.created_at,
      ir.request_number,
      ir.title as inspection_title,
      ir.location,
      ir.status as inspection_status,
      inspector.name as inspector_name,
      (SELECT COUNT(*) FROM checklist_items WHERE checklist_id = ic.id) as total_items,
      (SELECT COUNT(*) FROM checklist_items WHERE checklist_id = ic.id AND status = 'passed') as passed_items,
      (SELECT COUNT(*) FROM checklist_items WHERE checklist_id = ic.id AND status = 'failed') as failed_items,
      (SELECT COUNT(*) FROM checklist_items WHERE checklist_id = ic.id AND status = 'pending') as pending_items
    FROM inspection_checklists ic
    LEFT JOIN inspection_requests ir ON ic.inspection_request_id = ir.id
    LEFT JOIN users inspector ON ir.inspector_id = inspector.id
    WHERE 1=1
  `;

  const params: any[] = [];
  let paramIndex = 1;

  if (startDate) {
    sql += ` AND ic.created_at >= $${paramIndex}`;
    params.push(startDate);
    paramIndex++;
  }

  if (endDate) {
    sql += ` AND ic.created_at <= $${paramIndex}`;
    params.push(endDate);
    paramIndex++;
  }

  sql += ' ORDER BY ic.created_at DESC';

  const result = await query(sql, params);
  const allChecklists = result.rows;

  // Get detailed items for each checklist
  const checklistsWithItems = await Promise.all(allChecklists.map(async (checklist) => {
    const itemsResult = await query(
      `SELECT 
        ci.*,
        u.name as checked_by_name
      FROM checklist_items ci
      LEFT JOIN users u ON ci.checked_by = u.id
      WHERE ci.checklist_id = $1
      ORDER BY ci.item_number`,
      [checklist.id]
    );
    return {
      ...checklist,
      items: itemsResult.rows,
    };
  }));

  // Generate summary statistics
  const summary = {
    total_checklists: allChecklists.length,
    completed_count: allChecklists.filter(c => c.is_completed).length,
    in_progress_count: allChecklists.filter(c => !c.is_completed).length,
    total_items: allChecklists.reduce((sum, c) => sum + parseInt(c.total_items), 0),
    passed_items: allChecklists.reduce((sum, c) => sum + parseInt(c.passed_items), 0),
    failed_items: allChecklists.reduce((sum, c) => sum + parseInt(c.failed_items), 0),
    pending_items: allChecklists.reduce((sum, c) => sum + parseInt(c.pending_items), 0),
  };

  return {
    summary,
    all_checklists: checklistsWithItems,
    completed_checklists: checklistsWithItems.filter(c => c.is_completed),
    in_progress_checklists: checklistsWithItems.filter(c => !c.is_completed),
  };
}

/**
 * Convert data to CSV format
 */
export function convertToCSV(data: any[], headers?: string[]): string {
  if (data.length === 0) return '';

  const keys = headers || Object.keys(data[0]);
  const headerRow = keys.join(',');
  
  const rows = data.map(row => {
    return keys.map(key => {
      const value = row[key];
      // Handle nulls and wrap strings with commas in quotes
      if (value === null || value === undefined) return '';
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    }).join(',');
  });

  return [headerRow, ...rows].join('\n');
}

