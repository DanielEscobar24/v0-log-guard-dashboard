import { NextRequest } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function getGatewayBaseUrl() {
  const explicitBase = process.env.API_GATEWAY_URL?.trim().replace(/\/$/, "")
  const legacyPublicBase = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, "")

  if (explicitBase) return explicitBase
  if (legacyPublicBase) return legacyPublicBase
  if (process.env.NODE_ENV !== "production") return "http://localhost:4000"

  return ""
}

async function proxy(request: NextRequest, path: string[]) {
  const gatewayBaseUrl = getGatewayBaseUrl()

  if (!gatewayBaseUrl) {
    return Response.json(
      {
        error:
          "Falta API_GATEWAY_URL en el entorno del servidor. En Vercel define la URL publica HTTPS de tu api-log-guard y vuelve a desplegar.",
      },
      { status: 503 },
    )
  }

  const upstreamUrl = new URL(`${gatewayBaseUrl}/api/${path.join("/")}`)
  request.nextUrl.searchParams.forEach((value, key) => {
    upstreamUrl.searchParams.append(key, value)
  })

  const headers = new Headers(request.headers)
  headers.delete("host")
  headers.delete("connection")

  const methodAllowsBody = request.method !== "GET" && request.method !== "HEAD"
  let upstreamResponse: Response

  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body: methodAllowsBody ? await request.text() : undefined,
      cache: "no-store",
    })
  } catch {
    return Response.json(
      {
        error:
          "No fue posible conectar con api-log-guard. Verifica que el backend esté ejecutándose en el puerto configurado y reinicia `npm run dev` si acabas de cambiar server.js.",
      },
      { status: 503 },
    )
  }

  const responseHeaders = new Headers(upstreamResponse.headers)
  responseHeaders.delete("content-encoding")
  responseHeaders.delete("content-length")

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  })
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  return proxy(request, path)
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  return proxy(request, path)
}

export async function PUT(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  return proxy(request, path)
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  return proxy(request, path)
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  return proxy(request, path)
}
