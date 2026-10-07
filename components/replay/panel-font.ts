import { IBM_Plex_Sans } from 'next/font/google'

// The match page's left panel is set in IBM Plex Sans, a step heavier than the
// rest of the site: put `${panelFont.className} font-medium` on the panel's
// root so plain text is medium, and use semibold / bold for emphasis inside it.
// Anything the panel opens outside itself (the team picker's popover) needs
// the same two classes.
export const panelFont = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'] })
