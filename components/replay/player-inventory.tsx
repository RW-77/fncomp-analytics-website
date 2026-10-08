'use client'

import { Coins, Package } from 'lucide-react'
import type { InventoryItem, ReplayEngine } from '@/lib/replay/engine'
import type { ItemInfo, PlayerSkin } from '@/lib/replay/match-data'
import { useInventory } from '@/lib/replay/use-replay'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// A player's inventory at the current replay time, laid out after the in-game
// replay HUD: item tiles colored by rarity (pickaxe first, then weapons and
// consumables in the order they were picked up — the data has no hotbar
// order), smaller tiles for augments and objective items, then gold and
// materials. Weapon tiles show the reserve of their ammo type, like the HUD;
// stacks show their count. Hover a tile for its name and loaded ammo.
// ---------------------------------------------------------------------------

// Flat tile colors by rarity. Common, uncommon and rare are sampled from the
// in-game replay HUD; the others are matched to them in tone. Items without a
// rarity (the hand-maintained static items) get a neutral tile, a step lighter
// than the HUD's empty slot (#232737).
const RARITY_BG: Record<string, string> = {
  Common: '#7C8084',
  Uncommon: '#45861E',
  Rare: '#0A78B5',
  Epic: '#7B3FB3',
  Legendary: '#B5651D',
  Mythic: '#B8962B',
  Transcendent: '#138E99',
}
const NEUTRAL_BG = '#3B4050'
const EMPTY_SLOT_BG = '#232737'

// The hotbar row spans the panel like the bars above it: pickaxe + a five-item
// hotbar. Unused columns show as empty slots, as in-game.
const HOTBAR_COLUMNS = 6

// Which section an item goes in, by its category (see getItemCatalog).
const HOTBAR = new Set(['weapon', 'consumable', 'utility', 'melee'])
const SMALL = new Set(['augment', 'objective'])
// Gold, then wood, brick, metal (the in-game order). Fixed ids, so each shows
// its icon (from the match's item info) even before the player has any.
const GOLD_ID = 'Athena_WadsItemData'
const MATERIALS = ['WoodItemData', 'StoneItemData', 'MetalItemData']

function section(itemId: string, info: ItemInfo | undefined): 'pickaxe' | 'hotbar' | 'small' | null {
  const category = info?.category ?? 'unknown'
  if (category === 'pickaxe') return 'pickaxe'
  if (HOTBAR.has(category)) return 'hotbar'
  if (SMALL.has(category)) return 'small'
  // In no catalog yet (a new season's item): weapon-like ids go on the hotbar,
  // anything else with the small items, so nothing the player holds is hidden.
  if (category === 'unknown') return /^W(M)?ID_/.test(itemId) ? 'hotbar' : 'small'
  return null   // materials, ammo, gold (shown separately); build pieces, edit tool (hidden)
}

export function PlayerInventory({
  engine,
  playerId,
  pickaxe,
  compact = false,
}: {
  engine: ReplayEngine
  playerId: string
  pickaxe: PlayerSkin | undefined
  compact?: boolean         // the team panel: the hotbar row only
}) {
  const items = useInventory(engine, playerId)
  if (items === null) return null   // still loading
  const info = engine.itemInfo

  // Totals by item id (a material or ammo type can span several slots).
  const totals = new Map<string, number>()
  for (const it of items) totals.set(it.itemId, (totals.get(it.itemId) ?? 0) + it.count)

  const pickaxes = items.filter((it) => section(it.itemId, info[it.itemId]) === 'pickaxe')
  const hotbar = items.filter((it) => section(it.itemId, info[it.itemId]) === 'hotbar')
  const small = items.filter((it) => section(it.itemId, info[it.itemId]) === 'small')

  if (pickaxes.length + hotbar.length + small.length === 0) {
    return <p className="text-xs text-slate-500">No items</p>
  }

  const columns = HOTBAR_COLUMNS
  const filled = Math.min(pickaxes.length, 1) + hotbar.length
  const empty = Math.max(columns, Math.ceil(filled / columns) * columns) - filled
  return (
    <div className="grid gap-1.5">
      <div
        className={cn('grid', compact ? 'gap-0.5' : 'gap-1')}
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {pickaxes.slice(0, 1).map((it) => (
          <Tile
            key={it.slot}
            imageUrl={pickaxe?.imageUrl ?? null}
            background={NEUTRAL_BG}
            title={pickaxe?.name ? `${pickaxe.name} (pickaxe)` : 'Pickaxe'}
          />
        ))}
        {hotbar.map((it) => (
          <HotbarTile key={it.slot} item={it} info={info} totals={totals} />
        ))}
        {Array.from({ length: empty }, (_, i) => (
          <div key={`empty-${i}`} aria-hidden className="aspect-square" style={{ background: EMPTY_SLOT_BG }} />
        ))}
      </div>

      {!compact && small.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {small.map((it) => {
            const i = info[it.itemId]
            return (
              <Tile
                key={it.slot}
                size={30}
                imageUrl={i?.imageUrl ?? null}
                background={i?.rarity ? RARITY_BG[i.rarity] ?? NEUTRAL_BG : NEUTRAL_BG}
                title={i?.name ?? it.itemId}
                corner={it.count > 1 ? it.count : null}
              />
            )
          })}
        </div>
      )}

      {!compact && (
        <div className="grid grid-cols-4 gap-1">
          <Resource
            label={info[GOLD_ID]?.name ?? 'Gold'}
            count={totals.get(GOLD_ID) ?? 0}
            icon={info[GOLD_ID]?.imageUrl ?? null}
            fallback={<Coins className="size-4 text-amber-300" />}
          />
          {MATERIALS.map((id) => (
            <Resource
              key={id}
              label={info[id]?.name ?? id}
              count={totals.get(id) ?? 0}
              icon={info[id]?.imageUrl ?? null}
              fallback={<Package className="size-4 text-slate-400" />}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// A weapon or consumable. A weapon shows the reserve of its ammo type (with
// that ammo's icon) when the player carries any; a stack shows its count.
function HotbarTile({
  item,
  info,
  totals,
}: {
  item: InventoryItem
  info: Record<string, ItemInfo>
  totals: Map<string, number>
}) {
  const i = info[item.itemId]
  // Guns fire carried ammo (an "ammo" item: light bullets, shells, ...).
  // Other weapon-catalog items have their own ammo types — a Chug Jug's is its
  // charge — so loaded/reserve only applies to the former.
  const ammoInfo = i?.ammo ? info[i.ammo] : undefined
  const usesCarriedAmmo = ammoInfo?.category === 'ammo'
  const reserve = usesCarriedAmmo && i?.ammo ? totals.get(i.ammo) ?? 0 : undefined
  const ammoIcon = usesCarriedAmmo ? ammoInfo?.imageUrl ?? null : null

  const name = i?.name ?? item.itemId
  const title = [
    i?.rarity ? `${i.rarity} ${name}` : name,
    usesCarriedAmmo ? `${item.ammo} loaded` : null,
    reserve !== undefined ? `${reserve} reserve` : null,
    item.count > 1 ? `×${item.count}` : null,
  ].filter(Boolean).join(' · ')

  let corner: React.ReactNode = null
  if (reserve !== undefined) {
    corner = (
      <>
        {reserve}
        {/* eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL */}
        {ammoIcon && <img src={ammoIcon} alt="" className="size-3 object-contain" />}
      </>
    )
  } else if (item.count > 1) {
    corner = item.count
  }

  return (
    <Tile
      imageUrl={i?.imageUrl ?? null}
      background={i?.rarity ? RARITY_BG[i.rarity] ?? NEUTRAL_BG : NEUTRAL_BG}
      title={title}
      corner={corner}
    />
  )
}

// A square item tile. Without `size` it fills its grid cell.
function Tile({
  size,
  imageUrl,
  background,
  title,
  corner = null,
}: {
  size?: number             // css px; omit to fill the grid cell
  imageUrl: string | null
  background: string
  title: string
  corner?: React.ReactNode
}) {
  return (
    <div
      title={title}
      className="relative aspect-square shrink-0 overflow-hidden"
      style={{ width: size, background }}
    >
      {imageUrl ? (
        // A plain <img>: presigned S3 URLs change per page load, so
        // next/image's optimizer would only add a hop.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt={title} className="absolute inset-0 size-full object-contain p-[7%]" />
      ) : (
        <span className="absolute inset-0 grid place-items-center text-white/35">
          <Package className="size-[45%]" />
        </span>
      )}
      {corner !== null && (
        <span className="absolute bottom-0.5 right-1 flex items-center gap-0.5 text-[11px] font-semibold leading-none tabular-nums text-white [text-shadow:0_0_2px_rgba(0,0,0,0.85)]">
          {corner}
        </span>
      )}
    </div>
  )
}

// Gold or a material: its icon and how many the player has.
function Resource({
  label,
  count,
  icon,
  fallback,
}: {
  label: string
  count: number
  icon: string | null
  fallback: React.ReactNode
}) {
  return (
    <div title={label} className="flex items-center justify-center gap-1.5 bg-white/[0.04] px-1.5 py-1">
      {icon ? (
        // eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL
        <img src={icon} alt="" className="size-5 shrink-0 object-contain" />
      ) : (
        <span className="grid size-5 shrink-0 place-items-center">{fallback}</span>
      )}
      <span className="text-sm font-semibold tabular-nums text-slate-100">{count}</span>
    </div>
  )
}
