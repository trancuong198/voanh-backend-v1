/**
 * Vô Ảnh – CipherH Dashboard
 * Admin Control JavaScript
 * Handles admin panel functionality, monitoring, and management
 */

let adminSocket = null;
let adminStats = {};
let chartInstances = {};
let refreshInterval = null;

document.addEventListener("DOMContentLoaded", () => {
    console.log("CipherH Admin: Initializing...");
    initializeAdminSocket();
    initializeAdminUI();
    loadAdminData();
    setupAdminUpdates();
});

/* ================= SOCKET ================= */
function initializeAdminSocket() {
    if (typeof io === "undefined") return;

    adminSocket = io("/admin", { transports: ["websocket"] });

    adminSocket.on("connect", () => {
        console.log("Socket connected");
        updateConnectionStatus("connected");
    });

    adminSocket.on("disconnect", () => {
        console.log("Socket disconnected");
        updateConnectionStatus("disconnected");
    });

    adminSocket.on("admin_update", handleAdminUpdate);
    adminSocket.on("system_alert", handleSystemAlert);
}

function handleAdminUpdate(data) {
    console.log("Admin update:", data);
    switch (data.type) {
        case "interaction":
            updateInteractionStats(data);
            break;
        case "memory_sync":
            updateMemoryStatus(data);
            break;
        case "platform_status":
            updatePlatformStatus(data);
            break;
        default:
            console.log("Unknown update type:", data.type);
    }
}

function handleSystemAlert(data) {
    console.warn("System alert:", data);
    showAdminNotification(data.message, data.level || "warning");
}

/* ================= LOAD DATA ================= */
async function loadAdminData() {
    try {
        const res = await fetch("/admin/api/system/status");
        const data = await res.json();
        adminStats = data;
        updateAdminDashboard(data);
    } catch (e) {
        console.error("Load admin data error:", e);
        showAdminNotification("Không thể tải dữ liệu admin", "danger");
    }
}

function updateAdminDashboard(data) {
    updateSystemOverview(data);
    updateAdminCharts(data);
    updateComponentStatuses(data);
}

/* ================= OVERVIEW ================= */
function updateSystemOverview(data) {
    const set = (cls, val) => {
        const el = document.querySelector(cls);
        if (el) el.textContent = val || 0;
    };
    if (!data.database) return;
    set(".stat-users", data.database.users);
    set(".stat-interactions", data.database.interactions);
    set(".stat-memories", data.database.memories);
}

/* ================= COMPONENT STATUS ================= */
function updateComponentStatuses(data) {
    updateComponentStatus("notion-vault", data.notion_vault);
    updateComponentStatus("openai-brain", data.openai_brain);
    if (data.platforms)
        Object.keys(data.platforms).forEach(p =>
            updatePlatformStatusDisplay(p, data.platforms[p])
        );
}

function updateComponentStatus(id, status) {
    const el = document.getElementById(id + "-status");
    if (!el) return;

    let cls = "bg-secondary",
        txt = "Không xác định";
    if (status?.connected) {
        cls = "bg-success";
        txt = "Hoạt động";
    } else if (status?.error) {
        cls = "bg-danger";
        txt = "Lỗi";
    } else {
        cls = "bg-warning";
        txt = "Hạn chế";
    }
    el.innerHTML = `<span class="badge ${cls}">${txt}</span>`;
}

/* ================= CHARTS ================= */
function updateAdminCharts(data) {
    if (!window.Chart) return;
    if (data.platform_stats) updatePlatformChart(data.platform_stats);
    if (data.interaction_timeline) updateTimelineChart(data.interaction_timeline);
    if (data.sentiment_stats) updateSentimentChart(data.sentiment_stats);
}

function updatePlatformChart(stats) {
    const c = document.getElementById("platformChart");
    if (!c) return;
    const ctx = c.getContext("2d");
    chartInstances.platform?.destroy();
    chartInstances.platform = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: stats.map(s => s.platform),
            datasets: [
                {
                    data: stats.map(s => s.count),
                    backgroundColor: [
                        "#007bff",
                        "#1877f2",
                        "#ff0050",
                        "#0068ff",
                        "#0088cc",
                        "#ea4335"
                    ]
                }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function updateTimelineChart(timeline) {
    const c = document.getElementById("timelineChart");
    if (!c) return;
    const ctx = c.getContext("2d");
    chartInstances.timeline?.destroy();
    chartInstances.timeline = new Chart(ctx, {
        type: "line",
        data: {
            labels: timeline.labels,
            datasets: [
                {
                    label: "Tương tác",
                    data: timeline.interactions,
                    borderColor: "#00ffb3",
                    backgroundColor: "rgba(0,255,179,0.1)",
                    fill: true
                }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function updateSentimentChart(sentiment) {
    const c = document.getElementById("sentimentChart");
    if (!c) return;
    const ctx = c.getContext("2d");
    chartInstances.sentiment?.destroy();
    chartInstances.sentiment = new Chart(ctx, {
        type: "bar",
        data: {
            labels: ["Tích cực", "Trung tính", "Tiêu cực"],
            datasets: [
                {
                    data: [
                        sentiment.positive || 0,
                        sentiment.neutral || 0,
                        sentiment.negative || 0
                    ],
                    backgroundColor: ["#28a745", "#6c757d", "#dc3545"]
                }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

/* ================= UI INTERACTIONS ================= */
function initializeAdminUI() {
    document
        .querySelectorAll(".nav-tabs .nav-link")
        .forEach(l => l.addEventListener("click", handleTabSwitch));
    document
        .querySelectorAll(".platform-toggle input[type='checkbox']")
        .forEach(t => t.addEventListener("change", handlePlatformToggle));
    const form = document.getElementById("createMemoryForm");
    if (form) form.addEventListener("submit", handleCreateMemory);
    const btn = document.getElementById("create-memory-btn");
    if (btn) btn.addEventListener("click", showCreateMemoryModal);
}

/* ================= TABS ================= */
function handleTabSwitch(e) {
    const tab = e.target.getAttribute("href").substring(1);
    console.log("Switching to", tab);
    loadTabData(tab);
}

async function loadTabData(tab) {
    const routes = {
        interactions: "/admin/interactions?format=json",
        users: "/admin/users?format=json",
        memories: "/admin/memories?format=json",
        platforms: "/api/platforms"
    };
    if (!routes[tab]) return;
    try {
        const res = await fetch(routes[tab]);
        const data = await res.json();
        window[`update${tab.charAt(0).toUpperCase() + tab.slice(1)}Display`]?.(data);
    } catch (e) {
        console.error(`Failed to load ${tab}:`, e);
    }
}

/* ================= PLATFORM TOGGLES ================= */
async function handlePlatformToggle(e) {
    const name = e.target.id.replace("toggle-", "");
    const isActive = e.target.checked;
    try {
        const res = await fetch(`/admin/api/platform/${name}/toggle`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ active: isActive })
        });
        const data = await res.json();
        if (data.status === "success") {
            updatePlatformStatusDisplay(name, { active: isActive });
            showAdminNotification(
                `${name} đã được ${isActive ? "kích hoạt" : "tạm dừng"}`,
                "success"
            );
        } else throw new Error(data.error);
    } catch (err) {
        console.error("Platform toggle error:", err);
        showAdminNotification("Không thể thay đổi trạng thái", "danger");
        e.target.checked = !isActive;
    }
}

function updatePlatformStatusDisplay(platform, status) {
    const card = document.querySelector(`[data-platform="${platform}"]`);
    if (!card) return;
    const badge = card.querySelector(".status-badge");
    if (badge)
        badge.innerHTML = status.active
            ? '<span class="badge bg-success">Hoạt động</span>'
            : '<span class="badge bg-secondary">Tạm dừng</span>';
}

/* ================= MEMORY ================= */
async function handleCreateMemory(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
        content: fd.get("content"),
        memory_type: fd.get("memory_type"),
        confidence: parseFloat(fd.get("confidence"))
    };
    try {
        const res = await fetch("/admin/api/memory/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.status === "success") {
            showAdminNotification("Ký ức đã được tạo", "success");
            bootstrap.Modal.getInstance(
                document.getElementById("createMemoryModal")
            )?.hide();
            e.target.reset();
            loadMemoriesData();
        } else throw new Error(result.error);
    } catch (err) {
        console.error("Create memory error:", err);
        showAdminNotification("Không thể tạo ký ức", "danger");
    }
}

/* ================= UTILS ================= */
function showAdminNotification(msg, type = "info", duration = 5000) {
    console.log(`CipherH Admin [${type.toUpperCase()}]: ${msg}`);
    const n = document.createElement("div");
    n.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    n.style.cssText =
        "top:20px;right:20px;z-index:9999;min-width:300px;font-size:14px";
    n.innerHTML = `${msg}<button type="button" class="btn-close" data-bs-dismiss="alert"></button>`;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), duration);
}

/* ================= PERIODIC ================= */
function setupAdminUpdates() {
    refreshInterval = setInterval(loadAdminData, 120000);
    setInterval(checkConnectionStatus, 10000);
}

function checkConnectionStatus() {
    if (!adminSocket) return;
    updateConnectionStatus(adminSocket.connected ? "connected" : "disconnected");
}

function updateConnectionStatus(status) {
    document.querySelectorAll(".connection-status").forEach(el => {
        el.innerHTML =
            status === "connected"
                ? '<span class="badge bg-success">Kết nối</span>'
                : '<span class="badge bg-danger">Mất kết nối</span>';
    });
}

/* ================= CLEANUP ================= */
window.addEventListener("beforeunload", () => {
    clearInterval(refreshInterval);
    adminSocket?.disconnect();
    Object.values(chartInstances).forEach(c => c?.destroy?.());
});

window.CipherHAdmin = {
    refreshDashboard: loadAdminData,
    syncVault: () => fetch("/admin/api/vault/sync", { method: "POST" }),
    togglePlatform: handlePlatformToggle,
    createMemory: handleCreateMemory,
    showAdminNotification
};

console.log("Vô Ảnh – CipherH Dashboard JS loaded");
