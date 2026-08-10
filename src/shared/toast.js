export function createToast(root = document) {
  let timer = 0;
  return function toast(message) {
    const element = root.querySelector('#toast');
    if (!element) return;
    clearTimeout(timer);
    element.textContent = message;
    element.classList.add('show');
    timer = setTimeout(() => element.classList.remove('show'), 2300);
  };
}
