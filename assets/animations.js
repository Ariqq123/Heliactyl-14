/**
 * Heliactyl Global Animations using Anime.js
 * First visit: full entrance animations
 * Subsequent pages: subtle, fast entrance
 */

document.addEventListener("DOMContentLoaded", () => {
  const firstVisit = !sessionStorage.getItem('heliactyl_animated');

  // Config: full vs subtle
  const cfg = firstVisit ? {
    nav:    { tx: -20, dur: 500, stagger: 40, start: 80 },
    card:   { ty: 30,  dur: 700, stagger: 80, start: 200 },
    header: { ty: -10, dur: 500, stagger: 40, start: 150 }
  } : {
    nav:    { tx: -6,  dur: 220, stagger: 12, start: 0 },
    card:   { ty: 8,   dur: 260, stagger: 20, start: 30 },
    header: { ty: -4,  dur: 220, stagger: 12, start: 20 }
  };

  const pinFinal = (el) => {
    el.style.opacity = '1';
    el.style.transform = '';
    el.dataset.entered = '1';
  };

  const attachHover = (el) => {
    el.addEventListener('mouseenter', () => {
      if (el.dataset.entered !== '1') return;
      anime.remove(el);
      anime({
        targets: el,
        scale: 1.02,
        duration: 250,
        easing: 'easeOutElastic(1, .8)',
        complete: () => { el.style.opacity = '1'; }
      });
    });
    el.addEventListener('mouseleave', () => {
      if (el.dataset.entered !== '1') return;
      anime.remove(el);
      anime({
        targets: el,
        scale: 1,
        duration: 350,
        easing: 'easeOutElastic(1, .8)',
        complete: () => { el.style.opacity = '1'; }
      });
    });
    el.addEventListener('mousedown', () => {
      if (el.dataset.entered !== '1') return;
      anime.remove(el);
      anime({
        targets: el,
        scale: 0.97,
        duration: 100,
        easing: 'easeOutQuad'
      });
    });
  };

  // 1. Sidebar Nav Items
  const navItems = document.querySelectorAll('.nav-link');
  if (navItems.length > 0) {
    anime({
      targets: navItems,
      translateX: [cfg.nav.tx, 0],
      opacity: [0, 1],
      delay: anime.stagger(cfg.nav.stagger, { start: cfg.nav.start }),
      easing: 'easeOutQuad',
      duration: cfg.nav.dur,
      complete: () => {
        navItems.forEach(el => { pinFinal(el); attachHover(el); });
      }
    });
  }

  // 2. Cards
  const cards = document.querySelectorAll('.card, .bg-white.rounded-3xl, .bg-gray-200.rounded-2xl');
  if (cards.length > 0) {
    anime({
      targets: cards,
      translateY: [cfg.card.ty, 0],
      opacity: [0, 1],
      delay: anime.stagger(cfg.card.stagger, { start: cfg.card.start }),
      easing: firstVisit ? 'easeOutQuint' : 'easeOutQuad',
      duration: cfg.card.dur,
      complete: () => { cards.forEach(pinFinal); }
    });
  }

  // 3. Headers
  const headers = document.querySelectorAll('h1, h2, h3');
  if (headers.length > 0) {
    anime({
      targets: headers,
      translateY: [cfg.header.ty, 0],
      opacity: [0, 1],
      delay: anime.stagger(cfg.header.stagger, { start: cfg.header.start }),
      easing: 'easeOutQuad',
      duration: cfg.header.dur,
      complete: () => { headers.forEach(pinFinal); }
    });
  }

  // 4. Hover for non-nav buttons
  const otherButtons = document.querySelectorAll('button:not(.nav-link), a[type="button"]:not(.nav-link)');
  otherButtons.forEach(el => {
    if (!el.closest('.card, .bg-white.rounded-3xl, .bg-gray-200.rounded-2xl')) {
      pinFinal(el);
    }
    attachHover(el);
  });

  // 5. AFK Coin Counter pop
  const coinCounter = document.getElementById('arciogainedcoins');
  if (coinCounter) {
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
    observer.observe(coinCounter, { characterData: true, childList: true, subtree: true });
  }

  if (firstVisit) {
    sessionStorage.setItem('heliactyl_animated', '1');
  }
});
