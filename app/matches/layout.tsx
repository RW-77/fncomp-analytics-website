// Match pages run full screen in the dark gray theme: marking the root here
// themes the whole document from the first paint, loading skeleton and
// not-found page included (see globals.css).
export default function MatchLayout({ children }: { children: React.ReactNode }) {
  return <div data-theme="dark-gray">{children}</div>
}
