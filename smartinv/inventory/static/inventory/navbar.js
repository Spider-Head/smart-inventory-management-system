// Get references once for efficiency
const menu = document.querySelector('.mobile-menu');
const checkbox = document.getElementById('menu-toggle');
const body = document.body;

// Optional: Use checkbox change event to control menu open/close and animations
checkbox.addEventListener('change', () => {
  if (checkbox.checked) {
    // Open menu
    menu.classList.add('show');

    gsap.fromTo(
      menu,
      { x: 300, opacity: 0, rotateY: 60 },
      { x: 0, opacity: 1, rotateY: 0, duration: 0.7, ease: 'power4.out' }
    );

    body.classList.add('menu-open');
  } else {
    // Close menu
    gsap.to(menu, {
      x: 300,
      opacity: 0,
      rotateY: 60,
      duration: 0.5,
      ease: 'power4.in',
      onComplete: () => {
        menu.classList.remove('show');
      },
    });

    body.classList.remove('menu-open');
  }
});

// This toggleMenu function can be called from your hamburger label's onclick if needed.
// Alternatively, rely on native checkbox toggle by clicking label and the above event listener.
function toggleMenu() {
  // Toggle checkbox checked state, which triggers the event listener above
  checkbox.checked = !checkbox.checked;
}

// Animate navbar on load
window.onload = () => {
  gsap.from('.navbar', {
    y: -80,
    opacity: 0,
    duration: 1,
    ease: 'power3.out',
  });
};

// Accessibility: close menu on Escape key press
document.addEventListener('keydown', (evt) => {
  if (evt.key === 'Escape') {
    if (checkbox.checked) {
      checkbox.checked = false;
      // The 'change' event on checkbox will handle closing animation and class removal
    }
  }
});
