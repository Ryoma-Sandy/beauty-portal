/**
 * 管理者ダッシュボード – admin.js
 * 
 * - パスワード認証（SHA-256ハッシュ比較）
 * - pending / approved / official イベントの管理
 * - 編集・承認・却下・削除
 * - JSONダウンロード
 */

// ===== 管理者パスワード（SHA-256ハッシュ） =====
// デフォルトパスワード: "admin2026"
// 変更する場合: ブラウザのコンソールで
//   crypto.subtle.digest('SHA-256', new TextEncoder().encode('新パスワード'))
//     .then(h => console.log(Array.from(new Uint8Array(h)).map(b=>b.toString(16).padStart(2,'0')).join('')))
const ADMIN_HASH = 'a0c299b71a9e59d5ebe1e70e7e3e425fe3e5230c1faf3e89eb20df8b1cf3a661';

const DATA_URL = 'events-data.json';
let eventsData = null;

// ===== SHA-256 ハッシュ =====
async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ===== DOM Elements =====
const loginScreen = document.getElementById('login-screen');
const dashboard = document.getElementById('dashboard');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const passwordInput = document.getElementById('admin-password');

// ===== 認証 =====
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const hash = await sha256(passwordInput.value);
    
    if (hash === ADMIN_HASH) {
        sessionStorage.setItem('adminAuth', 'true');
        showDashboard();
    } else {
        loginError.textContent = 'パスワードが正しくありません';
        passwordInput.value = '';
        passwordInput.focus();
    }
});

// セッション復帰
if (sessionStorage.getItem('adminAuth') === 'true') {
    showDashboard();
}

function showDashboard() {
    loginScreen.style.display = 'none';
    dashboard.style.display = 'block';
    loadData();
}

// ログアウト
document.getElementById('btn-logout').addEventListener('click', () => {
    sessionStorage.removeItem('adminAuth');
    loginScreen.style.display = 'flex';
    dashboard.style.display = 'none';
    passwordInput.value = '';
    loginError.textContent = '';
});

// ===== データ読み込み =====
async function loadData() {
    try {
        const res = await fetch(DATA_URL + '?t=' + Date.now());
        eventsData = await res.json();
    } catch (e) {
        console.error('データ読み込みエラー:', e);
        const stored = localStorage.getItem('beautyPortal_adminData');
        eventsData = stored ? JSON.parse(stored) : { official: [], pending: [], approved: [], lastCrawled: null };
    }
    
    mergePendingFromLocalStorage();
    
    updateStats();
    renderPendingList();
    renderApprovedList();
    renderOfficialList();
}

// ユーザーがlocalStorageに投稿したデータを pending に取り込む
function mergePendingFromLocalStorage() {
    try {
        const userEvents = JSON.parse(localStorage.getItem('beautyPortal_pendingSubmissions') || '[]');
        if (userEvents.length > 0) {
            for (const ue of userEvents) {
                const exists = eventsData.pending.some(p => p.id === ue.id);
                if (!exists) {
                    eventsData.pending.push(ue);
                }
            }
        }
    } catch (e) {
        // ignore
    }
}

// ===== 統計表示 =====
function updateStats() {
    document.getElementById('stat-official').textContent = eventsData.official.length;
    document.getElementById('stat-pending').textContent = eventsData.pending.length;
    document.getElementById('stat-approved').textContent = eventsData.approved.length;
    document.getElementById('pending-badge').textContent = eventsData.pending.length;
    
    if (eventsData.lastCrawled) {
        const d = new Date(eventsData.lastCrawled);
        const mm = String(d.getMinutes()).padStart(2, '0');
        document.getElementById('stat-crawled').textContent = 
            (d.getMonth() + 1) + '/' + d.getDate() + ' ' + d.getHours() + ':' + mm;
    }
}

// ===== リスト描画 =====
function renderPendingList() {
    const container = document.getElementById('pending-list');
    
    if (eventsData.pending.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-check-double"></i><p>承認待ちの申請はありません</p></div>';
        return;
    }
    
    let html = '';
    eventsData.pending.forEach(function(event) {
        html += '<div class="event-item pending-item" id="event-' + event.id + '">';
        html += '<div class="event-item-header">';
        html += '<span class="event-item-title">' + escHtml(event.title) + '</span>';
        html += '<div class="event-item-actions">';
        html += '<button class="btn-edit" onclick="openEdit(' + event.id + ', \'pending\')"><i class="fas fa-edit"></i> 編集</button>';
        html += '<button class="btn-approve" onclick="approveEvent(' + event.id + ')"><i class="fas fa-check"></i> 承認</button>';
        html += '<button class="btn-reject" onclick="rejectEvent(' + event.id + ')"><i class="fas fa-times"></i> 却下</button>';
        html += '</div></div>';
        html += '<div class="event-item-meta">';
        html += '<span><i class="far fa-calendar-alt"></i> ' + escHtml(event.date) + '</span>';
        html += '<span><i class="fas fa-tag"></i> ' + escHtml(event.category) + '</span>';
        html += '<span><i class="fas fa-map-marker-alt"></i> ' + escHtml(event.region) + ' - ' + escHtml(event.location) + '</span>';
        if (event.organizer) {
            html += '<span><i class="fas fa-building"></i> ' + escHtml(event.organizer) + '</span>';
        }
        html += '</div>';
        html += '<div class="event-item-desc">' + escHtml(event.description) + '</div>';
        if (event.applicant) {
            html += '<div class="applicant-info">';
            html += '<strong><i class="fas fa-user"></i> 申請者:</strong> ';
            html += escHtml(event.applicant.name) + ' | ';
            html += '<a href="mailto:' + escHtml(event.applicant.email) + '">' + escHtml(event.applicant.email) + '</a>';
            if (event.applicant.company) {
                html += ' | ' + escHtml(event.applicant.company);
            }
            html += '</div>';
        }
        html += '</div>';
    });
    container.innerHTML = html;
}

function renderApprovedList() {
    const container = document.getElementById('approved-list');
    
    if (eventsData.approved.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-folder-open"></i><p>承認済みの投稿はありません</p></div>';
        return;
    }
    
    let html = '';
    eventsData.approved.forEach(function(event) {
        html += '<div class="event-item approved-item">';
        html += '<div class="event-item-header">';
        html += '<span class="event-item-title">' + escHtml(event.title) + '</span>';
        html += '<div class="event-item-actions">';
        html += '<button class="btn-edit" onclick="openEdit(' + event.id + ', \'approved\')"><i class="fas fa-edit"></i> 編集</button>';
        html += '<button class="btn-remove" onclick="revokeApproval(' + event.id + ')"><i class="fas fa-undo"></i> 承認取消</button>';
        html += '</div></div>';
        html += '<div class="event-item-meta">';
        html += '<span><i class="far fa-calendar-alt"></i> ' + escHtml(event.date) + '</span>';
        html += '<span><i class="fas fa-tag"></i> ' + escHtml(event.category) + '</span>';
        html += '<span><i class="fas fa-map-marker-alt"></i> ' + escHtml(event.region) + '</span>';
        html += '</div>';
        html += '<div class="event-item-desc">' + escHtml(event.description) + '</div>';
        html += '</div>';
    });
    container.innerHTML = html;
}

function renderOfficialList() {
    const container = document.getElementById('official-list');
    
    let html = '';
    eventsData.official.forEach(function(event) {
        html += '<div class="event-item official-item">';
        html += '<div class="event-item-header">';
        html += '<span class="event-item-title">' + escHtml(event.title) + '</span>';
        html += '<div class="event-item-actions">';
        html += '<button class="btn-edit" onclick="openEdit(' + event.id + ', \'official\')"><i class="fas fa-edit"></i> 編集</button>';
        html += '</div></div>';
        html += '<div class="event-item-meta">';
        html += '<span><i class="far fa-calendar-alt"></i> ' + escHtml(event.date) + '</span>';
        html += '<span><i class="fas fa-tag"></i> ' + escHtml(event.category) + '</span>';
        html += '<span><i class="fas fa-map-marker-alt"></i> ' + escHtml(event.region) + ' - ' + escHtml(event.location) + '</span>';
        html += '</div>';
        html += '</div>';
    });
    container.innerHTML = html;
}

// ===== 承認・却下 =====
function approveEvent(id) {
    const idx = eventsData.pending.findIndex(e => e.id === id);
    if (idx === -1) return;
    
    const event = eventsData.pending.splice(idx, 1)[0];
    event.source = 'approved';
    event.approvedAt = new Date().toISOString();
    eventsData.approved.push(event);
    
    saveAndRefresh();
    showAdminToast('イベントを承認しました');
}

function rejectEvent(id) {
    if (!confirm('この申請を却下しますか？')) return;
    
    const idx = eventsData.pending.findIndex(e => e.id === id);
    if (idx === -1) return;
    
    eventsData.pending.splice(idx, 1);
    saveAndRefresh();
    showAdminToast('申請を却下しました');
}

function revokeApproval(id) {
    if (!confirm('この投稿の承認を取り消しますか？ポータルから非表示になります。')) return;
    
    const idx = eventsData.approved.findIndex(e => e.id === id);
    if (idx === -1) return;
    
    const event = eventsData.approved.splice(idx, 1)[0];
    event.source = 'user';
    delete event.approvedAt;
    eventsData.pending.push(event);
    
    saveAndRefresh();
    showAdminToast('承認を取り消し、保留に戻しました');
}

// ===== 編集モーダル =====
const editModal = document.getElementById('edit-modal');
const editForm = document.getElementById('edit-form');

function openEdit(id, sourceType) {
    const list = eventsData[sourceType];
    const event = list.find(e => e.id === id);
    if (!event) return;
    
    document.getElementById('edit-id').value = id;
    document.getElementById('edit-source-type').value = sourceType;
    document.getElementById('edit-title').value = event.title || '';
    document.getElementById('edit-date').value = event.date || '';
    document.getElementById('edit-sortDate').value = event.sortDate || '';
    document.getElementById('edit-category').value = event.category || '美容皮膚科';
    document.getElementById('edit-region').value = event.region || '関東';
    document.getElementById('edit-location').value = event.location || '';
    document.getElementById('edit-organizer').value = event.organizer || '';
    document.getElementById('edit-description').value = event.description || '';
    document.getElementById('edit-url').value = event.url || '';
    
    editModal.classList.add('active');
}

document.getElementById('edit-modal-close').addEventListener('click', () => {
    editModal.classList.remove('active');
});

editModal.addEventListener('click', (e) => {
    if (e.target === editModal) editModal.classList.remove('active');
});

editForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const id = parseInt(document.getElementById('edit-id').value);
    const sourceType = document.getElementById('edit-source-type').value;
    const list = eventsData[sourceType];
    const event = list.find(e => e.id === id);
    
    if (!event) return;
    
    event.title = document.getElementById('edit-title').value;
    event.date = document.getElementById('edit-date').value;
    event.sortDate = document.getElementById('edit-sortDate').value;
    event.category = document.getElementById('edit-category').value;
    event.region = document.getElementById('edit-region').value;
    event.location = document.getElementById('edit-location').value;
    event.organizer = document.getElementById('edit-organizer').value;
    event.description = document.getElementById('edit-description').value;
    event.url = document.getElementById('edit-url').value;
    
    editModal.classList.remove('active');
    saveAndRefresh();
    showAdminToast('イベントを更新しました');
});

// ===== 保存 & 再描画 =====
function saveAndRefresh() {
    localStorage.setItem('beautyPortal_adminData', JSON.stringify(eventsData));
    
    updateStats();
    renderPendingList();
    renderApprovedList();
    renderOfficialList();
}

// ===== JSONダウンロード =====
document.getElementById('btn-download').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(eventsData, null, 4)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'events-data.json';
    a.click();
    URL.revokeObjectURL(url);
    showAdminToast('events-data.json をダウンロードしました');
});

// ===== タブ切り替え =====
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
    });
});

// ===== ユーティリティ =====
function escHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function showAdminToast(message) {
    const toast = document.createElement('div');
    toast.className = 'admin-toast';
    toast.innerHTML = '<i class="fas fa-check-circle"></i> ' + message;
    document.body.appendChild(toast);
    
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}
