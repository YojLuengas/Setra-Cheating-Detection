document.addEventListener('DOMContentLoaded', function() {
  // Modal handling
  const modal = document.getElementById('deleteModal');
  if (modal) {
    const confirmBtn = document.getElementById('confirmDelete');
    const cancelBtn = document.querySelector('.cancel');
    const closeBtn = document.querySelector('.close');
    let currentForm = null;

    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        currentForm = this.closest('form');
        modal.style.display = 'block';
      });
    });

    if (confirmBtn) {
      confirmBtn.addEventListener('click', function() {
        if (currentForm) {
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
        }
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', function() {
        modal.style.display = 'none';
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', function() {
        modal.style.display = 'none';
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
