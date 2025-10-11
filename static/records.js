document.addEventListener('DOMContentLoaded', function() {
  // Modal handling
  const modal = document.getElementById('deleteModal');
  if (modal) {
    const confirmBtn = document.getElementById('confirmDelete');
    const cancelBtn = document.querySelector('.cancel');
    const closeBtn = document.querySelector('.close');
    let currentForm = null;
    let selectedForms = [];

    // Check if on folders page
    const isFoldersPage = document.querySelectorAll('.folder-card').length > 0;

    if (isFoldersPage) {
      // Add checkboxes and bulk delete button
      const recordsHeader = document.querySelector('.records-header');
      let bulkDeleteBtn;
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
          modal.style.display = 'block';
          bulkDeleteBtn.style.display = 'none'; // Hide button when modal opens
        });
      }

      // Function to toggle delete button visibility
      const toggleDeleteButton = () => {
        const checkedBoxes = document.querySelectorAll('.folder-card input[type="checkbox"]:checked');
        if (bulkDeleteBtn) {
          bulkDeleteBtn.style.display = checkedBoxes.length > 0 ? 'inline-block' : 'none';
        }
      };

      // Add checkboxes to folder cards
      document.querySelectorAll('.folder-card').forEach(card => {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.style.marginRight = '10px';
        checkbox.addEventListener('change', toggleDeleteButton);
        const folderContent = card.querySelector('.folder-content');
        if (folderContent) {
          folderContent.insertBefore(checkbox, folderContent.firstChild);
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
        modal.style.display = 'block';
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
            } else {
              alert('Delete failed');
              modal.style.display = 'none';
            }
          }).catch(error => {
            console.error('Error:', error);
            alert('Delete failed');
            modal.style.display = 'none';
          });
        } else if (selectedForms.length > 0) {
          // Bulk delete
          let deleteCount = 0;
          selectedForms.forEach(form => {
            fetch(form.action, {
              method: 'POST',
              body: new FormData(form)
            }).then(response => {
              if (response.ok) {
                const card = form.closest('.folder-card');
                if (card) card.remove();
              } else {
                console.error('Delete failed for', form.action);
              }
              deleteCount++;
              if (deleteCount === selectedForms.length) {
                modal.style.display = 'none';
                toggleDeleteButton(); // Hide button after delete
              }
            }).catch(error => {
              console.error('Error:', error);
              deleteCount++;
              if (deleteCount === selectedForms.length) {
                modal.style.display = 'none';
                toggleDeleteButton(); // Hide button after delete
              }
            });
          });
        }
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', function() {
        modal.style.display = 'none';
        if (isFoldersPage) toggleDeleteButton(); // Show button back if cancelled
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', function() {
        modal.style.display = 'none';
        if (isFoldersPage) toggleDeleteButton(); // Show button back if closed
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
