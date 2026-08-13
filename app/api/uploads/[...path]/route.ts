import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { existsSync, statSync } from 'fs';
import { readFile } from 'fs/promises';
import { extname, join, normalize, relative, sep } from 'path';

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.zip': 'application/zip',
};

function contentTypeFor(filePath: string): string {
  return MIME_BY_EXT[extname(filePath).toLowerCase()] || 'application/octet-stream';
}

/** Serve files from public/uploads (works for files saved after the server started). */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const segments = (await params).path || [];
    if (segments.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (segments.some((s) => !s || s === '.' || s === '..' || s.includes('\0'))) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    const uploadsRoot = join(process.cwd(), 'public', 'uploads');
    const absolute = normalize(join(uploadsRoot, ...segments));
    const rel = relative(uploadsRoot, absolute);
    if (!rel || rel.startsWith('..') || rel.split(sep).includes('..')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    if (!existsSync(absolute) || !statSync(absolute).isFile()) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await readFile(absolute);
    const type = contentTypeFor(absolute);
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': type,
        'Content-Length': String(body.length),
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('Error serving upload:', error);
    return NextResponse.json({ error: 'Failed to serve file' }, { status: 500 });
  }
}
