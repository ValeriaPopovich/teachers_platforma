export function testResultError(score, max, enabled = true) {
  if (!enabled || score === '' || max === '') return '';
  if (+score > +max) return 'Баллы не могут быть больше максимума';
  return '';
}
