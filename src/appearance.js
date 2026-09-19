// App-local appearance preference; leaves the shared kit's settings intact.
const key = 'project-planner:appearance';
export function getAppearance() {
  try { return localStorage.getItem(key) === 'hud' ? 'hud' : 'motion'; } catch { return 'motion'; }
}
export function setAppearance(value) {
  const look = value === 'hud' ? 'hud' : 'motion';
  try { localStorage.setItem(key, look); } catch { /* Session-only when storage is unavailable. */ }
  document.documentElement.dataset.plannerLook = look;
  window.dispatchEvent(new CustomEvent('planner:appearance', { detail: look }));
}
export function initAppearance() {
  document.documentElement.dataset.plannerLook = getAppearance();
  window.addEventListener('storage', event => {
    if (event.key === key) {
      document.documentElement.dataset.plannerLook = getAppearance();
      window.dispatchEvent(new CustomEvent('planner:appearance', { detail: getAppearance() }));
    }
  });
}
