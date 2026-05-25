(function () {
    let customTags = [];
    let threadTags = {};

    // Load configuration
    function refreshData() {
        chrome.storage.sync.get(['customTags', 'threadTags'], (result) => {
            customTags = result.customTags || [];
            threadTags = result.threadTags || {};
            updateThreadListUI();
        });
    }

    refreshData();

    // Inject Google Material Symbols
    function injectMaterialIcons() {
        if (document.head.querySelector('#gt-material-icons')) return;
        const link = document.createElement('link');
        link.id = 'gt-material-icons';
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20,400,0,0';
        document.head.appendChild(link);
    }
    injectMaterialIcons();

    // Watch for storage changes
    chrome.storage.onChanged.addListener((changes) => {
        if (changes.customTags || changes.threadTags) {
            refreshData();
        }
    });

    // Main UI Injection Logic with Debounce to prevent infinite loops
    let updateTimeout;
    const observer = new MutationObserver((mutations) => {
        // Ignore changes made by the extension itself - more robust check
        const isOurChange = mutations.some(m => {
            const target = m.target;
            if (!target || !target.classList) return false;
            return target.classList.contains('gt-tag-container') ||
                target.classList.contains('gt-tag-pill') ||
                target.classList.contains('gt-hover-tag-li') ||
                target.classList.contains('gt-menu-container') ||
                (m.addedNodes && Array.from(m.addedNodes).some(n => n.classList && n.classList.contains('gt-tag-pill')));
        });
        if (isOurChange) return;

        clearTimeout(updateTimeout);
        updateTimeout = setTimeout(() => {
            injectToolbarButton();
            injectHoverTagButton();
            updateThreadListUI();
        }, 800);
    });

    observer.observe(document.body, { childList: true, subtree: true });

    function injectToolbarButton() {
        // Look for Gmail toolbar (contains label, delete, etc.)
        // Specifically when one or more messages are selected
        const toolbars = document.querySelectorAll('div[role="toolbar"]');

        toolbars.forEach(toolbar => {
            if (toolbar.querySelector('.gt-tag-btn')) return; // Already injected

            // Find a reference element (e.g., Labels button)
            const labelsBtn = Array.from(toolbar.querySelectorAll('div[aria-label]'))
                .find(el => el.getAttribute('aria-label').includes('Labels') || el.getAttribute('aria-label').includes('Nhãn'));

            if (labelsBtn) {
                const btn = document.createElement('div');
                btn.className = 'gt-tag-btn';
                btn.innerHTML = '<span>🏷️ Tag</span>';
                btn.onclick = (e) => showTagMenu(e, toolbar);

                labelsBtn.parentNode.insertBefore(btn, labelsBtn);
            }
        });
    }

    function injectHoverTagButton() {
        const hoverToolbars = document.querySelectorAll('ul.bqY');
        hoverToolbars.forEach(toolbar => {
            if (toolbar.querySelector('.gt-hover-tag-li')) return;

            const li = document.createElement('li');
            li.className = 'bqX gt-hover-tag-li';
            li.setAttribute('data-tooltip', 'Gán Tag');
            li.style.display = 'inline-flex';
            li.style.alignItems = 'center';
            li.style.justifyContent = 'center';
            li.style.cursor = 'pointer';
            li.style.width = '24px';
            li.style.height = '24px';
            li.style.marginLeft = '4px';
            li.innerHTML = '<span style="font-size: 16px;">🏷️</span>';

            li.onclick = (e) => {
                console.log('Tag icon clicked');
                e.preventDefault();
                e.stopPropagation();
                const tr = toolbar.closest('tr');
                // Gmail uses data-thread-id or data-legacy-thread-id in various places
                const threadId = tr.querySelector('[data-thread-id]')?.getAttribute('data-thread-id')
                    || tr.querySelector('[data-legacy-thread-id]')?.getAttribute('data-legacy-thread-id')
                    || tr.querySelector('[data-threadid]')?.getAttribute('data-threadid');

                console.log('Thread ID found:', threadId);
                if (threadId) {
                    showTagMenu(e, null, [threadId]);
                } else {
                    console.warn('Could not find Thread ID for this row');
                }
            };

            li.onmouseover = () => { li.style.backgroundColor = 'rgba(0,0,0,0.1)'; };
            li.onmouseout = () => { li.style.backgroundColor = 'transparent'; };

            toolbar.appendChild(li);
        });
    }

    function showTagMenu(event, toolbar, specificIds = null) {
        event.stopPropagation();

        // Remove existing menus
        const existing = document.querySelector('.gt-menu-container');
        if (existing) existing.remove();

        const menu = document.createElement('div');
        menu.className = 'gt-menu-container gt-menu-overlay';

        // Get thread IDs
        const selectedIds = specificIds || getSelectedThreadIds();

        if (customTags.length === 0) {
            menu.innerHTML = '<div class="gt-menu-item">Chưa có tag nào</div>';
        } else {
            customTags.forEach(tag => {
                const item = document.createElement('div');
                item.className = 'gt-menu-item';

                // Highlight if tag is already present in all selected threads (or first one)
                const isAssigned = selectedIds.length > 0 &&
                    threadTags[selectedIds[0]] &&
                    threadTags[selectedIds[0]].includes(tag.id);

                if (isAssigned) item.classList.add('active');

                let iconHtml = '';
                if (tag.icon.includes('<i')) {
                    iconHtml = tag.icon;
                } else if (/^[a-z0-9_]+$/i.test(tag.icon)) {
                    iconHtml = `<span class="material-symbols-outlined">${tag.icon}</span>`;
                } else {
                    iconHtml = tag.icon;
                }

                item.innerHTML = `
          <span class="tag-icon">${iconHtml}</span>
          <div class="tag-color-dot" style="background: ${tag.color}"></div>
          <span class="tag-name">${tag.name}</span>
        `;
                item.onclick = () => {
                    toggleTagForSelected(selectedIds, tag.id);
                    menu.remove();
                };
                menu.appendChild(item);
            });

            // Add Clear option
            const clearItem = document.createElement('div');
            clearItem.className = 'gt-menu-item';
            clearItem.style.borderTop = '1px solid #eee';
            clearItem.style.marginTop = '4px';
            clearItem.innerHTML = `<span class="tag-icon">🗑️</span> <span class="tag-name">Xóa tất cả tag</span>`;
            clearItem.onclick = () => {
                clearTagsFromSelected(selectedIds);
                menu.remove();
            };
            menu.appendChild(clearItem);
        }

        // Append menu next to button
        document.body.appendChild(menu);

        const menuWidth = 200; // Match CSS width
        const menuHeight = menu.offsetHeight;
        let top, left;

        if (event.clientX && event.clientY) {
            top = event.clientY + window.scrollY + 10;
            left = event.clientX + window.scrollX;

            // Check right edge
            if (left + menuWidth > window.innerWidth + window.scrollX) {
                left = event.clientX + window.scrollX - menuWidth;
            }
            // Check bottom edge
            if (event.clientY + menuHeight > window.innerHeight) {
                top = event.clientY + window.scrollY - menuHeight - 10;
            }
        } else {
            const rect = event.currentTarget.getBoundingClientRect();
            top = rect.bottom + window.scrollY + 5;
            left = rect.left + window.scrollX;

            if (left + menuWidth > window.innerWidth + window.scrollX) {
                left = rect.right + window.scrollX - menuWidth;
            }
        }

        menu.style.top = top + 'px';
        menu.style.left = left + 'px';

        // Close menu when clicking outside
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 10);
    }

    function getSelectedThreadIds() {
        const threadIds = [];
        const selectedRows = document.querySelectorAll('tr.zA.x7'); // Usual class for selected rows
        selectedRows.forEach(row => {
            const threadId = row.querySelector('[data-thread-id]')?.getAttribute('data-thread-id')
                || row.querySelector('[data-legacy-thread-id]')?.getAttribute('data-legacy-thread-id')
                || row.querySelector('[data-threadid]')?.getAttribute('data-threadid');

            if (threadId) threadIds.push(threadId);
        });
        return threadIds;
    }

    function toggleTagForSelected(ids, tagId) {
        if (ids.length === 0) return;

        chrome.storage.sync.get(['threadTags'], (result) => {
            const data = result.threadTags || {};

            // Deciding whether to add or remove based on the first thread
            const shouldAdd = !data[ids[0]] || !data[ids[0]].includes(tagId);

            ids.forEach(id => {
                if (!data[id]) data[id] = [];

                if (shouldAdd) {
                    if (!data[id].includes(tagId)) data[id].push(tagId);
                } else {
                    data[id] = data[id].filter(tid => tid !== tagId);
                    if (data[id].length === 0) delete data[id];
                }
            });

            chrome.storage.sync.set({ threadTags: data }, () => {
                refreshData();
            });
        });
    }

    function updateThreadListUI() {
        const rows = document.querySelectorAll('tr[role="row"]');
        rows.forEach(row => {
            const threadId = row.querySelector('[data-thread-id]')?.getAttribute('data-thread-id')
                || row.querySelector('[data-legacy-thread-id]')?.getAttribute('data-legacy-thread-id')
                || row.querySelector('[data-threadid]')?.getAttribute('data-threadid');

            if (!threadId) return;

            const tags = threadTags[threadId] || [];
            const currentTagIds = tags.sort().join(',');
            let tagContainer = row.querySelector('.gt-tag-container');

            // Find where to inject (next to subject)
            const subjectCell = row.querySelector('.y6');
            if (!subjectCell) return;

            // Handle Case: No tags for this email
            if (tags.length === 0) {
                if (tagContainer) {
                    if (tagContainer.dataset.appliedTags === "") return;
                    tagContainer.innerHTML = '';
                    tagContainer.dataset.appliedTags = "";
                }
                return;
            }

            // Handle Case: Has tags
            if (tagContainer) {
                if (tagContainer.dataset.appliedTags === currentTagIds) return;
            } else {
                tagContainer = document.createElement('span');
                tagContainer.className = 'gt-tag-container';
                subjectCell.insertBefore(tagContainer, subjectCell.firstChild);
            }

            // Update identifying attribute and content
            tagContainer.dataset.appliedTags = currentTagIds;
            tagContainer.innerHTML = '';

            tags.forEach(tagId => {
                const tag = customTags.find(t => t.id === tagId);
                if (tag) {
                    const pill = document.createElement('span');
                    pill.className = 'gt-tag-pill';
                    pill.style.backgroundColor = tag.color;

                    let iconHtml = '';
                    if (tag.icon.includes('<i')) {
                        iconHtml = tag.icon; // FontAwesome HTML
                    } else if (/^[a-z0-9_]+$/i.test(tag.icon)) {
                        iconHtml = `<span class="material-symbols-outlined">${tag.icon}</span>`; // Material Icon
                    } else {
                        iconHtml = tag.icon; // Emoji/Text
                    }

                    pill.innerHTML = `${iconHtml} ${tag.name}`;
                    tagContainer.appendChild(pill);
                }
            });
        });
    }

    function clearTagsFromSelected(ids) {
        if (ids.length === 0) return;

        chrome.storage.sync.get(['threadTags'], (result) => {
            const data = result.threadTags || {};
            ids.forEach(id => {
                delete data[id];
            });
            chrome.storage.sync.set({ threadTags: data }, () => {
                refreshData();
            });
        });
    }

})();
