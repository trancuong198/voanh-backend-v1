/**
 * CipherH Main Application JavaScript (Optimized for Flask/Render)
 * Handles real-time communication, UI updates, and core functionality
 */

// Global variables
let socket = null;
let connectionStatus = 'disconnected';
let notificationQueue = [];
let systemStats = {};

// Initialize app
document.addEventListener('DOMContentLoaded', () => initializeApp());

function initializeApp() {
    console.log('⚡ CipherH: Initializing app...');

    initializeSocket();
    initializeUI();
    loadSystemStats();
    setupPeriodicUpdates();

    if (window.feather) feather.replace();
    console.log('✅ CipherH: App initialized');
}

/** SOCKET.IO HANDLERS **/
function initializeSocket() {
    if (typeof io === 'undefined') {
        console.warn('⚠️ Socket.IO not found — skipping socket init');
        return;
    }

    socket = io(`${window.location.origin}`);

    socket.on('connect', () => {
        connectionStatus = 'connected';
        updateConnectionStatus('connected');
        showNotification('Đã kết nối CipherH', 'success');
    });

    socket.on('disconnect', () => {
        connectionStatus = 'disconnected';
        updateConnectionStatus('disconnected');
        showNotification('Mất kết nối CipherH', 'warning');
    });

    socket.on('cipher_response', data => handleCipherResponse(data));
    socket.on('new_interaction', data => handleNewInteraction(data));
    socket.on('system_update', data => handleSystemUpdate(data));
    socket.on('connect_error', err => {
        console.error('Socket connect error:', err);
        showNotification('Không thể kết nối server', 'danger');
    });
}

function handleCipherResponse(data) {
    console.log('💬 CipherH response:', data);
    if (typeof addMessageToChat === 'function')
        addMessageToChat(data.message, 'cipher', data.timestamp);
    if (data.context_tags) updateContextTags(data.context_tags);
    if (data.sentiment) updateSentimentDisplay(data.sentiment);
}

function handleNewInteraction(data) {
    updateInteractionStats(data);
    if (typeof addToRecentActivity === 'function') addToRecentActivity(data);
    showNotification(`Tương tác mới từ ${data.platform}`, 'info');
}

function handleSystemUpdate(data) {
    updateSystemStatus(data);
    if (data.type === 'memory_sync') showNotification('Vault đã đồng bộ', 'success');
}

/** UI MANAGEMENT **/
function initializeUI() {
    initializeTooltips();
    initializeModals();
    setupGlobalHandlers();
    initializeTheme();
}

function initializeTooltips() {
    if (!window.bootstrap) return;
    const triggers = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    triggers.forEach(el => new bootstrap.Tooltip(el));
}

function initializeModals() {
    if (!window.bootstrap) return;
    document.querySelectorAll('.modal').forEach(m => new bootstrap.Modal(m));
}

function setupGlobalHandlers() {
    document.body.addEventListener('click', e => {
        const target = e.target.closest('[data-action]');
        if (!target) return;

        const action = target.dataset.action;
        e.preventDefault();

        if (action === 'refresh') refreshPage();
        if (action === 'sync-vault') syncVault();
    });

    document.body.addEventListener('click', e => {
        const copyEl = e.target.closest('[data-copy]');
        if (copyEl) copyToClipboard(copyEl.dataset.copy);
    });
}

function initializeTheme() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    const setTheme = e => document.documentElement.setAttribute('data-bs-theme', e.matches ? 'dark' : 'light');

    setTheme(prefersDark);
    prefersDark.addEventListener('change', setTheme);
}

/** SYSTEM STATS **/
async function loadSystemStats() {
    try {
        const res = await fetch('/api/status');
        const data = await res.json();
        systemStats = data;
        updateStatsDisplay(data);
    } catch (err) {
        console.error('❌ Failed to load stats', err);
        showNotification('Không thể tải thống kê hệ thống', 'warning');
    }
}

function updateStatsDisplay(data) {
    const i = document.getElementById('interaction-count');
    const u = document.getElementById('active-users');
    const vault = document.getElementById('vault-status');
    const brain = document.getElementById('brain-status');

    if (i && data.database) i.textContent = data.database.total_interactions ?? 0;
    if (u && data.database) u.textContent = data.database.total_users ?? 0;

    if (vault)
        vault.innerHTML = data.notion_vault?.connected
            ? '<span class="badge bg-success">Kết nối</span>'
            : '<span class="badge bg-warning">Hạn chế</span>';

    if (brain)
        brain.innerHTML = data.openai_brain?.connected
            ? '<span class="badge bg-success">Hoạt động</span>'
            : '<span class="badge bg-danger">Lỗi</span>';

    updateConnectionStatus(data.cipher_personality ? 'connected' : 'disconnected');
}

/** NOTIFICATION SYSTEM **/
function showNotification(msg, type = 'info', duration = 4000) {
    const el = document.createElement('div');
    el.className = `alert alert-${type} alert-dismissible fade position-fixed notification`;
    el.style.cssText = 'top:20px;right:20px;z-index:9999;min-width:300px;';
    el.innerHTML = `
        <div class="d-flex align-items-center">
            <i data-feather="${getNotificationIcon(type)}" size="16" class="me-2"></i>
            <div class="flex-grow-1">${msg}</div>
            <button type="button" class="btn-close"></button>
        </div>`;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('show'), 10);
    setTimeout(() => el.remove(), duration);
    el.querySelector('.btn-close').addEventListener('click', () => el.remove());
    if (window.feather) feather.replace();
}

function getNotificationIcon(t) {
    return { success: 'check', danger: 'x', warning: 'alert-circle', info: 'info' }[t] || 'info';
}

/** ACTIONS **/
async function refreshPage() {
    showNotification('Đang làm mới...', 'info', 1200);
    await loadSystemStats();
    showNotification('Làm mới thành công', 'success');
}

async function syncVault() {
    try {
        const btn = document.querySelector('[data-action="sync-vault"]');
        if (btn) { btn.classList.add('loading'); btn.disabled = true; }

        const res = await fetch('/admin/api/vault/sync', { method: 'POST' });
        const data = await res.json();

        if (data.status === 'success') showNotification('Vault đồng bộ xong', 'success');
        else throw new Error(data.error);

    } catch (e) {
        showNotification('Không thể đồng bộ vault', 'danger');
    } finally {
        const btn = document.querySelector('[data-action="sync-vault"]');
        if (btn) { btn.classList.remove('loading'); btn.disabled = false; }
    }
}

/** UTILITIES **/
function copyToClipboard(text) {
    navigator.clipboard?.writeText(text)
        .then(() => showNotification('Đã sao chép', 'success', 1500))
        .catch(() => showNotification('Không thể sao chép', 'danger'));
}

/** PERIODIC UPDATE **/
function setupPeriodicUpdates() {
    setInterval(() => connectionStatus === 'connected' && loadSystemStats(), 30000);
}

/** ERROR HANDLERS **/
window.addEventListener('error', e => {
    console.error('Global error:', e.error);
    showNotification('Lỗi không mong muốn', 'danger');
});
window.addEventListener('unhandledrejection', e => {
    console.error('Promise rejection:', e.reason);
});

window.CipherH = { showNotification, refreshPage, syncVault, loadSystemStats };
console.log('🚀 CipherH: app.js loaded');
