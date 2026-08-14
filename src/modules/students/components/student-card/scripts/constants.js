export const STUDENT_PAYMENT_BADGE_VARIANTS = Object.freeze({
  empty: 'neutral',
  paid: 'success',
  partial: 'warning',
  debt: 'danger',
});

export const STUDENT_CARD_MENU_ITEMS = Object.freeze([
  { value: 'edit', label: 'Редактировать' },
  { value: 'payment', label: 'Внести оплату' },
  { value: 'delete', label: 'Удалить', danger: true },
]);
