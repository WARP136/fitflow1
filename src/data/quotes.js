/*
 * Rotating line on the dashboard. Written in the product voice: encouraging,
 * never scolding, never about discipline or "no excuses".
 */
export const QUOTES = [
  { text: 'A short walk still counts as a walk.', by: 'FitFlow' },
  { text: 'You’re allowed to start again as many times as you need.', by: 'FitFlow' },
  { text: 'Consistency isn’t the same as perfection. It never was.', by: 'FitFlow' },
  { text: 'Some days the goal is just to move a little. That’s a real goal.', by: 'FitFlow' },
  { text: 'The plan is supposed to fit you, not the other way round.', by: 'FitFlow' },
  { text: 'Rest is part of the training, not a break from it.', by: 'FitFlow' },
  { text: 'Nobody is keeping score here. Least of all us.', by: 'FitFlow' },
  { text: 'Ten minutes today beats an hour you keep postponing.', by: 'FitFlow' },
]

export const quoteOfNow = () =>
  QUOTES[Math.floor(Date.now() / 20000) % QUOTES.length]
