/**
 * Heliactyl Global Animations using Anime.js
 * Loads deferred so it runs after DOM is ready
 */

document.addEventListener("DOMContentLoaded", () => {
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
      translateX: [-20, 0],
      opacity: [0, 1],
      delay: anime.stagger(40, { start: 80 }),
      easing: 'easeOutQuad',
      duration: 500,
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
      translateY: [30, 0],
      opacity: [0, 1],
      delay: anime.stagger(80, { start: 200 }),
      easing: 'easeOutQuint',
      duration: 700,
      complete: () => { cards.forEach(pinFinal); }
    });
  }

  // 3. Headers
  const headers = document.querySelectorAll('h1, h2, h3');
  if (headers.length > 0) {
    anime({
      targets: headers,
      translateY: [-10, 0],
      opacity: [0, 1],
      delay: anime.stagger(40, { start: 150 }),
      easing: 'easeOutQuad',
      duration: 500,
      complete: () => { headers.forEach(pinFinal); }
    });
  }

  // 4. Hover for non-nav buttons (exclude nav-links to prevent selector bleed)
  const otherButtons = document.querySelectorAll('button:not(.nav-link), a[type="button"]:not(.nav-link)');
  otherButtons.forEach(el => { 
    // Only attach if it isn't part of the card entrance tracking
    if (!el.closest('.card, .bg-white.rounded-3xl, .bg-gray-200.rounded-2xl')) {
      pinFinal(el); 
    }
    attachHover(el); 
  });

  // 5. AFK Coin Counter pop
  const coinCounter = document.getElementById('arciogainedcoins');
  if (coinCounter) {
    const observer = new MutationObserver(() => {
      anime.remove(coinCounter); // Prevent stacking glitch on rapid updates
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
});
