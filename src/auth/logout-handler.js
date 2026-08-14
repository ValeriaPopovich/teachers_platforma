export function bindLogoutHandler(document, onLogout) {
  document.addEventListener('click', (event) => {
    if (event.target?.closest?.('#logoutBtn')) onLogout();
  });
}
