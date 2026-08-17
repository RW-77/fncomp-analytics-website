// Maps a Fortnite "GeoIdentity" flag token (from the fnapi leaderboard, stored
// on event_window_players.flag_token) to a flag-icons class code.
//
// The code is an ISO 3166-1 alpha-2 country code, or a GB subdivision code for
// the home nations (England/Scotland/Wales aren't ISO countries — flag-icons
// ships them as `gb-eng`, `gb-sct`, `gb-wls`). Keys are the lowercase suffix of
// the token "GroupIdentity_GeoIdentity_<key>", which Epic spells as the
// concatenated lowercase country name (e.g. "unitedstates", "southkorea").
//
// Anything not in this table — the non-country tokens `global`/`fortnite`, a
// null/absent token, or a country we haven't mapped yet — returns null from
// flagCode(), which the <Flag> component renders as the default globe. So an
// unmapped country degrades to the globe rather than breaking; add a line here
// to give it its real flag.
//
// Entries below the divider are every token observed in the data so far; the
// rest are common competitive-scene countries mapped ahead of time.
const FLAG_TOKEN_TO_CODE: Record<string, string> = {
  // --- observed in data ---
  unitedstates: "us",
  germany: "de",
  poland: "pl",
  france: "fr",
  denmark: "dk",
  mexico: "mx",
  southkorea: "kr",
  canada: "ca",
  sweden: "se",
  russia: "ru",
  england: "gb-eng",
  italy: "it",
  wales: "gb-wls",
  spain: "es",
  ukraine: "ua",
  netherlands: "nl",
  japan: "jp",
  norway: "no",
  argentina: "ar",
  unitedkingdom: "gb",
  czechrepublic: "cz",
  scotland: "gb-sct",
  saudiarabia: "sa",
  australia: "au",
  switzerland: "ch",
  turkey: "tr",
  latvia: "lv",
  belarus: "by",
  belgium: "be",
  brazil: "br",
  colombia: "co",
  portugal: "pt",
  nigeria: "ng",
  uruguay: "uy",
  iceland: "is",
  egypt: "eg",
  newzealand: "nz",
  ireland: "ie",
  // --- mapped ahead of time (not yet seen, harmless if Epic's key differs) ---
  finland: "fi",
  austria: "at",
  greece: "gr",
  hungary: "hu",
  romania: "ro",
  croatia: "hr",
  serbia: "rs",
  slovakia: "sk",
  slovenia: "si",
  estonia: "ee",
  lithuania: "lt",
  bulgaria: "bg",
  luxembourg: "lu",
  cyprus: "cy",
  malta: "mt",
  northernireland: "gb-nir",
  chile: "cl",
  peru: "pe",
  ecuador: "ec",
  venezuela: "ve",
  paraguay: "py",
  bolivia: "bo",
  costarica: "cr",
  panama: "pa",
  dominicanrepublic: "do",
  puertorico: "pr",
  china: "cn",
  india: "in",
  philippines: "ph",
  indonesia: "id",
  thailand: "th",
  vietnam: "vn",
  malaysia: "my",
  singapore: "sg",
  taiwan: "tw",
  hongkong: "hk",
  israel: "il",
  unitedarabemirates: "ae",
  qatar: "qa",
  kuwait: "kw",
  morocco: "ma",
  southafrica: "za",
  tunisia: "tn",
  algeria: "dz",
  georgia: "ge",
  kazakhstan: "kz",
  azerbaijan: "az",
  armenia: "am",
  pakistan: "pk",
}

/**
 * flag-icons code for a raw flag token, or `null` when there's no mapped
 * country flag (non-country tokens, missing token, or an unmapped country).
 * Accepts either the full "GroupIdentity_GeoIdentity_<key>" token or a bare key.
 */
export function flagCode(flagToken: string | null | undefined): string | null {
  if (!flagToken) return null
  const key = flagToken.replace(/^GroupIdentity_GeoIdentity_/, "").toLowerCase()
  return FLAG_TOKEN_TO_CODE[key] ?? null
}
