// ─────────────────────────────────────────────────────────────
//  ✏️  JAKE: EDIT YOUR GIFT MESSAGE HERE
// ─────────────────────────────────────────────────────────────
export const GIFT_MESSAGE = {
  headline: 'Merry Christmas, Mom! ❤️',
  signoff: 'Love, Jake',
  // Your personal note. Shown on the welcome screen and on Settings → About.
  // Use \n\n for a new paragraph.
  note: 'Made you an app for all your knitting stuff. No more losing count.',
}

// The family list for the "Made for" field. Mom can add more in Settings.
export const DEFAULT_FAMILY: string[] = ['Dad', 'Jake', 'Mike', 'Matt', 'Majo']

// Always offered alongside the family list.
export const JUST_FOR_ME = 'Just for me'

// Project types. Mom can edit this list later.
export const DEFAULT_PROJECT_TYPES: string[] = [
  'Sweater',
  'Belt',
  'Hat',
  'Scarf',
  'Blanket',
  'Needlepoint canvas',
  'Pillow',
  'Ornament',
  'Other',
]

export const CRAFTS = ['Knitting', 'Needlepoint', 'Other'] as const

// Days between "time to back up" reminders.
export const BACKUP_REMINDER_DAYS = 60

// Stash choices. "Other" lets her type anything.
export const YARN_WEIGHTS: string[] = [
  'Lace',
  'Fingering',
  'Sport',
  'DK',
  'Worsted',
  'Aran',
  'Bulky',
  'Super bulky',
  'Thread / floss',
  'Canvas',
]
export const FIBER_SUGGESTIONS: string[] = [
  'Wool',
  'Merino',
  'Cotton',
  'Acrylic',
  'Alpaca',
  'Cashmere',
  'Mohair',
  'Silk',
  'Linen',
  'Wool blend',
  'Cotton blend',
]
