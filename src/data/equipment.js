/*
 * What the person actually has to train with. Solves one specific way
 * fitness apps make beginners feel stupid: showing them a cable row while
 * they're standing in a bedroom.
 *
 * Nothing here gates on "advanced" or rewards you for owning more gear, and
 * having none isn't a lesser option - the copy for 'none' is the warmest of
 * the three, since that's the person most likely to quit.
 *
 * Levels are cumulative: 'some' does everything 'none' does, 'gym' does
 * everything. See allows().
 */
export const EQUIPMENT = [
  {
    id: 'none',
    label: 'Nothing at all',
    hint: 'Just me and some floor',
    blurb:
      'Which is genuinely enough. Everything in the timer works with no equipment, and always will.',
  },
  {
    id: 'some',
    label: 'A few things',
    hint: 'Dumbbells, a band, a mat',
    blurb:
      'We will mix in a few movements that use them, and never require them.',
  },
  {
    id: 'gym',
    label: 'A full gym',
    hint: 'Machines and racks',
    blurb:
      'The library opens up. The session stays the same length: more options, not more obligation.',
  },
]

export const getEquipment = (id) =>
  EQUIPMENT.find((e) => e.id === id) || EQUIPMENT[0]

// Rank, so the check is a comparison rather than a pile of if-statements.
const RANK = { none: 0, some: 1, gym: 2 }

/**
 * Can somebody with `owned` equipment do a movement that needs `needs`?
 * Unknown values fall back to yes - an unrecognised tag from the wger API
 * should never cause a movement to silently vanish from the list.
 */
export const allows = (owned, needs) => {
  const have = RANK[owned]
  const want = RANK[needs]
  if (have === undefined || want === undefined) return true
  return have >= want
}
