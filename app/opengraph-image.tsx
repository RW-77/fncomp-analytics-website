import { readFile } from "node:fs/promises"
import path from "node:path"
import { ImageResponse } from "next/og"

// The image link previews show for every page (pages without their own):
// the logo, the headline in the homepage's gold and white, and what's inside.
export const alt = "FNAnalytics: Competitive Fortnite Analytics"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

// The homepage headline's font. next/og needs a TTF, which Google Fonts serves
// to user agents that don't take WOFF2. null (the default sans) if the fetch
// fails, so the build never breaks over it.
async function sora(weight: number): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Sora:wght@${weight}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 6.1)" },
    })).text()
    const url = css.match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/)?.[1]
    return url ? await (await fetch(url)).arrayBuffer() : null
  } catch {
    return null
  }
}

export default async function OpengraphImage() {
  const [logo, bold, extraBold] = await Promise.all([
    readFile(path.join(process.cwd(), "public/fnanalytics_logo.png")),
    sora(700),
    sora(800),
  ])
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`
  const fonts = [
    ...(bold ? [{ name: "Sora", data: bold, weight: 700 as const }] : []),
    ...(extraBold ? [{ name: "Sora", data: extraBold, weight: 800 as const }] : []),
  ]

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#111112",
          color: "white",
          fontFamily: fonts.length ? "Sora" : "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <img src={logoSrc} width={64} height={64} alt="" />
          <div style={{ fontSize: 40, fontWeight: 700 }}>FNAnalytics</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 92, fontWeight: 800, color: "#e3c97e", letterSpacing: "-0.03em" }}>Competitive</div>
          <div style={{ fontSize: 92, fontWeight: 800, letterSpacing: "-0.03em" }}>Fortnite Analytics</div>
        </div>
        <div style={{ fontSize: 30, color: "#cbd5e1", fontWeight: 700 }}>
          2D replays · fight detection · filterable stats · every FNCS game
        </div>
      </div>
    ),
    { ...size, fonts },
  )
}
