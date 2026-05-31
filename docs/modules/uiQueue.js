export const DURATIONS = {
  success: 3000,
  info: 3000,
  error: 5000,
};

export function getDuration(type, overrideDuration) {
  if (typeof overrideDuration === 'number' && overrideDuration > 0) return overrideDuration;
  return DURATIONS[type] ?? DURATIONS.info;
}

export function selectActive(incoming) {
  return incoming;
}

export function scheduleHide(toast, setTimeout, onHide) {
  const duration = getDuration(toast.type, toast.duration);
  const tid = setTimeout(onHide, duration);
  return tid;
}
