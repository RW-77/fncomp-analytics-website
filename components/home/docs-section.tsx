import Link from "next/link"
import { ArrowRight, BookOpen } from "lucide-react"

// The homepage's last section: a still from the accuracy lab (/labs/accuracy,
// a shot's tracer from shooter to target, with the lab's controls hidden, and
// mirrored so the shot sits right) and, over its empty left side, what the docs
// cover and a way in.
export function DocsSection() {
  return (
    <section className="border-t border-white/[0.06]">
      <div className="section-x py-20 lg:py-28">
        <div className="relative overflow-hidden rounded-md bg-[#0b0f17] ring-1 ring-white/[0.06]">
          {/* eslint-disable-next-line @next/next/no-img-element -- a static still */}
          <img
            src="/images/labs-accuracy-shot.webp"
            alt="The accuracy lab: a shot's path from the shooter to its target, in 3D"
            className="aspect-[2400/1266] w-full object-cover"
          />
          <div className="flex flex-col gap-5 bg-[var(--app-bg)] p-6 sm:p-7 lg:absolute lg:left-[4%] lg:top-1/2 lg:max-w-[min(30rem,40%)] lg:-translate-y-1/2 lg:rounded-md lg:shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
            <h2 className="font-[family-name:var(--font-sora)] text-3xl font-bold tracking-[-0.02em] text-white sm:text-4xl">
              How every number is calculated
            </h2>
            <p className="text-base leading-7 text-slate-300">
              Each stat has a page explaining exactly what it counts and how, with worked examples and interactive
              visualizations, so you can trust what you&apos;re reading.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/docs"
                className="inline-flex h-11 items-center gap-2 rounded-[4px] bg-[var(--accent-gold)] px-5 text-[15px] font-semibold text-[var(--accent-gold-fg)] hover:bg-[var(--accent-gold-strong)]"
              >
                <BookOpen className="size-4" aria-hidden />
                Read the docs
              </Link>
              <Link
                href="/labs/accuracy"
                className="inline-flex h-11 items-center gap-1.5 px-2 text-[15px] font-semibold text-slate-300 hover:text-white"
              >
                Open the accuracy lab
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
