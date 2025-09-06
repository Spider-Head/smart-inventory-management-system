// --- Global State ---
const scannedPIDs = new Set();
let currentScan = null;
let pendingProductData = null;
let pendingDecodedText = null;
let currentProductPrice = 0;
let availableQuantity = 0;
let allowCartUpdate = false;


const currentTransaction = {
  purchaser: { name: '', contact: '', email: '' },
  products: [] // {pid, name, price, quantity}
};

let isFormShrunk = false;

// --- State Reset Utility ---
// --- State Reset Utility ---
function resetPurchaseState(fullCart = false) {
  currentScan = null;
  currentProductPrice = 0;
  availableQuantity = 0;
  pendingProductData = null;
  pendingDecodedText = null;

  if (document.getElementById('purchase-product-name')) document.getElementById('purchase-product-name').value = '';
  if (document.getElementById('purchase-quantity')) document.getElementById('purchase-quantity').value = 1;

  // ✅ Clear purchaser form fields
  if (document.getElementById('buyer-name')) document.getElementById('buyer-name').value = '';
  if (document.getElementById('buyer-contact')) document.getElementById('buyer-contact').value = '';
  if (document.getElementById('buyer-email')) document.getElementById('buyer-email').value = '';

  if (document.getElementById('remaining-stock')) {
    document.getElementById('remaining-stock').textContent = "Remaining: --";
    document.getElementById('remaining-stock').style.color = "#666";
  }
  if (document.getElementById('final-total')) document.getElementById('final-total').textContent = '0';

  if (fullCart) {
    // ✅ Clear cart + purchaser object completely
    currentTransaction.products = [];
    currentTransaction.purchaser = { name: '', contact: '', email: '' };

    updateMultiProductListUI();
  }
}


// --- Utility Functions ---
function getCurrentDateTimeString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
}

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

function populatePurchaserFields() {
  document.getElementById('buyer-name').value = currentTransaction.purchaser.name || '';
  document.getElementById('buyer-contact').value = currentTransaction.purchaser.contact || '';
  document.getElementById('buyer-email').value = currentTransaction.purchaser.email || '';
}

function savePurchaserInfo() {
  currentTransaction.purchaser.name = document.getElementById('buyer-name').value;
  currentTransaction.purchaser.contact = document.getElementById('buyer-contact').value;
  currentTransaction.purchaser.email = document.getElementById('buyer-email').value;
}

// --- GSAP Animations ---
function shrinkFormToBall() {
  const form = document.getElementById('purchase-popup');
  if (!form) return;
  gsap.to(form, {
    duration: 0.6,
    scale: 0.2,
    borderRadius: "50%",
    x: window.innerWidth * 0.39,
    y: window.innerHeight * 0.36,
    opacity: 1,
    ease: "power3.inOut",
    onStart: () => { form.style.pointerEvents = 'none'; },
    onComplete: () => { 
      isFormShrunk = true;
      document.querySelector('.scanner-container').classList.remove('blurred');
      document.getElementById('purchase-popup-overlay').classList.remove('active');
      form.classList.add('ball-mode');
      form.style.pointerEvents = 'auto';
      form.addEventListener('click', handleBallClickOnce, { once: true });
    }
  });
}

function handleBallClickOnce(e) {
  e.stopPropagation();
  expandBallToForm();
}

function expandBallToForm() {
  const form = document.getElementById('purchase-popup');
  if (!form) return;
  gsap.to(form, {
    duration: 0.6,
    scale: 1,
    borderRadius: "16px",
    x: 0, y: 0,
    opacity: 1,
    ease: "power3.inOut",
    onStart: () => { form.style.pointerEvents = 'auto'; },
    onComplete: () => { 
      isFormShrunk = false; 
      form.classList.remove('ball-mode');
      form.removeEventListener('click', handleBallClickOnce, false);
    }
  });
  document.querySelector('.scanner-container').classList.remove('blurred');
}

// --- Cart Product Management, Cart UI ---
function addOrUpdateProduct(pid, name, price, quantity) {
  const idx = currentTransaction.products.findIndex(p => p.pid === pid);
  if (idx >= 0) {
    currentTransaction.products[idx].quantity = quantity;
    currentTransaction.products[idx].price = price;
  } else {
    currentTransaction.products.push({ pid, name, price, quantity });
  }
  updateMultiProductListUI();
}

function updateMultiProductListUI() {
  const container = document.getElementById('multi-product-list');
  if (!container) return;
  container.innerHTML = '';
  currentTransaction.products.forEach(prod => {
    const div = document.createElement('div');
    div.textContent = `${prod.name} | Qty: ${prod.quantity} | ₹${(prod.price*prod.quantity).toFixed(2)}`;
    div.style.padding = '4px 0';
    container.appendChild(div);
  });
}

// --- Add Another Product ---
function addAnotherProduct(event) {
  if (event) event.preventDefault();
  saveCurrentProductFromForm();
  savePurchaserInfo();
  shrinkFormToBall();
  // Next scanned product will be added by submitQuantity()
  console.log("Ready for next product scan.");
}

function saveCurrentProductFromForm() {
  if (!currentScan) {
    console.log('No current scan; skipping save to cart');
    return; // Prevent adding on invalid/no selection
  } // Guard: don't add anything if no valid scan!
  const name = document.getElementById("purchase-product-name").value;
  const qty = parseInt(document.getElementById("purchase-quantity").value) || 1;
  addOrUpdateProduct(currentScan, name, currentProductPrice, qty);
  updateMultiProductListUI();
}



// --- Scan Success Handler ---
function onScanSuccess(decodedText) {
  if (scannedPIDs.has(decodedText)) {
    // Duplicate product flow
    currentScan = decodedText;
    allowCartUpdate = false; // 🚫 block premature cart update
    fetch(`/inventory/product/${decodedText}/?dup=true`)
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          // Show product name + ID in popup
          document.getElementById("popup-description").textContent =
            `${data.name} (${data.pid}) is already scanned. Do you want to remove it?`;

          // Pre-fill form values (not yet added to cart!)
          document.getElementById("purchase-product-name").value = data.name;
          currentProductPrice = parseFloat(data.price);
          availableQuantity = data.quantity || 0;
          document.getElementById("purchase-quantity").value = 1;
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
    // New product flow
    pendingDecodedText = decodedText;
    allowCartUpdate = false; // 🚫 not until qty confirmed
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

// --- Duplicate Product: Open Form and Add to Cart if not already present ---
function openPurchaseForm() {
  togglePopup(false);
  allowCartUpdate = true; // ✅ user confirmed "Yes"
  const purchasePopup = document.getElementById("purchase-popup");
  purchasePopup.classList.add("active");
  document.getElementById("purchase-popup-overlay").classList.add("active");
  document.querySelector('.scanner-container').classList.add('blurred');
  document.getElementById("purchase-quantity").value = 1;
  if (isFormShrunk) expandBallToForm();
  populatePurchaserFields();
  updateMultiProductListUI();
  updateFinalTotal();
}


function closeDuplicatePopup() {
  allowCartUpdate = false; // 🚫 don’t add to cart
  togglePopup(false);
}

// --- Quantity Popup ---
function showQuantityPopup() {
  document.getElementById("quantity-popup").classList.add("active");
  document.getElementById("quantity-popup-overlay").classList.add("active");
  document.querySelector('.scanner-container').classList.add('blurred');
}
function hideQuantityPopup() {
  document.getElementById("quantity-popup").classList.remove("active");
  document.getElementById("quantity-popup-overlay").classList.remove("active");
  document.querySelector('.scanner-container').classList.remove('blurred');
  document.getElementById("quantity-input").value = 1;
}
function cancelQuantity() {
  pendingProductData = null;
  pendingDecodedText = null;
  hideQuantityPopup();
}

// --- Quantity Popup: Confirm New Product ---
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

        document.querySelector("#product-table-body").insertAdjacentHTML('afterbegin', createProductRow(data));
        const newRow = document.querySelector(`.table-row[data-id="${data.pid}"]`);
        if (newRow) {
          gsap.from(newRow, { opacity: 0, y: 20, duration: 0.6, ease: "power3.out" });
        }

        if (isFormShrunk) {
          // ✅ Directly add to cart
          addOrUpdateProduct(data.pid, data.name, parseFloat(data.price), qty);
          allowCartUpdate = true;
          populatePurchaserFields();
          updateMultiProductListUI();
        } else {
          // ✅ Fill purchase form for further edits
          currentScan = data.pid;
          currentProductPrice = parseFloat(data.price);
          availableQuantity = data.quantity;
          document.getElementById("purchase-quantity").value = qty;
          allowCartUpdate = true;
          updateFinalTotal();
        }
      } else {
        alert("Product not found");
      }
    })
    .catch(() => alert("Error adding product."));
}


// --- Final Total & Cart/Stock Synchronization ---
function updateFinalTotal() {
  const qtyInput = document.getElementById("purchase-quantity");
  const qty = parseInt(qtyInput.value) || 1;
  const discount = parseFloat(document.getElementById("purchase-discount").value) || 0;
  const tax = parseFloat(document.getElementById("purchase-tax").value) || 0;

  // ✅ Add/update only if explicitly allowed
  if (allowCartUpdate && currentScan && document.getElementById("purchase-popup").classList.contains("active")) {
    addOrUpdateProduct(
      currentScan,
      document.getElementById("purchase-product-name").value,
      currentProductPrice,
      qty
    );
  }

  let subtotal = currentTransaction.products.reduce((sum, p) => sum + p.quantity * p.price, 0);
  let discountAmt = subtotal * (discount / 100);
  let taxAmt = (subtotal - discountAmt) * (tax / 100);
  let finalTotal = subtotal - discountAmt + taxAmt;
  document.getElementById("final-total").textContent = finalTotal.toFixed(2);

  const remStockEl = document.getElementById("remaining-stock");
  let remaining = availableQuantity - qty;
  remStockEl.textContent = `Remaining: ${remaining}`;
  remStockEl.style.color = remaining < 0 ? "red" : "#28a745";
  document.getElementById("purchase-submit").disabled = (remaining < 0);
}



// --- Make Purchase ---
function makePurchase(e) {
  e.preventDefault();
  saveCurrentProductFromForm();
  savePurchaserInfo();
  if (!currentTransaction.products.length) {
    alert("No product(s) to purchase.");
    return;
  }

  fetch('/inventory/remove_multiple/', {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken')},
    body: JSON.stringify(currentTransaction)
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        alert('Transaction completed successfully!');
        resetPurchaseState(true);
        cancelPurchase();
      } else {
        alert(data.error || 'Failed to complete transaction.');
      }
    })
    .catch(() => alert('Server error. Please try again.'));
}

// --- CSRF ---
function getCookie(name) {
  let value = null;
  if (document.cookie && document.cookie !== '') {
    document.cookie.split(';').forEach(cookie => {
      let [key,val] = cookie.trim().split('=');
      if (key === name) value = decodeURIComponent(val);
    });
  }
  return value;
}

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
function cancelPurchase() {
  document.getElementById("purchase-popup").classList.remove("active");
  document.getElementById("purchase-popup-overlay").classList.remove("active");
  document.querySelector('.scanner-container').classList.remove('blurred');
  if (isFormShrunk) expandBallToForm();
  resetPurchaseState(true);
}

// --- Initialization ---
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
    .catch(() => {});
  new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }).render(onScanSuccess);
  animateTableRows();
});

function animateTableRows() {
  const rows = document.querySelectorAll('#product-table-body .table-row');
  if (!rows.length) return;
  gsap.from(rows, { opacity: 0, y: 15, stagger: 0.1, duration: 0.5, ease: 'power3.out' });
}
window.addEventListener("DOMContentLoaded", animateTableRows);


