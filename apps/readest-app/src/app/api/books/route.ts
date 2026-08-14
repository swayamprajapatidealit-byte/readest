import { NextResponse } from 'next/server';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { SUPPORTED_BOOK_EXTS } from '@/services/constants';

export const runtime = 'nodejs';

const BOOKS_DIR = process.env['BOOKS_DIR'] || path.join(process.cwd(), 'data', 'books');

export interface BooksDirEntry {
  name: string;
  size: number;
  mtimeMs: number;
}

export async function GET() {
  let filenames: string[];
  try {
    filenames = await readdir(BOOKS_DIR);
  } catch {
    return NextResponse.json({ books: [] as BooksDirEntry[] });
  }

  const books: BooksDirEntry[] = await Promise.all(
    filenames
      .filter((name) => SUPPORTED_BOOK_EXTS.includes(path.extname(name).slice(1).toLowerCase()))
      .map(async (name) => {
        const stats = await stat(path.join(BOOKS_DIR, name));
        return { name, size: stats.size, mtimeMs: stats.mtimeMs };
      }),
  );

  return NextResponse.json({ books });
}
