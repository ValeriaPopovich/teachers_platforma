export function defaultHomeworkGrade(enabled, currentValue) {
  return enabled && (currentValue === '' || currentValue == null) ? '5' : currentValue;
}
