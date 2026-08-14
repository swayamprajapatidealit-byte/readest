import { NextRequest, NextResponse } from 'next/server';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import path from 'node:path';
import { SUPPORTED_BOOK_EXTS } from '@/services/constants';

export const runtime = 'nodejs';

const BOOKS_DIR = process.env['BOOKS_DIR'] || path.join(process.cwd(), 'data', 'books');

function resolveBookPath(name: string): string | null {
  const ext = path.extname(name).slice(1).toLowerCase();
  if (!SUPPORTED_BOOK_EXTS.includes(ext)) return null;

  const resolved = path.resolve(BOOKS_DIR, name);
  const relative = path.relative(BOOKS_DIR, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;

  return resolved;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const filePath = resolveBookPath(name);
  if (!filePath) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let size: number;
  try {
    size = (await stat(filePath)).size;
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const range = request.headers.get('range');
  let start = 0;
  let end = size - 1;
  let status = 200;

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    const rangeStart = match?.[1] ? Number(match[1]) : undefined;
    const rangeEnd = match?.[2] ? Number(match[2]) : undefined;
    if (!match || (rangeStart === undefined && rangeEnd === undefined)) {
      return new NextResponse(null, {
        status: 416,
        headers: { 'Content-Range': `bytes */${size}` },
      });
    }
    // Suffix range (`bytes=-N`): last N bytes.
    start = rangeStart ?? Math.max(size - (rangeEnd ?? 0), 0);
    end = rangeStart !== undefined && rangeEnd !== undefined ? rangeEnd : size - 1;
    if (start > end || end >= size) {
      return new NextResponse(null, {
        status: 416,
        headers: { 'Content-Range': `bytes */${size}` },
      });
    }
    status = 206;
  }

  const stream = Readable.toWeb(
    createReadStream(filePath, { start, end }),
  ) as ReadableStream<Uint8Array>;

  const headers = new Headers({
    'Content-Type': 'application/epub+zip',
    'Accept-Ranges': 'bytes',
    'Content-Length': String(end - start + 1),
  });
  if (status === 206) {
    headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  }

  return new NextResponse(stream, { status, headers });
}
