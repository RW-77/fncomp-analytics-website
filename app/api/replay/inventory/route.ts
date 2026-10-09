import { NextRequest, NextResponse } from 'next/server'

import { getMatchInventory, signItemCatalog } from '@/lib/replay/match-data'
import { getItemCatalog } from '@/lib/stats'

// Never statically cache: the item icons are per-request presigned S3 URLs.
export const dynamic = 'force-dynamic'

// A match's inventory (inventory.json from the ETL) plus display info — name,
// category, rarity, ammo type and a presigned icon URL — for every item id in
// it, so the client only loads the icons this match uses. 404 when the match
// hasn't been processed for inventory yet.
export async function GET(req: NextRequest) {
  const matchId = new URL(req.url).searchParams.get('matchId')
  if (!matchId) {
    return NextResponse.json({ error: 'Missing matchId' }, { status: 400 })
  }

  try {
    const inventory = await getMatchInventory(matchId)
    if (!inventory) {
      return NextResponse.json({ error: 'Inventory not found' }, { status: 404 })
    }
    const itemInfo = await signItemCatalog(await getItemCatalog(inventory.items))
    return NextResponse.json({ ...inventory, itemInfo })
  } catch (caught) {
    console.error(`Failed to load inventory for match ${matchId}`, caught)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
