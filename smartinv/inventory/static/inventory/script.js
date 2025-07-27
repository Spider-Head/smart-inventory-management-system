const scannedPIDs = new Set();
let currentScan = null;

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
                    const row = `
                        <tr data-id="${data.pid}">
                            <td>${data.name}</td>
                            <td>${data.pid}</td>
                            <td>${data.category}</td>
                            <td>${data.added_date}</td>
                            <td>${data.expiry_date}</td>
                            <td>₹ ${data.price}</td>
                        </tr>`;
                    document.querySelector("#product-table tbody").insertAdjacentHTML('beforeend', row);
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
            const row = document.querySelector(`tr[data-id="${currentScan}"]`);
            if (data.quantity !== undefined) {
                if (data.quantity > 0) {
                    const quantityCell = row.querySelector("td:last-child");
                    quantityCell.textContent = `₹ ${data.quantity}`;
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
                const row = `
                    <tr data-id="${item.pid}">
                        <td>${item.name}</td>
                        <td>${item.pid}</td>
                        <td>${item.category}</td>
                        <td>${item.added_date}</td>
                        <td>${item.expiry_date}</td>
                        <td>₹ ${item.price}</td>
                    </tr>`;
                document.querySelector("#product-table tbody").insertAdjacentHTML('beforeend', row);
            });
        })
        .catch(err => console.error("Failed to load initial data:", err));
});

// Initialize QR scanner
new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }).render(onScanSuccess);
