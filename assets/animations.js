/**
 * Heliactyl Animations
 * Hybrid: CSS/WAAPI for entrance (composited), anime.js for interactive
 *
 * - First visit: full entrance via CSS classes
 * - Subsequent: subtle entrance
 * - Hover: anime.js (cleanly cancellable)
 * - AFK counter pop: anime.js (conditional flow)
 * - Brand SVG morph: anime.js SVG morphTo (subtle loop)
 * - Respects prefers-reduced-motion (handled in CSS)
 */

(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const firstVisit = !sessionStorage.getItem('heliactyl_animated');
  const variant = firstVisit ? 'full' : 'subtle';
  const staggerStep = firstVisit ? 80 : 20;
  const staggerStart = firstVisit ? 200 : 30;

  const onReady = (fn) => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  };

  onReady(() => {
    if (!reduceMotion) {
      // 1. Sidebar nav: pure CSS via class (stagger via :nth-child)
      document.querySelectorAll('.nav-link').forEach(el => {
        el.classList.add(`animate-entrance-${variant}`);
      });

      // 2. Cards: CSS class + JS-driven stagger delay
      const cards = document.querySelectorAll(
        '.card, .bg-white.rounded-3xl, .bg-gray-200.rounded-2xl'
      );
      cards.forEach((el, i) => {
        el.style.animationDelay = `${staggerStart + i * staggerStep}ms`;
        el.classList.add(`animate-entrance-${variant}`);
      });

      // 3. Headers: CSS class + stagger delay
      const headers = document.querySelectorAll('h1, h2, h3');
      headers.forEach((el, i) => {
        el.style.animationDelay = `${(firstVisit ? 150 : 20) + i * (firstVisit ? 40 : 12)}ms`;
        el.classList.add(`animate-entrance-${variant}`);
      });

      if (firstVisit) {
        sessionStorage.setItem('heliactyl_animated', '1');
      }
    }

    attachInteractive();
  });

  /**
   * Interactive animations (anime.js)
   * - Button hover scale
   * - AFK counter pop on text change
   * - Brand SVG morph loop
   */
  function attachInteractive() {
    if (typeof anime === 'undefined') return;

    if (!reduceMotion) {
      const interactiveTargets = document.querySelectorAll(
        '.nav-link, button:not(.cf-turnstile), a[type="button"]'
      );
      interactiveTargets.forEach(attachHover);

          }

    // AFK Coin Counter pop
    const coinCounter = document.getElementById('arciogainedcoins');
    if (coinCounter && !reduceMotion) {
      const observer = new MutationObserver(() => {
        anime.remove(coinCounter);
        anime({
          targets: coinCounter,
          scale: [1.5, 1],
          color: ['#10b981', '#6b7280'],
          duration: 700,
          easing: 'easeOutElastic(1, .8)'
        });
      });
      observer.observe(coinCounter, {
        characterData: true,
        childList: true,
        subtree: true
      });
    }
  }

  function attachHover(el) {
    el.addEventListener('mouseenter', () => {
      anime.remove(el);
      anime({
        targets: el,
        scale: 1.02,
        duration: 200,
        easing: 'easeOutQuad'
      });
    });
    el.addEventListener('mouseleave', () => {
      anime.remove(el);
      anime({
        targets: el,
        scale: 1,
        duration: 250,
        easing: 'easeOutQuad'
      });
    });
    el.addEventListener('mousedown', () => {
      anime.remove(el);
      anime({
        targets: el,
        scale: 0.97,
        duration: 100,
        easing: 'easeOutQuad'
      });
    });
  }

})();
