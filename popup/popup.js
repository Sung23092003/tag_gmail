document.addEventListener('DOMContentLoaded', () => {
  const tagList = document.getElementById('tag-list');
  const addTagBtn = document.getElementById('add-tag-btn');
  const tagForm = document.getElementById('tag-form');
  const cancelBtn = document.getElementById('cancel-btn');
  const saveTagBtn = document.getElementById('save-tag-btn');
  const colorOptions = document.querySelectorAll('.color-option');
  const tagColorPicker = document.getElementById('tag-color');

  let selectedColor = '#3399ff';

  // Load tags
  loadTags();

  // Toggle form
  addTagBtn.addEventListener('click', () => {
    tagForm.classList.remove('hidden');
    addTagBtn.classList.add('hidden');
  });

  cancelBtn.addEventListener('click', () => {
    tagForm.classList.add('hidden');
    addTagBtn.classList.remove('hidden');
    resetForm();
  });

  // Color selection
  colorOptions.forEach(opt => {
    opt.addEventListener('click', () => {
      colorOptions.forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      selectedColor = opt.dataset.color;
      tagColorPicker.value = selectedColor;
    });
  });

  tagColorPicker.addEventListener('input', () => {
    colorOptions.forEach(o => o.classList.remove('selected'));
    selectedColor = tagColorPicker.value;
  });

  // Save tag (New or Update)
  saveTagBtn.addEventListener('click', () => {
    const name = document.getElementById('tag-name').value.trim();
    const icon = document.getElementById('tag-icon').value.trim();
    const editId = document.getElementById('edit-tag-id').value;

    if (!name) {
      alert('Vui lòng nhập tên tag');
      return;
    }

    chrome.storage.sync.get(['customTags'], (result) => {
      let tags = result.customTags || [];

      if (editId) {
        // Update existing
        tags = tags.map(t => t.id === editId ? { ...t, name, icon: icon || '🏷️', color: selectedColor } : t);
      } else {
        // Create new
        const newTag = {
          id: 'tag_' + Date.now(),
          name,
          color: selectedColor,
          icon: icon || '🏷️'
        };
        tags.push(newTag);
      }

      chrome.storage.sync.set({ customTags: tags }, () => {
        loadTags();
        tagForm.classList.add('hidden');
        addTagBtn.classList.remove('hidden');
        resetForm();
      });
    });
  });

  function loadTags() {
    chrome.storage.sync.get(['customTags'], (result) => {
      const tags = result.customTags || [];
      tagList.innerHTML = '';

      if (tags.length === 0) {
        tagList.innerHTML = '<p style="text-align:center; color: #a1a1aa; font-size: 0.8rem;">Chưa có tag nào. Hãy tạo một cái!</p>';
        return;
      }

      tags.forEach(tag => {
        const item = document.createElement('div');
        item.className = 'tag-item';

        let iconHtml = '';
        if (tag.icon.includes('<i')) {
          iconHtml = tag.icon;
        } else if (/^[a-z0-9_]+$/i.test(tag.icon)) {
          iconHtml = `<span class="material-symbols-outlined">${tag.icon}</span>`;
        } else {
          iconHtml = tag.icon;
        }

        item.innerHTML = `
          <div class="tag-info">
            <span class="tag-icon">${iconHtml}</span>
            <div class="tag-color-circle" style="background: ${tag.color}"></div>
            <span class="tag-name">${tag.name}</span>
          </div>
          <div class="actions">
            <button class="edit-btn" data-id="${tag.id}">✎</button>
            <button class="delete-btn" data-id="${tag.id}">✕</button>
          </div>
        `;
        tagList.appendChild(item);

        item.querySelector('.edit-btn').addEventListener('click', (e) => {
          const id = e.target.dataset.id;
          startEditing(id);
        });

        item.querySelector('.delete-btn').addEventListener('click', (e) => {
          const id = e.target.dataset.id;
          deleteTag(id);
        });
      });
    });
  }

  function startEditing(id) {
    chrome.storage.sync.get(['customTags'], (result) => {
      const tags = result.customTags || [];
      const tag = tags.find(t => t.id === id);
      if (tag) {
        document.getElementById('tag-name').value = tag.name;
        document.getElementById('tag-icon').value = tag.icon;
        document.getElementById('edit-tag-id').value = tag.id;
        selectedColor = tag.color;
        tagColorPicker.value = tag.color;

        // Set selected color preset
        colorOptions.forEach(opt => {
          if (opt.dataset.color === tag.color) opt.classList.add('selected');
          else opt.classList.remove('selected');
        });

        tagForm.classList.remove('hidden');
        addTagBtn.classList.add('hidden');
        saveTagBtn.innerText = 'Cập nhật Tag';
      }
    });
  }

  function deleteTag(id) {
    chrome.storage.sync.get(['customTags'], (result) => {
      const tags = result.customTags || [];
      const updatedTags = tags.filter(t => t.id !== id);
      chrome.storage.sync.set({ customTags: updatedTags }, () => {
        loadTags();
      });
    });
  }

  function resetForm() {
    document.getElementById('tag-name').value = '';
    document.getElementById('tag-icon').value = '';
    document.getElementById('edit-tag-id').value = '';
    saveTagBtn.innerText = 'Lưu Tag';
    colorOptions.forEach(o => o.classList.remove('selected'));
    selectedColor = '#3399ff';
    tagColorPicker.value = selectedColor;
  }
});
