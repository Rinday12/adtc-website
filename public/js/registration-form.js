/**
 * Registration Form — UAD Fields Toggle
 *
 * Shows/hides the UAD-specific fields (NIM/NIY + KTM upload) based on
 * the selected participant category, and keeps HTML5 required validation
 * in sync so the browser won't block submission when the fields are hidden.
 */

(function () {
  'use strict';

  /**
   * Toggle visibility and required state of UAD-specific fields.
   * Called on initial page load and on every category change.
   */
  function toggleUadFields() {
    var categorySelect = document.getElementById('categorySelect');
    var uadFields = document.getElementById('uadFields');

    if (!categorySelect || !uadFields) return;

    var uadCategories = ['mahasiswa_uad', 'karyawan_uad'];
    var isUad = uadCategories.indexOf(categorySelect.value) !== -1;

    if (isUad) {
      // Show the section
      uadFields.classList.remove('hidden');

      // Make all inputs inside required
      var inputs = uadFields.querySelectorAll('input');
      inputs.forEach(function (input) {
        input.setAttribute('required', 'required');
      });
    } else {
      // Hide the section
      uadFields.classList.add('hidden');

      // Remove required so the browser doesn't block form submission
      var inputs = uadFields.querySelectorAll('input');
      inputs.forEach(function (input) {
        input.removeAttribute('required');
      });
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var categorySelect = document.getElementById('categorySelect');

    if (categorySelect) {
      // Run once on load to handle pre-filled form data (e.g. validation errors)
      toggleUadFields();

      // Re-run whenever the user changes the category
      categorySelect.addEventListener('change', toggleUadFields);
    }
  });
})();
