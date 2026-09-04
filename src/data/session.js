/*
 * One session, for everybody. No Beginner/Intermediate/Advanced to pick from
 * before you're allowed to move - an app whose argument is "we meet you where
 * you are" can't open by asking you to rate yourself.
 *
 * The shape here (movements, rounds, rest lengths) is still real data because
 * the Today tile quotes it and the number has to be true. What's gone is the
 * label. Flexibility moved to energy (pace of animations and coach speech) and
 * equipment (which movements get offered, never how hard they are), plus the
 * timer's swap line for an easier version of the movement you're already on.
 *
 * The arithmetic behind `minutes`, so nobody has to trust it: 45 + 40 + 35
 * seconds is 2 min of work a round, twice over is 4, five 45s rests is another
 * 3.75. Call it 8.
 */
export const SESSION = {
  rounds: 2,
  restSeconds: 45,
  minutes: 8,
  blurb:
    'Three movements, two rounds, unhurried rests. Short enough to finish on a bad day, and stopping after one still counts.',
  exercises: ['jumpingjacks', 'pushups', 'jumpingsquats'],
}
