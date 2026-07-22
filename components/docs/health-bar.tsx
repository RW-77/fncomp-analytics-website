import type { CSSProperties } from 'react';

/**
 * One damage event, as it happened. The buffer is a chronological list of these
 * — the same dealer may appear more than once (e.g. A hits, then B, then A
 * again). Each event lands on the victim shield-first, then health.
 */
export type DamageEvent = {
  /** Display name, e.g. "Player A" or "Storm". */
  dealer: string;
  /** Damage this event dealt, in HP units. */
  amount: number;
  /**
   * Chunk color. Optional — when omitted, a color is auto-assigned per dealer
   * from a palette that excludes green and blue (those are reserved for
   * remaining health/shield). A dealer's first specified color wins for all of
   * their chunks, so the same player always reads as one color.
   */
  color?: string;
  /** Storm/fall/etc. — labelled "untracked"; never credited as a DCE dealer. */
  environment?: boolean;
};

export type HealthBarProps = {
  /**
   * Damage events in chronological order (earliest first). Omit or pass an
   * empty list to render a full, undamaged victim with no legend.
   */
  events?: DamageEvent[];
};

/** Both bars are always full-capacity 100. */
const SHIELD_CAP = 100;
const HP_CAP = 100;

const SHIELD_COLOR = '#38bdf8'; // remaining shield — blue, reserved
const HP_COLOR = '#4ade80'; // remaining HP — green, reserved

/**
 * Auto-assign palette for dealer colors. Deliberately free of green and blue
 * hues so a missing (damaged) chunk is never mistaken for health/shield that's
 * still there. Warm + magenta/purple only.
 */
const PALETTE = [
  '#f59e0b', // amber
  '#fb7185', // rose
  '#d946ef', // fuchsia
  '#fb923c', // orange
  '#a855f7', // purple
  '#f43f5e', // red
  '#eab308', // yellow
  '#ec4899', // pink
];
/** Untracked/environmental default — a desaturated slate, reads neutral grey. */
const ENV_COLOR = '#94a3b8';

function hexToRgba(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * Marks a *missing* region: a faint color wash under a sparse diagonal hatch.
 * The colored lines (2px) are deliberately thinner than the transparent gaps
 * (7px) and drawn at low opacity, so the region reads as muted/hollow — gone,
 * not loud — while the color still says who dealt it. The remaining (solid)
 * chunk stays fully saturated, so the eye separates "still there" from "gone"
 * by texture and brightness at a glance.
 */
function missingStyle(color: string): CSSProperties {
  return {
    backgroundColor: hexToRgba(color, 0.08),
    backgroundImage: `repeating-linear-gradient(45deg, ${hexToRgba(color, 0.42)} 0 2px, transparent 2px 9px)`,
    // A faint colored cap instead of the solid one the remaining chunk gets.
    borderTop: `2px solid ${hexToRgba(color, 0.38)}`,
    // Thin dark separator on the left edge so adjacent chunks stay crisp.
    boxShadow: 'inset 1px 0 0 rgba(2, 6, 23, 0.45)',
    color: '#e2e8f0',
    fontWeight: 500,
    textShadow: '0 1px 3px rgba(2, 6, 23, 0.85)',
  };
}

/** Resolve one color per dealer (first appearance / first specified wins). */
function resolveColors(events: DamageEvent[]): Map<string, string> {
  const colors = new Map<string, string>();
  let next = 0;
  for (const e of events) {
    if (colors.has(e.dealer)) continue;
    if (e.color) colors.set(e.dealer, e.color);
    else if (e.environment) colors.set(e.dealer, ENV_COLOR);
    else colors.set(e.dealer, PALETTE[next++ % PALETTE.length]);
  }
  return colors;
}

/** One event split into how much of it landed on shield vs. health. */
type Part = {
  dealer: string;
  color: string;
  environment?: boolean;
  shield: number;
  hp: number;
};

/**
 * Drain the victim through the whole event buffer, shield-first. Shield fills
 * to capacity across the earliest events; once it's full, the overflow of the
 * boundary-crossing event — and everything after — lands on health. Damage past
 * a full health bar (overkill) is dropped from the visual.
 */
function splitEvents(events: DamageEvent[], colors: Map<string, string>): Part[] {
  let shieldUsed = 0;
  let hpUsed = 0;
  return events.map((e) => {
    const shield = Math.min(e.amount, Math.max(0, SHIELD_CAP - shieldUsed));
    shieldUsed += shield;
    const hp = Math.min(e.amount - shield, Math.max(0, HP_CAP - hpUsed));
    hpUsed += hp;
    return { dealer: e.dealer, color: colors.get(e.dealer)!, environment: e.environment, shield, hp };
  });
}

type LegendRow = { dealer: string; color: string; environment?: boolean; shield: number; hp: number };

/** One row per dealer, totalling their standing shield/HP damage on the bar. */
function buildLegend(parts: Part[]): LegendRow[] {
  const rows = new Map<string, LegendRow>();
  for (const p of parts) {
    const row = rows.get(p.dealer) ?? {
      dealer: p.dealer,
      color: p.color,
      environment: p.environment,
      shield: 0,
      hp: 0,
    };
    row.shield += p.shield;
    row.hp += p.hp;
    rows.set(p.dealer, row);
  }
  return [...rows.values()];
}

function Segment({
  value,
  capacity,
  color,
  missing,
}: {
  value: number;
  capacity: number;
  color: string;
  missing: boolean;
}) {
  if (value <= 0) return null;
  const pct = (value / capacity) * 100;
  const base: CSSProperties = {
    flex: `0 0 ${pct}%`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontVariantNumeric: 'tabular-nums',
    minWidth: 0,
    overflow: 'hidden',
  };
  // Remaining = solid saturated with a bright cap; missing = muted hatch.
  const style: CSSProperties = missing
    ? { ...base, ...missingStyle(color) }
    : {
        ...base,
        background: color,
        borderTop: `2px solid ${color}`,
        color: '#0b1220',
        fontWeight: 600,
      };
  return <div style={style}>{pct >= 9 ? Math.round(value) : null}</div>;
}

function Bar({
  name,
  remaining,
  remainingColor,
  missingParts,
  pick,
}: {
  name: string;
  remaining: number;
  remainingColor: string;
  /** Missing chunks already ordered left-to-right for this bar. */
  missingParts: Part[];
  pick: (p: Part) => number;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <span
        style={{
          width: '46px',
          textAlign: 'right',
          fontSize: '12px',
          fontWeight: 500,
          color: '#94a3b8',
          flexShrink: 0,
        }}
      >
        {name}
      </span>
      <div
        style={{
          flex: 1,
          display: 'flex',
          height: '30px',
          borderRadius: '6px',
          overflow: 'hidden',
          background: 'rgba(148, 163, 184, 0.1)',
          border: '1px solid rgba(148, 163, 184, 0.22)',
        }}
      >
        {/* Remaining health/shield: solid, anchored left (bar empties right→left). */}
        <Segment value={remaining} capacity={SHIELD_CAP} color={remainingColor} missing={false} />
        {/* Missing region: one hatched chunk per event that touched this bar. */}
        {missingParts.map((p, i) => (
          <Segment key={`${p.dealer}-${i}`} value={pick(p)} capacity={SHIELD_CAP} color={p.color} missing />
        ))}
      </div>
    </div>
  );
}

export default function HealthBar({ events = [] }: HealthBarProps) {
  const colors = resolveColors(events);
  const parts = splitEvents(events, colors);

  const missingShield = parts.reduce((s, p) => s + p.shield, 0);
  const missingHp = parts.reduce((s, p) => s + p.hp, 0);
  const remainingShield = SHIELD_CAP - missingShield;
  const remainingHp = HP_CAP - missingHp;

  // Bars empty right-to-left, so the earliest damage sits at the right edge.
  // Reversing the chronological buffer lays chunks out left-to-right correctly
  // (latest damage nearest the remaining bar), which also wraps a
  // boundary-crossing event to opposite corners: its shield part to the far
  // left of the shield bar, its HP part to the far right of the health bar.
  const reversed = [...parts].reverse();
  const shieldMissing = reversed.filter((p) => p.shield > 0);
  const hpMissing = reversed.filter((p) => p.hp > 0);

  const legend = buildLegend(parts);

  return (
    <figure
      className="not-prose"
      style={{
        margin: '1.5rem auto',
        maxWidth: '620px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      <Bar
        name="Shield"
        remaining={remainingShield}
        remainingColor={SHIELD_COLOR}
        missingParts={shieldMissing}
        pick={(p) => p.shield}
      />
      <Bar
        name="HP"
        remaining={remainingHp}
        remainingColor={HP_COLOR}
        missingParts={hpMissing}
        pick={(p) => p.hp}
      />

      {/* Legend: one row per dealer with their standing damage and how it split.
          Only shown when there's damage to explain. Swatches are solid so the
          color key stays legible at small size. */}
      {legend.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px 16px',
            marginTop: '2px',
            paddingLeft: '56px',
          }}
        >
          {legend.map((row) => {
            const total = row.shield + row.hp;
            const note =
              row.shield > 0 && row.hp > 0
                ? ` (${Math.round(row.shield)} shield + ${Math.round(row.hp)} HP)`
                : row.environment
                  ? ' (untracked)'
                  : '';
            return (
              <span
                key={`legend-${row.dealer}`}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: '#cbd5e1' }}
              >
                <span
                  style={{
                    width: '11px',
                    height: '11px',
                    borderRadius: '3px',
                    background: row.color,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontWeight: 500 }}>{row.dealer}</span>
                <span style={{ color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
                  {Math.round(total)} dmg{note}
                </span>
              </span>
            );
          })}
        </div>
      )}
    </figure>
  );
}
