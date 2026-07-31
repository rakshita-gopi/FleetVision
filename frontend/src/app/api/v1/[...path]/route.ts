import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

function backendBase(): string {
  const raw =
    process.env.BACKEND_API_URL ||
    process.env.NEXT_PUBLIC_WS_API_URL ||
    // Fallback for Vercel when dashboard env still points at a dead tunnel hostname
    "https://literally-kinase-attachments-discovered.trycloudflare.com/api/v1";
  return raw.replace(/\/$/, "");
}

async function proxy(req: NextRequest, segments: string[]) {
  const base = backendBase();
  if (!base || base.startsWith("/")) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Backend API is not configured. Set BACKEND_API_URL on Vercel to your live API (e.g. Cloudflare tunnel) ending in /api/v1.",
      },
      { status: 503 }
    );
  }

  const incoming = new URL(req.url);
  const target = `${base}/${segments.map(encodeURIComponent).join("/")}${incoming.search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });
  // Ensure JSON APIs work through the proxy
  if (!headers.has("accept")) {
    headers.set("accept", "application/json");
  }

  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: "manual",
    cache: "no-store",
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch (err) {
    const detail = err instanceof Error ? err.message : "upstream unreachable";
    return NextResponse.json(
      {
        success: false,
        message: `Cannot reach backend at ${base}. Is the API / tunnel running? (${detail})`,
      },
      { status: 502 }
    );
  }

  const out = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      out.set(key, value);
    }
  });

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: out,
  });
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path || []);
}
export async function POST(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path || []);
}
export async function PUT(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path || []);
}
export async function PATCH(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path || []);
}
export async function DELETE(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path || []);
}
export async function OPTIONS(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path || []);
}
