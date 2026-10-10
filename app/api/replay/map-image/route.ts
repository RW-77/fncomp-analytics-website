import { NextRequest, NextResponse } from "next/server"

import { getMapImage } from "@/lib/replay/match-data"

// A game version's map image (~2 MB), at a stable URL so browsers and the CDN
// cache it. A presigned S3 URL changes on every page load, so it never would.
// Map images rarely change once synced, but can be re-synced, hence a day.
const CACHE_CONTROL = "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400"

export async function GET(req: NextRequest) {
  const build = req.nextUrl.searchParams.get("build") ?? ""
  const mode = req.nextUrl.searchParams.get("mode") ?? ""
  if (!/^\d+\.\d{2}$/.test(build) || !/^[a-z0-9_-]+$/.test(mode)) {
    return NextResponse.json({ error: "Bad build or mode" }, { status: 400 })
  }
  try {
    const image = await getMapImage(build, mode)
    if (!image) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return new Response(image, { headers: { "Content-Type": "image/webp", "Cache-Control": CACHE_CONTROL } })
  } catch (err) {
    console.error(`Failed to load map image ${build}/${mode}`, err)
    return NextResponse.json({ error: "Failed to load map image" }, { status: 500 })
  }
}
