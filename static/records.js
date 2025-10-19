let selectModeActive = false;
let snapshotSelectModeActive = false;

// === Folder state update ===
function updateFolderState() {
  const cards = document.querySelectorAll('.folder-card');
  const selected = document.querySelectorAll('.folder-card.selected').length;

  // Show/hide delete buttons
  cards.forEach(card => {
    const deleteBtn = card.querySelector('.delete-btn');
    if (!deleteBtn) return;
    deleteBtn.style.display = (selected === 0 && !selectModeActive) ? '' : 'none';
  });

  // Enable/disable folder links
  cards.forEach(card => {
    const link = card.querySelector('.folder-link');
    if (!link) return;
    link.style.pointerEvents = (selected > 0 || selectModeActive) ? 'none' : '';
  });

  // Enable/disable bulk delete button
  const bulkBtn = document.querySelector('.delete-selected-btn');
  if (bulkBtn) {
    bulkBtn.disabled = selected === 0;
    bulkBtn.style.opacity = selected === 0 ? '0.5' : '1';
    bulkBtn.style.pointerEvents = selected === 0 ? 'none' : '';
  }
}

// === Snapshot state update ===
function updateSnapshotState() {
  const cards = document.querySelectorAll('.snapshot-card');
  const selected = document.querySelectorAll('.snapshot-card.selected').length;

  // Show/hide delete buttons
  cards.forEach(card => {
    const deleteBtn = card.querySelector('.delete-btn');
    if (!deleteBtn) return;
    deleteBtn.style.display = (selected === 0 && !snapshotSelectModeActive) ? '' : 'none';
  });

  // Enable/disable links
  cards.forEach(card => {
    const link = card.querySelector('a'); // snapshot links
    if (!link) return;
    link.style.pointerEvents = (selected > 0 || snapshotSelectModeActive) ? 'none' : '';
  });

  // Enable/disable bulk delete button
  const bulkBtn = document.querySelector('.delete-selected-btn');
  if (bulkBtn) {
    bulkBtn.disabled = selected === 0;
    bulkBtn.style.opacity = selected === 0 ? '0.5' : '1';
    bulkBtn.style.pointerEvents = selected === 0 ? 'none' : '';
  }
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

  // Removed disableCheckboxes as no checkboxes exist

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
    setElementsState(true);
  };

  const closeModal = () => {
    modal.style.display = 'none';
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
    // Initial toggle to set button state
    updateFolderState();
  }

  // === Snapshot page checkboxes ===
  if (isSnapshotsPage) {
    // Initial toggle to set button state
    updateSnapshotState();
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
        updateFolderState();
        return;
      }

      // If select mode is active, toggle
      if (selectModeActive) {
        e.preventDefault();
        card.classList.toggle("selected");
        updateFolderState();
        return;
      }

      // Normal single click: clear other selections, select this only
      document.querySelectorAll('.folder-card.selected').forEach(c => {
        if (c !== card) {
          c.classList.remove('selected');
        }
      });

      card.classList.add("selected");
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
      e.preventDefault();
      openFolder();
    });

    // --- Right-click (context) → toggle selection ---
    card.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      if (isClickOnControl(e.target)) return;
      card.classList.toggle("selected");
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
        // Activate select mode
        if (isFoldersPage) {
          selectModeActive = true;
          updateFolderState();
        } else if (isSnapshotsPage) {
          snapshotSelectModeActive = true;
          updateSnapshotState();
        }
        // Close dropdown
        headerMenuContainer.classList.remove('active');
      } else if (text === 'select all') {
        if (isFoldersPage) {
          const cards = document.querySelectorAll('.folder-card');
          const allSelected = Array.from(cards).every(card => card.classList.contains('selected'));
          if (allSelected) {
            // Deselect all
            cards.forEach(card => card.classList.remove('selected'));
          } else {
            // Select all
            cards.forEach(card => card.classList.add('selected'));
          }
          updateFolderState();
        } else if (isSnapshotsPage) {
          const cards = document.querySelectorAll('.snapshot-card');
          const allSelected = Array.from(cards).every(card => card.classList.contains('selected'));
          if (allSelected) {
            // Deselect all
            cards.forEach(card => card.classList.remove('selected'));
          } else {
            // Select all
            cards.forEach(card => card.classList.add('selected'));
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
          cb.closest('.snapshot-card')
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
  const link = card.querySelector('.snapshot-link');

  const openSnapshot = () => {
    if (link) {
      window.location.href = link.href;
    }
  };

  // Ignore click if it's on a button, menu, or input inside the card
  const isClickOnControl = (target) => {
    return !!target.closest("button, input, .snapshot-menu-btn, .snapshot-menu-dropdown");
  };

  // --- Single click (select or toggle) ---
  card.addEventListener('click', e => {
    if (isClickOnControl(e.target)) return;

    // Ctrl or Cmd pressed → multi-select toggle
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      card.classList.toggle("selected");
      const cb = card.querySelector('input[type="checkbox"]');
      if (cb) cb.checked = card.classList.contains("selected");
      updateSnapshotState();
      return;
    }

    // If select mode is active, toggle
    if (snapshotSelectModeActive) {
      e.preventDefault();
      card.classList.toggle("selected");
      const cb = card.querySelector('input[type="checkbox"]');
      if (cb) cb.checked = card.classList.contains("selected");
      updateSnapshotState();
      return;
    }

    // Normal single click: clear other selections, select this only
    document.querySelectorAll('.snapshot-card.selected').forEach(c => {
      if (c !== card) {
        c.classList.remove('selected');
        const cb = c.querySelector('input[type="checkbox"]');
        if (cb) cb.checked = false;
      }
    });

    card.classList.add("selected");
    const cb = card.querySelector('input[type="checkbox"]');
    if (cb) cb.checked = true;
    updateSnapshotState();
  });

  // --- Double-click → open snapshot ---
  card.addEventListener("dblclick", (e) => {
    if (isClickOnControl(e.target)) return;
    e.preventDefault();
    openSnapshot();
  });

  // --- Right-click (context) → toggle selection ---
  card.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    if (isClickOnControl(e.target)) return;
    card.classList.toggle("selected");
    const cb = card.querySelector('input[type="checkbox"]');
    if (cb) cb.checked = card.classList.contains("selected");
    updateSnapshotState();
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
      let selectedCards = Array.from(document.querySelectorAll('.folder-card.selected, .snapshot-card.selected'));

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