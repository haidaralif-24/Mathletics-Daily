// Single place for tunable constants. Change here, nowhere else.
const WINDOW_HOURS = 24;

export const SCORING = {
  base: 10,
  speedMax: 5,
  stepsMax: 5,
  windowHours: WINDOW_HOURS,
  windowMs: WINDOW_HOURS * 60 * 60 * 1000,
} as const;

export const SCHEDULE = {
  timezone: 'Asia/Jakarta',
  releaseHourWib: 4, // questions release at 04:00 WIB (= 21:00 UTC the day before)
  wibOffsetHours: 7,
} as const;

export const LIMITS = {
  finalAnswerMaxChars: 500,
  stepPhotosMax: 5,
  stepPhotoMaxBytes: 8 * 1024 * 1024,
} as const;
