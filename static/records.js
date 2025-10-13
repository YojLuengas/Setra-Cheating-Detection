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
    if (isFoldersPage) updateFolderState();
    if (isSnapshotsPage) updateSnapshotState();
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


  // === Folder state update ===
  function updateFolderState() {
    const cards = document.querySelectorAll('.folder-card');
    const checkboxes = document.querySelectorAll('.folder-card input[type="checkbox"]');
    const checked = document.querySelectorAll('.folder-card input[type="checkbox"]:checked').length;
    const anyVisible = Array.from(checkboxes).some(cb => cb.style.display !== 'none');

    // Show/hide delete buttons
    cards.forEach(card => {
      const deleteBtn = card.querySelector('.delete-btn');
      if (!deleteBtn) return;
      deleteBtn.style.display = (checked === 0 && !anyVisible) ? '' : 'none';
    });

    // Enable/disable folder links
    cards.forEach(card => {
      const link = card.querySelector('.folder-link');
      if (!link) return;
      link.style.pointerEvents = (checked > 0 || anyVisible) ? 'none' : '';
      link.style.opacity = (checked > 0 || anyVisible) ? '0.5' : '1';
    });

    // Show/hide checkboxes
    checkboxes.forEach(cb => cb.style.display = anyVisible ? 'inline' : 'none');

    // Enable/disable bulk delete button
    const bulkBtn = document.querySelector('.delete-selected-btn');
    if (bulkBtn) {
      bulkBtn.disabled = checked === 0;
      bulkBtn.style.opacity = checked === 0 ? '0.5' : '1';
      bulkBtn.style.pointerEvents = checked === 0 ? 'none' : '';
    }

    // Update border & styles
    checkboxes.forEach(cb => {
      if (cb.checked) {
        cb.closest('.folder-card').style.border = '2px solid red';
        cb.style.accentColor = 'red';
        cb.style.filter = 'hue-rotate(120deg)';
      } else {
        cb.closest('.folder-card').style.border = '';
        cb.style.accentColor = '';
        cb.style.filter = '';
      }
    });
  }

  // === Snapshot state update ===
  function updateSnapshotState() {
    const cards = document.querySelectorAll('.snapshot-card');
    const checkboxes = document.querySelectorAll('.snapshot-card input[type="checkbox"]');
    const checked = document.querySelectorAll('.snapshot-card input[type="checkbox"]:checked').length;
    const anyVisible = Array.from(checkboxes).some(cb => cb.style.display !== 'none');

    // Show/hide delete buttons
    cards.forEach(card => {
      const deleteBtn = card.querySelector('.delete-btn');
      if (!deleteBtn) return;
      deleteBtn.style.display = (checked === 0 && !anyVisible) ? '' : 'none';
    });

    // Enable/disable links
    cards.forEach(card => {
      const link = card.querySelector('a'); // snapshot links
      if (!link) return;
      link.style.pointerEvents = (checked > 0 || anyVisible) ? 'none' : '';
      link.style.opacity = (checked > 0 || anyVisible) ? '0.5' : '1';
    });

    // Show/hide checkboxes
    checkboxes.forEach(cb => cb.style.display = anyVisible ? 'inline' : 'none');

    // Enable/disable bulk delete button
    const bulkBtn = document.querySelector('.delete-selected-btn');
    if (bulkBtn) {
      bulkBtn.disabled = checked === 0;
      bulkBtn.style.opacity = checked === 0 ? '0.5' : '1';
      bulkBtn.style.pointerEvents = checked === 0 ? 'none' : '';
    }

    // Update border & styles
    checkboxes.forEach(cb => {
      if (cb.checked) {
        cb.closest('.snapshot-card').style.border = '2px solid red';
        cb.style.accentColor = 'red';
        cb.style.filter = 'hue-rotate(120deg)';
      } else {
        cb.closest('.snapshot-card').style.border = '';
        cb.style.accentColor = '';
        cb.style.filter = '';
      }
    });
  }

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

      // const bulkDeleteBtn = document.createElement('button');
      // bulkDeleteBtn.textContent = 'Delete Selected';
      // bulkDeleteBtn.className = 'delete-selected-btn';
      // bulkDeleteBtn.style.padding = '8px 14px';
      // bulkDeleteBtn.style.backgroundColor = '#dc3545';
      // bulkDeleteBtn.style.color = 'white';
      // bulkDeleteBtn.style.border = 'none';
      // bulkDeleteBtn.style.borderRadius = '8px';
      // bulkDeleteBtn.style.cursor = 'pointer';
      // bulkDeleteBtn.style.fontWeight = '600';
      // bulkDeleteBtn.style.display = 'inline-flex'; // Always visible
      // bulkDeleteBtn.disabled = true;
      // bulkDeleteBtn.style.opacity = '0.5';
      // bulkDeleteBtn.style.pointerEvents = 'none';
      // bulkContainer.appendChild(bulkDeleteBtn);

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

      // Bind select all checkbox
      selectAllCheckbox.addEventListener('change', function() {
        const allCbs = document.querySelectorAll('.folder-card input[type="checkbox"]');
        allCbs.forEach(cb => cb.checked = this.checked);
        if (this.checked) {
          allCbs.forEach(cb => {
            cb.closest('.folder-card').style.border = '2px solid red';
            cb.style.accentColor = 'red';
            cb.style.filter = 'hue-rotate(120deg)';
          });
        } else {
          allCbs.forEach(cb => {
            cb.closest('.folder-card').style.border = '';
            cb.style.accentColor = '';
            cb.style.filter = '';
          });
        }
        document.querySelectorAll('.folder-card .folder-link').forEach(a => {
          a.style.pointerEvents = this.checked ? 'none' : '';
          a.style.opacity = this.checked ? '0.5' : '1';
        });
        updateFolderState();
      });

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
    updateFolderState();

    document.querySelectorAll('.folder-card input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', updateFolderState);
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

      // const bulkDeleteBtnSnapshots = document.createElement('button');
      // bulkDeleteBtnSnapshots.textContent = 'Delete Selected';
      // bulkDeleteBtnSnapshots.className = 'delete-selected-btn';
      // bulkDeleteBtnSnapshots.style.padding = '8px 14px';
      // bulkDeleteBtnSnapshots.style.backgroundColor = '#dc3545';
      // bulkDeleteBtnSnapshots.style.color = 'white';
      // bulkDeleteBtnSnapshots.style.border = 'none';
      // bulkDeleteBtnSnapshots.style.borderRadius = '8px';
      // bulkDeleteBtnSnapshots.style.cursor = 'pointer';
      // bulkDeleteBtnSnapshots.style.fontWeight = '600';
      // bulkDeleteBtnSnapshots.style.display = 'inline-block'; // Always visible
      // bulkDeleteBtnSnapshots.disabled = true;
      // bulkDeleteBtnSnapshots.style.opacity = '0.5';
      // bulkDeleteBtnSnapshots.style.pointerEvents = 'none';
      // bulkContainer.appendChild(bulkDeleteBtnSnapshots);

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

      // Bind select all checkbox
      selectAllCheckbox.addEventListener('change', function() {
        const allCbs = document.querySelectorAll('.snapshot-card input[type="checkbox"]');
        allCbs.forEach(cb => cb.checked = this.checked);
        if (this.checked) {
          allCbs.forEach(cb => {
            cb.closest('.snapshot-card').style.border = '2px solid red';
            cb.style.accentColor = 'red';
            cb.style.filter = 'hue-rotate(120deg)';
          });
        } else {
          allCbs.forEach(cb => {
            cb.closest('.snapshot-card').style.border = '';
            cb.style.accentColor = '';
            cb.style.filter = '';
          });
        }
        updateSnapshotState();
      });

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
    updateSnapshotState();

    document.querySelectorAll('.snapshot-card input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', function() {
        if (this.checked) {
          this.closest('.snapshot-card').style.border = '2px solid red';
          this.style.accentColor = 'red';
          this.style.filter = 'hue-rotate(120deg)';
        } else {
          this.closest('.snapshot-card').style.border = '';
          this.style.accentColor = '';
          this.style.filter = '';
        }
        updateSnapshotState();
        handleCheckboxVisibility('.snapshot-card');
      });
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

// === Folder menu toggle ===
document.querySelectorAll('.folder-menu-btn').forEach(btn => {
  // Prevent blue outline/focus flash
  btn.addEventListener('mousedown', e => e.preventDefault());

  btn.addEventListener('click', e => {
    e.stopPropagation();
    const container = btn.closest('.folder-menu-container');
    const isActive = container.classList.contains('active');

    // Close all other open menus first
    document.querySelectorAll('.folder-menu-container.active').forEach(c => c.classList.remove('active'));

    // Toggle current menu
    if (!isActive) {
      container.classList.add('active');
    }
  });
});

// Close menu if clicking outside
document.addEventListener('click', e => {
  if (!e.target.closest('.folder-menu-container')) {
    document.querySelectorAll('.folder-menu-container.active').forEach(c => c.classList.remove('active'));
  }
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
    // Do not show select all or select indicator
    // Close the dropdown
    const container = e.target.closest('.folder-menu-container');
    if (container) container.classList.remove('active');
  } else if (e.target.classList.contains('folder-menu-item') && e.target.textContent.trim().toLowerCase() === 'select all') {
    e.stopPropagation();
    // Hide delete buttons
    document.querySelectorAll('.folder-card .delete-btn').forEach(btn => btn.style.display = 'none');
    // Do not hide folder menu buttons
    // Show checkboxes
    document.querySelectorAll('.folder-card input[type="checkbox"]').forEach(cb => {
      cb.style.display = 'inline';
    });
    // Check if all are checked
    const allChecked = document.querySelectorAll('.folder-card input[type="checkbox"]:checked').length === document.querySelectorAll('.folder-card input[type="checkbox"]').length;
    if (allChecked) {
      // Uncheck all
      document.querySelectorAll('.folder-card input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
        cb.closest('.folder-card').style.border = '';
        cb.style.accentColor = '';
        cb.style.filter = '';
      });
      // Hide checkboxes and show delete buttons
      document.querySelectorAll('.folder-card input[type="checkbox"]').forEach(cb => cb.style.display = 'none');
      document.querySelectorAll('.folder-card .delete-btn').forEach(btn => btn.style.display = '');
      // Disable delete selected button
      const btn = document.querySelector('.delete-selected-btn');
      if (btn) {
        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.style.pointerEvents = 'none';
      }
      // Enable folder links
      document.querySelectorAll('.folder-card .folder-link').forEach(a => {
        a.style.pointerEvents = '';
        a.style.opacity = '1';
      });
      // Update button and link states
      toggleDeleteButton();
    } else {
      // Check all
      document.querySelectorAll('.folder-card input[type="checkbox"]').forEach(cb => {
        cb.checked = true;
        cb.closest('.folder-card').style.border = '2px solid red';
        cb.style.accentColor = 'red';
        cb.style.filter = 'hue-rotate(120deg)';
      });
      // Enable delete selected button
      const btn = document.querySelector('.delete-selected-btn');
      if (btn) {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.pointerEvents = '';
      }
      // Disable folder links
      document.querySelectorAll('.folder-card .folder-link').forEach(a => {
        a.style.pointerEvents = 'none';
        a.style.opacity = '0.5';
      });
    }
    // Close the dropdown
    const container = e.target.closest('.folder-menu-container');
    if (container) container.classList.remove('active');
  }
});

// === Handle Select mode for snapshots ===
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('snapshot-menu-item') && e.target.textContent.trim().toLowerCase() === 'select') {
    e.stopPropagation();
    // Hide delete buttons
    document.querySelectorAll('.snapshot-card .delete-btn').forEach(btn => btn.style.display = 'none');
    // Do not hide snapshot menu buttons
    // Show checkboxes
    document.querySelectorAll('.snapshot-card input[type="checkbox"]').forEach(cb => {
      cb.style.display = 'inline';
    });
    // Close the dropdown
    const container = e.target.closest('.snapshot-menu-container');
    if (container) container.classList.remove('active');
  } else if (e.target.classList.contains('snapshot-menu-item') && e.target.textContent.trim().toLowerCase() === 'select all') {
    e.stopPropagation();
    // Hide delete buttons
    document.querySelectorAll('.snapshot-card .delete-btn').forEach(btn => btn.style.display = 'none');
    // Do not hide snapshot menu buttons
    // Show checkboxes
    document.querySelectorAll('.snapshot-card input[type="checkbox"]').forEach(cb => {
      cb.style.display = 'inline';
    });
    // Check if all are checked
    const allChecked = document.querySelectorAll('.snapshot-card input[type="checkbox"]:checked').length === document.querySelectorAll('.snapshot-card input[type="checkbox"]').length;
    if (allChecked) {
      // Uncheck all
      document.querySelectorAll('.snapshot-card input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
        cb.closest('.snapshot-card').style.border = '';
        cb.style.accentColor = '';
        cb.style.filter = '';
      });
      // Hide checkboxes and show delete buttons
      document.querySelectorAll('.snapshot-card input[type="checkbox"]').forEach(cb => cb.style.display = 'none');
      document.querySelectorAll('.snapshot-card .delete-btn').forEach(btn => btn.style.display = '');
      // Disable delete selected button
      const btn = document.querySelector('.delete-selected-btn');
      if (btn) {
        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.style.pointerEvents = 'none';
      }
      // Update button and link states
      updateSnapshotState();
    } else {
      // Check all
      document.querySelectorAll('.snapshot-card input[type="checkbox"]').forEach(cb => {
        cb.checked = true;
        cb.closest('.snapshot-card').style.border = '2px solid red';
        cb.style.accentColor = 'red';
        cb.style.filter = 'hue-rotate(120deg)';
      });
      // Enable delete selected button
      const btn = document.querySelector('.delete-selected-btn');
      if (btn) {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.pointerEvents = '';
      }
    }
    // Close the dropdown
    const container = e.target.closest('.snapshot-menu-container');
    if (container) container.classList.remove('active');
  }
});

document.addEventListener('DOMContentLoaded', () => {
      const sortDropdown = document.querySelector('.sort-dropdown');
      const sortBtn = document.querySelector('.sort-btn');
      const headerMenuContainer = document.querySelector('.header-menu-container');
      const headerMenuBtn = document.querySelector('.header-menu-btn');

      sortBtn.addEventListener('click', () => {
        sortDropdown.classList.toggle('active');
      });

      headerMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        headerMenuContainer.classList.toggle('active');
      });

      document.addEventListener('click', (e) => {
        if (!sortDropdown.contains(e.target)) sortDropdown.classList.remove('active');
        if (!headerMenuContainer.contains(e.target)) headerMenuContainer.classList.remove('active');
      });
    });

    document.addEventListener("DOMContentLoaded", () => {
  const folderCards = document.querySelectorAll(".folder-card");
  const checkboxes = document.querySelectorAll(".select-indicator");

  // --- Header menu functionality ---
  const openBtn = document.querySelector(".header-open-btn");
  const selectBtn = document.querySelector(".header-select-btn");
  const selectAllBtn = document.querySelector(".header-select-all-btn");
  const deleteBtn = document.querySelector(".header-delete-btn");

  // 1️⃣ Open → Go to the first folder (if any)
  openBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    const firstLink = document.querySelector(".folder-link");
    if (firstLink) {
      window.location.href = firstLink.href;
    } else {
      alert("No folders to open.");
    }
  });

  // 2️⃣ Select → Show all checkboxes
  selectBtn?.addEventListener("click", () => {
    checkboxes.forEach(cb => cb.style.display = "inline-block");
  });

  // 3️⃣ Select All → Check all boxes
  selectAllBtn?.addEventListener("click", () => {
    checkboxes.forEach(cb => {
      cb.style.display = "inline-block";
      cb.checked = true;
    });
  });

  // 4️⃣ Delete → Remove all selected (with confirmation)
  deleteBtn?.addEventListener("click", () => {
    const selected = Array.from(checkboxes).filter(cb => cb.checked);
    if (selected.length === 0) {
      alert("No folders selected.");
      return;
    }

    if (confirm(`Delete ${selected.length} selected folder(s)?`)) {
      selected.forEach(cb => {
        const form = cb.closest(".folder-card").querySelector(".delete-form");
        if (form) form.submit();
      });
    }
  });
});

// === Select folder on click & open on double click ===
document.querySelectorAll('.folder-card').forEach(card => {
  // Single / Ctrl+Click selection
  card.addEventListener('click', (e) => {
    if (e.target.closest('.folder-menu-btn') || e.target.closest('.folder-menu-dropdown')) return;

    const checkbox = card.querySelector('.select-indicator');
    const isCtrl = e.ctrlKey; // Detect Ctrl key

    // Ctrl+Click → toggle selection
    if (isCtrl) {
      card.classList.toggle('selected');
      if (checkbox) checkbox.checked = card.classList.contains('selected');
      return;
    }

    // Normal click → select only this
    document.querySelectorAll('.folder-card.selected').forEach(selectedCard => {
      selectedCard.classList.remove('selected');
      const cb = selectedCard.querySelector('.select-indicator');
      if (cb) cb.checked = false;
    });

    card.classList.add('selected');
    if (checkbox) checkbox.checked = true;
  });

  // Right-click → toggle (like Ctrl)
  card.addEventListener('contextmenu', (e) => {
    e.preventDefault(); // prevent context menu
    const checkbox = card.querySelector('.select-indicator');
    card.classList.toggle('selected');
    if (checkbox) checkbox.checked = card.classList.contains('selected');
  });

  // Double click → open folder
  card.addEventListener('dblclick', (e) => {
    if (e.target.closest('.folder-menu-btn') || e.target.closest('.folder-menu-dropdown')) return;

    const folderAnchor = card.querySelector('.folder-menu-dropdown a[href], .folder-link a[href]');
    if (folderAnchor) {
      window.location.href = folderAnchor.href;
    }
  });
});

// === Deselect folder if clicking outside ===
document.addEventListener('click', (e) => {
  if (!e.target.closest('.folder-card') && !e.target.closest('.folder-menu-btn') && !e.target.closest('.folder-menu-dropdown')) {
    document.querySelectorAll('.folder-card.selected').forEach(selectedCard => {
      selectedCard.classList.remove('selected');
      const cb = selectedCard.querySelector('.select-indicator');
      if (cb) cb.checked = false;
    });
  }
});


// === Snapshot selection & open on double click ===
document.querySelectorAll('.snapshot-card').forEach(card => {
  const checkbox = card.querySelector('input[type="checkbox"]');

  // Left click (single or ctrl)
  card.addEventListener('click', e => {
    if (e.target.closest('.snapshot-menu-btn') || e.target.closest('.snapshot-menu-dropdown')) return;

    const isCtrl = e.ctrlKey;

    // Ctrl + Click → toggle selection
    if (isCtrl) {
      card.classList.toggle('selected');
      if (checkbox) checkbox.checked = card.classList.contains('selected');
      return;
    }

    // Normal click → select only this one
    document.querySelectorAll('.snapshot-card.selected').forEach(s => {
      s.classList.remove('selected');
      const cb = s.querySelector('input[type="checkbox"]');
      if (cb) cb.checked = false;
    });

    card.classList.add('selected');
    if (checkbox) checkbox.checked = true;
  });

  // Right-click → toggle selection
  card.addEventListener('contextmenu', e => {
    e.preventDefault();
    card.classList.toggle('selected');
    if (checkbox) checkbox.checked = card.classList.contains('selected');
  });

  // Double click → open snapshot
  card.addEventListener('dblclick', e => {
    if (e.target.closest('.snapshot-menu-btn') || e.target.closest('.snapshot-menu-dropdown')) return;
    const snapAnchor = card.querySelector('.snapshot-link');
    if (snapAnchor) window.location.href = snapAnchor.href;
  });
});

// === Deselect snapshots when clicking outside ===
document.addEventListener('click', e => {
  if (!e.target.closest('.snapshot-card') && !e.target.closest('.snapshot-menu-btn') && !e.target.closest('.snapshot-menu-dropdown')) {
    document.querySelectorAll('.snapshot-card.selected').forEach(s => {
      s.classList.remove('selected');
      const cb = s.querySelector('input[type="checkbox"]');
      if (cb) cb.checked = false;
    });
  }
});
