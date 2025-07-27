gsap.registerPlugin(ScrollTrigger);

// Enhanced hero fade/float animation
gsap.from(".hero-content", {
  duration: 1.3,
  y: 60,
  opacity: 0,
  ease: "power4.out"
});
gsap.from(".hero-3d-img", {
  duration: 1.7,
  scale: 0.75,
  opacity: 0,
  rotateY: 40,
  ease: "expo.out",
  delay: 0.3
});
gsap.from(".hero-gradient-text", {
  duration: 1.25,
  opacity: 0,
  y: 35,
  delay: 0.7
});
gsap.from(".hero-text p, .cta-btn", {
  duration: 1.2,
  opacity: 0,
  y: 32,
  ease: "power2.out",
  delay: 1
});


// Section fade/stagger
gsap.utils.toArray("section").forEach((section, i) => {
  gsap.from(section, {
    scrollTrigger: {
      trigger: section,
      start: "top 85%",
      toggleActions: "play none none none"
    },
    opacity: 0,
    y: 90,
    duration: 1,
    ease: "power4.out",
    delay: 0.2 * i
  });
});

// Service cards 3D float and stagger in view
gsap.utils.toArray(".card").forEach((card, i) => {
  gsap.from(card, {
    scrollTrigger: {
      trigger: card,
      start: "top 92%",
      toggleActions: "play none none none"
    },
    y: 80,
    opacity: 0,
    rotateY: 30,
    duration: 0.89,
    delay: i * 0.15,
    ease: "power2.out"
  });
});

// Slick carousel init
$(document).ready(function(){
  $('.carousel').slick({
    centerMode: true,
    centerPadding: '40px',
    slidesToShow: 3,
    autoplay: true,
    autoplaySpeed: 3300,
    speed: 900,
    arrows: false,
    dots: true,
    responsive: [
      {
        breakpoint: 900,
        settings: {
          slidesToShow: 1.2,
          centerPadding: '6vw'
        }
      }
    ]
  });
});