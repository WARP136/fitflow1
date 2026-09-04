/*
 * Why the person is here. No weight-loss goal on purpose: every one of these
 * is about how you want to feel or what you want to be able to do, because a
 * goal phrased as a number on a scale is one you can fail at daily. The diet
 * page still takes a lose/gain target - that's a calculation input and it
 * belongs there.
 *
 * `line` is one sentence of encouragement printed on /move. Copy, not
 * configuration.
 */
export const GOALS = [
  {
    id: 'feel-better',
    label: 'Feel better day to day',
    hint: 'More energy, less stiffness',
    line: 'Short and often beats long and rare. We will keep the sessions small.',
  },
  {
    id: 'stronger',
    label: 'Get stronger',
    hint: 'Build something over time',
    line: 'Strength is the one thing that genuinely needs consistency, so we will keep it realistic.',
  },
  {
    id: 'calmer',
    label: 'Clear my head',
    hint: 'Movement as a reset',
    line: 'Then the walk and the jog matter more than the timer. Both are on the rail.',
  },
  {
    id: 'moving-more',
    label: 'Just move more',
    hint: 'Undo the sitting',
    line: 'Anything counts. Water and a ten minute walk are a complete day here.',
  },
]

export const getGoal = (id) => GOALS.find((g) => g.id === id) || GOALS[0]
