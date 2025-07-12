// Variabili globali
let currentTemplateId = null;
let currentCampaignId = null;
let currentConfigurationId = null;
let templates = [];
let recipients = [];
let categories = [];
let campaigns = [];
let configurations = [];
let currentDeleteRecipientId = null;
let currentDeleteCategory = null;
let selectedRecipientIds = [];
// Flag globale per la conferma invio campagna
let campaignSendConfirmed = false;
let campaignSendInProgress = false; // Per evitare invii multipli
let progressInterval = null;
let progressCampaignId = null;
let joditInstance;

// Inizializzazione dell'applicazione
document.addEventListener('DOMContentLoaded', function() {
    // Inizializza Jodit con un delay per assicurarsi che sia caricato
    setTimeout(() => {
        console.log('Elemento jodit-editor:', document.getElementById('jodit-editor'));
        console.log('Jodit disponibile:', typeof Jodit);
        
        const editorElement = document.getElementById('jodit-editor');
        if (editorElement) {
            if (typeof Jodit !== 'undefined') {
                try {
                    // Assicurati che l'elemento sia visibile
                    if (editorElement.offsetParent !== null) {
                        joditInstance = new Jodit('#jodit-editor', {
                            height: 300
                        });
                        
                        console.log('Jodit inizializzato con successo');
                        
                        // Aggiungi listener per aggiornare lastHtmlContent quando l'utente modifica il contenuto
                        joditInstance.events.on('change', () => {
                            lastHtmlContent = joditInstance.value;
                            console.log('Contenuto aggiornato da Jodit:', lastHtmlContent);
                        });
                    } else {
                        console.log('Elemento jodit-editor non è visibile, inizializzazione rimandata');
                        // Riprova dopo un po'
                        setTimeout(() => {
                            if (typeof Jodit !== 'undefined') {
                                joditInstance = new Jodit('#jodit-editor', {
                                    height: 300
                                });
                                console.log('Jodit inizializzato con successo (secondo tentativo)');
                            }
                        }, 500);
                    }
                } catch (error) {
                    console.error('Errore nell\'inizializzazione di Jodit:', error);
                }
            } else {
                console.error('Jodit non è disponibile');
            }
        } else {
            console.error('L\'elemento jodit-editor non esiste');
        }
    }, 100);
    
    loadTemplates();
    loadCategories();
    loadCampaigns();
    loadConfigurations();
    setupEventListeners();
    showSection('campaigns', null); // Mostra la sezione Campagne di default
    // === GESTIONE INVIO CAMPAGNA: validazione e conferma ===
    const templateSelect = document.getElementById('campaign-template');
    const categorySelect = document.getElementById('campaign-category');
    if (templateSelect) templateSelect.addEventListener('change', updateSendCampaignBtn);
    if (categorySelect) categorySelect.addEventListener('change', updateSendCampaignBtn);
    updateSendCampaignBtn();

    // Intercetta submit form campagna per mostrare il modale di conferma
    const campaignForm = document.getElementById('campaign-form');
    if (campaignForm) {
        // Rimuovo qualsiasi altro submit handler precedente
        campaignForm.onsubmit = null;
        // Rimuovo eventuali altri listener di submit
        campaignForm.replaceWith(campaignForm.cloneNode(true));
        const newCampaignForm = document.getElementById('campaign-form');
        newCampaignForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            if (campaignSendInProgress) return false;

            // Prepara il messaggio di conferma
            const template = document.getElementById('campaign-template');
            const category = document.getElementById('campaign-category');
            const count = document.getElementById('campaign-count').value || 'tutti';
            const delay = document.getElementById('campaign-delay').value;
            const templateText = template.options[template.selectedIndex]?.text || '';
            const categoryText = category.options[category.selectedIndex]?.text || '';
            const html = `
                Saranno inviate <b>${count}</b> mail alla categoria <b>${categoryText}</b> 
                con il template <b>${templateText}</b> con un ritardo di <b>${delay}</b> secondi tra una mail e un'altra.<br><br>
                Continuare?
            `;

            // Mostra swal di conferma
            const result = await Swal.fire({
                title: 'Conferma Invio Campagna',
                html: html,
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Conferma e invia',
                cancelButtonText: 'Annulla'
            });

            if (result.isConfirmed) {
                campaignSendInProgress = true;
                inviaCampagna(); // SOLO QUI parte l'invio e il modale avanzamento
            }
        });
        attachCampaignSelectListeners();
        updateSendCampaignBtn();
    }
});

// Funzione per collegare i listener change alle select campagna
function attachCampaignSelectListeners() {
    const templateSelect = document.getElementById('campaign-template');
    const categorySelect = document.getElementById('campaign-category');
    if (templateSelect) templateSelect.addEventListener('change', updateSendCampaignBtn);
    if (categorySelect) categorySelect.addEventListener('change', updateSendCampaignBtn);
}

// Inizializzazione editor Jodit
function initJoditEditor() {
    if (document.getElementById('jodit-editor') && typeof Jodit !== 'undefined') {
        joditInstance = new Jodit('#jodit-editor', {
            height: 300
        });
        
        joditInstance.events.on('change', () => {
            lastHtmlContent = joditInstance.value;
        });
    }
}

// Setup event listeners
function setupEventListeners() {
    // Form template
    document.getElementById('template-form').addEventListener('submit', handleTemplateSubmit);
    
    // Form upload CSV
    document.getElementById('upload-form').addEventListener('submit', handleCsvUpload);
    
    // Form campagna
    document.getElementById('campaign-form').addEventListener('submit', handleCampaignSubmit);
    
    // Filtro categoria
    document.getElementById('category-filter').addEventListener('change', filterRecipients);
    
    // Modal conferma eliminazione template
    document.getElementById('confirmDelete').addEventListener('click', confirmDeleteTemplate);
    
    // Modal conferma eliminazione campagna
    document.getElementById('confirmDeleteCampaign').addEventListener('click', confirmDeleteCampaign);
    
    // Form configurazione
    document.getElementById('configuration-form').addEventListener('submit', handleConfigurationSubmit);
    
    // Modal conferma eliminazione configurazione
    document.getElementById('confirmDeleteConfiguration').addEventListener('click', confirmDeleteConfiguration);
}

// Gestione sezioni
function showSection(sectionName, event) {
    // Nascondi tutte le sezioni
    document.querySelectorAll('.section').forEach(section => {
        section.style.display = 'none';
    });
    
    // Mostra la sezione selezionata
    document.getElementById(sectionName + '-section').style.display = 'block';
    
    // Aggiorna la navigazione se l'evento è fornito
    if (event && event.target) {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        event.target.classList.add('active');
    }
    
    // Carica i dati specifici della sezione
    switch(sectionName) {
        case 'templates':
            loadTemplates();
            break;
        case 'recipients':
            loadRecipients();
            break;
        case 'campaigns':
            loadCampaigns();
            break;
        case 'configurations':
            loadConfigurations();
            break;
    }
}

// === GESTIONE TEMPLATE ===

// Carica i template
async function loadTemplates() {
    try {
        const response = await fetch('/api/templates');
        templates = await response.json();
        renderTemplatesList();
        updateCampaignTemplateSelect();
    } catch (error) {
        showAlert('Errore nel caricamento dei template', 'danger');
    }
}

// Renderizza la lista dei template
function renderTemplatesList() {
    const container = document.getElementById('templates-list');
    container.innerHTML = '';
    
    if (templates.length === 0) {
        container.innerHTML = '<p class="text-muted text-center">Nessun template disponibile</p>';
        return;
    }
    
    templates.forEach(template => {
        const item = document.createElement('div');
        item.className = 'list-group-item list-group-item-action';
        item.innerHTML = `
            <div class="template-item">
                <div>
                    <h6 class="mb-1">${template.name}</h6>
                    <small class="text-muted">${template.subject}</small>
                </div>
                <div class="template-actions">
                    <button class="btn btn-outline-primary btn-sm" onclick="editTemplate(${template.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-outline-danger btn-sm" onclick="deleteTemplate(${template.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
        container.appendChild(item);
    });
}

// Mostra form nuovo template
function showNewTemplateForm() {
    currentTemplateId = null;
    clearTemplateForm();
    document.getElementById('template-name').focus();
}

// Modifica template
async function editTemplate(templateId) {
    try {
        const response = await fetch(`/api/templates/${templateId}`);
        const template = await response.json();
        
        currentTemplateId = template.id;
        document.getElementById('template-name').value = template.name;
        document.getElementById('template-subject').value = template.subject;
        lastHtmlContent = template.content; // Salva il contenuto HTML
        if (joditInstance) {
            joditInstance.value = template.content;
        }
        
        // Evidenzia il template selezionato
        document.querySelectorAll('.list-group-item').forEach(item => {
            item.classList.remove('active');
        });
        event.target.closest('.list-group-item').classList.add('active');
        
    } catch (error) {
        showAlert('Errore nel caricamento del template', 'danger');
    }
}

// Variabile per mantenere il contenuto HTML
let lastHtmlContent = '';

// Gestione submit form template
async function handleTemplateSubmit(event) {
    event.preventDefault();
    
    const name = document.getElementById('template-name').value;
    const subject = document.getElementById('template-subject').value;
    let content;
    if (joditInstance) {
        content = joditInstance.value;
    } else {
        content = '';
    }
    
    if (!name || !subject || !content) {
        showAlert('Tutti i campi sono obbligatori', 'warning');
        return;
    }
    
    const templateData = { name, subject, content };
    const url = currentTemplateId ? `/api/templates/${currentTemplateId}` : '/api/templates';
    const method = currentTemplateId ? 'PUT' : 'POST';
    
    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(templateData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAlert(result.message, 'success');
            loadTemplates();
            clearTemplateForm();
        } else {
            showAlert(result.error, 'danger');
        }
    } catch (error) {
        showAlert('Errore nel salvataggio del template', 'danger');
    }
}

// Elimina template
function deleteTemplate(templateId) {
    currentTemplateId = templateId;
    const modal = new bootstrap.Modal(document.getElementById('deleteModal'));
    modal.show();
}

// Conferma eliminazione template
async function confirmDeleteTemplate() {
    try {
        const response = await fetch(`/api/templates/${currentTemplateId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAlert(result.message, 'success');
            loadTemplates();
            clearTemplateForm();
            bootstrap.Modal.getInstance(document.getElementById('deleteModal')).hide();
        } else {
            showAlert(result.error, 'danger');
        }
    } catch (error) {
        showAlert('Errore nell\'eliminazione del template', 'danger');
    }
}

// Pulisci form template
function clearTemplateForm() {
    document.getElementById('template-form').reset();
    if (joditInstance) {
        joditInstance.value = '';
    }
    lastHtmlContent = ''; // Reset del contenuto HTML salvato
    currentTemplateId = null;
    
    // Rimuovi evidenziazione
    document.querySelectorAll('.list-group-item').forEach(item => {
        item.classList.remove('active');
    });
}

// === GESTIONE DESTINATARI ===

// Carica destinatari
async function loadRecipients(category = '') {
    try {
        const url = category ? `/api/recipients?category=${encodeURIComponent(category)}` : '/api/recipients';
        const response = await fetch(url);
        recipients = await response.json();
        renderRecipientsTable();
        updateRecipientsStats();
    } catch (error) {
        showAlert('Errore nel caricamento dei destinatari', 'danger');
    }
}

// Carica categorie
async function loadCategories() {
    try {
        const response = await fetch('/api/categories');
        categories = await response.json();
        updateCategoryFilters();
    } catch (error) {
        showAlert('Errore nel caricamento delle categorie', 'danger');
    }
}

// Aggiorna filtri categoria
function updateCategoryFilters() {
    const filterSelect = document.getElementById('category-filter');
    const campaignSelect = document.getElementById('campaign-category');
    
    // Pulisci opzioni esistenti
    filterSelect.innerHTML = '<option value="">Tutte le categorie</option>';
    campaignSelect.innerHTML = '<option value="">Seleziona categoria...</option>';
    
    // Aggiungi categorie
    categories.forEach(category => {
        filterSelect.innerHTML += `<option value="${category}">${category}</option>`;
        campaignSelect.innerHTML += `<option value="${category}">${category}</option>`;
    });
    attachCampaignSelectListeners();
    updateSendCampaignBtn(); // Aggiorna stato bottone
}

// Filtra destinatari per categoria
function filterRecipients() {
    const category = document.getElementById('category-filter').value;
    loadRecipients(category);
}

// Gestione upload CSV
async function handleCsvUpload(event) {
    event.preventDefault();
    
    const fileInput = document.getElementById('csv-file');
    const file = fileInput.files[0];
    
    if (!file) {
        showAlert('Seleziona un file CSV', 'warning');
        return;
    }
    
    const formData = new FormData();
    formData.append('csv', file);
    
    try {
        const response = await fetch('/api/recipients/upload', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAlert(result.message, 'success');
            fileInput.value = '';
            loadRecipients();
            loadCategories();
        } else {
            showAlert(result.error, 'danger');
        }
    } catch (error) {
        showAlert('Errore nel caricamento del file CSV', 'danger');
    }
}

// Gestione selezione multipla destinatari
function updateSelectedRecipients() {
    const checkboxes = document.querySelectorAll('.recipient-checkbox');
    selectedRecipientIds = Array.from(checkboxes).filter(cb => cb.checked).map(cb => parseInt(cb.value));
    const btn = document.getElementById('delete-selected-recipients-btn');
    btn.disabled = selectedRecipientIds.length === 0;
}

document.getElementById('select-all-recipients').addEventListener('change', function() {
    const checked = this.checked;
    document.querySelectorAll('.recipient-checkbox').forEach(cb => {
        cb.checked = checked;
    });
    updateSelectedRecipients();
});

function showDeleteSelectedRecipientsModal() {
    const modal = new bootstrap.Modal(document.getElementById('deleteSelectedRecipientsModal'));
    modal.show();
}

document.getElementById('confirmDeleteSelectedRecipients').addEventListener('click', async function() {
    if (selectedRecipientIds.length === 0) return;
    try {
        const response = await fetch('/api/recipients/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: selectedRecipientIds })
        });
        const result = await response.json();
        if (response.ok) {
            showAlert(result.message, 'success');
            loadRecipients(document.getElementById('category-filter').value);
            loadCategories();
        } else {
            showAlert(result.error, 'danger');
        }
    } catch (e) {
        showAlert('Errore nell\'eliminazione selezionati', 'danger');
    }
    bootstrap.Modal.getInstance(document.getElementById('deleteSelectedRecipientsModal')).hide();
});

// Modifica renderRecipientsTable per checkbox e selezione
function renderRecipientsTable() {
    const tbody = document.getElementById('recipients-table');
    tbody.innerHTML = '';
    const deleteSelectedBtn = document.getElementById('delete-selected-recipients-btn');
    if (recipients.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Nessun destinatario trovato</td></tr>';
        deleteSelectedBtn.style.display = 'none';
        return;
    }
    deleteSelectedBtn.style.display = '';
    recipients.forEach(recipient => {
        const row = document.createElement('tr');
        let statusClass, statusText;
        switch(recipient.status) {
            case 1:
                statusClass = 'status-sent';
                statusText = 'Inviata';
                break;
            case -1:
                statusClass = 'status-error';
                statusText = 'Errore';
                break;
            default:
                statusClass = 'status-pending';
                statusText = 'In attesa';
        }
        const sentDate = recipient.sent_date ? new Date(recipient.sent_date).toLocaleString('it-IT') : '-';
        row.innerHTML = `
            <td><input type="checkbox" class="recipient-checkbox" value="${recipient.id}" onchange="updateSelectedRecipients()"></td>
            <td>${recipient.email}</td>
            <td>${recipient.name}</td>
            <td><span class="badge bg-secondary">${recipient.category}</span></td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td>${sentDate}</td>
            <td><button class="btn btn-outline-danger btn-sm" title="Elimina" onclick="deleteRecipient(${recipient.id}, '${recipient.category}')"><i class="fas fa-trash"></i></button></td>
        `;
        tbody.appendChild(row);
    });
    // Aggiorna selezione allineando la checkbox "seleziona tutti"
    document.getElementById('select-all-recipients').checked = recipients.length > 0 && document.querySelectorAll('.recipient-checkbox:checked').length === recipients.length;
    updateSelectedRecipients();
}

// Aggiorna statistiche destinatari
function updateRecipientsStats() {
    const statsContainer = document.getElementById('recipients-stats');
    const total = recipients.length;
    const sent = recipients.filter(r => r.status === 1).length;
    const error = recipients.filter(r => r.status === -1).length;
    const pending = total - sent - error;
    
    statsContainer.innerHTML = `
        <div class="row">
            <div class="col-3">
                <div class="stats-card text-center">
                    <div class="stats-number">${total}</div>
                    <div class="stats-label">Totali</div>
                </div>
            </div>
            <div class="col-3">
                <div class="stats-card text-center">
                    <div class="stats-number">${sent}</div>
                    <div class="stats-label">Inviate</div>
                </div>
            </div>
            <div class="col-3">
                <div class="stats-card text-center">
                    <div class="stats-number">${pending}</div>
                    <div class="stats-label">In attesa</div>
                </div>
            </div>
            <div class="col-3">
                <div class="stats-card text-center">
                    <div class="stats-number">${error}</div>
                    <div class="stats-label">Errori</div>
                </div>
            </div>
        </div>
    `;
}

// === GESTIONE CAMPAGNE ===

// Carica campagne
async function loadCampaigns() {
    try {
        const response = await fetch('/api/campaigns');
        campaigns = await response.json();
        renderCampaignsList();
    } catch (error) {
        showAlert('Errore nel caricamento delle campagne', 'danger');
    }
}

// Aggiorna select template per campagne
function updateCampaignTemplateSelect() {
    const select = document.getElementById('campaign-template');
    select.innerHTML = '<option value="">Seleziona template...</option>';
    
    templates.forEach(template => {
        select.innerHTML += `<option value="${template.id}">${template.name}</option>`;
    });
    attachCampaignSelectListeners();
    updateSendCampaignBtn(); // Aggiorna stato bottone
}

// === GESTIONE INVIO CAMPAGNA: validazione e conferma ===
function updateSendCampaignBtn() {
    const template = document.getElementById('campaign-template').value;
    const category = document.getElementById('campaign-category').value;
    const btn = document.querySelector('#campaign-form button[type="submit"]');
    console.log('updateSendCampaignBtn', {template, category, btn});
    if (btn) btn.disabled = !(template && category);
}

// Gestione submit form campagna
async function handleCampaignSubmit(event) {
    // Se submit arriva dal modale, non bloccare
    if (event.submitter && event.submitter.id === 'confirmSendCampaignBtn') return;
    event.preventDefault();
    
    const templateId = document.getElementById('campaign-template').value;
    const category = document.getElementById('campaign-category').value;
    const recipientsCount = document.getElementById('campaign-count').value || null;
    const delaySeconds = document.getElementById('campaign-delay').value || 30;
    
    if (!templateId || !category) {
        showAlert('Template e categoria sono obbligatori', 'warning');
        return;
    }
    
    const campaignData = {
        templateId: parseInt(templateId),
        category: category,
        recipientsCount: recipientsCount ? parseInt(recipientsCount) : null,
        delaySeconds: parseInt(delaySeconds)
    };
    
    try {
        const response = await fetch('/api/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(campaignData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAlert(result.message, 'success');
            document.getElementById('campaign-form').reset();
            loadCampaigns();
            
            // Mostra il modal avanzamento
            showProgressSwal(result.campaignId, result.recipientsCount || 0);
            setTimeout(loadCampaigns, 5000);
        } else {
            showAlert(result.error, 'danger');
        }
    } catch (error) {
        showAlert('Errore nell\'avvio della campagna', 'danger');
    }
}

// Funzione che esegue l'invio reale della campagna
async function inviaCampagna() {
    const templateId = document.getElementById('campaign-template').value;
    const category = document.getElementById('campaign-category').value;
    const recipientsCount = document.getElementById('campaign-count').value || null;
    const delaySeconds = document.getElementById('campaign-delay').value || 30;

    if (!templateId || !category) {
        showAlert('Template e categoria sono obbligatori', 'warning');
        campaignSendInProgress = false;
        return;
    }

    const campaignData = {
        templateId: parseInt(templateId),
        category: category,
        recipientsCount: recipientsCount ? parseInt(recipientsCount) : null,
        delaySeconds: parseInt(delaySeconds)
    };

    try {
        const response = await fetch('/api/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(campaignData)
        });

        const result = await response.json();

        if (response.ok) {
            showAlert(result.message, 'success');
            document.getElementById('campaign-form').reset();
            loadCampaigns();
            // Mostra il modal avanzamento SOLO qui (swal)
            showProgressSwal(result.campaignId, result.recipientsCount || 0);
            setTimeout(loadCampaigns, 5000);
        } else {
            showAlert(result.error, 'danger');
            campaignSendInProgress = false;
        }
    } catch (error) {
        showAlert('Errore nell\'avvio della campagna', 'danger');
        campaignSendInProgress = false;
    }
}

// Renderizza lista campagne
function renderCampaignsList() {
    const container = document.getElementById('campaigns-list');
    container.innerHTML = '';
    
    if (campaigns.length === 0) {
        container.innerHTML = '<p class="text-muted text-center">Nessuna campagna disponibile</p>';
        return;
    }
    
    campaigns.forEach(campaign => {
        const item = document.createElement('div');
        item.className = 'campaign-item fade-in';
        
        let statusClass, statusText;
        switch(campaign.status) {
            case 'completed':
                statusClass = 'completed';
                statusText = 'Completata';
                break;
            case 'completed_with_errors':
                statusClass = 'completed_with_errors';
                statusText = 'Completato con errori';
                break;
            case 'partial':
                statusClass = 'partial';
                statusText = 'Parziale';
                break;
            case 'error':
                statusClass = 'error';
                statusText = 'Errore';
                break;
            default:
                statusClass = 'pending';
                statusText = 'In corso';
        }
        // Determina se i pulsanti sono abilitati
        const canRetry = campaign.status === 'error' || campaign.status === 'partial';
        const canDelete = true; // Sempre eliminabile
        // Tooltip
        const retryTooltip = canRetry ? 'Riprova la campagna' : 'Riprova disponibile solo per campagne in errore o parziali';
        const deleteTooltip = 'Elimina la campagna';
        item.innerHTML = `
            <div class="d-flex justify-content-between align-items-start">
                <div>
                    <h6 class="mb-1">${campaign.template_name || 'Template non trovato'}</h6>
                    <p class="mb-1 text-muted">Categoria: ${campaign.category}</p>
                    <p class="mb-1 text-muted">Destinatari: ${campaign.recipients_count || 'Tutti'}</p>
                    <p class="mb-1 text-muted">Ritardo: ${campaign.delay_seconds}s</p>
                    <small class="text-muted">Creato: ${new Date(campaign.created_at).toLocaleString('it-IT')}</small>
                </div>
                <span class="campaign-status ${statusClass}">${statusText}</span>
            </div>
            <div class="campaign-actions">
                <button class="btn btn-outline-warning btn-sm me-1" onclick="retryCampaign(${campaign.id})" title="${retryTooltip}" ${canRetry ? '' : 'disabled'}>
                    <i class="fas fa-redo"></i> Riprova
                </button>
                <button class="btn btn-outline-danger btn-sm" onclick="deleteCampaign(${campaign.id})" title="${deleteTooltip}">
                    <i class="fas fa-trash"></i> Elimina
                </button>
            </div>
        `;
        container.appendChild(item);
    });
    // Inizializza i tooltip Bootstrap
    setTimeout(() => {
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[title]'));
        tooltipTriggerList.forEach(function (el) {
            new bootstrap.Tooltip(el);
        });
    }, 100);
}

// === GESTIONE CONFIGURAZIONI ===

// Carica configurazioni
async function loadConfigurations() {
    try {
        const response = await fetch('/api/configurations');
        configurations = await response.json();
        renderConfigurationsList();
    } catch (error) {
        showAlert('Errore nel caricamento delle configurazioni', 'danger');
    }
}

// Renderizza lista configurazioni
function renderConfigurationsList() {
    const container = document.getElementById('configurations-list');
    container.innerHTML = '';
    
    if (configurations.length === 0) {
        container.innerHTML = '<p class="text-muted text-center">Nessuna configurazione disponibile</p>';
        return;
    }
    
    configurations.forEach(config => {
        const item = document.createElement('div');
        item.className = 'list-group-item list-group-item-action';
        const activeBadge = config.is_active ? '<span class="badge bg-success ms-2">Attiva</span>' : '';
        
        item.innerHTML = `
            <div class="template-item">
                <div>
                    <h6 class="mb-1">${config.name} ${activeBadge}</h6>
                    <small class="text-muted">${config.email_host}:${config.email_port}</small>
                </div>
                <div class="template-actions">
                    <button class="btn btn-outline-primary btn-sm" onclick="editConfiguration(${config.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${!config.is_active ? `<button class="btn btn-outline-success btn-sm" onclick="activateConfiguration(${config.id})" title="Attiva configurazione">
                        <i class="fas fa-check"></i>
                    </button>` : ''}
                    <button class="btn btn-outline-danger btn-sm" onclick="deleteConfiguration(${config.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
        container.appendChild(item);
    });
}

// Mostra form nuova configurazione
function showNewConfigurationForm() {
    currentConfigurationId = null;
    clearConfigurationForm();
    document.getElementById('config-name').focus();
}

// Modifica configurazione
async function editConfiguration(configId) {
    try {
        const response = await fetch(`/api/configurations/${configId}`);
        const config = await response.json();
        
        currentConfigurationId = config.id;
        document.getElementById('config-name').value = config.name;
        document.getElementById('config-host').value = config.email_host;
        document.getElementById('config-port').value = config.email_port;
        document.getElementById('config-user').value = config.email_user;
        document.getElementById('config-pass').value = config.email_pass;
        document.getElementById('config-from').value = config.email_from;
        document.getElementById('config-active').checked = config.is_active === 1;
        
        // Evidenzia la configurazione selezionata
        document.querySelectorAll('#configurations-list .list-group-item').forEach(item => {
            item.classList.remove('active');
        });
        event.target.closest('.list-group-item').classList.add('active');
        
    } catch (error) {
        showAlert('Errore nel caricamento della configurazione', 'danger');
    }
}

// Gestione submit form configurazione
async function handleConfigurationSubmit(event) {
    event.preventDefault();
    
    const name = document.getElementById('config-name').value;
    const email_host = document.getElementById('config-host').value;
    const email_port = document.getElementById('config-port').value;
    const email_user = document.getElementById('config-user').value;
    const email_pass = document.getElementById('config-pass').value;
    const email_from = document.getElementById('config-from').value;
    const is_active = document.getElementById('config-active').checked;
    
    if (!name || !email_host || !email_port || !email_user || !email_pass || !email_from) {
        showAlert('Tutti i campi sono obbligatori', 'warning');
        return;
    }
    
    const configData = { name, email_host, email_port, email_user, email_pass, email_from, is_active };
    const url = currentConfigurationId ? `/api/configurations/${currentConfigurationId}` : '/api/configurations';
    const method = currentConfigurationId ? 'PUT' : 'POST';
    
    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(configData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAlert(result.message, 'success');
            loadConfigurations();
            clearConfigurationForm();
        } else {
            showAlert(result.error, 'danger');
        }
    } catch (error) {
        showAlert('Errore nel salvataggio della configurazione', 'danger');
    }
}

// Elimina configurazione
function deleteConfiguration(configId) {
    currentConfigurationId = configId;
    const modal = new bootstrap.Modal(document.getElementById('deleteConfigurationModal'));
    modal.show();
}

// Conferma eliminazione configurazione
async function confirmDeleteConfiguration() {
    try {
        const response = await fetch(`/api/configurations/${currentConfigurationId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAlert(result.message, 'success');
            loadConfigurations();
            clearConfigurationForm();
            bootstrap.Modal.getInstance(document.getElementById('deleteConfigurationModal')).hide();
        } else {
            showAlert(result.error, 'danger');
        }
    } catch (error) {
        showAlert('Errore nell\'eliminazione della configurazione', 'danger');
    }
}

// Attiva configurazione
async function activateConfiguration(configId) {
    try {
        const response = await fetch(`/api/configurations/${configId}/activate`, {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAlert(result.message, 'success');
            loadConfigurations();
        } else {
            showAlert(result.error, 'danger');
        }
    } catch (error) {
        showAlert('Errore nell\'attivazione della configurazione', 'danger');
    }
}

// Pulisci form configurazione
function clearConfigurationForm() {
    document.getElementById('configuration-form').reset();
    currentConfigurationId = null;
    
    // Rimuovi evidenziazione
    document.querySelectorAll('#configurations-list .list-group-item').forEach(item => {
        item.classList.remove('active');
    });
}

// === GESTIONE CAMPAGNE AVANZATA ===

// Elimina campagna
function deleteCampaign(campaignId) {
    currentCampaignId = campaignId;
    const modal = new bootstrap.Modal(document.getElementById('deleteCampaignModal'));
    modal.show();
}

// Conferma eliminazione campagna
async function confirmDeleteCampaign() {
    try {
        const response = await fetch(`/api/campaigns/${currentCampaignId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAlert(result.message, 'success');
            loadCampaigns();
            bootstrap.Modal.getInstance(document.getElementById('deleteCampaignModal')).hide();
        } else {
            showAlert(result.error, 'danger');
        }
    } catch (error) {
        showAlert('Errore nell\'eliminazione della campagna', 'danger');
    }
}

// Riprova campagna
async function retryCampaign(campaignId) {
    try {
        const response = await fetch(`/api/campaigns/${campaignId}/retry`, {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAlert(result.message, 'success');
            loadCampaigns();
            
            // Aggiorna automaticamente le campagne ogni 5 secondi
            setTimeout(loadCampaigns, 5000);
        } else {
            showAlert(result.error, 'danger');
        }
    } catch (error) {
        showAlert('Errore nell\'avvio della riprova', 'danger');
    }
}

// === AVANZAMENTO INVIO CAMPAGNA ===

// Modale avanzamento invio con SweetAlert2
function showProgressSwal(campaignId, total) {
    progressCampaignId = campaignId;
    let sent = 0;
    let error = 0;
    let current = '-';
    let errorsList = [];
    let percent = 0;
    let isCancelled = false;

    Swal.fire({
        title: 'Invio Email in corso',
        html: getProgressHtml(0, total, '-', 0, 0, []),
        showCancelButton: true,
        showConfirmButton: false,
        cancelButtonText: 'Annulla invio',
        allowOutsideClick: false,
        didOpen: () => {
            // Polling
            progressInterval = setInterval(async () => {
                if (!progressCampaignId) return;
                try {
                    const response = await fetch(`/api/campaigns/${progressCampaignId}/progress`);
                    if (!response.ok) return;
                    const data = await response.json();
                    sent = data.sent;
                    error = data.error;
                    current = data.current || '-';
                    errorsList = data.errors || [];
                    percent = Math.round((sent + error) / data.total * 100);
                    Swal.getHtmlContainer().innerHTML = getProgressHtml(percent, data.total, current, sent, error, errorsList);
                    // Se annullato
                    if (data.done && data.status === 'cancelled') {
                        clearInterval(progressInterval);
                        progressInterval = null;
                        progressCampaignId = null;
                        Swal.update({
                            title: 'Invio annullato',
                            icon: 'warning',
                            showCancelButton: false,
                            showConfirmButton: true,
                            confirmButtonText: 'Chiudi'
                        });
                        campaignSendInProgress = false;
                        return;
                    }
                    // Se completato
                    if (data.done) {
                        clearInterval(progressInterval);
                        progressInterval = null;
                        progressCampaignId = null;
                        Swal.update({
                            title: 'Invio completato',
                            icon: 'success',
                            showCancelButton: false,
                            showConfirmButton: true,
                            confirmButtonText: 'Chiudi'
                        });
                        campaignSendInProgress = false;
                        return;
                    }
                } catch (e) {}
            }, 1500);
        },
        willClose: () => {
            if (progressInterval) clearInterval(progressInterval);
            progressInterval = null;
            progressCampaignId = null;
            campaignSendInProgress = false;
        }
    }).then(result => {
        if (result.dismiss === Swal.DismissReason.cancel && progressCampaignId) {
            // Annulla invio
            fetch(`/api/campaigns/${progressCampaignId}/cancel`, { method: 'POST' });
            Swal.update({
                title: 'Annullamento in corso...',
                html: '<div class="text-center">Attendere prego...</div>',
                showCancelButton: false,
                showConfirmButton: false
            });
        }
    });
}

function getProgressHtml(percent, total, current, sent, error, errorsList) {
    return `
        <div class="mb-3">
            <div class="progress" style="height: 24px;">
                <div class="progress-bar" role="progressbar" style="width: ${percent}%">${percent}%</div>
            </div>
        </div>
        <div class="mb-2"><strong>Email attuale:</strong> <span>${current}</span></div>
        <div class="mb-2"><strong>Inviate:</strong> <span>${sent}</span> / <span>${total}</span></div>
        <div class="mb-2"><strong>Errori:</strong>
            <ul class="text-danger small mb-0">${errorsList.map(email => `<li>${email}</li>`).join('')}</ul>
        </div>
    `;
}

// === UTILITY ===

// Mostra alert
function showAlert(message, type) {
    const alertContainer = document.createElement('div');
    alertContainer.className = `alert alert-${type} alert-custom alert-dismissible fade show`;
    alertContainer.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    const container = document.querySelector('.container');
    container.insertBefore(alertContainer, container.firstChild);
    
    // Auto-remove dopo 5 secondi
    setTimeout(() => {
        if (alertContainer.parentNode) {
            alertContainer.remove();
        }
    }, 5000);
}

// === FUNZIONI GLOBALI PER ACCESSO DA HTML ===

// Rendi le funzioni accessibili globalmente
window.deleteCampaign = deleteCampaign;
window.retryCampaign = retryCampaign;
window.confirmDeleteCampaign = confirmDeleteCampaign;
window.deleteTemplate = deleteTemplate;
window.confirmDeleteTemplate = confirmDeleteTemplate;
window.editTemplate = editTemplate;
window.showNewTemplateForm = showNewTemplateForm;
window.clearTemplateForm = clearTemplateForm;
window.showSection = showSection;
window.editConfiguration = editConfiguration;
window.deleteConfiguration = deleteConfiguration;
window.activateConfiguration = activateConfiguration;
window.showNewConfigurationForm = showNewConfigurationForm;
window.clearConfigurationForm = clearConfigurationForm; 

function showDeleteAllRecipientsModal() {
    const category = document.getElementById('category-filter').value;
    currentDeleteCategory = category;
    document.getElementById('delete-all-category-label').textContent = category ? `della categoria "${category}"` : 'di tutte le categorie';
    const modal = new bootstrap.Modal(document.getElementById('deleteAllRecipientsModal'));
    modal.show();
}

const confirmDeleteAllRecipientsBtn = document.getElementById('confirmDeleteAllRecipients');
if (confirmDeleteAllRecipientsBtn) {
    confirmDeleteAllRecipientsBtn.addEventListener('click', async function() {
    const url = currentDeleteCategory ? `/api/recipients?category=${encodeURIComponent(currentDeleteCategory)}` : '/api/recipients';
    try {
        const response = await fetch(url, { method: 'DELETE' });
        const result = await response.json();
        if (response.ok) {
            showAlert(result.message, 'success');
            loadRecipients(currentDeleteCategory);
            loadCategories();
        } else {
            showAlert(result.error, 'danger');
        }
    } catch (e) {
        showAlert('Errore nell\'eliminazione massiva', 'danger');
    }
    bootstrap.Modal.getInstance(document.getElementById('deleteAllRecipientsModal')).hide();
    });
}

async function deleteRecipient(recipientId, category) {
    if (!confirm('Sei sicuro di voler eliminare questo destinatario?')) return;
    try {
        const response = await fetch(`/api/recipients/${recipientId}`, { method: 'DELETE' });
        const result = await response.json();
        if (response.ok) {
            showAlert(result.message, 'success');
            loadRecipients(category);
            loadCategories();
        } else {
            showAlert(result.error, 'danger');
        }
    } catch (e) {
        showAlert('Errore nell\'eliminazione destinatario', 'danger');
    }
}

// Funzione globale
window.deleteRecipient = deleteRecipient;
window.showDeleteAllRecipientsModal = showDeleteAllRecipientsModal; 
window.updateSelectedRecipients = updateSelectedRecipients;
window.showDeleteSelectedRecipientsModal = showDeleteSelectedRecipientsModal; 

// Aggiorna automaticamente il campo Numero destinatari in base alla categoria (campagna)
document.addEventListener('DOMContentLoaded', function() {
    const campaignCategorySelect = document.getElementById('campaign-category');
    const campaignCountInput = document.getElementById('campaign-count');
    if (campaignCategorySelect && campaignCountInput) {
        campaignCategorySelect.addEventListener('change', async function() {
            const category = this.value;
            if (!category) return;
            try {
                const response = await fetch(`/api/recipients/count?category=${encodeURIComponent(category)}`);
                if (!response.ok) return;
                const data = await response.json();
                if (data.count < 100) {
                    campaignCountInput.value = data.count;
                }
            } catch (e) {}
        });
    }
}); 

// Utility: converte tutte le immagini non-base64 in base64 nel contenuto HTML
async function convertImagesToBase64(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    const images = div.querySelectorAll('img');
    for (const img of images) {
        const src = img.getAttribute('src');
        if (src && !src.startsWith('data:')) {
            try {
                const dataUrl = await toDataURL(src);
                img.setAttribute('src', dataUrl);
            } catch (e) {
                // Se fallisce lascia l'URL originale
            }
        }
    }
    return div.innerHTML;
}
// Helper per convertire un'immagine in dataURL
function toDataURL(url) {
    return fetch(url)
        .then(response => response.blob())
        .then(blob => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        }));
} 