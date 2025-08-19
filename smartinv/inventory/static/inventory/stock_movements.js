const tbody = document.getElementById('movements-body');

function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    document.cookie.split(';').forEach(c => {
      const cookie = c.trim();
      if (cookie.startsWith(name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
      }
    });
  }
  return cookieValue;
}

function createPaymentToggle(orderId, currentStatus) {
  const container = document.createElement('div');
  container.className = 'payment-toggle-container';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.id = 'toggle-' + orderId;
  checkbox.checked = currentStatus.toLowerCase() === 'paid';

  const label = document.createElement('label');
  label.htmlFor = checkbox.id;
  label.className = 'toggle-label';
  label.textContent = checkbox.checked ? 'Paid' : 'Due';

  checkbox.addEventListener('change', async () => {
    const newStatus = checkbox.checked ? 'paid' : 'pending';
    label.textContent = checkbox.checked ? 'Paid' : 'Due';

    try {
      const response = await fetch(`/inventory/api/update-payment-status/${orderId}/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify({ payment_status: newStatus })
      });
      const data = await response.json();
      if (!data.success) {
        alert('Failed to update payment status.');
        checkbox.checked = !checkbox.checked;
        label.textContent = checkbox.checked ? 'Paid' : 'Due';
      }
    } catch (e) {
      alert('Network error.');
      checkbox.checked = !checkbox.checked;
      label.textContent = checkbox.checked ? 'Paid' : 'Due';
    }
  });

  container.appendChild(checkbox);
  container.appendChild(label);

  return container;
}

function createDeleteButton(orderId, tr) {
  const btn = document.createElement('button');
  btn.className = 'btn-delete-row';
  btn.title = 'Delete this record';
  btn.type = 'button';
  btn.textContent = '🗑️';
  btn.style.fontSize = '1.2rem';
  btn.addEventListener('click', async () => {
    if (confirm(`Are you sure you want to delete order ${orderId}? This action cannot be undone.`)) {
      try {
        const resp = await fetch(`/inventory/stock_movements/delete/${orderId}/`, {
          method: 'DELETE',
          headers: { 'X-CSRFToken': getCookie('csrftoken') }
        });
        const data = await resp.json();
        if (data.success) {
          tr.remove();
        } else {
          alert(data.error || 'Failed to delete record.');
        }
      } catch (err) {
        alert('Network error: ' + err);
      }
    }
  });
  return btn;
}

fetch('/inventory/stock_movements/')
  .then(res => {
    if (!res.ok) {
      throw new Error('Network response was not ok');
    }
    return res.json();
  })
  .then(data => {
    tbody.innerHTML = '';
    data.forEach(move => {
      const tr = document.createElement('tr');

      // Build cells explicitly
      const fields = [
        move.order_id,
        move.timestamp,
        move.product,
        move.quantity,
        move.action,
        move.purchaser,
        move.contact,
        `₹${move.amount}`
      ];

      fields.forEach((text, index) => {
        const td = tr.insertCell(-1);
        td.textContent = text;
        
        // Add class on action column for color
        if (index === 4) {
          td.className = 'action-' + move.action.replace(/\s+/g, '');
        }
        td.style.textAlign = 'center';
      });

      // Payment status toggle cell
      const paymentTd = tr.insertCell(-1);
      paymentTd.appendChild(createPaymentToggle(move.order_id, move.payment_status));
      paymentTd.style.textAlign = 'center';

      // Delete button cell
      const deleteTd = tr.insertCell(-1);
      deleteTd.appendChild(createDeleteButton(move.order_id, tr));
      deleteTd.style.textAlign = 'center';

      tbody.appendChild(tr);
    });
  })
  .catch(err => {
    console.error('Error loading stock movements:', err);
    tbody.innerHTML = '<tr><td colspan="10" style="color: red; text-align:center;">Failed to load stock movements data.</td></tr>';
  });


  