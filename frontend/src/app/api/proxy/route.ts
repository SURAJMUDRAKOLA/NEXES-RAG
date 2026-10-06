// src/app/api/proxy/route.ts
// Optional Next.js API proxy to FastAPI — Section 3.1
import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path') || '';
  const url = `${API_URL}/api/v1${path}`;
  const res = await fetch(url, {
    headers: Object.fromEntries(request.headers),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function POST(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path') || '';
  const url = `${API_URL}/api/v1${path}`;
  const body = await request.text();
  const res = await fetch(url, {
    method: 'POST',
    headers: Object.fromEntries(request.headers),
    body,
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
