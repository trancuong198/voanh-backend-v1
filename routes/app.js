/**
 * CipherH Main Application JavaScript
 * Handles real-time communication, UI updates, and core functionality
 */

// Global variables
let socket = null;
let connectionStatus = 'disconnected';
let notificationQueue = [];
let systemStats = {};

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    console.log('CipherH: Initializing application...');
    
    // Initialize Socket.IO connection
    initializeSocket();
    
    // Initialize UI components
    initializeUI();
    
    // Load initial data
    loadSystemStats();
    
    // Set up periodic updates
    setupPeriodicUpdates();
    
    // Initialize Feather icons
    if (typeof feather !== 'undefined') {
        feather.replace();
    }
    
    console.log('CipherH: Application initialized successfully');
}

/**
 * Socket.IO Initialization and Event Handlers
 */
function initializeSocket() {
    if (typeof io === 'undefined') {
        console.warn('CipherH: Socket.IO not available');
        return;
    }
    
    socket = io();
    
    socket.on('connect', handleSocketConnect);
    socket.on('disconnect', handleSocketDisconnect);
    socket.on('cipher_response', handleCipherResponse);
    socket.on('new_interaction', handleNewInteraction);
    socket.on('system_update', handleSystemUpdate);
    socket.on('error', handleSocketError);
}

function handleSocketConnect() {
    console.log('CipherH: Socket connected');
    connectionStatus = 'connected';
    updateConnectionStatus('connected');
    showNotification('Connected to CipherH', 'success');
}

function handleSocketDisconnect() {
    console.log('CipherH: Socket disconnected');
    connectionStatus = 'disconnected';
    updateConnectionStatus('disconnected');
    showNotification('Lost connection to CipherH', 'warning');
}

function handleCipherResponse(data) {
    console.log('CipherH: Received response', data);
    
    // Update UI based on response
    if (typeof addMessageToChat === 'function') {
        addMessageToChat(data.message, 'cipher', data.timestamp);
    }
    
    // Update conversation context
    if (data.context_tags) {
        updateContextTags(data.context_tags);
    }
    
    if (data.sentiment) {
        updateSentimentDisplay(data.sentiment);
    }
}

function handleNewInteraction(data) {
    console.log('CipherH: New interaction detected', data);
    
    // Update statistics
    updateInteractionStats(data);
    
    // Update activity feed
    if (typeof addToRecentActivity === 'function') {
        addToRecentActivity(data);
    }
    
    // Show notification
    showNotification(`Tương tác mới từ ${data.platform}`, 'info');
}

function handleSystemUpdate(data) {
    console.log('CipherH: System update', data);
    
    // Update system status displays
    updateSystemStatus(data);
    
    if (data.type === 'memory_sync') {
        showNotification('Vault đã được đồng bộ', 'success');
    }
}

function handleSocketError(data) {
    console.error('CipherH: Socket error', data);
    showNotification(data.message || 'Lỗi hệ thống', 'danger');
}

/**
 * UI Initialization and Management
 */
function initializeUI() {
    // Initialize tooltips
    initializeTooltips();
    
    // Initialize modals
    initializeModals();
    
    // Set up global click handlers
    setupGlobalHandlers();
    
    // Initialize theme handling
    initializeTheme();
}

function initializeTooltips() {
    if (typeof bootstrap !== 'undefined') {
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
    }
}

function initializeModals() {
    if (typeof bootstrap !== 'undefined') {
        const modalElements = document.querySelectorAll('.modal');
        modalElements.forEach(modalEl => {
            new bootstrap.Modal(modalEl);
        });
    }
}

function setupGlobalHandlers() {
    // Handle refresh buttons
    document.addEventListener('click', function(e) {
        if (e.target.matches('[data-action="refresh"]') || e.target.closest('[data-action="refresh"]')) {
            e.preventDefault();
            refreshPage();
        }
        
        if (e.target.matches('[data-action="sync-vault"]') || e.target.closest('[data-action="sync-vault"]')) {
            e.preventDefault();
            syncVault();
        }
    });
    
    // Handle copy buttons
    document.addEventListener('click', function(e) {
        if (e.target.matches('[data-copy]') || e.target.closest('[data-copy]')) {
            e.preventDefault();
            const text = e.target.dataset.copy || e.target.closest('[data-copy]').dataset.copy;
            copyToClipboard(text);
        }
    });
}

function initializeTheme() {
    // Respect user's dark mode preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.setAttribute('data-bs-theme', 'dark');
    }
    
    // Listen for theme changes
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
            document.documentElement.setAttribute('data-bs-theme', e.matches ? 'dark' : 'light');
        });
    }
}

/**
 * System Statistics and Updates
 */
async function loadSystemStats() {
    try {
        const response = await fetch('/status');
        const data = await response.json();
        
        systemStats = data;
        updateStatsDisplay(data);
        
    } catch (error) {
        console.error('CipherH: Failed to load system stats', error);
        showNotification('Không thể tải thống kê hệ thống', 'warning');
    }
}

function updateStatsDisplay(data) {
    // Update interaction counts
    const interactionElement = document.getElementById('interaction-count');
    if (interactionElement && data.database) {
        interactionElement.textContent = data.database.total_interactions || 0;
    }
    
    // Update user counts
    const userElement = document.getElementById('active-users');
    if (userElement && data.database) {
        userElement.textContent = data.database.total_users || 0;
    }
    
    // Update system status
    updateSystemStatusIndicators(data);
}

function updateSystemStatusIndicators(data) {
    // Update Notion Vault status
    const vaultElement = document.getElementById('vault-status');
    if (vaultElement) {
        if (data.notion_vault && data.notion_vault.connected) {
            vaultElement.innerHTML = '<span class="badge bg-success">Kết nối</span>';
        } else {
            vaultElement.innerHTML = '<span class="badge bg-warning">Hạn chế</span>';
        }
    }
    
    // Update OpenAI Brain status
    const brainElement = document.getElementById('brain-status');
    if (brainElement) {
        if (data.openai_brain && data.openai_brain.connected) {
            brainElement.innerHTML = '<span class="badge bg-success">Hoạt động</span>';
        } else {
            brainElement.innerHTML = '<span class="badge bg-danger">Lỗi</span>';
        }
    }
    
    // Update connection status
    updateConnectionStatus(data.cipher_personality ? 'connected' : 'disconnected');
}

function updateConnectionStatus(status) {
    const statusElements = document.querySelectorAll('#connection-status, .connection-status');
    
    statusElements.forEach(element => {
        if (status === 'connected') {
            element.innerHTML = '<i data-feather="wifi" size="12"></i> Kết nối';
            element.className = 'badge bg-success';
        } else {
            element.innerHTML = '<i data-feather="wifi-off" size="12"></i> Mất kết nối';
            element.className = 'badge bg-danger';
        }
    });
    
    // Re-initialize Feather icons
    if (typeof feather !== 'undefined') {
        feather.replace();
    }
}

function updateInteractionStats(data) {
    const current = parseInt(document.getElementById('interaction-count')?.textContent || '0');
    const interactionElement = document.getElementById('interaction-count');
    if (interactionElement) {
        interactionElement.textContent = current + 1;
        
        // Add animation
        interactionElement.style.transform = 'scale(1.2)';
        setTimeout(() => {
            interactionElement.style.transform = 'scale(1)';
        }, 200);
    }
}

/**
 * Notification System
 */
function showNotification(message, type = 'info', duration = 5000) {
    const notification = createNotificationElement(message, type);
    document.body.appendChild(notification);
    
    // Trigger animation
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // Auto remove
    setTimeout(() => {
        removeNotification(notification);
    }, duration);
    
    // Manual close button
    const closeBtn = notification.querySelector('.btn-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => removeNotification(notification));
    }
}

function createNotificationElement(message, type) {
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} alert-dismissible fade position-fixed notification`;
    notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    
    const icon = getNotificationIcon(type);
    notification.innerHTML = `
        <div class="d-flex align-items-center">
            <i data-feather="${icon}" size="16" class="me-2"></i>
            <div class="flex-grow-1">${message}</div>
            <button type="button" class="btn-close" aria-label="Close"></button>
        </div>
    `;
    
    return notification;
}

function getNotificationIcon(type) {
    const icons = {
        success: 'check-circle',
        danger: 'alert-triangle',
        warning: 'alert-circle',
        info: 'info'
    };
    return icons[type] || 'info';
}

function removeNotification(notification) {
    notification.classList.remove('show');
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 150);
}

/**
 * Context and Tags Management
 */
function updateContextTags(tags) {
    const contextElement = document.getElementById('context-tags');
    if (!contextElement) return;
    
    contextElement.innerHTML = '';
    
    tags.forEach(tag => {
        const tagElement = document.createElement('span');
        tagElement.className = 'context-tag';
        tagElement.textContent = tag;
        contextElement.appendChild(tagElement);
    });
}

function updateSentimentDisplay(sentiment) {
    const sentimentElement = document.getElementById('conversation-sentiment');
    if (!sentimentElement) return;
    
    const sentimentMap = {
        positive: { text: 'Tích cực', class: 'text-success' },
        negative: { text: 'Tiêu cực', class: 'text-danger' },
        neutral: { text: 'Trung tính', class: 'text-info' }
    };
    
    const mapped = sentimentMap[sentiment] || sentimentMap.neutral;
    sentimentElement.textContent = mapped.text;
    sentimentElement.className = mapped.class;
}

/**
 * Utility Functions
 */
async function refreshPage() {
    showNotification('Đang làm mới...', 'info', 1000);
    
    try {
        await loadSystemStats();
        showNotification('Đã làm mới thành công', 'success');
    } catch (error) {
        showNotification('Không thể làm mới', 'danger');
    }
}

async function syncVault() {
    try {
        const button = document.querySelector('[data-action="sync-vault"]');
        if (button) {
            button.classList.add('loading');
            button.disabled = true;
        }
        
        const response = await fetch('/admin/api/vault/sync', {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            showNotification('Vault đã được đồng bộ', 'success');
        } else {
            throw new Error(data.error || 'Sync failed');
        }
        
    } catch (error) {
        console.error('Vault sync error:', error);
        showNotification('Không thể đồng bộ vault', 'danger');
    } finally {
        const button = document.querySelector('[data-action="sync-vault"]');
        if (button) {
            button.classList.remove('loading');
            button.disabled = false;
        }
    }
}

function copyToClipboard(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            showNotification('Đã sao chép vào clipboard', 'success', 2000);
        }).catch(() => {
            fallbackCopy(text);
        });
    } else {
        fallbackCopy(text);
    }
}

function fallbackCopy(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        document.execCommand('copy');
        showNotification('Đã sao chép vào clipboard', 'success', 2000);
    } catch (error) {
        showNotification('Không thể sao chép', 'danger');
    }
    
    document.body.removeChild(textArea);
}

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    // Less than 1 minute
    if (diff < 60000) {
        return 'Vừa xong';
    }
    
    // Less than 1 hour
    if (diff < 3600000) {
        const minutes = Math.floor(diff / 60000);
        return `${minutes} phút trước`;
    }
    
    // Less than 1 day
    if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return `${hours} giờ trước`;
    }
    
    // More than 1 day
    return date.toLocaleDateString('vi-VN');
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }
}

/**
 * Periodic Updates
 */
function setupPeriodicUpdates() {
    // Update stats every 30 seconds
    setInterval(() => {
        if (connectionStatus === 'connected') {
            loadSystemStats();
        }
    }, 30000);
    
    // Update timestamps every minute
    setInterval(() => {
        updateRelativeTimestamps();
    }, 60000);
}

function updateRelativeTimestamps() {
    const timeElements = document.querySelectorAll('[data-timestamp]');
    timeElements.forEach(element => {
        const timestamp = element.dataset.timestamp;
        element.textContent = formatTimestamp(timestamp);
    });
}

/**
 * Error Handling
 */
window.addEventListener('error', function(event) {
    console.error('CipherH: Global error', event.error);
    
    // Don't show notifications for minor errors
    if (event.error && event.error.name !== 'ChunkLoadError') {
        showNotification('Đã xảy ra lỗi không mong muốn', 'danger');
    }
});

window.addEventListener('unhandledrejection', function(event) {
    console.error('CipherH: Unhandled promise rejection', event.reason);
    
    // Only show notification for significant errors
    if (event.reason && event.reason.status >= 500) {
        showNotification('Lỗi hệ thống', 'danger');
    }
});

// Export functions for global access
window.CipherH = {
    showNotification,
    refreshPage,
    syncVault,
    copyToClipboard,
    formatTimestamp,
    updateStatsDisplay
};

console.log('CipherH: Core application loaded');
