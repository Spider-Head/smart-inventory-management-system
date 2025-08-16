const scannedPIDs = new Set();
let currentScan = null;
let pendingProductData = null;
let pendingDecodedText = null;
let currentProductPrice = 0;
let availableQuantity = 0; // stock tracking

// 📌 Utility: format system date
function getCurrentDateTimeString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

// 📌 Create table row
function createProductRow(data) {
  return `
    <div class="table-row" role="row" data-id="${data.pid}">
      <div class="table-cell" role="cell" data-label="Product Name">${data.name}</div>
      <div class="table-cell" role="cell" data-label="PID">${data.pid}</div>
      <div class="table-cell" role="cell" data-label="Category">${data.category}</div>
      <div class="table-cell" role="cell" data-label="Added Date">${data.added_date}</div>
      <div class="table-cell" role="cell" data-label="Expiry Date">${data.expiry_date}</div>
      <div class="table-cell" role="cell" data-label="Price">₹ ${data.price}</div>
      <div class="table-cell" role="cell" data-label="Quantity">${data.quantity}</div>
    </div>
  `;
}

// 📌 Scan success handler
function onScanSuccess(decodedText) {
  if (scannedPIDs.has(decodedText)) {
    // Duplicate scan: show remove/purchase form popup
    currentScan = decodedText;
    fetch(`/inventory/product/${decodedText}/?dup=true`)
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          document.getElementById("popup-description").textContent =
            `${data.name} (${data.pid}) is already scanned. Do you want to remove it?`;
          document.getElementById("purchase-product-name").value = data.name;
          currentProductPrice = parseFloat(data.price);
          availableQuantity = data.quantity || 0;
          updateFinalTotal();
        }
        togglePopup(true);
      })
      .catch(() => {
        document.getElementById("popup-description").textContent =
          `Product (${decodedText}) is already scanned. Do you want to remove it?`;
        togglePopup(true);
      });

  } else {
    // New product scan: show quantity popup
    pendingDecodedText = decodedText;
    fetch(`/inventory/product/${decodedText}/?dup=false&preload=true`)
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          pendingProductData = data;
          showQuantityPopup();
        } else {
          alert("Product not found");
        }
      })
      .catch(() => alert("Error retrieving product."));
  }
}

// 📌 Show Enter Quantity Popup
function showQuantityPopup() {
  document.getElementById("quantity-popup").classList.add("active");
  document.getElementById("quantity-popup-overlay").classList.add("active");
  document.querySelector('.scanner-container').classList.add('blurred');
}

// 📌 Close Quantity Popup
function hideQuantityPopup() {
  document.getElementById("quantity-popup").classList.remove("active");
  document.getElementById("quantity-popup-overlay").classList.remove("active");
  document.querySelector('.scanner-container').classList.remove('blurred');
  document.getElementById("quantity-input").value = 1;
}

// 📌 Cancel entering quantity
function cancelQuantity() {
  pendingProductData = null;
  pendingDecodedText = null;
  hideQuantityPopup();
}

// 📌 Submit the chosen quantity
function submitQuantity() {
  const qty = parseInt(document.getElementById("quantity-input").value) || 1;
  hideQuantityPopup();

  fetch(`/inventory/product/${pendingDecodedText}/?dup=false&qty=${qty}`)
    .then(res => res.json())
    .then(data => {
      if (!data.error) {
        scannedPIDs.add(pendingDecodedText);
        data.added_date = getCurrentDateTimeString();
        data.quantity = qty;

        const rowHTML = createProductRow(data);
        document.querySelector("#product-table-body").insertAdjacentHTML('afterbegin', rowHTML);

        const newRow = document.querySelector(`.table-row[data-id="${data.pid}"]`);
        if (newRow) {
          gsap.from(newRow, { opacity: 0, y: 20, duration: 0.6, ease: "power3.out" });
        }
      } else {
        alert("Product not found");
      }
    })
    .catch(() => alert("Error adding product."));
}

function closeDuplicatePopup() {
  togglePopup(false);
  currentScan = null; // clear the stored PID
}


// 📌 Open purchase popup instead of immediate removal
function openPurchaseForm() {
  togglePopup(false);
  document.getElementById("purchase-popup").classList.add("active");
  document.getElementById("purchase-popup-overlay").classList.add("active");
  document.querySelector('.scanner-container').classList.add('blurred');
  document.getElementById("purchase-quantity").value = 1;
  updateFinalTotal();
}

// 📌 Cancel purchase
function cancelPurchase() {
  document.getElementById("purchase-popup").classList.remove("active");
  document.getElementById("purchase-popup-overlay").classList.remove("active");
  document.querySelector('.scanner-container').classList.remove('blurred');
}

// 📌 Update total amount & remaining stock
function updateFinalTotal() {
  const qty = parseInt(document.getElementById("purchase-quantity").value) || 1;
  const discount = parseFloat(document.getElementById("purchase-discount").value) || 0;
  const tax = parseFloat(document.getElementById("purchase-tax").value) || 0;

  let subtotal = qty * currentProductPrice;
  let discountAmt = subtotal * (discount / 100);
  let taxAmt = (subtotal - discountAmt) * (tax / 100);
  let finalTotal = subtotal - discountAmt + taxAmt;

  document.getElementById("final-total").textContent = finalTotal.toFixed(2);

  // Remaining stock logic
  const remStockEl = document.getElementById("remaining-stock");
  if (remStockEl) {
    const remaining = availableQuantity - qty;
    remStockEl.textContent = `Remaining: ${remaining}`;
    if (remaining < 0) {
      remStockEl.style.color = "red";
      document.getElementById("purchase-submit").disabled = true;
    } else {
      remStockEl.style.color = "#28a745";
      document.getElementById("purchase-submit").disabled = false;
    }
  }
}

// 📌 Make purchase & remove stock
function makePurchase(e) {
  e.preventDefault();
  const qty = parseInt(document.getElementById("purchase-quantity").value) || 1;

  fetch(`/inventory/remove/${currentScan}/`, {
    method: "POST",
    headers: { 'X-CSRFToken': getCookie('csrftoken') },
    body: JSON.stringify({
      purchaser: document.getElementById("buyer-name").value,
      contact: document.getElementById("buyer-contact").value,
      email: document.getElementById("buyer-email").value,
      quantity: qty,
      discount: document.getElementById("purchase-discount").value
    })
  })
    .then(res => res.json())
    .then(data => {
      const row = document.querySelector(`.table-row[data-id="${currentScan}"]`);
      if (data.quantity !== undefined) {
        if (data.quantity > 0) {
          if (row) {
            const qtyCell = row.querySelector('.table-cell[data-label="Quantity"]');
            if (qtyCell) qtyCell.textContent = data.quantity;
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
      console.error("Purchase error:", err);
      alert("Server error. Try again.");
    });

  cancelPurchase();
  currentScan = null;
}

// 📌 Get CSRF
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

// 📌 Toggle popup
function togglePopup(show) {
  const popup = document.getElementById('popup');
  const overlay = document.getElementById('popup-overlay');
  const background = document.querySelector('.scanner-container');
  if (show) {
    popup.classList.add('active');
    overlay.classList.add('active');
    background.classList.add('blurred');
  } else {
    popup.classList.remove('active');
    overlay.classList.remove('active');
    background.classList.remove('blurred');
  }
}

// 📌 Load stock on page load
window.addEventListener("DOMContentLoaded", () => {
  fetch("/inventory/warehouse/")
    .then(res => res.json())
    .then(data => {
      data.forEach(item => {
        scannedPIDs.add(item.pid);
        if (!item.quantity) item.quantity = 1;
        const rowHTML = createProductRow(item);
        document.querySelector("#product-table-body").insertAdjacentHTML('beforeend', rowHTML);
      });
    })
    .catch(err => console.error("Failed to load initial data:", err));
});

// 📌 QR Scanner init
new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }).render(onScanSuccess);

// 📌 Animate UI
document.addEventListener('DOMContentLoaded', () => {
  gsap.from('.scanner-card', { y: 40, opacity: 0, stagger: 0.15, duration: 0.7, ease: "power3.out" });
  gsap.from('.table-container', { y: 40, opacity: 0, duration: 0.7, delay: 0.5, ease: "power3.out" });
});

function animateTableRows() {
  const rows = document.querySelectorAll('#product-table-body .table-row');
  if (!rows.length) return;
  gsap.from(rows, { opacity: 0, y: 15, stagger: 0.1, duration: 0.5, ease: 'power3.out' });
}
window.addEventListener("DOMContentLoaded", animateTableRows);
