import { NextResponse } from 'next/server';

const PINECONE_HOST = process.env.PINECONE_HOST;
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;

function pineconeHeaders() {
  return {
    'Api-Key': PINECONE_API_KEY!,
    'Content-Type': 'application/json',
  };
}

function missingConfig() {
  return NextResponse.json(
    { error: 'Pinecone config missing. Check PINECONE_HOST and PINECONE_API_KEY in .env' },
    { status: 500 }
  );
}

// ─── GET: Query vectors by sessionId ─────────────────────────────────────────
export async function GET(request: Request) {
  if (!PINECONE_HOST || !PINECONE_API_KEY) return missingConfig();

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId') || 'default';
  const type = searchParams.get('type'); // 'calibration' | 'model' | 'log'

  const filter: Record<string, unknown> = { sessionId: { '$eq': sessionId } };
  if (type) filter.type = { '$eq': type };

  try {
    const res = await fetch(`${PINECONE_HOST}/query`, {
      method: 'POST',
      headers: pineconeHeaders(),
      body: JSON.stringify({
        vector: Array(1024).fill(0),
        filter,
        topK: 1000,
        includeMetadata: true,
        includeValues: true,
      }),
    });

    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data }, { status: res.status });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─── POST: Upsert vectors ─────────────────────────────────────────────────────
export async function POST(request: Request) {
  if (!PINECONE_HOST || !PINECONE_API_KEY) return missingConfig();

  try {
    const body = await request.json();
    // body.vectors: Array<{ id: string; values: number[]; metadata: Record<string,unknown> }>
    const { vectors } = body;

    if (!Array.isArray(vectors) || vectors.length === 0) {
      return NextResponse.json({ error: 'vectors array is required' }, { status: 400 });
    }

    const res = await fetch(`${PINECONE_HOST}/vectors/upsert`, {
      method: 'POST',
      headers: pineconeHeaders(),
      body: JSON.stringify({ vectors }),
    });

    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data }, { status: res.status });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
