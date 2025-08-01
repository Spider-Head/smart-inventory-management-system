document.addEventListener('DOMContentLoaded', () => {
  // Animate cards on page load with fade, scale and blur effect
  gsap.from('.dashboard-card', {
    y: 36,
    opacity: 0,
    scale: 0.92,
    filter: 'blur(12px)',
    duration: 0.6,
    stagger: 0.08,
    ease: 'power2.out',
  });

  // Select all dashboard cards
  const cards = document.querySelectorAll('.dashboard-card');

  cards.forEach(card => {
    const btn = card.querySelector('.expand-btn');
    const header = card.querySelector('.dashboard-card-header');
    const content = card.querySelector('.dashboard-card-content');

    // Initially collapse all card contents
    gsap.set(content, { height: 0, opacity: 0, clearProps: 'all' });

    let isAnimating = false; // to prevent toggle spam while animating

    // Toggle card expansion/collapse with animation and accessibility
    const toggleCard = () => {
      if (isAnimating) return;

      isAnimating = true;

      const isExpanded = card.classList.toggle('expanded');
      // Update aria-expanded for accessibility
      card.setAttribute('aria-expanded', isExpanded);

      if (isExpanded) {
        // Expand animation: animate height & fade in content
        gsap.set(content, { opacity: 1, height: 'auto' });
        const contentHeight = content.scrollHeight;

        gsap.fromTo(
          content,
          { height: 0, opacity: 0 },
          {
            height: contentHeight,
            opacity: 1,
            duration: 0.5,
            ease: 'power3.out',
            clearProps: 'height',
            onComplete: () => {
              isAnimating = false;
            },
          }
        );
      } else {
        // Collapse animation: animate height & fade out content
        gsap.to(content, {
          height: 0,
          opacity: 0,
          duration: 0.35,
          ease: 'power2.in',
          onComplete: () => {
            isAnimating = false;
          },
        });
      }
    };

    // Button click toggles card expansion without triggering header click
    btn.addEventListener('click', e => {
      e.stopPropagation();
      toggleCard();
    });

    // Header click toggles card expansion/collapse
    header.addEventListener('click', toggleCard);

    // Keyboard accessibility: toggle on Enter or Space keypress
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleCard();
      }
    });
  });
});

// After DOMContentLoaded and gsap animation on cards...
function animateProgressBars() {
  document.querySelectorAll('.progress-bar').forEach(bar => {
    const quantity = parseInt(bar.getAttribute('data-quantity'), 10) || 0;
    // Assume 100 is 'maximum' for visual; adjust as needed!
    const width = Math.min(100, (quantity / 25) * 100); // If 25 = critical stock, change as you wish
    gsap.to(bar, {
      width: width + '%',
      duration: 1.1,
      ease: 'expo.out',
      delay: Math.random() * 0.15
    });
  });
}

animateProgressBars();

document.querySelectorAll('.low-stock-li').forEach(li => {
  const mainRow = li.querySelector('.li-main-row');
  const details = li.querySelector('.li-details-content');
  const btn = li.querySelector('.expand-li-btn');

  gsap.set(details, { height: 0, opacity: 0 });

  let expanded = false;
  function toggleDetails() {
    expanded = !expanded;
    li.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    li.classList.toggle('expanded', expanded);
    if (expanded) {
      gsap.to(details, {
        height: details.scrollHeight,
        opacity: 1,
        duration: 0.36,
        ease: "power2.out",
        onComplete: () => gsap.set(details, { height: 'auto' })
      });
    } else {
      gsap.to(details, {
        height: 0,
        opacity: 0,
        duration: 0.22,
        ease: "power2.in"
      });
    }
  }

  mainRow.addEventListener('click', toggleDetails);
  btn.addEventListener('click', e => { e.stopPropagation(); toggleDetails(); });
  li.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleDetails();
    }
  });
});




// Register GSAP
gsap.registerPlugin(ScrollToPlugin);

document.addEventListener('DOMContentLoaded', () => {
  const wrapper = document.querySelector('.carousel-wrapper');
  const track = document.querySelector('.carousel-track');
  const cards = gsap.utils.toArray('.insight-card');

  if (!wrapper || !track || cards.length === 0) return;

  // Variables to track active card and update active class
  let activeIndex = 0;

  // Function to update active card based on scroll position
  function updateActiveCard() {
    const scrollLeft = wrapper.scrollLeft;
    const wrapperCenter = wrapper.offsetWidth / 2;

    let closestIndex = 0;
    let closestDistance = Number.MAX_VALUE;

    cards.forEach((card, i) => {
      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      const distance = Math.abs(cardCenter - (scrollLeft + wrapperCenter));
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = i;
      }
    });

    if (closestIndex !== activeIndex) {
      cards[activeIndex].classList.remove('active');
      cards[closestIndex].classList.add('active');
      activeIndex = closestIndex;
    }
  }

  // Initialize first card as active
  cards[0].classList.add('active');

  // Animate scale and opacity for all cards continuously depending on distance from center
  function animateCards() {
    const scrollLeft = wrapper.scrollLeft;
    const wrapperCenter = wrapper.offsetWidth / 2;

    cards.forEach(card => {
      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      const distToCenter = Math.abs(cardCenter - (scrollLeft + wrapperCenter));
      // Closer to center: scale 1.05, opacity 1; farther: scale down and fade
      const scale = gsap.utils.clamp(0.85, 1.05, 1.05 - distToCenter / 800);
      const opacity = gsap.utils.clamp(0.5, 1, 1 - distToCenter / 600);

      gsap.to(card, { scale, opacity, duration: 0.3, ease: 'power2.out' });
    });
  }

  // On scroll update active card & animation
  wrapper.addEventListener('scroll', () => {
    updateActiveCard();
    animateCards();
  });

  // Optional: smooth scrolling to card on click
  cards.forEach((card, i) => {
    card.addEventListener('click', () => {
      const offsetLeft = card.offsetLeft - (wrapper.offsetWidth - card.offsetWidth) / 2;
      gsap.to(wrapper, { scrollTo: { x: offsetLeft }, duration: 0.7, ease: 'power2.out' });
    });
  });

  // Trigger initial animation state (in case no scroll yet)
  updateActiveCard();
  animateCards();
});


document.addEventListener('DOMContentLoaded', function () {
  if (!chartData) return;

  // Define glossy gradients and vivid colors for each category
  const colors = [
    'linear-gradient(180deg, #a3e9ff 0%, #2397f5 85%, #0e3148 100%)',
    'linear-gradient(180deg, #ffe7b3 0%, #ffbe57 85%, #8a6e16 100%)',
    'linear-gradient(180deg, #f6b2e1 0%, #cb4b97 90%, #5a3053 100%)',
    'linear-gradient(180deg, #afffdc 0%, #48d296 85%, #0b5142 100%)',
    '#75aaff'
  ];

  // fallback to solid colors as Plotly bar colors, or use patterns
  const fillColors = [
    'rgba(55,183,238,0.92)',
    'rgba(255,196,77,0.93)',
    'rgba(204,82,152,0.93)',
    'rgba(54,221,171,0.93)',
    'rgba(55,180,255,0.93)',
  ];

  const borderColors = [
    '#2478c8', '#b39032', '#84276e', '#197e64', '#2256a8'
  ];

  // For each category, build a trace
  const traces = chartData.categories.map((cat, i) => ({
    name: cat,
    x: chartData.dates,
    y: chartData.quantities[cat],
    type: 'bar',
    marker: {
      color: fillColors[i % fillColors.length],
      line: {
        color: borderColors[i % borderColors.length],
        width: 4.5
      },
      // simulated 3D glass effect
      opacity: 0.95,
      pattern: { shape: "/", bgcolor: "rgba(255,255,255,0.05)", fgcolor: "rgba(255,255,255,0.11)", size: 6 }
    },
    hoverlabel: {
      bgcolor: "#121429",
      bordercolor: fillColors[i % fillColors.length],
      font: { color: "#fff", size: 16 }
    }
  }));

  Plotly.newPlot('consumptionChart', traces, {
    barmode: 'group',
    bargap: 0.21,
    bargroupgap: 0.08,
    title: {
      text: 'Daily Consumption by Category',
      font: {
        size: 27,
        color: "#226",
        family: "Montserrat,sans-serif"
      }
    },
    xaxis: {
      title: 'Date',
      tickangle: -35,      // Angle the labels to prevent collide
      automargin: true,    // Let it auto-pad if needed
      tickfont: { size: 15 }
    },
    margin: { l: 60, r: 30, t: 60, b: 95 },  // More margin at bottom for dates/legend

    yaxis: {
      title: 'Quantity Removed',
      tickfont: { size: 17, color: "#176" },
      gridcolor: "rgba(22,66,144,0.11)"
    },
    plot_bgcolor: 'rgba(236,246,255,0.96)',
    paper_bgcolor: 'rgba(236,246,255,0.0)',

    // Make bars glossy via gradients + shadows
    // Plotly doesn't support pure CSS gradients, but you can simulate by using patterns and opacities
    margin: { l: 64, r: 36, b: 84, t: 90, pad: 8 },
    legend: {
      orientation: "h",
      y: 1.14,    // place above chart (1.0 is top edge)
      xanchor: "center",
      x: 0.5,
      font: { size: 15 }
    },
    dragmode: 'pan', // Allow interactive drag/zoom!
    hovermode: 'x unified',
  }, {
    responsive: true,
    displayModeBar: true,
    displaylogo: false,
    modeBar: { remove: ["toImage", "sendDataToCloud"] }
  });

  // Animate entrance for premium feel
  Plotly.animate('consumptionChart',
    { data: traces },
    { transition: { duration: 880, easing: 'cubic-in-out' }, frame: { duration: 640, redraw: true } }
  );
});

document.addEventListener('DOMContentLoaded', () => {
  const reorderPopup = document.getElementById('reorder-popup');
  const reorderOverlay = document.getElementById('reorder-popup-overlay');
  const reorderForm = document.getElementById('reorder-form');

  let currentUnitPrice = 0;

  function bindQtyButtons() {
    // Remove existing to avoid multiple bindings
    document.getElementById('qty-inc').replaceWith(document.getElementById('qty-inc').cloneNode(true));
    document.getElementById('qty-dec').replaceWith(document.getElementById('qty-dec').cloneNode(true));
    
    document.getElementById('qty-inc').addEventListener('click', () => {
      const qtyInput = reorderForm.elements['quantity'];
      qtyInput.value = Number(qtyInput.value) + 1;
      updatePrice();
    });

    document.getElementById('qty-dec').addEventListener('click', () => {
      const qtyInput = reorderForm.elements['quantity'];
      if (qtyInput.value > 1) {
        qtyInput.value = Number(qtyInput.value) - 1;
        updatePrice();
      }
    });

    reorderForm.elements['quantity'].addEventListener('input', () => {
      const qtyInput = reorderForm.elements['quantity'];
      if (qtyInput.value < 1 || isNaN(qtyInput.value)) {
        qtyInput.value = 1;
      }
      updatePrice();
    });
  }
  
  function updatePrice() {
    const qty = parseInt(reorderForm.elements['quantity'].value) || 1;
    reorderForm.elements['price'].value = `₹ ${ (qty * currentUnitPrice).toFixed(2) }`;
  }

  function openPopup(data) {
    reorderPopup.classList.add('active');
    reorderOverlay.classList.add('active');
    reorderPopup.setAttribute('aria-hidden', 'false');
    reorderPopup.focus();

    reorderForm.elements['product'].value = data.product;
    reorderForm.elements['quantity'].value = data.qty || 1;
    reorderForm.elements['supplier'].value = data.supplier;
    reorderForm.elements['email'].value = data.email;
    currentUnitPrice = parseFloat(data.price) || 0;
    updatePrice();
  }

  function closePopup() {
    reorderPopup.classList.remove('active');
    reorderOverlay.classList.remove('active');
    reorderPopup.setAttribute('aria-hidden', 'true');
  }

  // Attach one submit handler
  if (reorderForm._handlerAdded !== true) {
    reorderForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = {
        product: reorderForm.elements['product'].value,
        qty: reorderForm.elements['quantity'].value,
        price: reorderForm.elements['price'].value,
        supplier: reorderForm.elements['supplier'].value,
        email: reorderForm.elements['email'].value
      };

      // Disable submit button to prevent duplicates
      reorderForm.querySelector('.modal-send').disabled = true;

      try {
        const response = await fetch('/inventory/reorder/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
          },
          body: JSON.stringify(formData)
        });
        const result = await response.json();

        if (result.success) {
          alert('Reorder email sent successfully!');
        } else {
          alert(result.error || 'Failed to send reorder email.');
        }
      } catch {
        alert('Error sending reorder email.');
      } finally {
        reorderForm.querySelector('.modal-send').disabled = false;
        closePopup();
      }
    });
    reorderForm._handlerAdded = true;
  }

  // Bind qty buttons on load
  bindQtyButtons();

  document.querySelectorAll('.reorder-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      openPopup({
        product: btn.dataset.product,
        qty: Number(btn.dataset.defaultqty) || 1,
        price: btn.dataset.price,
        supplier: btn.dataset.supplier,
        email: btn.dataset.email
      });
    });
  });

  reorderOverlay.addEventListener('click', closePopup);
  document.querySelector('.modal-cancel').addEventListener('click', closePopup);


  function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
      const cookies = document.cookie.split(';');
      for (let cookie of cookies) {
        if (cookie.trim().startsWith(name + '=')) {
          cookieValue = decodeURIComponent(cookie.trim().substring(name.length + 1));
          break;
        }
      }
    }
    return cookieValue;
  }
});
document.addEventListener('DOMContentLoaded', () => {
  const reorderPopup = document.getElementById('reorder-popup');
  const reorderOverlay = document.getElementById('reorder-popup-overlay');
  const reorderForm = document.getElementById('reorder-form');
  let currentUnitPrice = 0;

  // Helper for CSRF if needed
  function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
      for (let cookie of document.cookie.split(';')) {
        if (cookie.trim().startsWith(name + '=')) {
          cookieValue = decodeURIComponent(cookie.trim().substring(name.length + 1));
          break;
        }
      }
    }
    return cookieValue;
  }

  // Show modal with pre-filled data
  function openPopup(data) {
    reorderPopup.style.display = 'block';
    reorderOverlay.style.display = 'block';
    reorderPopup.setAttribute('aria-hidden', 'false');
    reorderForm.elements['product'].value = data.product;
    reorderForm.elements['quantity'].value = data.qty || 1;
    reorderForm.elements['supplier'].value = data.supplier;
    reorderForm.elements['email'].value = data.email;
    currentUnitPrice = parseFloat(data.price) || 0;
    updatePrice();
  }

  function closePopup() {
    reorderPopup.style.display = 'none';
    reorderOverlay.style.display = 'none';
    reorderPopup.setAttribute('aria-hidden', 'true');
  }

  // Price updates on qty
  function updatePrice() {
    const qty = parseInt(reorderForm.elements['quantity'].value) || 1;
    reorderForm.elements['price'].value = `₹ ${(qty * currentUnitPrice).toFixed(2)}`;
  }

  // Bind to reorder-btns
  document.querySelectorAll('.reorder-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      openPopup({
        product: btn.dataset.product,
        qty: Number(btn.dataset.defaultqty) || 1,
        price: btn.dataset.price,
        supplier: btn.dataset.supplier,
        email: btn.dataset.email
      });
    });
  });

  // Bind increment/decrement qty
  document.getElementById('qty-inc').addEventListener('click', function() {
    let val = parseInt(reorderForm.elements['quantity'].value) || 1;
    reorderForm.elements['quantity'].value = val + 1;
    updatePrice();
  });
  document.getElementById('qty-dec').addEventListener('click', function() {
    let val = parseInt(reorderForm.elements['quantity'].value) || 1;
    if (val > 1) reorderForm.elements['quantity'].value = val - 1;
    updatePrice();
  });
  reorderForm.elements['quantity'].addEventListener('input', updatePrice);

  // Modal close
  document.querySelector('.modal-cancel').addEventListener('click', closePopup);
  reorderOverlay.addEventListener('click', closePopup);

  // Submit handler (replace with your backend AJAX as needed)
  reorderForm.addEventListener('submit', function(e) {
    e.preventDefault();
    // Optionally, implement your reorder POST/email AJAX here
    closePopup();
    alert('Reorder request sent!'); // Placeholder
  });
});
