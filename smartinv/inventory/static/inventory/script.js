const scannedPIDs = new Set();
let currentScan = null;

function onScanSuccess(decodedText) {
    if (scannedPIDs.has(decodedText)) {
        currentScan = decodedText;
        document.getElementById('popup').style.display = 'block';
    } else {
        // ✅ Use GET param to signal non-duplicate scan
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
                            <td>${data.quantity}</td>
                        </tr>`;
                    document.querySelector("#product-table tbody").insertAdjacentHTML('beforeend', row);
                } else {
                    alert("Product not found");
                }
            });
    }
}

function confirmRemove(confirm) {
    document.getElementById('popup').style.display = 'none';

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
                    // ✅ Update quantity shown in table
                    const quantityCell = row.querySelector("td:last-child");
                    quantityCell.textContent = data.quantity;
                } else {
                    // ✅ Quantity became zero: remove row from table
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

// Initialize QR Scanner
new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }).render(onScanSuccess);


window.addEventListener("DOMContentLoaded", () => {
    fetch("/inventory/warehouse/")
        .then(res => res.json())
        .then(data => {
            data.forEach(item => {
                scannedPIDs.add(item.pid);  // So it doesn't re-scan & duplicate
                const row = `
                    <tr data-id="${item.pid}">
                        <td>${item.name}</td>
                        <td>${item.pid}</td>
                        <td>${item.category}</td>
                        <td>${item.added_date}</td>
                        <td>${item.expiry_date}</td>
                        <td>${item.quantity}</td>
                    </tr>`;
                document.querySelector("#product-table tbody").insertAdjacentHTML('beforeend', row);
            });
        });
});
