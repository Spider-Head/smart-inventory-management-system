fetch('/inventory/stock_movements/')
    .then(res => res.json())
    .then(data => {
        const tbody = document.getElementById('movements-body');
        data.forEach(move => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${move.order_id}</td>
                <td>${move.timestamp}</td>
                <td>${move.product}</td>
                <td>${move.quantity}</td>
                <td class="action-${move.action.replace(' ', '')}">${move.action}</td>
                <td>${move.purchaser}</td>
                <td>${move.contact}</td>
                <td>${move.email}</td>
                <td>${move.payment_status}</td>
            `;
            tbody.appendChild(tr);
        });
    })
    .catch(err => console.error('Error loading stock movements:', err));
