document.addEventListener('DOMContentLoaded', () => {
  let draggedProduct = null;

  // -- DRAG & DROP ANIMATION HELPERS --
  function animateDragStart(elem) {
    gsap.to(elem, { scale: 1.1, boxShadow: "0 10px 25px rgba(0,0,0,0.45)", duration: 0.35, zIndex: 9000 });
  }
  function animateDrop(elem) {
    gsap.to(elem, { scale: 1, boxShadow: "0 2px 8px rgba(0,0,0,0.25)", duration: 0.35, zIndex: 1 });
  }
  function animateDropZoneGlow(elem, active) {
    if (active) {
      gsap.to(elem, { boxShadow: "0 0 25px 6px #3a7bd5cc", duration: 0.3 });
    } else {
      gsap.to(elem, { boxShadow: "none", duration: 0.3 });
    }
  }

  // -- MAKE ALL PRODUCTS DRAGGABLE --
  function makeDraggable() {
    document.querySelectorAll('.draggable').forEach(elem => {
      elem.setAttribute('draggable', 'true');
      elem.addEventListener('dragstart', (e) => {
        draggedProduct = e.target;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', '');
        e.target.classList.add('dragging');
        animateDragStart(e.target);
      });
      elem.addEventListener('dragend', (e) => {
        e.target.classList.remove('dragging');
        draggedProduct = null;
        animateDrop(e.target);
      });
    });
  }
  makeDraggable();

  // -- DROPPABLE AREAS HANDLING --
  document.querySelectorAll('.droppable').forEach(dropZone => {
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
      e.dataTransfer.dropEffect = "move";
      animateDropZoneGlow(dropZone, true);
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('dragover');
      animateDropZoneGlow(dropZone, false);
    });

    dropZone.addEventListener('drop', async (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      animateDropZoneGlow(dropZone, false);
      if (!draggedProduct) return;

      const productId = draggedProduct.dataset.productId;
      const oldParent = draggedProduct.parentElement;
      let newRackId = null;

      // FIX: for unassigned-products, place in the unassigned-list container!
      if (dropZone.id === 'unassigned-products') {
        newRackId = null;
        const unassignedList = dropZone.querySelector('.unassigned-list');
        if (unassignedList) {
          unassignedList.appendChild(draggedProduct);
        } else {
          dropZone.appendChild(draggedProduct);
        }
      } else {
        newRackId = dropZone.dataset.rackId;
        if (!dropZone.classList.contains('rack-products')) {
          const inner = dropZone.querySelector('.rack-products');
          if (inner) inner.appendChild(draggedProduct);
          else dropZone.appendChild(draggedProduct);
        } else {
          dropZone.appendChild(draggedProduct);
        }
      }

      gsap.fromTo(draggedProduct,
        { opacity: 0.7, scale: 1.1 },
        { opacity: 1, scale: 1, duration: 0.4, onComplete: makeDraggable }
      );

      try {
        await updateProductRack(productId, newRackId);
      } catch (err) {
        alert("Failed to update product allocation: " + err.message);
        if (oldParent) oldParent.appendChild(draggedProduct);
      }
    });
  });

  // -- RACK/PRODUCT ACTION HELPERS --
  function animateRemoveElement(element) {
    return gsap.to(element, { opacity: 0, scale: 0.5, duration: 0.4 }).then(() => element.remove());
  }

  // -- BUTTON EVENT HANDLERS USING EVENT DELEGATION --
  document.body.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-delete-rack')) {
      const rackElem = e.target.closest('.rack');
      const rackId = rackElem.dataset.rackId;
      if (confirm('Delete this rack? Products will be disallocated.')) {
        deleteRack(rackId, rackElem);
      }
    } else if (e.target.classList.contains('btn-delete-shelf')) {
      const shelfElem = e.target.closest('.shelf');
      const shelfId = shelfElem.dataset.shelfId;
      if (confirm('Delete this shelf? All racks and products inside will be affected.')) {
        deleteShelf(shelfId, shelfElem);
      }
    } else if (e.target.classList.contains('btn-delete-inventory')) {
      const inventoryId = e.target.dataset.inventoryId;
      if (confirm('Delete this entire inventory model? This action cannot be undone.')) {
        deleteInventoryModel(inventoryId);
      }
    } else if (e.target.classList.contains('btn-add-rack')) {
      const shelfId = e.target.dataset.shelfId;
      addRackToShelf(shelfId);
    }
  });

  // -- API CALLS FOR DELETION/ADDITION --
  async function deleteRack(rackId, rackElem) {
    try {
      const resp = await fetch(`/inventory/api/delete-rack/${rackId}/`, {
        method: 'DELETE',
        headers: { 'X-CSRFToken': getCookie('csrftoken') }
      });
      const data = await resp.json();
      if (data.success) {
        await animateRemoveElement(rackElem);
      } else {
        alert(`Error deleting rack: ${data.error || 'Unknown error'}`);
      }
    } catch {
      alert('Network error deleting rack.');
    }
  }

  async function deleteShelf(shelfId, shelfElem) {
    try {
      const resp = await fetch(`/inventory/api/delete-shelf/${shelfId}/`, {
        method: 'DELETE',
        headers: { 'X-CSRFToken': getCookie('csrftoken') }
      });
      const data = await resp.json();
      if (data.success) {
        await animateRemoveElement(shelfElem);
      } else {
        alert(`Error deleting shelf: ${data.error || 'Unknown error'}`);
      }
    } catch {
      alert('Network error deleting shelf.');
    }
  }

  async function deleteInventoryModel(inventoryId) {
    try {
      const resp = await fetch(`/inventory/api/delete-inventory-model/${inventoryId}/`, {
        method: 'DELETE',
        headers: { 'X-CSRFToken': getCookie('csrftoken') }
      });
      const data = await resp.json();
      if (data.success) {
        alert('Inventory model deleted. Reloading...');
        window.location.href = '/inventory/organise-products/';
      } else {
        alert(`Error deleting inventory model: ${data.error || 'Unknown error'}`);
      }
    } catch {
      alert('Network error deleting inventory model.');
    }
  }

  async function addRackToShelf(shelfId) {
    const addRackBtn = document.querySelector(`button.btn-add-rack[data-shelf-id="${shelfId}"]`);
    if (!addRackBtn) return;
    addRackBtn.disabled = true;
    addRackBtn.textContent = 'Adding...';
    try {
      const resp = await fetch('/inventory/api/add-rack/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCookie('csrftoken'),
        },
        body: JSON.stringify({ shelf_id: shelfId }),
      });
      const data = await resp.json();
      if (data.success && data.new_rack) {
        insertNewRack(data.new_rack, shelfId);
        addRackBtn.disabled = false;
        addRackBtn.textContent = '➕ Add Rack';
      } else {
        alert(`Error adding rack: ${data.error || 'Unknown error'}`);
        addRackBtn.disabled = false;
        addRackBtn.textContent = '➕ Add Rack';
      }
    } catch {
      alert('Network error adding rack.');
      addRackBtn.disabled = false;
      addRackBtn.textContent = '➕ Add Rack';
    }
  }

  function insertNewRack(rackData, shelfId) {
    const shelfDiv = document.querySelector(`section.shelf[data-shelf-id="${shelfId}"] .racks-row`);
    if (!shelfDiv) return;

    const rackDiv = document.createElement('div');
    rackDiv.className = 'rack glass-rack droppable animate-in';
    rackDiv.dataset.rackId = rackData.id;

    const rackHeader = document.createElement('div');
    rackHeader.className = 'rack-header';
    rackHeader.style = 'display: flex; align-items: center; justify-content: space-between;';

    const h4 = document.createElement('h4');
    h4.className = 'editable-rack-label';
    h4.contentEditable = true;
    h4.dataset.rackId = rackData.id;
    h4.spellcheck = false;
    h4.textContent = rackData.label || `Rack ${shelfDiv.children.length + 1}`;

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn btn-danger btn-delete-rack';
    delBtn.dataset.rackId = rackData.id;
    delBtn.title = 'Delete Rack';
    delBtn.textContent = '🗑️';

    rackHeader.append(h4, delBtn);

    const productsDiv = document.createElement('div');
    productsDiv.className = 'rack-products fancy-scroll';
    productsDiv.innerHTML = '<p class="empty-rack-text"><em>Empty</em></p>';

    rackDiv.append(rackHeader, productsDiv);

    // Insert rackDiv before Add Rack button
    const addRackBtn = shelfDiv.querySelector('button.btn-add-rack');
    shelfDiv.insertBefore(rackDiv, addRackBtn);

    gsap.from(rackDiv, { opacity: 0, scale: 0.75, duration: 0.5, ease: "back.out(1.7)" });
    makeDraggable();
  }

  async function updateProductRack(productId, rackId) {
    const resp = await fetch('/inventory/api/update-product-rack/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCookie('csrftoken'),
      },
      body: JSON.stringify({ product_id: productId, rack_id: rackId }),
    });
    if (!resp.ok) throw new Error("Network response was not ok.");
    const data = await resp.json();
    if (data.error) throw new Error(data.error);
    return data.success;
  }

  // -- GET CSRF TOKEN --
  function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
      const cookies = document.cookie.split(';');
      for (let cookie of cookies) {
        cookie = cookie.trim();
        if (cookie.startsWith(name + '=')) {
          cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
          break;
        }
      }
    }
    return cookieValue;
  }

  // -- INLINE LABEL EDITING: save on blur or Enter --
  function setupLabelEditing() {
    document.body.addEventListener('blur', (e) => {
      if (e.target.classList.contains('editable-shelf-label')) {
        const shelfId = e.target.dataset.shelfId;
        const newLabel = e.target.textContent.trim();
        saveShelfLabel(shelfId, newLabel);
      } else if (e.target.classList.contains('editable-rack-label')) {
        const rackId = e.target.dataset.rackId;
        const newLabel = e.target.textContent.trim();
        saveRackLabel(rackId, newLabel);
      }
    }, true);

    document.body.addEventListener('keypress', (e) => {
      if ((e.target.classList.contains('editable-shelf-label') || e.target.classList.contains('editable-rack-label')) && e.key === 'Enter') {
        e.preventDefault();
        e.target.blur();
      }
    });
  }

  async function saveShelfLabel(shelfId, label) {
    try {
      const resp = await fetch('/inventory/api/rename-shelf/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCookie('csrftoken'),
        },
        body: JSON.stringify({ shelf_id: shelfId, label: label }),
      });
      // NOTE: Specific check/fix for wrong endpoint or bad trailing slash
      const text = await resp.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('API response was not valid JSON:', text);
        throw new Error("Unexpected response from server (see console).");
      }
      if (!data.success) throw new Error(data.error || "Failed to save shelf label");
    } catch (error) {
      alert("Error saving shelf label: " + error.message);
    }
  }

  async function saveRackLabel(rackId, label) {
    try {
      const resp = await fetch('/inventory/api/rename-rack/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCookie('csrftoken'),
        },
        body: JSON.stringify({ rack_id: rackId, label: label }),
      });
      const text = await resp.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('API response was not valid JSON:', text);
        throw new Error("Unexpected response from server (see console).");
      }
      if (!data.success) throw new Error(data.error || "Failed to save rack label");
    } catch (error) {
      alert("Error saving rack label: " + error.message);
    }
  }

  setupLabelEditing();

  // --- CREATE INVENTORY MODEL FORM SUBMISSION ---
  const createForm = document.getElementById('create-inventory-model-form');
  const msgPara = document.getElementById('create-model-msg');
  if (createForm) {
    createForm.addEventListener('submit', (e) => {
      e.preventDefault();
      msgPara.textContent = '';
      const title = createForm.title.value.trim();
      const numShelves = parseInt(createForm.num_shelves.value);
      const racksPerShelf = parseInt(createForm.racks_per_shelf.value);

      if (!title || isNaN(numShelves) || isNaN(racksPerShelf) || numShelves < 1 || racksPerShelf < 1) {
        msgPara.textContent = 'Please enter valid values';
        msgPara.style.color = 'red';
        return;
      }

      fetch('/inventory/api/create-inventory-model/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCookie('csrftoken'),
        },
        body: JSON.stringify({
          title: title,
          num_shelves: numShelves,
          racks_per_shelf: racksPerShelf,
        }),
      })
      .then(response => response.json())
      .then(data => {
        if (data.error) {
          msgPara.textContent = 'Error: ' + data.error;
          msgPara.style.color = 'red';
        } else {
          msgPara.textContent = 'Inventory model created successfully! Reloading...';
          msgPara.style.color = 'green';
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        }
      })
      .catch(() => {
        msgPara.textContent = 'Network error creating model';
        msgPara.style.color = 'red';
      });
    });
  }
});


async function refreshOrganiseProducts() {
  // Fetch latest data from backend (via an API endpoint)
  const resp = await fetch('/inventory/api/organise-products-data/');
  const data = await resp.json();
  // Now re-render the organiser UI using the new data
  renderOrganiseProducts(data);
}

document.body.addEventListener('click', async (e) => {
  if (e.target.classList.contains('btn-delete-product')) {
    const productId = e.target.dataset.productId;
    if (confirm("Delete this product? This will remove it from the system.")) {
      const resp = await fetch(`/inventory/remove/${productId}/`, {
        method: "POST",
        headers: { 'X-CSRFToken': getCookie('csrftoken') },
        // Add body (if required by backend), or just send the POST
      });
      const result = await resp.json();
      if (result.error) {
        alert(result.error);
      } else {
        // Refresh UI after deletion
        await refreshOrganiseProducts();
      }
    }
  }
});



