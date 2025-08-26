// Priority CRM - Local-First Contact Management Application
class PriorityCRM {
    constructor() {
        this.contacts = [];
        this.currentEditingId = null;
        this.focusQueue = [];
        this.currentFocusIndex = 0;
        this.currentView = 'card'; // 'card' or 'table'
        this.focusAdvanceTimer = null; // Timer for auto-advancing in focus mode
        
        this.init();
    }

    init() {
        this.loadContacts();
        this.loadViewPreference();
        this.bindEvents();
        this.renderContacts();
        this.updateStats();
        this.populateTagFilter();
        this.updateViewToggle();
    }

    // Data Management
    loadContacts() {
        const stored = localStorage.getItem('priorityCRM_contacts');
        if (stored) {
            this.contacts = JSON.parse(stored);
        }
    }

    saveContacts() {
        localStorage.setItem('priorityCRM_contacts', JSON.stringify(this.contacts));
    }

    loadViewPreference() {
        const saved = localStorage.getItem('priorityCRM_viewMode');
        if (saved && (saved === 'card' || saved === 'table')) {
            this.currentView = saved;
        }
    }

    saveViewPreference() {
        localStorage.setItem('priorityCRM_viewMode', this.currentView);
    }

    generateId() {
        return 'contact_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Contact CRUD Operations
    addContact(contactData) {
        // Check for duplicate entries (same name and company)
        const isDuplicate = this.contacts.some(existingContact => 
            existingContact.name.toLowerCase().trim() === contactData.name.toLowerCase().trim() &&
            (existingContact.company || '').toLowerCase().trim() === (contactData.company || '').toLowerCase().trim()
        );

        if (isDuplicate) {
            throw new Error(`A contact with the name "${contactData.name}"${contactData.company ? ` at "${contactData.company}"` : ''} already exists.`);
        }

        const contact = {
            id: this.generateId(),
            name: contactData.name,
            company: contactData.company || '',
            email: contactData.email || '',
            phone: contactData.phone || '',
            priority: contactData.priority,
            notes: contactData.notes || '',
            tags: this.parseTags(contactData.tags || ''),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            clearedToday: false,
            lastCleared: null
        };

        this.contacts.push(contact);
        this.saveContacts();
        return contact;
    }

    updateContact(id, contactData) {
        const index = this.contacts.findIndex(c => c.id === id);
        if (index !== -1) {
            // Check for duplicate entries (excluding the current contact being updated)
            const isDuplicate = this.contacts.some((existingContact, idx) => 
                idx !== index && // Exclude the current contact being updated
                existingContact.name.toLowerCase().trim() === contactData.name.toLowerCase().trim() &&
                (existingContact.company || '').toLowerCase().trim() === (contactData.company || '').toLowerCase().trim()
            );

            if (isDuplicate) {
                throw new Error(`A contact with the name "${contactData.name}"${contactData.company ? ` at "${contactData.company}"` : ''} already exists.`);
            }

            this.contacts[index] = {
                ...this.contacts[index],
                name: contactData.name,
                company: contactData.company || '',
                email: contactData.email || '',
                phone: contactData.phone || '',
                priority: contactData.priority,
                notes: contactData.notes || '',
                tags: this.parseTags(contactData.tags || ''),
                updatedAt: new Date().toISOString()
            };
            this.saveContacts();
            return this.contacts[index];
        }
        return null;
    }

    deleteContact(id) {
        this.contacts = this.contacts.filter(c => c.id !== id);
        this.saveContacts();
    }

    getContact(id) {
        return this.contacts.find(c => c.id === id);
    }

    parseTags(tagString) {
        if (!tagString) return [];
        return tagString.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    }

    formatTags(tags) {
        return tags.join(', ');
    }

    // Priority and Sorting
    getPriorityOrder(priority) {
        const order = { 'high': 1, 'medium': 2, 'low': 3 };
        return order[priority] || 4;
    }

    sortContactsByPriority(contacts = this.contacts) {
        return contacts.sort((a, b) => {
            const priorityCompare = this.getPriorityOrder(a.priority) - this.getPriorityOrder(b.priority);
            if (priorityCompare !== 0) return priorityCompare;
            
            // Secondary sort by name
            return a.name.localeCompare(b.name);
        });
    }

    // Search and Filtering
    filterContacts() {
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        const priorityFilter = document.getElementById('priorityFilter').value;
        const tagFilter = document.getElementById('tagFilter').value;

        // Only show non-cleared contacts in main view
        let filtered = this.contacts.filter(contact => !contact.clearedToday);

        // Apply search filter
        if (searchTerm) {
            filtered = filtered.filter(contact => 
                contact.name.toLowerCase().includes(searchTerm) ||
                contact.company.toLowerCase().includes(searchTerm) ||
                contact.tags.some(tag => tag.toLowerCase().includes(searchTerm))
            );
        }

        // Apply priority filter
        if (priorityFilter) {
            filtered = filtered.filter(contact => contact.priority === priorityFilter);
        }

        // Apply tag filter
        if (tagFilter) {
            filtered = filtered.filter(contact => contact.tags.includes(tagFilter));
        }

        return this.sortContactsByPriority(filtered);
    }

    // Get cleared contacts for completed deals section
    getClearedContacts() {
        const clearedContacts = this.contacts.filter(contact => contact.clearedToday);
        return this.sortContactsByPriority(clearedContacts);
    }

    // UI Rendering
    renderContacts() {
        const filteredContacts = this.filterContacts();
        const gridContainer = document.getElementById('contactsGrid');
        const tableContainer = document.getElementById('contactsTable');
        const tableBody = document.getElementById('contactsTableBody');
        const emptyState = document.getElementById('emptyState');

        if (filteredContacts.length === 0) {
            gridContainer.innerHTML = '';
            tableBody.innerHTML = '';
            emptyState.classList.remove('hidden');
            gridContainer.classList.add('hidden');
            tableContainer.classList.add('hidden');
            return;
        }

        emptyState.classList.add('hidden');

        if (this.currentView === 'card') {
            gridContainer.classList.remove('hidden');
            tableContainer.classList.add('hidden');
            gridContainer.innerHTML = filteredContacts.map(contact => this.createContactCard(contact)).join('');
        } else {
            gridContainer.classList.add('hidden');
            tableContainer.classList.remove('hidden');
            tableBody.innerHTML = filteredContacts.map(contact => this.createContactRow(contact)).join('');
        }
    }

    setView(viewType) {
        this.currentView = viewType;
        this.saveViewPreference();
        this.updateViewToggle();
        this.renderContacts();
    }

    updateViewToggle() {
        const cardBtn = document.getElementById('cardViewBtn');
        const tableBtn = document.getElementById('tableViewBtn');

        if (this.currentView === 'card') {
            cardBtn.className = 'px-3 py-2 rounded-md text-sm font-medium transition-colors bg-black text-white';
            tableBtn.className = 'px-3 py-2 rounded-md text-sm font-medium transition-colors text-gray-600 hover:text-black';
        } else {
            cardBtn.className = 'px-3 py-2 rounded-md text-sm font-medium transition-colors text-gray-600 hover:text-black';
            tableBtn.className = 'px-3 py-2 rounded-md text-sm font-medium transition-colors bg-black text-white';
        }
    }

    createContactCard(contact) {
        const priorityClass = `priority-${contact.priority}`;
        const priorityIcon = this.getPriorityIcon(contact.priority);
        const tagsList = contact.tags.length > 0 ? 
            contact.tags.map(tag => `<span class="bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs">${tag}</span>`).join(' ') : 
            '<span class="text-gray-400 text-sm">No tags</span>';

        return `
            <div class="bg-white border border-gray-200 rounded-lg p-6 card-hover ${priorityClass}" data-contact-id="${contact.id}">
                <div class="flex items-start justify-between mb-4">
                    <div class="flex items-center space-x-2">
                        <i class="${priorityIcon} text-lg"></i>
                        <h3 class="font-bold text-lg">${this.escapeHtml(contact.name)}</h3>
                    </div>
                    <div class="flex space-x-2">
                        <button class="edit-contact text-gray-500 hover:text-black" data-contact-id="${contact.id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="delete-contact text-gray-500 hover:text-red-600" data-contact-id="${contact.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                
                <div class="space-y-2 mb-4">
                    ${contact.company ? `<p class="text-gray-600"><i class="fas fa-building w-4"></i> ${this.escapeHtml(contact.company)}</p>` : ''}
                    ${contact.email ? `<p class="text-gray-600"><i class="fas fa-envelope w-4"></i> ${this.escapeHtml(contact.email)}</p>` : ''}
                    ${contact.phone ? `<p class="text-gray-600"><i class="fas fa-phone w-4"></i> ${this.escapeHtml(contact.phone)}</p>` : ''}
                </div>
                
                ${contact.notes ? `<p class="text-sm text-gray-700 mb-3 italic">"${this.escapeHtml(contact.notes)}"</p>` : ''}
                
                <div class="flex flex-wrap gap-1 mb-3">
                    ${tagsList}
                </div>
                
                <div class="flex items-center justify-between text-sm text-gray-500">
                    <span class="capitalize font-medium ${this.getPriorityColorClass(contact.priority)}">${contact.priority} Priority</span>
                    ${contact.clearedToday ? '<span class="text-green-600"><i class="fas fa-check-circle mr-1"></i>Cleared Today</span>' : ''}
                </div>
            </div>
        `;
    }

    createContactRow(contact) {
        const priorityIcon = this.getPriorityIcon(contact.priority);
        const tagsList = contact.tags.length > 0 ? 
            contact.tags.map(tag => `<span class="bg-gray-200 text-gray-700 px-2 py-1 rounded-full text-xs mr-1">${this.escapeHtml(tag)}</span>`).join('') : 
            '<span class="text-gray-400 text-sm">No tags</span>';

        return `
            <tr class="hover:bg-gray-50 transition-colors" data-contact-id="${contact.id}">
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <i class="${priorityIcon} text-lg mr-3"></i>
                        <div>
                            <div class="text-sm font-medium text-gray-900">${this.escapeHtml(contact.name)}</div>
                            ${contact.clearedToday ? '<div class="text-xs text-green-600"><i class="fas fa-check-circle mr-1"></i>Cleared Today</div>' : ''}
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">${contact.company ? this.escapeHtml(contact.company) : '<span class="text-gray-400">No company</span>'}</div>
                </td>
                <td class="px-6 py-4">
                    <div class="text-sm text-gray-900">
                        ${contact.email ? `<div><i class="fas fa-envelope w-4 mr-2"></i>${this.escapeHtml(contact.email)}</div>` : ''}
                        ${contact.phone ? `<div class="mt-1"><i class="fas fa-phone w-4 mr-2"></i>${this.escapeHtml(contact.phone)}</div>` : ''}
                        ${!contact.email && !contact.phone ? '<span class="text-gray-400">No contact info</span>' : ''}
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${this.getPriorityBadgeClass(contact.priority)}">
                        ${contact.priority} Priority
                    </span>
                </td>
                <td class="px-6 py-4">
                    <div class="flex flex-wrap gap-1">
                        ${tagsList}
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button class="edit-contact text-gray-500 hover:text-black mr-3" data-contact-id="${contact.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="delete-contact text-gray-500 hover:text-red-600" data-contact-id="${contact.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }

    getPriorityIcon(priority) {
        const icons = {
            'high': 'fas fa-exclamation-circle text-red-600',
            'medium': 'fas fa-circle text-yellow-500',
            'low': 'fas fa-circle text-blue-600'
        };
        return icons[priority] || 'fas fa-circle';
    }

    getPriorityColorClass(priority) {
        const classes = {
            'high': 'text-red-600',
            'medium': 'text-yellow-600',
            'low': 'text-blue-600'
        };
        return classes[priority] || '';
    }

    getPriorityBadgeClass(priority) {
        const classes = {
            'high': 'bg-red-600 text-white',
            'medium': 'bg-yellow-500 text-white',
            'low': 'bg-blue-600 text-white'
        };
        return classes[priority] || 'bg-gray-400 text-white';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Statistics
    updateStats() {
        // Only count non-cleared contacts for main dashboard
        const activeContacts = this.contacts.filter(c => !c.clearedToday);
        
        const counts = {
            high: activeContacts.filter(c => c.priority === 'high').length,
            medium: activeContacts.filter(c => c.priority === 'medium').length,
            low: activeContacts.filter(c => c.priority === 'low').length,
            total: activeContacts.length
        };

        document.getElementById('highCount').textContent = counts.high;
        document.getElementById('mediumCount').textContent = counts.medium;
        document.getElementById('lowCount').textContent = counts.low;
        document.getElementById('totalCount').textContent = counts.total;
    }

    updateCompletedStats() {
        const clearedContacts = this.contacts.filter(c => c.clearedToday);
        
        const counts = {
            high: clearedContacts.filter(c => c.priority === 'high').length,
            medium: clearedContacts.filter(c => c.priority === 'medium').length,
            low: clearedContacts.filter(c => c.priority === 'low').length,
            total: clearedContacts.length
        };

        const totalElement = document.getElementById('completedTotalCount');
        const highElement = document.getElementById('completedHighCount');
        const mediumElement = document.getElementById('completedMediumCount');
        const lowElement = document.getElementById('completedLowCount');

        if (totalElement) totalElement.textContent = counts.total;
        if (highElement) highElement.textContent = counts.high;
        if (mediumElement) mediumElement.textContent = counts.medium;
        if (lowElement) lowElement.textContent = counts.low;
    }

    populateTagFilter() {
        const tagFilter = document.getElementById('tagFilter');
        const allTags = [...new Set(this.contacts.flatMap(c => c.tags))].sort();
        
        // Clear existing options except "All Tags"
        tagFilter.innerHTML = '<option value="">All Tags</option>';
        
        allTags.forEach(tag => {
            const option = document.createElement('option');
            option.value = tag;
            option.textContent = tag;
            tagFilter.appendChild(option);
        });
    }

    // Modal Management
    showAddContactModal() {
        this.currentEditingId = null;
        document.getElementById('modalTitle').textContent = 'Add New Contact';
        document.getElementById('saveBtn').innerHTML = '<i class="fas fa-save mr-2"></i>Save Contact';
        this.clearContactForm();
        document.getElementById('contactModal').classList.remove('hidden');
        document.getElementById('contactName').focus();
    }

    showEditContactModal(id) {
        const contact = this.getContact(id);
        if (!contact) return;

        this.currentEditingId = id;
        document.getElementById('modalTitle').textContent = 'Edit Contact';
        document.getElementById('saveBtn').innerHTML = '<i class="fas fa-save mr-2"></i>Update Contact';
        
        document.getElementById('contactName').value = contact.name;
        document.getElementById('contactCompany').value = contact.company;
        document.getElementById('contactEmail').value = contact.email;
        document.getElementById('contactPhone').value = contact.phone;
        document.getElementById('contactPriority').value = contact.priority;
        document.getElementById('contactNotes').value = contact.notes;
        document.getElementById('contactTags').value = this.formatTags(contact.tags);
        
        document.getElementById('contactModal').classList.remove('hidden');
        document.getElementById('contactName').focus();
    }

    hideContactModal() {
        document.getElementById('contactModal').classList.add('hidden');
        this.clearContactForm();
        this.currentEditingId = null;
    }

    clearContactForm() {
        document.getElementById('contactForm').reset();
    }

    // Focus Mode
    enterFocusMode() {
        this.prepareFocusQueue();
        if (this.focusQueue.length === 0) {
            alert('No contacts available for focus mode. Add some contacts first!');
            return;
        }
        
        this.currentFocusIndex = 0;
        this.showFocusModal();
        this.renderFocusContact();
    }

    prepareFocusQueue() {
        // Get all non-cleared contacts, sorted by priority
        this.focusQueue = this.sortContactsByPriority(
            this.contacts.filter(c => !c.clearedToday)
        );
        
        // If no uncleared contacts, show message
        if (this.focusQueue.length === 0) {
            alert('All contacts have been cleared! Check the Completed Deals section to see your progress.');
        }
    }

    showFocusModal() {
        document.getElementById('focusModeModal').classList.remove('hidden');
    }

    hideFocusModal() {
        // Clear any running timer when exiting focus mode
        if (this.focusAdvanceTimer) {
            clearInterval(this.focusAdvanceTimer);
            this.focusAdvanceTimer = null;
        }
        
        document.getElementById('focusModeModal').classList.add('hidden');
        
        // Update main dashboard to reflect any changes made in focus mode
        this.renderContacts();
        this.updateStats();
    }

    // Completed Deals Management
    showCompletedDealsModal() {
        document.getElementById('completedDealsModal').classList.remove('hidden');
        this.renderCompletedDeals();
        this.updateCompletedStats();
    }

    hideCompletedDealsModal() {
        document.getElementById('completedDealsModal').classList.add('hidden');
    }

    renderCompletedDeals() {
        const clearedContacts = this.getClearedContacts();
        const container = document.getElementById('completedDealsContent');

        if (clearedContacts.length === 0) {
            container.innerHTML = `
                <div class="text-center py-16">
                    <i class="fas fa-inbox text-6xl text-gray-300 mb-4"></i>
                    <h3 class="text-2xl font-bold text-gray-600 mb-2">No Completed Deals Yet</h3>
                    <p class="text-gray-500">Start using Focus Mode to mark contacts as cleared and they will appear here.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                ${clearedContacts.map(contact => this.createCompletedContactCard(contact)).join('')}
            </div>
        `;
    }

    createCompletedContactCard(contact) {
        const priorityClass = `priority-${contact.priority}`;
        const priorityIcon = this.getPriorityIcon(contact.priority);
        const tagsList = contact.tags.length > 0 ? 
            contact.tags.map(tag => `<span class="bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs">${tag}</span>`).join(' ') : 
            '<span class="text-gray-400 text-sm">No tags</span>';
        
        const clearedDate = new Date(contact.lastCleared).toLocaleDateString();
        const clearedTime = new Date(contact.lastCleared).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

        return `
            <div class="bg-white border border-gray-200 rounded-lg p-6 ${priorityClass} opacity-90">
                <div class="flex items-start justify-between mb-4">
                    <div class="flex items-center space-x-2">
                        <i class="${priorityIcon} text-lg"></i>
                        <h3 class="font-bold text-lg">${this.escapeHtml(contact.name)}</h3>
                        <i class="fas fa-check-circle text-green-600 ml-2"></i>
                    </div>
                    <div class="flex space-x-2">
                        <button class="reactivate-contact text-gray-500 hover:text-green-600" data-contact-id="${contact.id}" title="Reactivate Contact">
                            <i class="fas fa-undo"></i>
                        </button>
                        <button class="delete-completed-contact text-gray-500 hover:text-red-600" data-contact-id="${contact.id}" title="Delete Permanently">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                
                <div class="space-y-2 mb-4">
                    ${contact.company ? `<p class="text-gray-600"><i class="fas fa-building w-4"></i> ${this.escapeHtml(contact.company)}</p>` : ''}
                    ${contact.email ? `<p class="text-gray-600"><i class="fas fa-envelope w-4"></i> ${this.escapeHtml(contact.email)}</p>` : ''}
                    ${contact.phone ? `<p class="text-gray-600"><i class="fas fa-phone w-4"></i> ${this.escapeHtml(contact.phone)}</p>` : ''}
                </div>
                
                ${contact.notes ? `<p class="text-sm text-gray-700 mb-3 italic">"${this.escapeHtml(contact.notes)}"</p>` : ''}
                
                <div class="flex flex-wrap gap-1 mb-3">
                    ${tagsList}
                </div>
                
                <div class="flex items-center justify-between text-sm">
                    <span class="capitalize font-medium ${this.getPriorityColorClass(contact.priority)}">${contact.priority} Priority</span>
                    <div class="text-green-600 font-medium">
                        <i class="fas fa-clock mr-1"></i>
                        <span>Completed: ${clearedDate} ${clearedTime}</span>
                    </div>
                </div>
            </div>
        `;
    }

    reactivateContact(id) {
        const contactIndex = this.contacts.findIndex(c => c.id === id);
        if (contactIndex !== -1) {
            this.contacts[contactIndex].clearedToday = false;
            this.contacts[contactIndex].lastCleared = null;
            this.saveContacts();
            
            // Update both views
            this.renderCompletedDeals();
            this.updateCompletedStats();
            this.renderContacts();
            this.updateStats();
        }
    }

    deleteCompletedContact(id) {
        const contact = this.getContact(id);
        if (contact && confirm(`Are you sure you want to permanently delete "${contact.name}"? This action cannot be undone.`)) {
            this.deleteContact(id);
            this.renderCompletedDeals();
            this.updateCompletedStats();
            this.updateStats();
        }
    }

    clearAllCompleted() {
        const clearedContacts = this.contacts.filter(c => c.clearedToday);
        if (clearedContacts.length === 0) {
            alert('No completed deals to clear.');
            return;
        }
        
        if (confirm(`Are you sure you want to permanently delete all ${clearedContacts.length} completed deals? This action cannot be undone.`)) {
            this.contacts = this.contacts.filter(c => !c.clearedToday);
            this.saveContacts();
            
            this.renderCompletedDeals();
            this.updateCompletedStats();
            this.updateStats();
        }
    }

    renderFocusContact() {
        const container = document.getElementById('focusContent');
        
        if (this.currentFocusIndex >= this.focusQueue.length) {
            container.innerHTML = `
                <div class="text-center py-16">
                    <i class="fas fa-trophy text-6xl text-gray-300 mb-4"></i>
                    <h3 class="text-2xl font-bold text-gray-700 mb-2">All Done!</h3>
                    <p class="text-gray-500 mb-6">You've worked through all your contacts for today.</p>
                    <button id="restartFocusBtn" class="bg-black text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors">
                        <i class="fas fa-redo mr-2"></i>Restart Focus Session
                    </button>
                </div>
            `;
            return;
        }

        const contact = this.focusQueue[this.currentFocusIndex];
        const progress = ((this.currentFocusIndex / this.focusQueue.length) * 100).toFixed(0);
        
        container.innerHTML = `
            <!-- Auto-advance notification area -->
            <div id="autoAdvanceNotification" class="hidden bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <div class="flex items-center justify-between">
                    <div class="flex items-center">
                        <i class="fas fa-check-circle text-green-600 mr-3"></i>
                        <div>
                            <p class="text-green-800 font-medium">Contact Cleared!</p>
                            <p class="text-green-600 text-sm">Moving to next contact in <span id="countdownTimer">12</span> seconds...</p>
                        </div>
                    </div>
                    <button id="skipTimerBtn" class="text-green-600 hover:text-green-800 font-medium">
                        Skip Timer
                    </button>
                </div>
            </div>
            
            <div class="mb-6">
                <div class="flex items-center justify-between text-sm text-gray-600 mb-2">
                    <span>Contact ${this.currentFocusIndex + 1} of ${this.focusQueue.length}</span>
                    <span>${progress}% Complete</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2">
                    <div class="bg-black h-2 rounded-full transition-all duration-300" style="width: ${progress}%"></div>
                </div>
            </div>
            
            <!-- Single Contact Focus Display -->
            <div class="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-12 mb-8 text-center">
                <div class="max-w-2xl mx-auto">
                    <!-- Priority Indicator -->
                    <div class="mb-6">
                        <i class="${this.getPriorityIcon(contact.priority)} text-6xl mb-4"></i>
                        <div class="inline-block ${contact.priority === 'high' ? 'bg-red-600' : contact.priority === 'medium' ? 'bg-yellow-500' : 'bg-blue-600'} text-white px-6 py-2 rounded-full text-lg font-bold uppercase tracking-wide">
                            ${contact.priority} PRIORITY
                        </div>
                    </div>
                    
                    <!-- Contact Name and Company -->
                    <h1 class="text-5xl font-bold text-gray-900 mb-3">${this.escapeHtml(contact.name)}</h1>
                    ${contact.company ? `<h2 class="text-2xl text-gray-600 mb-8">${this.escapeHtml(contact.company)}</h2>` : '<div class="mb-8"></div>'}
                    
                    <!-- Contact Information Grid -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        ${contact.email ? `
                            <div class="bg-white p-6 rounded-lg shadow-sm">
                                <div class="flex items-center justify-center mb-3">
                                    <i class="fas fa-envelope text-2xl text-gray-500"></i>
                                </div>
                                <p class="text-lg text-gray-800 font-medium">Email</p>
                                <p class="text-gray-600">${this.escapeHtml(contact.email)}</p>
                            </div>
                        ` : ''}
                        ${contact.phone ? `
                            <div class="bg-white p-6 rounded-lg shadow-sm">
                                <div class="flex items-center justify-center mb-3">
                                    <i class="fas fa-phone text-2xl text-gray-500"></i>
                                </div>
                                <p class="text-lg text-gray-800 font-medium">Phone</p>
                                <p class="text-gray-600">${this.escapeHtml(contact.phone)}</p>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
            
            <!-- Notes Section -->
            ${contact.notes ? `
                <div class="bg-white p-8 rounded-lg shadow-sm mb-8">
                    <h3 class="text-xl font-bold text-gray-800 mb-4 flex items-center">
                        <i class="fas fa-sticky-note mr-3"></i>Notes
                    </h3>
                    <p class="text-gray-700 text-lg leading-relaxed">${this.escapeHtml(contact.notes)}</p>
                </div>
            ` : ''}
            
            <!-- Tags Section -->
            ${contact.tags.length > 0 ? `
                <div class="bg-white p-8 rounded-lg shadow-sm mb-8">
                    <h3 class="text-xl font-bold text-gray-800 mb-4 flex items-center">
                        <i class="fas fa-tags mr-3"></i>Tags
                    </h3>
                    <div class="flex flex-wrap gap-3 justify-center">
                        ${contact.tags.map(tag => `<span class="bg-gray-800 text-white px-4 py-2 rounded-full text-sm font-medium">${this.escapeHtml(tag)}</span>`).join('')}
                    </div>
                </div>
            ` : ''}
            
            <!-- Action Buttons -->
            <div class="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-6">
                <button id="clearContactBtn" class="bg-green-600 text-white px-12 py-4 rounded-xl font-bold text-lg hover:bg-green-700 transition-all duration-200 transform hover:scale-105 shadow-lg flex items-center" data-contact-id="${contact.id}">
                    <i class="fas fa-check-circle mr-3 text-xl"></i>
                    ${contact.clearedToday ? 'Mark as Cleared Again' : 'Clear for Today'}
                </button>
                
                <button id="skipContactBtn" class="bg-gray-500 text-white px-10 py-4 rounded-xl font-bold text-lg hover:bg-gray-600 transition-all duration-200 flex items-center">
                    <i class="fas fa-forward mr-3"></i>Skip
                </button>
                
                <button id="editInFocusBtn" class="bg-black text-white px-10 py-4 rounded-xl font-bold text-lg hover:bg-gray-800 transition-all duration-200 flex items-center" data-contact-id="${contact.id}">
                    <i class="fas fa-edit mr-3"></i>Edit
                </button>
            </div>
        `;
    }

    clearCurrentContact() {
        if (this.currentFocusIndex < this.focusQueue.length) {
            const contact = this.focusQueue[this.currentFocusIndex];
            const contactIndex = this.contacts.findIndex(c => c.id === contact.id);
            if (contactIndex !== -1) {
                this.contacts[contactIndex].clearedToday = true;
                this.contacts[contactIndex].lastCleared = new Date().toISOString();
                this.saveContacts();
            }
            
            // Show success notification and start countdown
            this.showAutoAdvanceNotification();
        }
    }

    showAutoAdvanceNotification() {
        const notification = document.getElementById('autoAdvanceNotification');
        const timerElement = document.getElementById('countdownTimer');
        
        if (notification && timerElement) {
            notification.classList.remove('hidden');
            
            // Generate random time between 10-15 seconds
            let countdown = Math.floor(Math.random() * 6) + 10; // 10-15 seconds
            timerElement.textContent = countdown;
            
            // Clear any existing timer
            if (this.focusAdvanceTimer) {
                clearInterval(this.focusAdvanceTimer);
            }
            
            // Start countdown timer
            this.focusAdvanceTimer = setInterval(() => {
                countdown--;
                if (timerElement) {
                    timerElement.textContent = countdown;
                }
                
                if (countdown <= 0) {
                    clearInterval(this.focusAdvanceTimer);
                    this.nextFocusContact();
                }
            }, 1000);
        }
    }

    skipAutoAdvanceTimer() {
        if (this.focusAdvanceTimer) {
            clearInterval(this.focusAdvanceTimer);
            this.focusAdvanceTimer = null;
        }
        this.nextFocusContact();
    }

    nextFocusContact() {
        // Clear any existing timer
        if (this.focusAdvanceTimer) {
            clearInterval(this.focusAdvanceTimer);
            this.focusAdvanceTimer = null;
        }
        
        this.currentFocusIndex++;
        this.renderFocusContact();
        
        // Update main dashboard to reflect changes
        this.renderContacts();
        this.updateStats();
    }

    restartFocusSession() {
        this.currentFocusIndex = 0;
        this.renderFocusContact();
    }

    // CSV Import/Export
    exportCSV() {
        if (this.contacts.length === 0) {
            alert('No contacts to export!');
            return;
        }

        const sortedContacts = this.sortContactsByPriority([...this.contacts]);
        const headers = ['Name', 'Company', 'Email', 'Phone', 'Priority', 'Notes', 'Tags', 'Created', 'Last Updated'];
        const csvContent = [
            headers.join(','),
            ...sortedContacts.map(contact => [
                `"${contact.name}"`,
                `"${contact.company}"`,
                `"${contact.email}"`,
                `"${contact.phone}"`,
                `"${contact.priority}"`,
                `"${contact.notes.replace(/"/g, '""')}"`,
                `"${this.formatTags(contact.tags)}"`,
                `"${new Date(contact.createdAt).toLocaleDateString()}"`,
                `"${new Date(contact.updatedAt).toLocaleDateString()}"`
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `priority-crm-contacts-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    }

    exportCompletedDealsCSV() {
        const clearedContacts = this.getClearedContacts();
        
        if (clearedContacts.length === 0) {
            alert('No completed deals to export!');
            return;
        }

        const headers = ['Name', 'Company', 'Email', 'Phone', 'Priority', 'Notes', 'Tags', 'Completed Date', 'Completed Time', 'Created Date', 'Deal Duration (Days)'];
        const csvContent = [
            headers.join(','),
            ...clearedContacts.map(contact => {
                const createdDate = new Date(contact.createdAt);
                const completedDate = new Date(contact.lastCleared);
                const durationDays = Math.ceil((completedDate - createdDate) / (1000 * 60 * 60 * 24));
                
                return [
                    `"${contact.name}"`,
                    `"${contact.company}"`,
                    `"${contact.email}"`,
                    `"${contact.phone}"`,
                    `"${contact.priority}"`,
                    `"${contact.notes.replace(/"/g, '""')}"`,
                    `"${this.formatTags(contact.tags)}"`,
                    `"${completedDate.toLocaleDateString()}"`,
                    `"${completedDate.toLocaleTimeString()}"`,
                    `"${createdDate.toLocaleDateString()}"`,
                    `"${durationDays}"`
                ].join(',');
            })
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `completed-deals-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    }

    importCSV(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const csv = e.target.result;
                const lines = csv.split('\n').filter(line => line.trim());
                
                if (lines.length < 2) {
                    alert('CSV file appears to be empty or invalid!');
                    return;
                }

                const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
                const nameIndex = headers.findIndex(h => h.includes('name'));
                const companyIndex = headers.findIndex(h => h.includes('company'));
                const emailIndex = headers.findIndex(h => h.includes('email'));
                const phoneIndex = headers.findIndex(h => h.includes('phone'));
                const priorityIndex = headers.findIndex(h => h.includes('priority'));
                const notesIndex = headers.findIndex(h => h.includes('notes'));
                const tagsIndex = headers.findIndex(h => h.includes('tags'));

                if (nameIndex === -1) {
                    alert('CSV must contain a "Name" column!');
                    return;
                }

                let importedCount = 0;
                let duplicateCount = 0;
                for (let i = 1; i < lines.length; i++) {
                    const values = this.parseCSVLine(lines[i]);
                    
                    if (values.length === 0 || !values[nameIndex]) continue;

                    const contactData = {
                        name: values[nameIndex] || '',
                        company: companyIndex !== -1 ? values[companyIndex] || '' : '',
                        email: emailIndex !== -1 ? values[emailIndex] || '' : '',
                        phone: phoneIndex !== -1 ? values[phoneIndex] || '' : '',
                        priority: this.validatePriority(priorityIndex !== -1 ? values[priorityIndex] || '' : 'medium'),
                        notes: notesIndex !== -1 ? values[notesIndex] || '' : '',
                        tags: tagsIndex !== -1 ? values[tagsIndex] || '' : ''
                    };

                    try {
                        this.addContact(contactData);
                        importedCount++;
                    } catch (error) {
                        // Skip duplicate entries
                        if (error.message.includes('already exists')) {
                            duplicateCount++;
                        } else {
                            console.warn('Error importing contact:', error.message);
                        }
                    }
                }

                let message = `Successfully imported ${importedCount} contacts!`;
                if (duplicateCount > 0) {
                    message += ` (${duplicateCount} duplicates were skipped)`;
                }
                alert(message);
                this.renderContacts();
                this.updateStats();
                this.populateTagFilter();

            } catch (error) {
                alert('Error importing CSV: ' + error.message);
            }
        };
        reader.readAsText(file);
    }

    parseCSVLine(line) {
        const values = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];
            
            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    current += '"';
                    i++; // Skip next quote
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        values.push(current.trim());
        return values;
    }

    validatePriority(priority) {
        const validPriorities = ['high', 'medium', 'low'];
        const normalized = priority.toLowerCase();
        return validPriorities.includes(normalized) ? normalized : 'medium';
    }

    // Event Handlers
    bindEvents() {
        // Add Contact Button
        document.getElementById('addContactBtn').addEventListener('click', () => this.showAddContactModal());
        document.querySelectorAll('.addContactBtn').forEach(btn => {
            btn.addEventListener('click', () => this.showAddContactModal());
        });

        // Modal Controls
        document.getElementById('closeModalBtn').addEventListener('click', () => this.hideContactModal());
        document.getElementById('cancelBtn').addEventListener('click', () => this.hideContactModal());

        // Contact Form
        document.getElementById('contactForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleContactSubmit();
        });

        // Search and Filters
        document.getElementById('searchInput').addEventListener('input', () => this.renderContacts());
        document.getElementById('priorityFilter').addEventListener('change', () => this.renderContacts());
        document.getElementById('tagFilter').addEventListener('change', () => this.renderContacts());

        // Contact Actions (Event Delegation)
        document.getElementById('contactsGrid').addEventListener('click', (e) => {
            if (e.target.closest('.edit-contact')) {
                const id = e.target.closest('.edit-contact').dataset.contactId;
                this.showEditContactModal(id);
            } else if (e.target.closest('.delete-contact')) {
                const id = e.target.closest('.delete-contact').dataset.contactId;
                this.handleDeleteContact(id);
            }
        });

        // Table Actions (Event Delegation)
        document.getElementById('contactsTableBody').addEventListener('click', (e) => {
            if (e.target.closest('.edit-contact')) {
                const id = e.target.closest('.edit-contact').dataset.contactId;
                this.showEditContactModal(id);
            } else if (e.target.closest('.delete-contact')) {
                const id = e.target.closest('.delete-contact').dataset.contactId;
                this.handleDeleteContact(id);
            }
        });

        // View Toggle Buttons
        document.getElementById('cardViewBtn').addEventListener('click', () => this.setView('card'));
        document.getElementById('tableViewBtn').addEventListener('click', () => this.setView('table'));

        // Focus Mode
        document.getElementById('focusModeBtn').addEventListener('click', () => this.enterFocusMode());
        document.getElementById('exitFocusBtn').addEventListener('click', () => this.hideFocusModal());

        // Completed Deals
        document.getElementById('completedDealsBtn').addEventListener('click', () => this.showCompletedDealsModal());
        document.getElementById('closeCompletedModalBtn').addEventListener('click', () => this.hideCompletedDealsModal());
        document.getElementById('clearAllCompletedBtn').addEventListener('click', () => this.clearAllCompleted());
        document.getElementById('exportCompletedBtn').addEventListener('click', () => this.exportCompletedDealsCSV());

        // Completed Deals Actions (Event Delegation)
        document.getElementById('completedDealsContent').addEventListener('click', (e) => {
            if (e.target.closest('.reactivate-contact')) {
                const id = e.target.closest('.reactivate-contact').dataset.contactId;
                this.reactivateContact(id);
            } else if (e.target.closest('.delete-completed-contact')) {
                const id = e.target.closest('.delete-completed-contact').dataset.contactId;
                this.deleteCompletedContact(id);
            }
        });

        // Focus Mode Actions (Event Delegation)
        document.getElementById('focusContent').addEventListener('click', (e) => {
            if (e.target.closest('#clearContactBtn')) {
                this.clearCurrentContact();
            } else if (e.target.closest('#skipContactBtn')) {
                this.nextFocusContact();
            } else if (e.target.closest('#editInFocusBtn')) {
                const id = e.target.closest('#editInFocusBtn').dataset.contactId;
                this.hideFocusModal();
                this.showEditContactModal(id);
            } else if (e.target.closest('#restartFocusBtn')) {
                this.restartFocusSession();
            } else if (e.target.closest('#skipTimerBtn')) {
                this.skipAutoAdvanceTimer();
            }
        });

        // Import/Export
        document.getElementById('importBtn').addEventListener('click', () => {
            document.getElementById('csvFileInput').click();
        });
        
        document.getElementById('csvFileInput').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.importCSV(file);
                e.target.value = ''; // Reset file input
            }
        });
        
        document.getElementById('exportBtn').addEventListener('click', () => this.exportCSV());

        // Close modals when clicking outside
        document.getElementById('contactModal').addEventListener('click', (e) => {
            if (e.target.id === 'contactModal') this.hideContactModal();
        });
        
        document.getElementById('focusModeModal').addEventListener('click', (e) => {
            if (e.target.id === 'focusModeModal') this.hideFocusModal();
        });

        document.getElementById('completedDealsModal').addEventListener('click', (e) => {
            if (e.target.id === 'completedDealsModal') this.hideCompletedDealsModal();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideContactModal();
                this.hideFocusModal();
                this.hideCompletedDealsModal();
            }
        });
    }

    handleContactSubmit() {
        const formData = {
            name: document.getElementById('contactName').value.trim(),
            company: document.getElementById('contactCompany').value.trim(),
            email: document.getElementById('contactEmail').value.trim(),
            phone: document.getElementById('contactPhone').value.trim(),
            priority: document.getElementById('contactPriority').value,
            notes: document.getElementById('contactNotes').value.trim(),
            tags: document.getElementById('contactTags').value.trim()
        };

        if (!formData.name) {
            alert('Name is required!');
            document.getElementById('contactName').focus();
            return;
        }

        if (!formData.priority) {
            alert('Priority is required!');
            document.getElementById('contactPriority').focus();
            return;
        }

        try {
            if (this.currentEditingId) {
                this.updateContact(this.currentEditingId, formData);
            } else {
                this.addContact(formData);
            }

            this.hideContactModal();
            this.renderContacts();
            this.updateStats();
            this.populateTagFilter();
        } catch (error) {
            alert(error.message);
            document.getElementById('contactName').focus();
        }
    }

    handleDeleteContact(id) {
        const contact = this.getContact(id);
        if (contact && confirm(`Are you sure you want to delete "${contact.name}"?`)) {
            this.deleteContact(id);
            this.renderContacts();
            this.updateStats();
            this.populateTagFilter();
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PriorityCRM();
});