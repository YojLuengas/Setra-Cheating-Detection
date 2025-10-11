document.addEventListener('DOMContentLoaded', function() {
  // Modal handling
  const modal = document.getElementById('deleteModal');
  if (modal) {
    const confirmBtn = document.getElementById('confirmDelete');
    const cancelBtn = document.querySelector('.cancel');
    const closeBtn = document.querySelector('.close');
    let currentForm = null;
    let selectedForms = [];
    let bulkDeleteBtn;
    let bulkDeleteBtnSnapshots;

    // Check if on folders page
    const isFoldersPage = document.querySelectorAll('.folder-card').length > 0;
    const isSnapshotsPage = document.querySelectorAll('.snapshot-card').length > 0;

    // Functions to disable/enable checkboxes to prevent glitching during modal
    const disableCheckboxes = () => {
      document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.disabled = true;
      });
    };
    const enableCheckboxes = () => {
      document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.disabled = false;
      });
    };

    // Functions to dim/enable delete buttons and forms during modal
    const disableDeleteElements = () => {
      document.querySelectorAll('.delete-form').forEach(form => {
        form.style.opacity = '0.5';
        form.style.pointerEvents = 'none';
      });
      document.querySelectorAll('.delete-selected-btn').forEach(btn => {
        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.style.pointerEvents = 'none';
      });
      // Add backdrop to dim the background
      let backdrop = document.querySelector('.modal-backdrop');
      if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop';
        backdrop.style.position = 'fixed';
        backdrop.style.top = '0';
        backdrop.style.left = '0';
        backdrop.style.width = '100%';
        backdrop.style.height = '100%';
        backdrop.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        backdrop.style.zIndex = '999';
        document.body.appendChild(backdrop);
      }
    };
    const enableDeleteElements = () => {
      document.querySelectorAll('.delete-form').forEach(form => {
        form.style.opacity = '1';
        form.style.pointerEvents = '';
      });
      document.querySelectorAll('.delete-selected-btn').forEach(btn => {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.pointerEvents = '';
      });
      // Remove backdrop
      const backdrop = document.querySelector('.modal-backdrop');
      if (backdrop) {
        backdrop.remove();
      }
    };

    if (isFoldersPage) {
      // Add checkboxes and bulk delete button
      const recordsHeader = document.querySelector('.records-header');
      if (recordsHeader) {
        bulkDeleteBtn = document.createElement('button');
        bulkDeleteBtn.textContent = 'Delete Selected';
        bulkDeleteBtn.className = 'delete-selected-btn';
        bulkDeleteBtn.style.marginLeft = '10px';
        bulkDeleteBtn.style.padding = '5px 10px';
        bulkDeleteBtn.style.backgroundColor = '#dc3545';
        bulkDeleteBtn.style.color = 'white';
        bulkDeleteBtn.style.border = 'none';
        bulkDeleteBtn.style.borderRadius = '4px';
        bulkDeleteBtn.style.cursor = 'pointer';
        bulkDeleteBtn.style.display = 'none'; // Hidden initially
        recordsHeader.appendChild(bulkDeleteBtn);

        bulkDeleteBtn.addEventListener('click', function() {
          selectedForms = [];
          document.querySelectorAll('.folder-card input[type="checkbox"]:checked').forEach(checkbox => {
            const form = checkbox.closest('.folder-card').querySelector('.delete-form');
            if (form) selectedForms.push(form);
          });
          if (selectedForms.length === 0) {
            alert('No folders selected.');
            return;
          }
          const modalP = modal.querySelector('p');
          modalP.textContent = `Are you sure you want to delete ${selectedForms.length} selected folder${selectedForms.length > 1 ? 's' : ''} and all their snapshots?`;
          disableCheckboxes();
          disableDeleteElements();
          modal.style.display = 'block';
          modal.style.zIndex = '1000';
        });
      }

      // Function to toggle delete button visibility
      const toggleDeleteButton = () => {
        const checkedBoxes = document.querySelectorAll('.folder-card input[type="checkbox"]:checked');
        if (bulkDeleteBtn) {
          bulkDeleteBtn.style.display = checkedBoxes.length > 0 ? 'inline-block' : 'none';
        }
      };

      // Add checkboxes to folder cards beside delete button
      document.querySelectorAll('.folder-card').forEach(card => {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.style.width = '25px';
        checkbox.style.height = '25px'; // Match delete button height
        checkbox.style.marginRight = '1px';
        checkbox.style.verticalAlign = 'middle'; // Align with delete button
        checkbox.addEventListener('change', toggleDeleteButton);
        const deleteForm = card.querySelector('.delete-form');
        if (deleteForm) {
          deleteForm.insertBefore(checkbox, deleteForm.firstChild);
        }
      });
    }

    if (isSnapshotsPage) {
      // Add checkboxes and bulk delete button for snapshots
      const recordsHeader = document.querySelector('.records-header');
      if (recordsHeader) {
        bulkDeleteBtnSnapshots = document.createElement('button');
        bulkDeleteBtnSnapshots.textContent = 'Delete Selected';
        bulkDeleteBtnSnapshots.className = 'delete-selected-btn';
        bulkDeleteBtnSnapshots.style.marginLeft = '10px';
        bulkDeleteBtnSnapshots.style.padding = '5px 10px';
        bulkDeleteBtnSnapshots.style.backgroundColor = '#dc3545';
        bulkDeleteBtnSnapshots.style.color = 'white';
        bulkDeleteBtnSnapshots.style.border = 'none';
        bulkDeleteBtnSnapshots.style.borderRadius = '4px';
        bulkDeleteBtnSnapshots.style.cursor = 'pointer';
        bulkDeleteBtnSnapshots.style.display = 'none'; // Hidden initially
        recordsHeader.appendChild(bulkDeleteBtnSnapshots);

        bulkDeleteBtnSnapshots.addEventListener('click', function() {
          selectedForms = [];
          document.querySelectorAll('.snapshot-card input[type="checkbox"]:checked').forEach(checkbox => {
            const form = checkbox.closest('.snapshot-card').querySelector('.delete-form');
            if (form) selectedForms.push(form);
          });
          if (selectedForms.length === 0) {
            alert('No snapshots selected.');
            return;
          }
          const modalP = modal.querySelector('p');
          modalP.textContent = `Are you sure you want to delete ${selectedForms.length} selected snapshot${selectedForms.length > 1 ? 's' : ''}?`;
          disableCheckboxes();
          disableDeleteElements();
          modal.style.display = 'block';
          modal.style.zIndex = '1000';
        });
      }

      // Function to toggle delete button visibility for snapshots
      const toggleDeleteButtonSnapshots = () => {
        const checkedBoxes = document.querySelectorAll('.snapshot-card input[type="checkbox"]:checked');
        if (bulkDeleteBtnSnapshots) {
          bulkDeleteBtnSnapshots.style.display = checkedBoxes.length > 0 ? 'inline-block' : 'none';
        }
      };

      // Add checkboxes to snapshot cards beside delete button
      document.querySelectorAll('.snapshot-card').forEach(card => {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.style.width = '25px';
        checkbox.style.height = '25px'; // Match delete button height
        checkbox.style.marginRight = '1px';
        checkbox.style.verticalAlign = 'middle'; // Align with delete button
        checkbox.addEventListener('change', toggleDeleteButtonSnapshots);
        const deleteForm = card.querySelector('.delete-form');
        if (deleteForm) {
          deleteForm.insertBefore(checkbox, deleteForm.firstChild);
        }
      });
    }

    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        currentForm = this.closest('form');
        selectedForms = [];
        const modalP = modal.querySelector('p');
        if (currentForm.closest('.folder-card')) {
          modalP.textContent = 'Are you sure you want to delete this folder and all its snapshots?';
        } else {
          modalP.textContent = 'Are you sure you want to delete this snapshot?';
        }
        disableCheckboxes();
        disableDeleteElements();
        modal.style.display = 'block';
        modal.style.zIndex = '1000';
      });
    });

    if (confirmBtn) {
      confirmBtn.addEventListener('click', function() {
        if (currentForm) {
          // Single delete
          fetch(currentForm.action, {
            method: 'POST',
            body: new FormData(currentForm)
          }).then(response => {
            if (response.ok) {
              const card = currentForm.closest('.folder-card') || currentForm.closest('.snapshot-card');
              if (card) card.remove();
              modal.style.display = 'none';
              enableCheckboxes();
              enableDeleteElements();
            } else {
              alert('Delete failed');
              modal.style.display = 'none';
              enableCheckboxes();
              enableDeleteElements();
            }
          }).catch(error => {
            console.error('Error:', error);
            alert('Delete failed');
            modal.style.display = 'none';
            enableCheckboxes();
            enableDeleteElements();
          });
        } else if (selectedForms.length > 0) {
          // Bulk delete
          const isBulkFolders = selectedForms[0].closest('.folder-card') !== null;
          // Hide bulk button immediately on confirm
          if (isBulkFolders && bulkDeleteBtn) {
            bulkDeleteBtn.style.display = 'none';
          } else if (!isBulkFolders && bulkDeleteBtnSnapshots) {
            bulkDeleteBtnSnapshots.style.display = 'none';
          }
          let deleteCount = 0;
          selectedForms.forEach(form => {
            fetch(form.action, {
              method: 'POST',
              body: new FormData(form)
            }).then(response => {
              if (response.ok) {
                const card = form.closest('.folder-card') || form.closest('.snapshot-card');
                if (card) card.remove();
              } else {
                console.error('Delete failed for', form.action);
              }
              deleteCount++;
              if (deleteCount === selectedForms.length) {
                modal.style.display = 'none';
                enableCheckboxes();
                enableDeleteElements();
                if (isBulkFolders) {
                  toggleDeleteButton(); // Update visibility after delete
                } else {
                  toggleDeleteButtonSnapshots(); // Update visibility after delete
                }
              }
            }).catch(error => {
              console.error('Error:', error);
              deleteCount++;
              if (deleteCount === selectedForms.length) {
                modal.style.display = 'none';
                enableCheckboxes();
                enableDeleteElements();
                if (isBulkFolders) {
                  toggleDeleteButton(); // Update visibility after delete
                } else {
                  toggleDeleteButtonSnapshots(); // Update visibility after delete
                }
              }
            });
          });
        }
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', function() {
        modal.style.display = 'none';
        enableCheckboxes();
        enableDeleteElements();
        if (isFoldersPage) {
          toggleDeleteButton(); // Show button back if cancelled
        } else if (isSnapshotsPage) {
          toggleDeleteButtonSnapshots(); // Show button back if cancelled
        }
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', function() {
        modal.style.display = 'none';
        enableCheckboxes();
        enableDeleteElements();
        if (isFoldersPage) {
          toggleDeleteButton(); // Show button back if closed
        } else if (isSnapshotsPage) {
          toggleDeleteButtonSnapshots(); // Show button back if closed
        }
      });
    }
  }

  // Load thumbnails for records_folder
  document.querySelectorAll(".record-thumb").forEach(function(img) {
    const src = img.getAttribute("data-src");
    if (!src) return;
    // fetch text because cheating_snapshot returns a data URI string
    fetch(src)
      .then(r => r.text())
      .then(t => {
        if (!t) return;
        img.src = t.startsWith("data:") ? t : ("data:image/jpeg;base64," + t);
      })
      .catch(() => {
        // fallback: use the endpoint URL directly (some setups return binary)
        img.src = src;
      });
  });
});
