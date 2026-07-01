import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';

// GET single document
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const result = await query(
      `SELECT 
        d.*,
        dc.name as category_name,
        u.name as uploaded_by_name
       FROM documents d
       LEFT JOIN document_categories dc ON d.category_id = dc.id
       LEFT JOIN users u ON d.uploaded_by = u.id
       WHERE d.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    return NextResponse.json({ document: result.rows[0] });
  } catch (error) {
    console.error('Error fetching document:', error);
    return NextResponse.json({ error: 'Failed to fetch document' }, { status: 500 });
  }
}

// PUT update document
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, description, file_type, file_size, file_path, category_id, version, status } = body;

    // Get user id
    const userResult = await query('SELECT id FROM users WHERE id = $1', [(session.user as any).id]);
    const userId = userResult.rows[0]?.id;

    // Get old values for audit
    const oldDoc = await query('SELECT * FROM documents WHERE id = $1', [id]);
    
    if (oldDoc.rows.length === 0) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const result = await query(
      `UPDATE documents 
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           file_type = COALESCE($3, file_type),
           file_size = COALESCE($4, file_size),
           file_path = COALESCE($5, file_path),
           category_id = COALESCE($6, category_id),
           version = COALESCE($7, version),
           status = COALESCE($8, status),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $9
       RETURNING *`,
      [name, description, file_type, file_size, file_path, category_id, version, status, id]
    );

    // Log the action
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, 'UPDATE', 'document', id, JSON.stringify(oldDoc.rows[0]), JSON.stringify(result.rows[0])]
    );

    return NextResponse.json({ document: result.rows[0] });
  } catch (error) {
    console.error('Error updating document:', error);
    return NextResponse.json({ error: 'Failed to update document' }, { status: 500 });
  }
}

// DELETE document
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Get user id
    const userResult = await query('SELECT id FROM users WHERE id = $1', [(session.user as any).id]);
    const userId = userResult.rows[0]?.id;

    // Get document for audit
    const doc = await query('SELECT * FROM documents WHERE id = $1', [id]);
    
    if (doc.rows.length === 0) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    await query('DELETE FROM documents WHERE id = $1', [id]);

    // Log the action
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, 'DELETE', 'document', id, JSON.stringify(doc.rows[0])]
    );

    return NextResponse.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
  }
}

