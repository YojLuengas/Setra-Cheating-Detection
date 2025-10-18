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
      // Removed opacity fade to prevent white fade color on folders
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
      // Removed opacity fade to prevent white fade color on snapshots
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

  // === Sort dropdown ===
  const sortDropdown = document.querySelector('.sort-dropdown');
  const sortBtn = document.querySelector('.sort-btn');
  const headerMenuContainer = document.querySelector('.header-menu-container');
  const headerMenuBtn = document.querySelector('.header-menu-btn');

  sortBtn?.addEventListener('click', () => {
    sortDropdown.classList.toggle('active');
  });

  headerMenuBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    headerMenuContainer.classList.toggle('active');
  });

  document.addEventListener('click', (e) => {
    if (!sortDropdown?.contains(e.target)) sortDropdown?.classList.remove('active');
    if (!headerMenuContainer?.contains(e.target)) headerMenuContainer?.classList.remove('active');
  });

  // Handle header menu item clicks
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('select-mode-btn')) {
      const text = e.target.textContent.trim().toLowerCase();
      if (text === 'select') {
        // Enable select mode for folders or snapshots
        if (isFoldersPage) {
          document.querySelectorAll('.folder-card input[type="checkbox"]').forEach(cb => {
            cb.style.display = 'inline';
          });
          updateFolderState();
        } else if (isSnapshotsPage) {
          document.querySelectorAll('.snapshot-card input[type="checkbox"]').forEach(cb => {
            cb.style.display = 'inline';
          });
          updateSnapshotState();
        }
        // Close the dropdown
        headerMenuContainer.classList.remove('active');
      } else if (text === 'select all') {
        // Toggle select all
        if (isFoldersPage) {
          const checkboxes = document.querySelectorAll('.folder-card input[type="checkbox"]');
          const allChecked = Array.from(checkboxes).every(cb => cb.checked);
          if (allChecked) {
            // Uncheck all and exit select mode
            checkboxes.forEach(cb => {
              cb.checked = false;
              cb.style.display = 'none';
              cb.closest('.folder-card').style.border = '';
              cb.style.accentColor = '';
              cb.style.filter = '';
            });
            document.querySelectorAll('.folder-card .delete-btn').forEach(btn => btn.style.display = '');
        document.querySelectorAll('.folder-card .folder-link').forEach(a => {
          a.style.pointerEvents = '';
        });
            updateFolderState();
          } else {
            // Check all
            checkboxes.forEach(cb => {
              cb.style.display = 'inline';
              cb.checked = true;
              cb.closest('.folder-card').style.border = '2px solid red';
              cb.style.accentColor = 'red';
              cb.style.filter = 'hue-rotate(120deg)';
            });
            document.querySelectorAll('.folder-card .folder-link').forEach(a => {
              a.style.pointerEvents = 'none';
            });
            updateFolderState();
          }
        } else if (isSnapshotsPage) {
          const checkboxes = document.querySelectorAll('.snapshot-card input[type="checkbox"]');
          const allChecked = Array.from(checkboxes).every(cb => cb.checked);
          if (allChecked) {
            // Uncheck all and exit select mode
            checkboxes.forEach(cb => {
              cb.checked = false;
              cb.style.display = 'none';
              cb.closest('.snapshot-card').style.border = '';
              cb.style.accentColor = '';
              cb.style.filter = '';
            });
            document.querySelectorAll('.snapshot-card .delete-btn').forEach(btn => btn.style.display = '');
            updateSnapshotState();
          } else {
            // Check all
            checkboxes.forEach(cb => {
              cb.style.display = 'inline';
              cb.checked = true;
              cb.closest('.snapshot-card').style.border = '2px solid red';
              cb.style.accentColor = 'red';
              cb.style.filter = 'hue-rotate(120deg)';
            });
            updateSnapshotState();
          }
        }
        // Close the dropdown
        headerMenuContainer.classList.remove('active');
      }
    }
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
      // Show checkboxes
      document.querySelectorAll('.folder-card input[type="checkbox"]').forEach(cb => {
        cb.style.display = 'inline';
      });
      updateFolderState();
      // Close the dropdown
      const container = e.target.closest('.folder-menu-container');
      if (container) container.classList.remove('active');
    } else if (e.target.classList.contains('folder-menu-item') && e.target.textContent.trim().toLowerCase() === 'select all') {
      e.stopPropagation();
      // Hide delete buttons
      document.querySelectorAll('.folder-card .delete-btn').forEach(btn => btn.style.display = 'none');
      // Show checkboxes
      document.querySelectorAll('.folder-card input[type="checkbox"]').forEach(cb => {
        cb.style.display = 'inline';
      });
      // Toggle select all
      const checkboxes = document.querySelectorAll('.folder-card input[type="checkbox"]');
      const allChecked = Array.from(checkboxes).every(cb => cb.checked);
      if (allChecked) {
        // Uncheck all and exit select mode
        checkboxes.forEach(cb => {
          cb.checked = false;
          cb.style.display = 'none';
          cb.closest('.folder-card').style.border = '';
          cb.style.accentColor = '';
          cb.style.filter = '';
        });
        document.querySelectorAll('.folder-card .delete-btn').forEach(btn => btn.style.display = '');
        document.querySelectorAll('.folder-card .folder-link').forEach(a => {
          a.style.pointerEvents = '';
          a.style.opacity = '1';
        });
        updateFolderState();
      } else {
        // Check all
        checkboxes.forEach(cb => {
          cb.checked = true;
          cb.closest('.folder-card').style.border = '2px solid red';
          cb.style.accentColor = 'red';
          cb.style.filter = 'hue-rotate(120deg)';
        });
        document.querySelectorAll('.folder-card .folder-link').forEach(a => {
          a.style.pointerEvents = 'none';
          a.style.opacity = '0.5';
        });
        updateFolderState();
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
      // Show checkboxes
      document.querySelectorAll('.snapshot-card input[type="checkbox"]').forEach(cb => {
        cb.style.display = 'inline';
      });
      updateSnapshotState();
      // Close the dropdown
      const container = e.target.closest('.snapshot-menu-container');
      if (container) container.classList.remove('active');
    } else if (e.target.classList.contains('snapshot-menu-item') && e.target.textContent.trim().toLowerCase() === 'select all') {
      e.stopPropagation();
      // Hide delete buttons
      document.querySelectorAll('.snapshot-card .delete-btn').forEach(btn => btn.style.display = 'none');
      // Show checkboxes
      document.querySelectorAll('.snapshot-card input[type="checkbox"]').forEach(cb => {
        cb.style.display = 'inline';
      });
      // Toggle select all
      const checkboxes = document.querySelectorAll('.snapshot-card input[type="checkbox"]');
      const allChecked = Array.from(checkboxes).every(cb => cb.checked);
      if (allChecked) {
        // Uncheck all and exit select mode
        checkboxes.forEach(cb => {
          cb.checked = false;
          cb.style.display = 'none';
          cb.closest('.snapshot-card').style.border = '';
          cb.style.accentColor = '';
          cb.style.filter = '';
        });
        document.querySelectorAll('.snapshot-card .delete-btn').forEach(btn => btn.style.display = '');
        updateSnapshotState();
      } else {
        // Check all
        checkboxes.forEach(cb => {
          cb.checked = true;
          cb.closest('.snapshot-card').style.border = '2px solid red';
          cb.style.accentColor = 'red';
          cb.style.filter = 'hue-rotate(120deg)';
        });
        updateSnapshotState();
      }
      // Close the dropdown
      const container = e.target.closest('.snapshot-menu-container');
      if (container) container.classList.remove('active');
    }
  });

  // === Select folder on click & open on double click ===
  document.querySelectorAll('.folder-card').forEach(card => {
    // Single / Ctrl+Click selection
    card.addEventListener('click', (e) => {
      if (e.target.closest('.folder-menu-btn') || e.target.closest('.folder-menu-dropdown')) return;

      const checkbox = card.querySelector('input[type="checkbox"]');
      const isSelectMode = checkbox && checkbox.style.display !== 'none';
      const isCtrl = e.ctrlKey; // Detect Ctrl key

      if (isSelectMode) {
        // In select mode, toggle selection on click
        card.classList.toggle('selected');
        if (checkbox) checkbox.checked = card.classList.contains('selected');
        return;
      }

      // Ctrl+Click → toggle selection
      if (isCtrl) {
        card.classList.toggle('selected');
        if (checkbox) checkbox.checked = card.classList.contains('selected');
        return;
      }

      // Normal click → select only this
      document.querySelectorAll('.folder-card.selected').forEach(selectedCard => {
        selectedCard.classList.remove('selected');
        const cb = selectedCard.querySelector('input[type="checkbox"]');
        if (cb) cb.checked = false;
      });

      card.classList.add('selected');
      if (checkbox) checkbox.checked = true;
    });

    // Right-click → toggle (like Ctrl)
    card.addEventListener('contextmenu', (e) => {
      e.preventDefault(); // prevent context menu
      const checkbox = card.querySelector('input[type="checkbox"]');
      card.classList.toggle('selected');
      if (checkbox) checkbox.checked = card.classList.contains('selected');
    });

    // Double click → open folder
    card.addEventListener('dblclick', (e) => {
      if (e.target.closest('.folder-menu-btn') || e.target.closest('.folder-menu-dropdown')) return;

      const folderAnchor = card.querySelector('.folder-menu-dropdown a[href], .folder-link[href]');
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
        const cb = selectedCard.querySelector('input[type="checkbox"]');
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

      const isSelectMode = checkbox && checkbox.style.display !== 'none';
      const isCtrl = e.ctrlKey;

      if (isSelectMode) {
        // In select mode, toggle selection on click
        card.classList.toggle('selected');
        if (checkbox) checkbox.checked = card.classList.contains('selected');
        return;
      }

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
});
