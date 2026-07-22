// app/docs/layout.tsx
import { RootProvider } from 'fumadocs-ui/provider/next';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { source } from '@/lib/source';
import type { ReactNode } from 'react';
// KaTeX styles for LaTeX rendered by rehype-katex. Scoped here rather than the
// root layout since math only appears in docs.
import 'katex/dist/katex.css';

// next-themes is disabled: the root layout hardcodes <html className="dark">, so
// it has nothing to drive. Leaving it on made RootProvider inject a blocking
// anti-flash <script>, which React can't execute when rendered from a nested
// layout on client navigation ("Encountered a script tag..." error).
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <RootProvider theme={{ enabled: false }}>
      {/* Flat backdrop covering the body gradient, matching /tournaments/[id]. */}
      <div className="fixed inset-0 -z-10 bg-[#0a0f1a]" aria-hidden />
      {/* themeSwitch disabled: no light mode yet (root layout hardcodes dark), so
          the sidebar-footer toggle has nothing to drive. */}
      <DocsLayout
        tree={source.pageTree}
        nav={{ title: 'FNAnalytics Docs' }}
        themeSwitch={{ enabled: false }}
      >
        {children}
      </DocsLayout>
    </RootProvider>
  );
}
