// path: static/js/delete-handler.js
document.addEventListener('DOMContentLoaded', function () {
  const modal = document.getElementById('deleteModal');
  if (!modal) return;

  const confirmBtn = document.getElementById('confirmDelete');
  const cancelBtn = modal.querySelector('.cancel');
  const closeBtn = modal.querySelector('.close');

  let currentForm = null;
  let selectedForms = [];

  const isFoldersPage = document.querySelectorAll('.folder-card').length > 0;
  const isSnapshotsPage = document.querySelectorAll('.snapshot-card').length > 0;

  const disableCheckboxes = (state = true) => {
    document.querySelectorAll('input[type="checkbox"]').forEach(cb => (cb.disabled = state));
  };

  const setElementsState = (disabled) => {
    document.querySelectorAll('.delete-form').forEach(f => {
      f.style.opacity = disabled ? '0.5' : '1';
      f.style.pointerEvents = disabled ? 'none' : '';
    });
    document.querySelectorAll('.delete-selected-btn').forEach(b => {
      b.disabled = disabled;
      b.style.opacity = disabled ? '0.5' : '1';
      b.style.pointerEvents = disabled ? 'none' : '';
    });
    const backdrop = document.querySelector('.modal-backdrop');
    if (disabled && !backdrop) {
      const div = document.createElement('div');
      div.className = 'modal-backdrop';
      Object.assign(div.style, {
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
        backgroundColor: 'rgba(0,0,0,0.5)', zIndex: '999'
      });
      document.body.appendChild(div);
    } else if (!disabled && backdrop) backdrop.remove();
  };

  const openModal = (message) => {
    modal.querySelector('p').textContent = message;
    modal.style.display = 'block';
    modal.style.zIndex = '1000';
    disableCheckboxes(true);
    setElementsState(true);
  };

  const closeModal = () => {
    modal.style.display = 'none';
    disableCheckboxes(false);
    setElementsState(false);
    currentForm = null;
    selectedForms = [];
    if (isFoldersPage) toggleDeleteButton();
    if (isSnapshotsPage) toggleDeleteButtonSnapshots();
  };


  let currentFolderDeleteBtn = null;

  // Handle delete button click
  document.querySelectorAll('.folder-delete-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();

      // Store the clicked button for later reference
      currentFolderDeleteBtn = btn;

      // Get folder name for modal message
      const folderName = btn.dataset.folderName
        || btn.closest('.folder-card')?.querySelector('.folder-name')?.textContent
        || "this folder";

      // Open modal with custom message
      openModal(`Are you sure you want to delete "${folderName}" and all its snapshots?`);
    });
  });

  // Confirm delete in modal
  confirmBtn.addEventListener('click', async () => {
    if (!currentFolderDeleteBtn) return;

    const url = currentFolderDeleteBtn.href;

    try {
      const response = await fetch(url, { method: 'POST' });
      if (response.ok) {
        // Remove folder card from DOM
        const card = currentFolderDeleteBtn.closest('.folder-card');
        if (card) card.remove();

        // Optional: show success message in modal or toast
        showToast("Folder deleted successfully!");
      } else {
        console.error("Delete failed:", response.status);
      }
    } catch (err) {
      console.error("Error deleting folder:", err);
    }

    // Close the modal
    closeModal();
    currentFolderDeleteBtn = null;
  });

  // Cancel / close modal
  [cancelBtn, closeBtn].forEach(el => {
    el.addEventListener('click', () => {
      closeModal();
      currentFolderDeleteBtn = null;
    });
  });


  let currentDeleteUrl = null;
  let currentCard = null;

  document.querySelectorAll('.snapshot-delete-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      currentDeleteUrl = btn.dataset.deleteUrl;
      currentCard = btn.closest('.snapshot-card');
      document.getElementById('deleteModal').style.display = 'block';
    });
  });

  confirmBtn?.addEventListener('click', async () => {
    if (!currentDeleteUrl) return;

    try {
      const response = await fetch(currentDeleteUrl, { method: 'POST' });
      if (response.ok && currentCard) currentCard.remove();
    } catch (e) {
      console.error('Error deleting:', e);
    }

    document.getElementById('deleteModal').style.display = 'none';
    currentDeleteUrl = null;
    currentCard = null;
  });


  // === Folder bulk + select-all ===
  const toggleDeleteButton = () => {
    const checked = document.querySelectorAll('.folder-card input[type="checkbox"]:checked').length;
    const btn = document.querySelector('.delete-selected-btn');
    const allBox = document.getElementById('select-all-folders');
    const allLabel = document.querySelector('label[for="select-all-folders"]');
    if (btn) {
      btn.disabled = checked === 0;
      btn.style.opacity = checked === 0 ? '0.5' : '1';
      btn.style.pointerEvents = checked === 0 ? 'none' : '';
    }
    if (allBox && allLabel) {
      allBox.style.display = 'inline';
      allLabel.style.display = 'inline';
    }
    document.querySelectorAll('.folder-card a').forEach(a => {
      a.style.pointerEvents = checked ? 'none' : '';
      a.style.opacity = checked ? '0.5' : '1';
    });
    document.querySelectorAll('.folder-card .delete-btn').forEach(btn => {
      btn.disabled = checked > 0;
      btn.style.opacity = checked > 0 ? '0.5' : '1';
      btn.style.pointerEvents = checked > 0 ? 'none' : '';
    });
  };

  // === Snapshot bulk + select-all ===
  const toggleDeleteButtonSnapshots = () => {
    const checked = document.querySelectorAll('.snapshot-card input[type="checkbox"]:checked').length;
    const btn = document.querySelector('.delete-selected-btn');
    const allBox = document.getElementById('select-all-snapshots');
    const allLabel = document.querySelector('label[for="select-all-snapshots"]');
    if (btn) {
      btn.disabled = checked === 0;
      btn.style.opacity = checked === 0 ? '0.5' : '1';
      btn.style.pointerEvents = checked === 0 ? 'none' : '';
    }
    if (allBox && allLabel) {
      allBox.style.display = 'inline';
      allLabel.style.display = 'inline';
    }
    document.querySelectorAll('.snapshot-card a').forEach(a => {
      a.style.pointerEvents = checked ? 'none' : '';
      a.style.opacity = checked ? '0.5' : '1';
    });
    document.querySelectorAll('.snapshot-card .delete-btn').forEach(btn => {
      btn.disabled = checked > 0;
      btn.style.opacity = checked > 0 ? '0.5' : '1';
      btn.style.pointerEvents = checked > 0 ? 'none' : '';
    });
  };

  // === Bind single delete ===
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      currentForm = btn.closest('form');
      const isFolder = !!btn.closest('.folder-card');
      openModal(isFolder
        ? 'Are you sure you want to delete this folder and all its snapshots?'
        : 'Are you sure you want to delete this snapshot?');
    });
  });

  // === Confirm delete ===
  confirmBtn?.addEventListener('click', async () => {
    if (currentForm) await handleDelete([currentForm]);
    else if (selectedForms.length) await handleDelete(selectedForms);
  });

  cancelBtn?.addEventListener('click', closeModal);
  closeBtn?.addEventListener('click', closeModal);

  // === Folder page checkboxes ===
  if (isFoldersPage) {
    // Add checkboxes and bulk delete button
    const headerActions = document.querySelector('.header-actions');
    if (headerActions) {
      headerActions.style.display = 'flex';
      headerActions.style.justifyContent = 'space-between';
      headerActions.style.alignItems = 'flex-start';

      const rightContainer = document.createElement('div');
      rightContainer.style.display = 'flex';
      rightContainer.style.flexDirection = 'column';
      rightContainer.style.alignItems = 'flex-end';

      const backLink = headerActions.querySelector('.back-link');
      if (backLink) {
        rightContainer.appendChild(backLink);
      }

      const bulkContainer = document.createElement('div');
      bulkContainer.style.display = 'flex';
      bulkContainer.style.flexDirection = 'column';
      bulkContainer.style.alignItems = 'flex-end';
      bulkContainer.style.marginTop = '5px';

      const bulkDeleteBtn = document.createElement('button');
      bulkDeleteBtn.textContent = 'Delete Selected';
      bulkDeleteBtn.className = 'delete-selected-btn';
      bulkDeleteBtn.style.padding = '8px 14px';
      bulkDeleteBtn.style.backgroundColor = '#dc3545';
      bulkDeleteBtn.style.color = 'white';
      bulkDeleteBtn.style.border = 'none';
      bulkDeleteBtn.style.borderRadius = '8px';
      bulkDeleteBtn.style.cursor = 'pointer';
      bulkDeleteBtn.style.fontWeight = '600';
      bulkDeleteBtn.style.display = 'inline-flex'; // Always visible
      bulkDeleteBtn.disabled = true;
      bulkDeleteBtn.style.opacity = '0.5';
      bulkDeleteBtn.style.pointerEvents = 'none';
      bulkContainer.appendChild(bulkDeleteBtn);

      const selectAllCheckbox = document.createElement('input');
      selectAllCheckbox.type = 'checkbox';
      selectAllCheckbox.id = 'select-all-folders';
      selectAllCheckbox.style.width = '25px';
      selectAllCheckbox.style.height = '25px';
      selectAllCheckbox.style.marginTop = '5px';
      selectAllCheckbox.style.display = 'none'; // Hidden initially
      const selectAllLabel = document.createElement('label');
      selectAllLabel.htmlFor = 'select-all-folders';
      selectAllLabel.textContent = 'Select All';
      selectAllLabel.style.fontSize = '14px';
      selectAllLabel.style.marginTop = '5px';
      selectAllLabel.style.display = 'none'; // Hidden initially
      bulkContainer.appendChild(selectAllLabel);
      bulkContainer.appendChild(selectAllCheckbox);

      rightContainer.appendChild(bulkContainer);
      headerActions.appendChild(rightContainer);
    }

    // Add checkboxes to folder cards beside delete button, initially hidden
    document.querySelectorAll('.folder-card').forEach(card => {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.style.width = '25px';
      checkbox.style.height = '25px'; // Match delete button height
      checkbox.style.marginRight = '1px';
      checkbox.style.verticalAlign = 'middle'; // Align with delete button
      checkbox.style.display = 'none'; // Hide initially
      const deleteForm = card.querySelector('.delete-form');
      if (deleteForm) {
        deleteForm.insertBefore(checkbox, deleteForm.firstChild);
      }
    });

    // Initial toggle to set button state
    toggleDeleteButton();

    const selectAll = document.getElementById('select-all-folders');
    selectAll?.addEventListener('change', () => {
      document.querySelectorAll('.folder-card input[type="checkbox"]').forEach(cb => (cb.checked = selectAll.checked));
      toggleDeleteButton();
    });

    document.querySelectorAll('.folder-card input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', toggleDeleteButton);
    });

    document.querySelector('.delete-selected-btn')?.addEventListener('click', () => {
      selectedForms = Array.from(document.querySelectorAll('.folder-card input[type="checkbox"]:checked'))
        .map(cb => cb.closest('.folder-card').querySelector('.delete-form'))
        .filter(Boolean);
      if (selectedForms.length === 0) return alert('No folders selected.');
      openModal(`Are you sure you want to delete ${selectedForms.length} selected folder${selectedForms.length > 1 ? 's' : ''}?`);
    });
  }

  // === Snapshot page checkboxes ===
  if (isSnapshotsPage) {
    // Add checkboxes and bulk delete button for snapshots
    const headerActions = document.querySelector('.header-actions');
    if (headerActions) {
      headerActions.style.display = 'flex';
      headerActions.style.justifyContent = 'space-between';
      headerActions.style.alignItems = 'flex-start';

      const rightContainer = document.createElement('div');
      rightContainer.style.display = 'flex';
      rightContainer.style.flexDirection = 'column';
      rightContainer.style.alignItems = 'flex-end';

      const backLink = headerActions.querySelector('.back-link');
      if (backLink) {
        rightContainer.appendChild(backLink);
      }

      const bulkContainer = document.createElement('div');
      bulkContainer.style.display = 'flex';
      bulkContainer.style.flexDirection = 'column';
      bulkContainer.style.alignItems = 'flex-end';
      bulkContainer.style.marginTop = '5px';

      const bulkDeleteBtnSnapshots = document.createElement('button');
      bulkDeleteBtnSnapshots.textContent = 'Delete Selected';
      bulkDeleteBtnSnapshots.className = 'delete-selected-btn';
      bulkDeleteBtnSnapshots.style.padding = '8px 14px';
      bulkDeleteBtnSnapshots.style.backgroundColor = '#dc3545';
      bulkDeleteBtnSnapshots.style.color = 'white';
      bulkDeleteBtnSnapshots.style.border = 'none';
      bulkDeleteBtnSnapshots.style.borderRadius = '8px';
      bulkDeleteBtnSnapshots.style.cursor = 'pointer';
      bulkDeleteBtnSnapshots.style.fontWeight = '600';
      bulkDeleteBtnSnapshots.style.display = 'inline-block'; // Always visible
      bulkDeleteBtnSnapshots.disabled = true;
      bulkDeleteBtnSnapshots.style.opacity = '0.5';
      bulkDeleteBtnSnapshots.style.pointerEvents = 'none';
      bulkContainer.appendChild(bulkDeleteBtnSnapshots);

      const selectAllCheckbox = document.createElement('input');
      selectAllCheckbox.type = 'checkbox';
      selectAllCheckbox.id = 'select-all-snapshots';
      selectAllCheckbox.style.width = '25px';
      selectAllCheckbox.style.height = '25px';
      selectAllCheckbox.style.marginTop = '5px';
      selectAllCheckbox.style.display = 'none'; // Hidden initially
      const selectAllLabel = document.createElement('label');
      selectAllLabel.htmlFor = 'select-all-snapshots';
      selectAllLabel.textContent = 'Select All';
      selectAllLabel.style.fontSize = '14px';
      selectAllLabel.style.marginTop = '5px';
      selectAllLabel.style.display = 'none'; // Hidden initially
      bulkContainer.appendChild(selectAllLabel);
      bulkContainer.appendChild(selectAllCheckbox);

      rightContainer.appendChild(bulkContainer);
      headerActions.appendChild(rightContainer);
    }

    // Add checkboxes to snapshot cards beside delete button
    document.querySelectorAll('.snapshot-card').forEach(card => {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.style.width = '25px';
      checkbox.style.height = '25px'; // Match delete button height
      checkbox.style.marginRight = '1px';
      checkbox.style.verticalAlign = 'middle'; // Align with delete button
      const deleteForm = card.querySelector('.delete-form');
      if (deleteForm) {
        deleteForm.insertBefore(checkbox, deleteForm.firstChild);
      }
    });

    // Initial toggle to set button state
    toggleDeleteButtonSnapshots();

    const selectAll = document.getElementById('select-all-snapshots');
    selectAll?.addEventListener('change', () => {
      document.querySelectorAll('.snapshot-card input[type="checkbox"]').forEach(cb => (cb.checked = selectAll.checked));
      toggleDeleteButtonSnapshots();
    });

    document.querySelectorAll('.snapshot-card input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', toggleDeleteButtonSnapshots);
    });

    document.querySelector('.delete-selected-btn')?.addEventListener('click', () => {
      selectedForms = Array.from(document.querySelectorAll('.snapshot-card input[type="checkbox"]:checked'))
        .map(cb => cb.closest('.snapshot-card').querySelector('.delete-form'))
        .filter(Boolean);
      if (selectedForms.length === 0) return alert('No snapshots selected.');
      openModal(`Are you sure you want to delete ${selectedForms.length} selected snapshot${selectedForms.length > 1 ? 's' : ''}?`);
    });
  }

  // === Search + thumbnails ===
  document.querySelectorAll(".record-thumb").forEach(img => {
    const src = img.getAttribute("data-src");
    if (!src) return;
    fetch(src)
      .then(r => r.text())
      .then(t => {
        if (t) img.src = t.startsWith("data:") ? t : "data:image/jpeg;base64," + t;
      })
      .catch(() => { img.src = src; });
  });

  document.getElementById('folder-search')?.addEventListener('input', function () {
    const q = this.value.toLowerCase();
    document.querySelectorAll('.folder-card').forEach(c => {
      const name = c.querySelector('.folder-name').textContent.toLowerCase();
      c.style.display = name.includes(q) ? '' : 'none';
    });
  });

  document.getElementById('snapshot-search')?.addEventListener('input', function () {
    const q = this.value.toLowerCase();
    document.querySelectorAll('.snapshot-card').forEach(c => {
      const ts = c.querySelector('.timestamp').textContent.toLowerCase();
      c.style.display = ts.includes(q) ? '' : 'none';
    });
  });

  // Hide loading overlay after page load
  setTimeout(() => {
    const overlay = document.querySelector('.loading-overlay');
    if (overlay) overlay.classList.add('hidden');
  }, 500);
});

// === Toggle 3-dot dropdown ===
document.querySelectorAll('.snapshot-menu-btn').forEach(btn => {
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const container = btn.closest('.snapshot-menu-container');
    document.querySelectorAll('.snapshot-menu-container').forEach(c => {
      if (c !== container) c.classList.remove('active');
    });
    container.classList.toggle('active');
  });
});

// Prevent bubbling from dropdown to snapshot link
document.querySelectorAll('.snapshot-menu-dropdown').forEach(dropdown => {
  dropdown.addEventListener('click', e => {
    e.stopPropagation();
  });
});

// Prevent snapshot link navigation when menu is active
document.querySelectorAll('.snapshot-link').forEach(link => {
  link.addEventListener('click', e => {
    const container = link.closest('.snapshot-card').querySelector('.snapshot-menu-container');
    if (container && container.classList.contains('active')) {
      e.preventDefault();
    }
  });
});

// Close dropdown when clicking outside
document.addEventListener('click', () => {
  document.querySelectorAll('.snapshot-menu-container').forEach(c => c.classList.remove('active'));
});

// === Folder menu dropdown toggle ===
document.querySelectorAll('.folder-menu-btn').forEach(btn => {
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const container = btn.closest('.folder-menu-container');
    const isActive = container.classList.contains('active');

    // Close any open menus
    document.querySelectorAll('.folder-menu-container.active').forEach(c => c.classList.remove('active'));

    // Toggle this one
    if (!isActive) container.classList.add('active');
  });
});

// === Handle Select mode for folders ===
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('folder-menu-item') && e.target.textContent.trim().toLowerCase() === 'select') {
    e.stopPropagation();
    // Hide delete buttons
    document.querySelectorAll('.folder-card .delete-btn').forEach(btn => btn.style.display = 'none');
    // Do not hide folder menu buttons
    // Show checkboxes
    document.querySelectorAll('.folder-card input[type="checkbox"]').forEach(cb => {
      cb.style.display = 'inline';
    });
    // Show select all
    const selectAll = document.getElementById('select-all-folders');
    const selectAllLabel = document.querySelector('label[for="select-all-folders"]');
    if (selectAll) selectAll.style.display = 'inline';
    if (selectAllLabel) selectAllLabel.style.display = 'inline';
    // Show select indicator
    document.querySelectorAll('.folder-card .select-indicator').forEach(indicator => {
      indicator.style.display = 'inline';
    });
    // Do not close the dropdown
  } else if (e.target.classList.contains('select-indicator') || e.target.closest('.select-indicator')) {
    e.stopPropagation();
    // Show delete buttons
    document.querySelectorAll('.folder-card .delete-btn').forEach(btn => btn.style.display = 'inline');
    // Do not show folder menu buttons again, keep them visible
    // Hide checkboxes
    document.querySelectorAll('.folder-card input[type="checkbox"]').forEach(cb => {
      cb.style.display = 'none';
    });
    // Hide select all
    const selectAll = document.getElementById('select-all-folders');
    const selectAllLabel = document.querySelector('label[for="select-all-folders"]');
    if (selectAll) selectAll.style.display = 'none';
    if (selectAllLabel) selectAllLabel.style.display = 'none';
    // Hide select indicator
    document.querySelectorAll('.folder-card .select-indicator').forEach(indicator => {
      indicator.style.display = 'none';
    });
    // Reset checkboxes
    document.querySelectorAll('.folder-card input[type="checkbox"]').forEach(cb => cb.checked = false);
    // Update button state
    if (isFoldersPage) toggleDeleteButton();
  }
});

