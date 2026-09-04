/*
 * Three movements, no difficulty label between them. A pushup isn't
 * "advanced", it's a pushup, and `swap` gives you an easier way into the
 * same one.
 *
 * `seconds` is how long the timer runs, `cue` is the one thing worth
 * remembering while you do it, `swap` is the way out that isn't quitting.
 */
export const EXERCISES = [
  {
    id: 'pushups',
    name: 'Pushups',
    lottie: '/lottie/pushup.json',
    seconds: 40,
    cue: 'Elbows close to your ribs, body in one line',
    swap: 'Do them on your knees or against a wall - same exercise',
  },
  {
    id: 'jumpingjacks',
    name: 'Jumping jacks',
    lottie: '/lottie/jumpingjacks.json',
    seconds: 45,
    cue: 'Land soft, let the knees bend',
    swap: 'Step side to side instead of jumping',
  },
  {
    id: 'jumpingsquats',
    name: 'Jumping squats',
    lottie: '/lottie/jumpingsquats.json',
    seconds: 35,
    cue: 'Sit back into your heels before you drive up',
    swap: 'Skip the jump, just stand up normally',
  },
]

export const getExercise = (id) => EXERCISES.find((e) => e.id === id) || EXERCISES[0]
