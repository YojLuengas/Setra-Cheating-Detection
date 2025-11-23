document.addEventListener('DOMContentLoaded', () => {
  let selectedRow = null;
  let selectedId = null;
  const table = document.querySelector('.table');

  // ====== Row Selection Logic ======
  document.querySelectorAll('.user-row').forEach(row => {
    row.addEventListener('click', e => {
      e.stopPropagation();
      if (selectedRow === row) {
        row.classList.remove('selected-row');
        selectedRow = null;
        selectedId = null;
        return;
      }
      if (selectedRow) selectedRow.classList.remove('selected-row');
      row.classList.add('selected-row');
      selectedRow = row;
      selectedId = row.dataset.id;
    });
  });

  // ====== Deselect when clicking outside ======
  document.addEventListener('click', e => {
    const isInsideTable = table && table.contains(e.target);
    const isInsideDropdown = !!e.target.closest('.dropdown');
    const isInsideModal = !!e.target.closest('.modal');
    if (!isInsideTable && !isInsideDropdown && !isInsideModal) {
      if (selectedRow) {
        selectedRow.classList.remove('selected-row');
        selectedRow = null;
        selectedId = null;
      }
    }
  });

  // ====== Get Selected User ID ======
  function getSelectedId() {
    if (!selectedId) {
      const modalEl = document.getElementById('noSelectionModal');
      if (modalEl) {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
      } else {
        alert('Please select a user first.');
      }
      return null;
    }
    return selectedId;
  }

  // ====== Perform Admin Action ======
  async function performAction(url, modalId, successMsg, failMsg) {
    const id = getSelectedId();
    if (!id) return;

    // hide modal if present
    const modalEl = document.getElementById(modalId);
    if (modalEl) {
      const modalInstance = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
      modalInstance.hide();
    }

    try {
      const resp = await fetch(`${url}/${id}`, { method: 'POST' });
      if (resp.ok) {
        showFeedbackModal('Success', successMsg, 'success');
        setTimeout(() => location.reload(), 1200);
      } else {
        // try to parse error message if server returns json
        let msg = failMsg;
        try {
          const json = await resp.json();
          if (json && json.message) msg = json.message;
        } catch (_) {}
        showFeedbackModal('Error', msg, 'danger');
      }
    } catch (error) {
      console.error(error);
      showFeedbackModal('Error', 'A network error occurred.', 'danger');
    }
  }

  // ====== Feedback Modal ======
  function showFeedbackModal(title, message, type) {
    const modalHTML = `
      <div class="modal fade" id="feedbackModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content border-0 rounded-3 shadow-lg">
            <div class="modal-header border-0">
              <h5 class="modal-title text-${type === 'success' ? 'success' : 'danger'}">${title}</h5>
            </div>
            <div class="modal-body text-secondary">${message}</div>
          </div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modal = new bootstrap.Modal(document.getElementById('feedbackModal'));
    modal.show();
    setTimeout(() => {
      modal.hide();
      const el = document.getElementById('feedbackModal');
      if (el) el.remove();
    }, 1500);
  }

  // ====== Trigger buttons (open modals) ======
  const triggers = [
    { triggerId: 'resetPasswordBtn', modalId: 'resetPasswordModal' },
    { triggerId: 'activateBtn', modalId: 'activateModal' },
    { triggerId: 'deactivateBtn', modalId: 'deactivateModal' },
    { triggerId: 'deleteBtn', modalId: 'deleteModal' }
  ];

  triggers.forEach(({ triggerId, modalId }) => {
    const btn = document.getElementById(triggerId);
    if (!btn) return;
    btn.addEventListener('click', e => {
      e.preventDefault();
      if (getSelectedId()) {
        const modalEl = document.getElementById(modalId);
        if (modalEl) new bootstrap.Modal(modalEl).show();
      }
    });
  });

  // ====== CONFIRM buttons: robust handler using .confirm-action-btn ======
  document.querySelectorAll('.confirm-action-btn').forEach(confirmBtn => {
    confirmBtn.addEventListener('click', () => {
      // find parent modal
      const modalEl = confirmBtn.closest('.modal');
      if (!modalEl) return;

      const modalId = modalEl.id; // e.g. "resetPasswordModal"
      const actionKey = modalId.replace(/Modal$/, ''); // e.g. "resetPassword", "activate", "delete"

      // map actionKey -> endpoint & messages
      let url, successMsg, failMsg;
      switch (actionKey) {
        case 'resetPassword':
          url = '/admin/reset_password';
          successMsg = 'Password reset to 1234.';
          failMsg = 'Failed to reset password.';
          break;
        case 'activate':
          url = '/admin/activate_user';
          successMsg = 'User activated successfully.';
          failMsg = 'Failed to activate user.';
          break;
        case 'deactivate':
          url = '/admin/deactivate_user';
          successMsg = 'User deactivated successfully.';
          failMsg = 'Failed to deactivate user.';
          break;
        case 'delete':
          url = '/admin/delete_user';
          successMsg = 'User deleted successfully.';
          failMsg = 'Failed to delete user.';
          break;
        default:
          console.warn('Unknown action for modal:', actionKey);
          return;
      }

      performAction(url, modalId, successMsg, failMsg);
    });
  });
});