/**
 * CipherH Admin Dashboard JavaScript
 * Handles admin panel functionality, monitoring, and management
 */

// Admin-specific variables
let adminSocket = null;
let adminStats = {};
let chartInstances = {};
let refreshInterval = null;

// Initialize admin panel
document.addEventListener('DOMContentLoaded', function() {
    initializeAdminPanel();
});

function initializeAdminPanel() {
    console.log('CipherH Admin: Initializing admin panel...');
    
    // Initialize Socket.IO for admin updates
    initializeAdminSocket();
    
    // Load initial admin data
    loadAdminData();
    
    // Initialize admin UI components
    initializeAdminUI();
    
    // Set up periodic updates
    setupAdminUpdates();
    
    console.log('CipherH Admin: Admin panel initialized');
}

/**
 * Admin Socket.IO Management
 */
function initializeAdminSocket() {
    if (typeof io !== 'undefined') {
        adminSocket = io('/admin');
        
        adminSocket.on('connect', () => {
            console.log('CipherH Admin: Socket connected');
            updateConnectionStatus('connected');
        });
        
        adminSocket.on('disconnect', () => {
            console.log('CipherH Admin: Socket disconnected');
            updateConnectionStatus('disconnected');
        });
        
        adminSocket.on('admin_update', handleAdminUpdate);
        adminSocket.on('system_alert', handleSystemAlert);
    }
}

function handleAdminUpdate(data) {
    console.log('CipherH Admin: Received update', data);
    
    switch (data.type) {
        case 'interaction':
            updateInteractionStats(data);
            break;
        case 'memory_sync':
            updateMemoryStatus(data);
            break;
        case 'platform_status':
            updatePlatformStatus(data);
            break;
        default:
            console.log('CipherH Admin: Unknown update type', data.type);
    }
}

function handleSystemAlert(data) {
    console.warn('CipherH Admin: System alert', data);
    showAdminNotification(data.message, data.level || 'warning');
    
    // Add to alert log
    addSystemAlert(data);
}

/**
 * Admin Data Loading
 */
async function loadAdminData() {
    try {
        const response = await fetch('/admin/api/system/status');
        const data = await response.json();
        
        adminStats = data;
        updateAdminDashboard(data);
        
    } catch (error) {
        console.error('CipherH Admin: Failed to load admin data', error);
        showAdminNotification('Không thể tải dữ liệu admin', 'danger');
    }
}

function updateAdminDashboard(data) {
    // Update system overview
    updateSystemOverview(data);
    
    // Update charts if present
    updateAdminCharts(data);
    
    // Update component statuses
    updateComponentStatuses(data);
    
    // Update recent activity
    updateRecentActivity(data);
}

function updateSystemOverview(data) {
    // Update user count
    const userCountEl = document.querySelector('.stat-users');
    if (userCountEl && data.database) {
        userCountEl.textContent = data.database.users || 0;
    }
    
    // Update interaction count
    const interactionCountEl = document.querySelector('.stat-interactions');
    if (interactionCountEl && data.database) {
        interactionCountEl.textContent = data.database.interactions || 0;
    }
    
    // Update memory count
    const memoryCountEl = document.querySelector('.stat-memories');
    if (memoryCountEl && data.database) {
        memoryCountEl.textContent = data.database.memories || 0;
    }
    
    // Update recent activity stats
    if (data.recent_activity) {
        updateRecentActivityStats(data.recent_activity);
    }
}

function updateComponentStatuses(data) {
    // Update Notion Vault status
    updateComponentStatus('notion-vault', data.notion_vault);
    
    // Update OpenAI Brain status
    updateComponentStatus('openai-brain', data.openai_brain);
    
    // Update Platform statuses
    if (data.platforms) {
        Object.keys(data.platforms).forEach(platform => {
            updatePlatformStatusDisplay(platform, data.platforms[platform]);
        });
    }
}

function updateComponentStatus(componentId, status) {
    const element = document.getElementById(componentId + '-status');
    if (!element) return;
    
    let badgeClass = 'bg-secondary';
    let statusText = 'Không xác định';
    
    if (status && status.connected) {
        badgeClass = 'bg-success';
        statusText = 'Hoạt động';
    } else if (status && status.error) {
        badgeClass = 'bg-danger';
        statusText = 'Lỗi';
    } else {
        badgeClass = 'bg-warning';
        statusText = 'Hạn chế';
    }
    
    element.innerHTML = `<span class="badge ${badgeClass}">${statusText}</span>`;
}

/**
 * Chart Management
 */
function updateAdminCharts(data) {
    // Update platform distribution chart
    if (data.platform_stats) {
        updatePlatformChart(data.platform_stats);
    }
    
    // Update interaction timeline chart
    if (data.interaction_timeline) {
        updateTimelineChart(data.interaction_timeline);
    }
    
    // Update sentiment analysis chart
    if (data.sentiment_stats) {
        updateSentimentChart(data.sentiment_stats);
    }
}

function updatePlatformChart(platformStats) {
    const canvas = document.getElementById('platformChart');
    if (!canvas || !window.Chart) return;
    
    const ctx = canvas.getContext('2d');
    
    // Destroy existing chart
    if (chartInstances.platform) {
        chartInstances.platform.destroy();
    }
    
    const data = {
        labels: platformStats.map(stat => stat.platform),
        datasets: [{
            data: platformStats.map(stat => stat.count),
            backgroundColor: [
                '#007bff', // Web
                '#1877f2', // Facebook
                '#ff0050', // TikTok
                '#0068ff', // Zalo
                '#0088cc', // Telegram
                '#ea4335'  // Email
            ]
        }]
    };
    
    chartInstances.platform = new Chart(ctx, {
        type: 'doughnut',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

function updateTimelineChart(timelineData) {
    const canvas = document.getElementById('timelineChart');
    if (!canvas || !window.Chart) return;
    
    const ctx = canvas.getContext('2d');
    
    // Destroy existing chart
    if (chartInstances.timeline) {
        chartInstances.timeline.destroy();
    }
    
    chartInstances.timeline = new Chart(ctx, {
        type: 'line',
        data: {
            labels: timelineData.labels,
            datasets: [{
                label: 'Tương tác',
                data: timelineData.interactions,
                borderColor: '#007bff',
                backgroundColor: 'rgba(0, 123, 255, 0.1)',
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function updateSentimentChart(sentimentData) {
    const canvas = document.getElementById('sentimentChart');
    if (!canvas || !window.Chart) return;
    
    const ctx = canvas.getContext('2d');
    
    // Destroy existing chart
    if (chartInstances.sentiment) {
        chartInstances.sentiment.destroy();
    }
    
    chartInstances.sentiment = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Tích cực', 'Trung tính', 'Tiêu cực'],
            datasets: [{
                data: [
                    sentimentData.positive || 0,
                    sentimentData.neutral || 0,
                    sentimentData.negative || 0
                ],
                backgroundColor: ['#28a745', '#6c757d', '#dc3545']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

/**
 * Admin UI Interactions
 */
function initializeAdminUI() {
    // Initialize tab switching
    initializeAdminTabs();
    
    // Initialize platform toggles
    initializePlatformToggles();
    
    // Initialize memory management
    initializeMemoryManagement();
    
    // Initialize export functionality
    initializeExportFunctionality();
}

function initializeAdminTabs() {
    const tabLinks = document.querySelectorAll('.nav-tabs .nav-link');
    tabLinks.forEach(link => {
        link.addEventListener('click', handleTabSwitch);
    });
}

function handleTabSwitch(event) {
    const targetTab = event.target.getAttribute('href').substring(1);
    console.log('CipherH Admin: Switching to tab', targetTab);
    
    // Load tab-specific data
    loadTabData(targetTab);
}

async function loadTabData(tabName) {
    switch (tabName) {
        case 'interactions':
            await loadInteractionsData();
            break;
        case 'users':
            await loadUsersData();
            break;
        case 'memories':
            await loadMemoriesData();
            break;
        case 'platforms':
            await loadPlatformsData();
            break;
        default:
            // Dashboard - already loaded
            break;
    }
}

async function loadInteractionsData() {
    try {
        const response = await fetch('/admin/interactions?format=json');
        const data = await response.json();
        
        updateInteractionsTable(data);
        
    } catch (error) {
        console.error('Failed to load interactions:', error);
    }
}

async function loadUsersData() {
    try {
        const response = await fetch('/admin/users?format=json');
        const data = await response.json();
        
        updateUsersTable(data);
        
    } catch (error) {
        console.error('Failed to load users:', error);
    }
}

async function loadMemoriesData() {
    try {
        const response = await fetch('/admin/memories?format=json');
        const data = await response.json();
        
        updateMemoriesDisplay(data);
        
    } catch (error) {
        console.error('Failed to load memories:', error);
    }
}

async function loadPlatformsData() {
    try {
        const response = await fetch('/api/platforms');
        const data = await response.json();
        
        updatePlatformsDisplay(data);
        
    } catch (error) {
        console.error('Failed to load platforms:', error);
    }
}

/**
 * Platform Management
 */
function initializePlatformToggles() {
    const toggles = document.querySelectorAll('.platform-toggle input[type="checkbox"]');
    toggles.forEach(toggle => {
        toggle.addEventListener('change', handlePlatformToggle);
    });
}

async function handlePlatformToggle(event) {
    const platformName = event.target.id.replace('toggle-', '');
    const isActive = event.target.checked;
    
    try {
        const response = await fetch(`/admin/api/platform/${platformName}/toggle`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ active: isActive })
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            showAdminNotification(
                `${platformName} đã được ${isActive ? 'kích hoạt' : 'tạm dừng'}`, 
                'success'
            );
            updatePlatformStatusDisplay(platformName, { active: isActive });
        } else {
            throw new Error(data.error);
        }
        
    } catch (error) {
        console.error('Platform toggle error:', error);
        showAdminNotification('Không thể thay đổi trạng thái nền tảng', 'danger');
        
        // Revert toggle
        event.target.checked = !isActive;
    }
}

async function togglePlatform(platformName) {
    const toggle = document.getElementById(`toggle-${platformName}`);
    if (toggle) {
        toggle.click();
    }
}

function updatePlatformStatusDisplay(platform, status) {
    const card = document.querySelector(`[data-platform="${platform}"]`);
    if (!card) return;
    
    const statusBadge = card.querySelector('.status-badge');
    const toggleSwitch = card.querySelector('input[type="checkbox"]');
    
    if (statusBadge) {
        if (status.active) {
            statusBadge.innerHTML = '<span class="badge bg-success">Hoạt động</span>';
        } else {
            statusBadge.innerHTML = '<span class="badge bg-secondary">Tạm dừng</span>';
        }
    }
    
    if (toggleSwitch) {
        toggleSwitch.checked = status.active;
    }
}

/**
 * Memory Management
 */
function initializeMemoryManagement() {
    const createMemoryBtn = document.getElementById('create-memory-btn');
    if (createMemoryBtn) {
        createMemoryBtn.addEventListener('click', showCreateMemoryModal);
    }
    
    const createMemoryForm = document.getElementById('createMemoryForm');
    if (createMemoryForm) {
        createMemoryForm.addEventListener('submit', handleCreateMemory);
    }
}

function showCreateMemoryModal() {
    const modal = document.getElementById('createMemoryModal');
    if (modal && window.bootstrap) {
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
    }
}

async function handleCreateMemory(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const memoryData = {
        content: formData.get('content'),
        memory_type: formData.get('memory_type'),
        confidence: parseFloat(formData.get('confidence'))
    };
    
    try {
        const response = await fetch('/admin/api/memory/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(memoryData)
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            showAdminNotification('Ký ức đã được tạo thành công', 'success');
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('createMemoryModal'));
            if (modal) {
                modal.hide();
            }
            
            // Refresh memories if on memories tab
            if (document.querySelector('.nav-link[href="#memories"].active')) {
                loadMemoriesData();
            }
            
            // Reset form
            event.target.reset();
            
        } else {
            throw new Error(data.error);
        }
        
    } catch (error) {
        console.error('Create memory error:', error);
        showAdminNotification('Không thể tạo ký ức', 'danger');
    }
}

async function createMemory() {
    const form = document.getElementById('createMemoryForm');
    if (form) {
        form.dispatchEvent(new Event('submit'));
    }
}

/**
 * Export Functionality
 */
function initializeExportFunctionality() {
    const exportBtns = document.querySelectorAll('[data-export]');
    exportBtns.forEach(btn => {
        btn.addEventListener('click', handleExport);
    });
}

async function handleExport(event) {
    const exportType = event.target.dataset.export;
    const days = prompt('Số ngày dữ liệu muốn xuất (mặc định: 30):', '30');
    
    if (days === null) return;
    
    try {
        const response = await fetch(`/admin/api/analytics/export?days=${days}`);
        const data = await response.json();
        
        const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: 'application/json'
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cipherh-${exportType}-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        showAdminNotification('Dữ liệu đã được xuất thành công', 'success');
        
    } catch (error) {
        console.error('Export error:', error);
        showAdminNotification('Không thể xuất dữ liệu', 'danger');
    }
}

/**
 * Admin Dashboard Functions
 */
async function refreshDashboard() {
    showAdminNotification('Đang làm mới dashboard...', 'info', 1000);
    
    try {
        await loadAdminData();
        showAdminNotification('Dashboard đã được làm mới', 'success');
    } catch (error) {
        showAdminNotification('Không thể làm mới dashboard', 'danger');
    }
}

async function syncVault() {
    const button = event.target;
    button.classList.add('loading');
    button.disabled = true;
    
    try {
        const response = await fetch('/admin/api/vault/sync', {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            showAdminNotification('Vault đã được đồng bộ', 'success');
            
            // Update memory stats
            if (adminStats.database) {
                adminStats.database.memories = (adminStats.database.memories || 0) + 1;
                updateSystemOverview(adminStats);
            }
        } else {
            throw new Error(data.error);
        }
        
    } catch (error) {
        console.error('Vault sync error:', error);
        showAdminNotification('Không thể đồng bộ vault', 'danger');
    } finally {
        button.classList.remove('loading');
        button.disabled = false;
    }
}

/**
 * Notification System for Admin
 */
function showAdminNotification(message, type = 'info', duration = 5000) {
    // Use the global notification system
    if (window.CipherH && window.CipherH.showNotification) {
        window.CipherH.showNotification(message, type, duration);
        return;
    }
    
    // Fallback notification system
    console.log(`CipherH Admin [${type.toUpperCase()}]: ${message}`);
    
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, duration);
}

/**
 * Periodic Updates
 */
function setupAdminUpdates() {
    // Refresh admin data every 2 minutes
    refreshInterval = setInterval(() => {
        loadAdminData();
    }, 120000);
    
    // Update connection status every 10 seconds
    setInterval(() => {
        checkConnectionStatus();
    }, 10000);
}

function checkConnectionStatus() {
    if (adminSocket) {
        const isConnected = adminSocket.connected;
        updateConnectionStatus(isConnected ? 'connected' : 'disconnected');
    }
}

function updateConnectionStatus(status) {
    const statusElements = document.querySelectorAll('.connection-status');
    statusElements.forEach(element => {
        if (status === 'connected') {
            element.innerHTML = '<span class="badge bg-success">Kết nối</span>';
        } else {
            element.innerHTML = '<span class="badge bg-danger">Mất kết nối</span>';
        }
    });
}

/**
 * Cleanup
 */
window.addEventListener('beforeunload', function() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
    
    if (adminSocket) {
        adminSocket.disconnect();
    }
    
    // Destroy chart instances
    Object.values(chartInstances).forEach(chart => {
        if (chart && chart.destroy) {
            chart.destroy();
        }
    });
});

// Export admin functions for global access
window.CipherHAdmin = {
    refreshDashboard,
    syncVault,
    togglePlatform,
    createMemory,
    showAdminNotification,
    loadAdminData
};

console.log('CipherH Admin: JavaScript loaded');
