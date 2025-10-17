let selectModeActive = false;
let snapshotSelectModeActive = false;

// === Folder state update ===
function updateFolderState() {
  const cards = document.querySelectorAll('.folder-card');
  const checkboxes = document.querySelectorAll('.folder-card input[type="checkbox"]');
  const checked = document.querySelectorAll('.folder-card input[type="checkbox"]:checked').length;

  // Show/hide delete buttons
  cards.forEach(card => {
    const deleteBtn = card.querySelector('.delete-btn');
    if (!deleteBtn) return;
    deleteBtn.style.display = (checked === 0 && !selectModeActive) ? '' : 'none';
  });

  // Enable/disable folder links
  cards.forEach(card => {
    const link = card.querySelector('.folder-link');
    if (!link) return;
    link.style.pointerEvents = (checked > 0 || selectModeActive) ? 'none' : '';
    link.style.opacity = (checked > 0 || selectModeActive) ? '0.5' : '1';
  });

  // Show/hide checkboxes
  checkboxes.forEach(cb => cb.style.display = (selectModeActive || checked > 0) ? 'inline' : 'none');

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

  // Show/hide delete buttons
  cards.forEach(card => {
    const deleteBtn = card.querySelector('.delete-btn');
    if (!deleteBtn) return;
    deleteBtn.style.display = (checked === 0 && !snapshotSelectModeActive) ? '' : 'none';
  });

  // Enable/disable links
  cards.forEach(card => {
    const link = card.querySelector('a'); // snapshot links
    if (!link) return;
    link.style.pointerEvents = (checked > 0 || snapshotSelectModeActive) ? 'none' : '';
    link.style.opacity = (checked > 0 || snapshotSelectModeActive) ? '0.5' : '1';
  });

  // Show/hide checkboxes
  checkboxes.forEach(cb => cb.style.display = (snapshotSelectModeActive || checked > 0) ? 'inline' : 'none');

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

    // Add checkboxes to folder cards, initially hidden
    document.querySelectorAll('.folder-card').forEach(card => {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.style.width = '25px';
      checkbox.style.height = '25px';
      checkbox.style.display = 'none'; // Hide initially
      checkbox.style.position = 'absolute';
      checkbox.style.bottom = '10px';
      checkbox.style.left = '10px';
      checkbox.style.zIndex = '10';
      card.appendChild(checkbox);
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

    // Add checkboxes to snapshot cards
    document.querySelectorAll('.snapshot-card').forEach(card => {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.style.width = '25px';
      checkbox.style.height = '25px';
      checkbox.style.marginRight = '1px';
      checkbox.style.verticalAlign = 'middle';
      checkbox.style.display = 'none'; // Hide initially
      card.insertBefore(checkbox, card.firstChild);
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
    const dataSrc = img.getAttribute("data-src");
    if (!dataSrc) return;
    fetch(dataSrc)
      .then(response => response.text())
      .then(data => {
        if (!data) return;
        // If server already returns a data URI use it, otherwise prefix as JPEG base64
        img.src = data.startsWith("data:") ? data : ("data:image/jpeg;base64," + data);
      })
      .catch(err => console.warn("Failed to fetch thumbnail:", err));
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
// --- Handle folder interactions (single, double, ctrl, right-click) --- //

const folderCards = document.querySelectorAll(".folder-card");

// If you track whether select mode is active
let selectModeActive = false;

// Helper: Update state (optional function, you can define your own)
function updateFolderState() {
  const selectedCount = document.querySelectorAll('.folder-card.selected').length;
  console.log(`Selected folders: ${selectedCount}`);
}

folderCards.forEach(card => {
  const folderLinkDiv = card.querySelector(".folder-link");
  const folderName = folderLinkDiv?.dataset?.folder;

  const openFolder = () => {
    if (!folderName) return;
    window.location.href = `/records/folder/${encodeURIComponent(folderName)}`;
  };

  // Ignore click if it's on a button, menu, or input inside the card
  const isClickOnControl = (target) => {
    return !!target.closest("button, input, .folder-menu-btn, .folder-menu-dropdown");
  };

  // --- Single click (select or toggle) ---
  card.addEventListener("click", (e) => {
    if (isClickOnControl(e.target)) return;

    // Ctrl or Cmd pressed → multi-select toggle
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      card.classList.toggle("selected");
      const cb = card.querySelector('input[type="checkbox"], .select-indicator');
      if (cb) cb.checked = card.classList.contains("selected");
      updateFolderState();
      return;
    }

    // If select mode is active, toggle
    if (selectModeActive) {
      e.preventDefault();
      card.classList.toggle("selected");
      const cb = card.querySelector('input[type="checkbox"], .select-indicator');
      if (cb) cb.checked = card.classList.contains("selected");
      updateFolderState();
      return;
    }

    // Normal single click: clear other selections, select this only
    document.querySelectorAll('.folder-card.selected').forEach(c => {
      if (c !== card) {
        c.classList.remove('selected');
        const cb = c.querySelector('input[type="checkbox"], .select-indicator');
        if (cb) cb.checked = false;
      }
    });

    card.classList.add("selected");
    const cb = card.querySelector('input[type="checkbox"], .select-indicator');
    if (cb) cb.checked = true;
    updateFolderState();
  });


  // --- SORT MENU FUNCTIONALITY ---

document.querySelectorAll('.sort-option').forEach(option => {
  option.addEventListener('click', () => {
    const sortType = option.dataset.sort;
    const grid = document.querySelector('.records-grid');
    if (!grid) return;

    // Get all folder cards
    const folders = Array.from(grid.querySelectorAll('.folder-card'));

    // Sort logic
    let sortedFolders = [];
    if (sortType === 'name') {
      sortedFolders = folders.sort((a, b) => {
        const nameA = a.querySelector('.folder-name').textContent.trim().toLowerCase();
        const nameB = b.querySelector('.folder-name').textContent.trim().toLowerCase();
        return nameA.localeCompare(nameB);
      });
    } 
    else if (sortType === 'date') {
      // Requires Flask to include folder.created_at
      sortedFolders = folders.sort((a, b) => {
        const dateA = new Date(a.dataset.createdAt || 0);
        const dateB = new Date(b.dataset.createdAt || 0);
        return dateB - dateA; // newest first
      });
    } 
    else if (sortType === 'count') {
      sortedFolders = folders.sort((a, b) => {
        const countA = parseInt(a.querySelector('.folder-count').textContent) || 0;
        const countB = parseInt(b.querySelector('.folder-count').textContent) || 0;
        return countB - countA; // highest first
      });
    }

    // Re-append sorted elements to the grid
    sortedFolders.forEach(folder => grid.appendChild(folder));

    // Close dropdown after sort
    document.querySelector('.sort-dropdown')?.classList.remove('active');
  });
});


  // --- Double-click → open folder ---
  card.addEventListener("dblclick", (e) => {
    if (isClickOnControl(e.target)) return;
    openFolder();
  });

  // --- Right-click (context) → toggle selection ---
  card.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    if (isClickOnControl(e.target)) return;
    card.classList.toggle("selected");
    const cb = card.querySelector('input[type="checkbox"], .select-indicator');
    if (cb) cb.checked = card.classList.contains("selected");
    updateFolderState();
  });
});


  // Sort and header menu toggle
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
    if (sortDropdown && !sortDropdown.contains(e.target)) sortDropdown.classList.remove('active');
    if (headerMenuContainer && !headerMenuContainer.contains(e.target)) headerMenuContainer.classList.remove('active');
  });

  // Handle header menu item clicks
  document.querySelectorAll('.header-menu-item').forEach(item => {
    item.addEventListener('click', function(e) {
      e.stopPropagation();
      const text = this.textContent.trim().toLowerCase();
      if (text === 'select') {
        // Show checkboxes for all cards and activate select mode
        if (isFoldersPage) {
          selectModeActive = true;
          document.querySelectorAll('.folder-card input[type="checkbox"]').forEach(cb => cb.style.display = 'inline');
          updateFolderState();
        } else if (isSnapshotsPage) {
          snapshotSelectModeActive = true;
          document.querySelectorAll('.snapshot-card input[type="checkbox"]').forEach(cb => cb.style.display = 'inline');
          updateSnapshotState();
        }
        // Close dropdown
        headerMenuContainer.classList.remove('active');
      } else if (text === 'select all') {
        if (isFoldersPage) {
          const checkboxes = document.querySelectorAll('.folder-card input[type="checkbox"]');
          const allChecked = Array.from(checkboxes).every(cb => cb.checked);
          if (allChecked) {
            // Uncheck all, keep checkboxes visible
            checkboxes.forEach(cb => {
              cb.checked = false;
              cb.style.display = 'inline';
              cb.closest('.folder-card').style.border = '';
              cb.style.accentColor = '';
              cb.style.filter = '';
            });
          } else {
            // Check all, show checkboxes, apply styles
            checkboxes.forEach(cb => {
              cb.checked = true;
              cb.style.display = 'inline';
              cb.closest('.folder-card').style.border = '2px solid red';
              cb.style.accentColor = 'red';
              cb.style.filter = 'hue-rotate(120deg)';
            });
          }
          updateFolderState();
        } else if (isSnapshotsPage) {
          const checkboxes = document.querySelectorAll('.snapshot-card input[type="checkbox"]');
          const allChecked = Array.from(checkboxes).every(cb => cb.checked);
          if (allChecked) {
            // Uncheck all, keep checkboxes visible
            checkboxes.forEach(cb => {
              cb.checked = false;
              cb.style.display = 'inline';
              cb.closest('.snapshot-card').style.border = '';
              cb.style.accentColor = '';
              cb.style.filter = '';
            });
          } else {
            // Check all, show checkboxes, apply styles
            checkboxes.forEach(cb => {
              cb.checked = true;
              cb.style.display = 'inline';
              cb.closest('.snapshot-card').style.border = '2px solid red';
              cb.style.accentColor = 'red';
              cb.style.filter = 'hue-rotate(120deg)';
            });
          }
          updateSnapshotState();
        }
        // Close dropdown
        headerMenuContainer.classList.remove('active');
      }
    });
  });
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

// Handle snapshot menu item clicks
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('snapshot-menu-item')) {
    const text = e.target.textContent.trim().toLowerCase();
    if (text === 'select') {
      // Show checkboxes for snapshots
      snapshotSelectModeActive = true;
      document.querySelectorAll('.snapshot-card input[type="checkbox"]').forEach(cb => cb.style.display = 'inline');
      updateSnapshotState();
    } else if (text === 'select all') {
      // Handle select all for snapshots
      const checkboxes = document.querySelectorAll('.snapshot-card input[type="checkbox"]');
      const allChecked = Array.from(checkboxes).every(cb => cb.checked);
      if (allChecked) {
        checkboxes.forEach(cb => {
          cb.checked = false;
          cb.closest('.snapshot-card').style.border = '';
          cb.style.accentColor = '';
          cb.style.filter = '';
        });
      } else {
        checkboxes.forEach(cb => {
          cb.checked = true;
          cb.closest('.snapshot-card').style.border = '2px solid red';
          cb.style.accentColor = 'red';
          cb.style.filter = 'hue-rotate(120deg)';
        });
      }
      updateSnapshotState();
    }
    // Close the dropdown
    const container = e.target.closest('.snapshot-menu-container');
    if (container) container.classList.remove('active');
  }
});

// Make entire snapshot card clickable to open snapshot
document.querySelectorAll('.snapshot-card').forEach(card => {
  card.addEventListener('click', e => {
    // If in select mode, don't navigate
    if (snapshotSelectModeActive) return;
    // If click is on menu button or dropdown, don't navigate
    if (e.target.closest('.snapshot-menu-container')) return;
    // Else, find the link and navigate
    const link = card.querySelector('.snapshot-link');
    if (link) {
      window.location.href = link.href;
    }
  });
});

// Handle header dropdown delete for selected items
document.querySelectorAll('.header-menu-item').forEach(item => {
  item.addEventListener('click', function(e) {
    e.stopPropagation();
    const text = this.textContent.trim().toLowerCase();

    if (text === 'delete') {
      const isFoldersPage = document.querySelectorAll('.folder-card').length > 0;
      const isSnapshotsPage = document.querySelectorAll('.snapshot-card').length > 0;

      // Collect selected cards
      let selectedCards = [];
      if (isFoldersPage) {
        selectedCards = Array.from(document.querySelectorAll('.folder-card input[type="checkbox"]:checked'))
          .map(cb => cb.closest('.folder-card'));
      } else if (isSnapshotsPage) {
        selectedCards = Array.from(document.querySelectorAll('.snapshot-card input[type="checkbox"]:checked'))
          .map(cb => cb.closest('.snapshot-card'));
      }

      if (selectedCards.length === 0) {
        alert('No items selected.');
        return;
      }

      // Open confirmation modal
      const modal = document.getElementById('deleteModal');
      if (!modal) return;
      const confirmBtn = document.getElementById('confirmDelete');
      const cancelBtn = modal.querySelector('.cancel');
      const closeBtn = modal.querySelector('.close');

      modal.querySelector('p').textContent = `Are you sure you want to delete ${selectedCards.length} selected item${selectedCards.length > 1 ? 's' : ''}?`;
      modal.style.display = 'block';
      modal.style.zIndex = '1000';

      const handleConfirm = async () => {
        for (const card of selectedCards) {
          const form = card.querySelector('.delete-form');
          const deleteBtn = card.querySelector('.delete-btn');
          const deleteUrl = deleteBtn?.dataset?.deleteUrl || deleteBtn?.href;

          try {
            if (form) {
              const response = await fetch(form.action, { method: form.method || 'POST' });
              if (!response.ok) console.error('Form delete failed:', response.status);
            } else if (deleteUrl) {
              const response = await fetch(deleteUrl, { method: 'POST' });
              if (!response.ok) console.error('URL delete failed:', response.status);
            }
            card.remove();
          } catch (err) {
            console.error('Error deleting:', err);
          }
        }

        modal.style.display = 'none';
        if (isFoldersPage) {
          selectModeActive = false;
          updateFolderState();
        } else if (isSnapshotsPage) {
          snapshotSelectModeActive = false;
          updateSnapshotState();
        }

        confirmBtn.removeEventListener('click', handleConfirm);
      };

      confirmBtn.addEventListener('click', handleConfirm, { once: true });
      [cancelBtn, closeBtn].forEach(el => el.addEventListener('click', () => modal.style.display = 'none', { once: true }));

      // Close dropdown
      const headerMenuContainer = document.querySelector('.header-menu-container');
      if (headerMenuContainer) headerMenuContainer.classList.remove('active');
    }
  });
});