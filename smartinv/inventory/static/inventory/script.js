const scannedPIDs = new Set();
let currentScan = null;

// Utility function to create a data row markup for card-style table rows
function createProductRow(data) {
  return `
    <div class="table-row" role="row" data-id="${data.pid}">
      <div class="table-cell" role="cell" data-label="Product Name">${data.name}</div>
      <div class="table-cell" role="cell" data-label="PID">${data.pid}</div>
      <div class="table-cell" role="cell" data-label="Category">${data.category}</div>
      <div class="table-cell" role="cell" data-label="Added Date">${data.added_date}</div>
      <div class="table-cell" role="cell" data-label="Expiry Date">${data.expiry_date}</div>
      <div class="table-cell" role="cell" data-label="Price">₹ ${data.price}</div>
    </div>
  `;
}

// Handle scan success
function onScanSuccess(decodedText) {
  if (scannedPIDs.has(decodedText)) {
    currentScan = decodedText;
    togglePopup(true);
  } else {
    fetch(`/inventory/product/${decodedText}/?dup=false`)
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          scannedPIDs.add(decodedText);
          const rowHTML = createProductRow(data);
          // Insert new product row at the top of #product-table-body
          document.querySelector("#product-table-body").insertAdjacentHTML('afterbegin', rowHTML);

          // Optional: Animate newly added row with GSAP
          const newRow = document.querySelector(`.table-row[data-id="${data.pid}"]`);
          if (newRow) {
            gsap.from(newRow, {
              opacity: 0,
              y: 20,
              duration: 0.6,
              ease: "power3.out"
            });
          }
        } else {
          alert("Product not found");
        }
      })
      .catch(() => alert("Error retrieving product."));
  }
}

// Handle popup confirmation
function confirmRemove(confirm) {
  togglePopup(false);

  if (confirm && currentScan) {
    fetch(`/inventory/remove/${currentScan}/`, {
      method: "POST",
      headers: {
        'X-CSRFToken': getCookie('csrftoken'),
      },
    })
      .then(res => res.json())
      .then(data => {
        const row = document.querySelector(`.table-row[data-id="${currentScan}"]`);
        if (data.quantity !== undefined) {
          if (data.quantity > 0) {
            // Update the last cell (Price) to show quantity or price accordingly
            if (row) {
              const priceCell = row.querySelector('.table-cell[data-label="Price"]');
              if (priceCell) priceCell.textContent = `₹ ${data.quantity}`;
            }
          } else {
            if (row) row.remove();
            scannedPIDs.delete(currentScan);
          }
        } else {
          alert(data.error || "Unexpected error");
        }
      })
      .catch(err => {
        console.error("Removal error:", err);
        alert("Server error. Try again.");
      });
  }

  currentScan = null;
}

// Get CSRF token from cookie
function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    for (let cookie of document.cookie.split(';')) {
      const trimmed = cookie.trim();
      if (trimmed.startsWith(name + '=')) {
        cookieValue = decodeURIComponent(trimmed.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

// Show or hide popup and apply blur effect
function togglePopup(show) {
  const popup = document.getElementById('popup');
  const overlay = document.getElementById('popup-overlay'); // use correct ID
  const background = document.querySelector('.scanner-container');

  if (show) {
    popup.classList.add('active');
    overlay.classList.add('active'); // show the overlay
    background.classList.add('blurred');
  } else {
    popup.classList.remove('active');
    overlay.classList.remove('active'); // hide the overlay
    background.classList.remove('blurred');
  }
}

// Load already scanned products on page load
window.addEventListener("DOMContentLoaded", () => {
  fetch("/inventory/warehouse/")
    .then(res => res.json())
    .then(data => {
      data.forEach(item => {
        scannedPIDs.add(item.pid);
        const rowHTML = createProductRow(item);
        // Append old items at the end to preserve order
        document.querySelector("#product-table-body").insertAdjacentHTML('beforeend', rowHTML);
      });
    })
    .catch(err => console.error("Failed to load initial data:", err));
});

// Initialize QR scanner
new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }).render(onScanSuccess);

// Animate scanner card and table container on page load using GSAP
document.addEventListener('DOMContentLoaded', () => {
  gsap.from('.scanner-card', {
    y: 40,
    opacity: 0,
    stagger: 0.15,
    duration: 0.7,
    ease: "power3.out"
  });

  gsap.from('.table-container', {
    y: 40,
    opacity: 0,
    duration: 0.7,
    delay: 0.5,
    ease: "power3.out"
  });
});

function animateTableRows() {
  const rows = document.querySelectorAll('#product-table-body .table-row');
  if (!rows.length) return;
  
  gsap.from(rows, {
    opacity: 0,
    y: 15,
    stagger: 0.1,
    duration: 0.5,
    ease: 'power3.out'
  });
}

// Call this after initial data load and after new inserts
window.addEventListener("DOMContentLoaded", () => {
  animateTableRows();
});

