/**
 * 管理者ダッシュボード – admin.js
 * 
 * シンプルなパスワード認証 + イベント管理 + クローラー設定
 */

// ===== パスワード =====
const ADMIN_PASSWORD = 'admin2026';
const DATA_URL = 'events-data.json';
let eventsData = null;

// ===== DOM =====
const loginScreen = document.getElementById('login-screen');
const dashboard = document.getElementById('dashboard');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const passwordInput = document.getElementById('admin-password');

// ===== 認証 =====
loginForm.addEventListener('submit', function(e) {
    e.preventDefault();
    if (passwordInput.value === ADMIN_PASSWORD) {
        sessionStorage.setItem('adminAuth', 'true');
        showDashboard();
    } else {
        loginError.textContent = 'パスワードが正しくありません';
        passwordInput.value = '';
        passwordInput.focus();
    }
});

if (sessionStorage.getItem('adminAuth') === 'true') {
    showDashboard();
}

function showDashboard() {
    loginScreen.style.display = 'none';
    dashboard.style.display = 'block';
    loadData();
}

// ログアウト
document.getElementById('btn-logout').addEventListener('click', function() {
    sessionStorage.removeItem('adminAuth');
    loginScreen.style.display = 'flex';
    dashboard.style.display = 'none';
    passwordInput.value = '';
    loginError.textContent = '';
});

// ===== タブ切り替え =====
document.querySelectorAll('.tab-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
        document.querySelectorAll('.tab-content').forEach(function(c) { c.classList.remove('active'); });
        btn.classList.add('active');
        var tabId = btn.getAttribute('data-tab');
        document.getElementById(tabId).classList.add('active');
        if (tabId === 'crawler-tab') renderCrawlerTargets();
    });
});

// ===== データ読み込み =====
async function loadData() {
    try {
        var res = await fetch(DATA_URL + '?t=' + Date.now());
        eventsData = await res.json();
    } catch (e) {
        console.error('データ読み込みエラー:', e);
        eventsData = { official: [], pending: [], approved: [], lastCrawled: null };
    }
    try {
        var userPending = JSON.parse(localStorage.getItem('beautyPortal_pendingSubmissions') || '[]');
        userPending.forEach(function(ue) {
            if (!eventsData.pending.some(function(p) { return p.id === ue.id; })) {
                eventsData.pending.push(ue);
            }
        });
    } catch (e) {}
    updateStats();
    renderPendingList();
    renderApprovedList();
    renderOfficialList();
}

// ===== 統計 =====
function updateStats() {
    document.getElementById('stat-official').textContent = eventsData.official.length;
    document.getElementById('stat-pending').textContent = eventsData.pending.length;
    document.getElementById('stat-approved').textContent = eventsData.approved.length;
    document.getElementById('pending-badge').textContent = eventsData.pending.length;
    if (eventsData.lastCrawled) {
        var d = new Date(eventsData.lastCrawled);
        document.getElementById('stat-crawled').textContent =
            (d.getMonth() + 1) + '/' + d.getDate() + ' ' + d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
    }
}

// ===== 承認待ちリスト =====
function renderPendingList() {
    var list = document.getElementById('pending-list');
    if (eventsData.pending.length === 0) {
        list.innerHTML = '<div class="empty-state"><i class="fas fa-check-double"></i><p>承認待ちの申請はありません</p></div>';
        return;
    }
    var html = '';
    eventsData.pending.forEach(function(ev) {
        html += '<div class="event-item"><div class="event-item-info">'
            + '<h3>' + ev.title + '</h3>'
            + '<p><i class="far fa-calendar-alt"></i> ' + ev.date + ' &nbsp; <i class="fas fa-map-marker-alt"></i> ' + (ev.region || '') + ' ' + (ev.location || '') + '</p>'
            + '<span class="badge badge-' + (ev.category === '美容外科' ? 'surgery' : ev.category === '総合' ? 'general' : 'derma') + '">' + ev.category + '</span>'
            + (ev.applicant ? ' <span class="applicant-info"><i class="fas fa-user"></i> ' + ev.applicant.name + ' (' + ev.applicant.email + ')</span>' : '')
            + '</div><div class="event-item-actions">'
            + '<button class="btn-sm btn-approve" onclick="approveEvent(' + ev.id + ')"><i class="fas fa-check"></i> 承認</button>'
            + '<button class="btn-sm btn-edit" onclick="openEditModal(' + ev.id + ', \'pending\')"><i class="fas fa-edit"></i></button>'
            + '<button class="btn-sm btn-reject" onclick="rejectEvent(' + ev.id + ')"><i class="fas fa-trash"></i> 却下</button>'
            + '</div></div>';
    });
    list.innerHTML = html;
}

// ===== 承認済みリスト =====
function renderApprovedList() {
    var list = document.getElementById('approved-list');
    if (eventsData.approved.length === 0) {
        list.innerHTML = '<div class="empty-state"><i class="fas fa-folder-open"></i><p>承認済みの投稿はありません</p></div>';
        return;
    }
    var html = '';
    eventsData.approved.forEach(function(ev) {
        html += '<div class="event-item"><div class="event-item-info">'
            + '<h3>' + ev.title + '</h3>'
            + '<p><i class="far fa-calendar-alt"></i> ' + ev.date + ' &nbsp; <i class="fas fa-map-marker-alt"></i> ' + (ev.region || '') + '</p>'
            + '<span class="badge badge-approved"><i class="fas fa-check-circle"></i> 承認済み</span>'
            + '</div><div class="event-item-actions">'
            + '<button class="btn-sm btn-edit" onclick="openEditModal(' + ev.id + ', \'approved\')"><i class="fas fa-edit"></i></button>'
            + '<button class="btn-sm btn-reject" onclick="revokeApproval(' + ev.id + ')"><i class="fas fa-undo"></i> 取消</button>'
            + '</div></div>';
    });
    list.innerHTML = html;
}

// ===== 公式イベントリスト =====
function renderOfficialList() {
    var list = document.getElementById('official-list');
    if (eventsData.official.length === 0) {
        list.innerHTML = '<div class="empty-state"><i class="fas fa-database"></i><p>公式イベントはありません</p></div>';
        return;
    }
    var html = '';
    eventsData.official.forEach(function(ev) {
        html += '<div class="event-item"><div class="event-item-info">'
            + '<h3>' + ev.title + '</h3>'
            + '<p><i class="far fa-calendar-alt"></i> ' + ev.date + ' &nbsp; <i class="fas fa-map-marker-alt"></i> ' + (ev.region || '') + '</p>'
            + '<span class="badge badge-official"><i class="fas fa-database"></i> 公式</span>'
            + '</div><div class="event-item-actions">'
            + '<button class="btn-sm btn-edit" onclick="openEditModal(' + ev.id + ', \'official\')"><i class="fas fa-edit"></i></button>'
            + '</div></div>';
    });
    list.innerHTML = html;
}

// ===== 承認・却下・取消 =====
function approveEvent(id) {
    var idx = eventsData.pending.findIndex(function(e) { return e.id === id; });
    if (idx === -1) return;
    var ev = eventsData.pending.splice(idx, 1)[0];
    ev.approvedAt = new Date().toISOString();
    eventsData.approved.push(ev);
    saveAndRefresh();
    showToast('イベントを承認しました');
}

function rejectEvent(id) {
    if (!confirm('この申請を却下しますか？')) return;
    var idx = eventsData.pending.findIndex(function(e) { return e.id === id; });
    if (idx === -1) return;
    eventsData.pending.splice(idx, 1);
    saveAndRefresh();
    showToast('申請を却下しました');
}

function revokeApproval(id) {
    if (!confirm('承認を取り消しますか？')) return;
    var idx = eventsData.approved.findIndex(function(e) { return e.id === id; });
    if (idx === -1) return;
    var ev = eventsData.approved.splice(idx, 1)[0];
    eventsData.pending.push(ev);
    saveAndRefresh();
    showToast('承認を取り消しました');
}

// ===== イベント編集モーダル =====
var editModal = document.getElementById('edit-modal');
document.getElementById('edit-modal-close').addEventListener('click', function() { editModal.classList.remove('active'); });
editModal.addEventListener('click', function(e) { if (e.target === editModal) editModal.classList.remove('active'); });

function openEditModal(id, sourceType) {
    var list = eventsData[sourceType] || [];
    var ev = list.find(function(e) { return e.id === id; });
    if (!ev) return;
    document.getElementById('edit-id').value = id;
    document.getElementById('edit-source-type').value = sourceType;
    document.getElementById('edit-title').value = ev.title || '';
    document.getElementById('edit-date').value = ev.date || '';
    document.getElementById('edit-sortDate').value = ev.sortDate || '';
    document.getElementById('edit-category').value = ev.category || '美容皮膚科';
    document.getElementById('edit-region').value = ev.region || 'オンライン';
    document.getElementById('edit-location').value = ev.location || '';
    document.getElementById('edit-organizer').value = ev.organizer || '';
    document.getElementById('edit-description').value = ev.description || '';
    document.getElementById('edit-url').value = ev.url || '';
    editModal.classList.add('active');
}

document.getElementById('edit-form').addEventListener('submit', function(e) {
    e.preventDefault();
    var id = parseInt(document.getElementById('edit-id').value);
    var sourceType = document.getElementById('edit-source-type').value;
    var list = eventsData[sourceType] || [];
    var ev = list.find(function(e) { return e.id === id; });
    if (!ev) return;
    ev.title = document.getElementById('edit-title').value;
    ev.date = document.getElementById('edit-date').value;
    ev.sortDate = document.getElementById('edit-sortDate').value;
    ev.category = document.getElementById('edit-category').value;
    ev.region = document.getElementById('edit-region').value;
    ev.location = document.getElementById('edit-location').value;
    ev.organizer = document.getElementById('edit-organizer').value;
    ev.description = document.getElementById('edit-description').value;
    ev.url = document.getElementById('edit-url').value;
    editModal.classList.remove('active');
    saveAndRefresh();
    showToast('イベントを更新しました');
});

// ===== 保存 & 更新 =====
function saveAndRefresh() {
    localStorage.setItem('beautyPortal_adminData', JSON.stringify(eventsData));
    updateStats();
    renderPendingList();
    renderApprovedList();
    renderOfficialList();
}

// ===== JSON ダウンロード =====
document.getElementById('btn-download').addEventListener('click', function() {
    var blob = new Blob([JSON.stringify(eventsData, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'events-data.json';
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('events-data.json をダウンロードしました');
});

// ===== トースト =====
function showToast(message) {
    var toast = document.createElement('div');
    toast.className = 'admin-toast show';
    toast.innerHTML = '<i class="fas fa-check-circle"></i> ' + message;
    document.body.appendChild(toast);
    setTimeout(function() {
        toast.classList.remove('show');
        setTimeout(function() { toast.remove(); }, 400);
    }, 3000);
}

// ========================================================
// ===== クローラー設定（全ターゲット編集・削除可能） =====
// ========================================================
var CRAWL_TARGETS_KEY = 'beautyPortal_crawlTargets';

var DEFAULT_CRAWL_TARGETS = [
    { name: 'JSAPS（日本美容外科学会）', url: 'https://www.jsaps.com/', parser: 'parseJSAPS', category: '美容外科', type: '国内学会' },
    { name: 'JSAS（日本美容外科学会）', url: 'https://www.jsas.or.jp/', parser: 'parseGenericConference', category: '美容外科', type: '国内学会' },
    { name: '日本美容皮膚科学会', url: 'https://www.aesthet-derm.org/', parser: 'parseGenericConference', category: '美容皮膚科', type: '国内学会' },
    { name: '日本レーザー医学会 (JSLMS)', url: 'https://www.jslms.or.jp/', parser: 'parseGenericConference', category: '総合', type: '国内学会' },
    { name: '日本抗加齢医学会 (JSAAM)', url: 'https://www.anti-aging.gr.jp/', parser: 'parseGenericConference', category: '総合', type: '国内学会' },
    { name: '日本美容医療学会（JAPSA）', url: 'https://japsa.or.jp/', parser: 'parseGenericConference', category: '総合', type: '国内学会' },
    { name: 'kenkyuukai.jp（研究会情報）', url: 'https://www.kenkyuukai.jp/biyo/', parser: 'parseKenkyuukai', category: '総合', type: '勉強会' },
    { name: 'ISAPS', url: 'https://www.isaps.org/', parser: 'parseInternationalConference', category: '美容外科', type: '海外学会' },
    { name: 'IMCAS', url: 'https://www.imcas.com/', parser: 'parseInternationalConference', category: '総合', type: '海外学会' },
    { name: 'UIME', url: 'https://www.uime.org/', parser: 'parseInternationalConference', category: '総合', type: '海外学会' },
    { name: 'ASPS', url: 'https://www.plasticsurgery.org/', parser: 'parseInternationalConference', category: '美容外科', type: '海外学会' },
    { name: 'The Aesthetic Society', url: 'https://www.theaestheticsociety.org/', parser: 'parseInternationalConference', category: '美容外科', type: '海外学会' },
    { name: 'AAD', url: 'https://www.aad.org/', parser: 'parseInternationalConference', category: '美容皮膚科', type: '海外学会' },
    { name: 'OSAPS', url: 'http://www.osaps.org/', parser: 'parseInternationalConference', category: '美容外科', type: '海外学会' },
    { name: 'ESAPS', url: 'https://esaps.org/', parser: 'parseInternationalConference', category: '美容外科', type: '海外学会' },
    { name: 'ISHRS', url: 'https://ishrs.org/', parser: 'parseInternationalConference', category: '美容外科', type: '海外学会' },
    { name: 'ASLMS', url: 'https://www.aslms.org/', parser: 'parseInternationalConference', category: '総合', type: '海外学会' },
    { name: 'WOSAAM', url: 'https://wosaam.net/', parser: 'parseInternationalConference', category: '総合', type: '海外学会' },
    { name: 'A4M', url: 'https://www.a4m.com/', parser: 'parseInternationalConference', category: '総合', type: '海外学会' }
];

// localStorageに保存されたターゲットを取得（初回はデフォルトをコピー）
function getCrawlTargets() {
    try {
        var stored = localStorage.getItem(CRAWL_TARGETS_KEY);
        if (stored) return JSON.parse(stored);
    } catch(e) {}
    saveCrawlTargets(DEFAULT_CRAWL_TARGETS);
    return DEFAULT_CRAWL_TARGETS.slice();
}

function saveCrawlTargets(targets) {
    localStorage.setItem(CRAWL_TARGETS_KEY, JSON.stringify(targets));
}

var parserLabels = {
    'parseJSAPS': 'JSAPS専用',
    'parseGenericConference': '国内学会（汎用）',
    'parseInternationalConference': '海外学会',
    'parseKenkyuukai': '研究会サイト'
};

function getCategoryBadgeClass(cat) {
    if (cat === '美容外科') return 'badge-surgery';
    if (cat === '美容皮膚科') return 'badge-derma';
    return 'badge-general';
}

function getTypeBadgeClass(type) {
    if (type === '国内学会') return 'badge-domestic';
    if (type === '海外学会') return 'badge-international';
    return 'badge-study';
}

// テーブル描画
function renderCrawlerTargets() {
    var container = document.getElementById('crawler-targets');
    var targets = getCrawlTargets();

    var html = '<table class="crawler-table"><thead><tr>'
        + '<th>サイト名</th><th>URL</th><th>分野</th><th>カテゴリ</th><th>パーサー</th><th>操作</th>'
        + '</tr></thead><tbody>';

    targets.forEach(function(t, i) {
        html += '<tr>'
            + '<td><strong>' + t.name + '</strong></td>'
            + '<td><a href="' + t.url + '" target="_blank" rel="noopener">' + t.url + '</a></td>'
            + '<td><span class="badge ' + getCategoryBadgeClass(t.category) + '">' + t.category + '</span></td>'
            + '<td><span class="badge ' + getTypeBadgeClass(t.type || '') + '">' + (t.type || '未分類') + '</span></td>'
            + '<td><span class="parser-tag">' + (parserLabels[t.parser] || t.parser) + '</span></td>'
            + '<td class="action-cell">'
            + '<button class="btn-sm btn-edit" onclick="openCrawlEditModal(' + i + ')"><i class="fas fa-edit"></i></button>'
            + '<button class="btn-sm btn-reject" onclick="removeCrawlTarget(' + i + ')"><i class="fas fa-trash"></i></button>'
            + '</td></tr>';
    });

    html += '</tbody></table>';
    html += '<p class="crawler-count"><i class="fas fa-info-circle"></i> 合計 ' + targets.length + ' サイト登録中</p>';
    container.innerHTML = html;
}

// 削除
function removeCrawlTarget(idx) {
    if (!confirm('本当に削除しますか？この操作は元に戻せません。')) return;
    var targets = getCrawlTargets();
    var removed = targets.splice(idx, 1)[0];
    saveCrawlTargets(targets);
    renderCrawlerTargets();
    showToast(removed.name + ' を削除しました');
}



// === クローラー編集モーダル ===
var crawlEditIdx = -1;
var crawlEditModal = document.getElementById('crawl-edit-modal');

function openCrawlEditModal(idx) {
    var targets = getCrawlTargets();
    var t = targets[idx];
    if (!t) return;
    crawlEditIdx = idx;
    document.getElementById('crawl-edit-name').value = t.name;
    document.getElementById('crawl-edit-url').value = t.url;
    document.getElementById('crawl-edit-category').value = t.category;
    document.getElementById('crawl-edit-type').value = t.type || '国内学会';
    document.getElementById('crawl-edit-parser').value = t.parser;
    crawlEditModal.classList.add('active');
}

document.getElementById('crawl-edit-close').addEventListener('click', function() {
    crawlEditModal.classList.remove('active');
});
crawlEditModal.addEventListener('click', function(e) {
    if (e.target === crawlEditModal) crawlEditModal.classList.remove('active');
});

document.getElementById('crawl-edit-form').addEventListener('submit', function(e) {
    e.preventDefault();
    var targets = getCrawlTargets();
    if (crawlEditIdx < 0 || crawlEditIdx >= targets.length) return;
    targets[crawlEditIdx].name = document.getElementById('crawl-edit-name').value.trim();
    targets[crawlEditIdx].url = document.getElementById('crawl-edit-url').value.trim();
    targets[crawlEditIdx].category = document.getElementById('crawl-edit-category').value;
    targets[crawlEditIdx].type = document.getElementById('crawl-edit-type').value;
    targets[crawlEditIdx].parser = document.getElementById('crawl-edit-parser').value;
    saveCrawlTargets(targets);
    crawlEditModal.classList.remove('active');
    renderCrawlerTargets();
    showToast('クロール対象を更新しました');
});

// === 新規追加フォーム ===
var addCrawlForm = document.getElementById('add-crawl-form');
if (addCrawlForm) {
    addCrawlForm.addEventListener('submit', function(e) {
        e.preventDefault();
        var name = document.getElementById('crawl-name').value.trim();
        var url = document.getElementById('crawl-url').value.trim();
        var category = document.getElementById('crawl-category').value;
        var parser = document.getElementById('crawl-parser').value;
        var type = document.getElementById('crawl-type').value;
        if (!name || !url) return;
        var targets = getCrawlTargets();
        if (targets.some(function(t) { return t.url === url; })) {
            showToast('このURLは既に登録されています');
            return;
        }
        targets.push({ name: name, url: url, parser: parser, category: category, type: type });
        saveCrawlTargets(targets);
        renderCrawlerTargets();
        addCrawlForm.reset();
        showToast(name + ' を追加しました');
    });
}

// ========================================================
// ===== 検索キーワード管理 =====
// ========================================================
var KW_CONFIG_KEY = 'beautyPortal_crawlerConfig';
var CONFIG_URL = 'crawler-config.json';

var DEFAULT_CONFIG = {
    searchKeywords: {
        domestic: ['学術集会', '総会', '大会', '研究会', '学術大会', '年次集会'],
        international: ['Congress', 'Annual Meeting', 'Symposium', 'Conference', 'Forum', 'Summit', 'Workshop'],
        study: ['セミナー', '勉強会', 'ハンズオン', '講習', 'ワークショップ', '研修会', '実技セミナー']
    },
    titlePatterns: {
        domestic: '第(\\d+)回[^。\\n]{2,60}(?:KEYWORDS)',
        jsaps: '(第\\d+回[^。\\n]*(?:KEYWORDS))',
        international: '(?:International\\s+)?(?:KEYWORDS)[^.]{0,120}?(202[6-9])'
    },
    datePatterns: { japanese: '(\\d{4})年(\\d{1,2})月(\\d{1,2})日', yearOnly: '202[6-9]' },
    minYear: 2026
};

function getCrawlerConfig() {
    try {
        var stored = localStorage.getItem(KW_CONFIG_KEY);
        if (stored) return JSON.parse(stored);
    } catch(e) {}
    return null;
}

function saveCrawlerConfig(config) {
    config.lastUpdated = new Date().toISOString();
    localStorage.setItem(KW_CONFIG_KEY, JSON.stringify(config));
}

async function loadCrawlerConfig() {
    var config = getCrawlerConfig();
    if (config) return config;
    try {
        var res = await fetch(CONFIG_URL + '?t=' + Date.now());
        config = await res.json();
        saveCrawlerConfig(config);
        return config;
    } catch(e) {
        config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        saveCrawlerConfig(config);
        return config;
    }
}

function renderKeywords(config) {
    var categories = ['domestic', 'international', 'study'];
    categories.forEach(function(cat) {
        var container = document.getElementById('kw-' + cat);
        if (!container) return;
        var keywords = (config.searchKeywords && config.searchKeywords[cat]) || [];
        var html = '';
        keywords.forEach(function(kw, i) {
            html += '<span class="kw-tag kw-tag-' + cat + '">'
                + kw
                + '<button class="kw-remove" onclick="removeKeyword(\'' + cat + '\',' + i + ')">&times;</button>'
                + '</span>';
        });
        container.innerHTML = html;
    });
}

function removeKeyword(cat, idx) {
    loadCrawlerConfig().then(function(config) {
        if (config.searchKeywords[cat]) {
            var removed = config.searchKeywords[cat].splice(idx, 1)[0];
            saveCrawlerConfig(config);
            renderKeywords(config);
            showToast('「' + removed + '」を削除しました');
        }
    });
}

function addKeyword(cat) {
    var input = document.getElementById('kw-' + cat + '-input');
    var val = input.value.trim();
    if (!val) return;
    loadCrawlerConfig().then(function(config) {
        if (!config.searchKeywords[cat]) config.searchKeywords[cat] = [];
        if (config.searchKeywords[cat].includes(val)) {
            showToast('「' + val + '」は既に登録されています');
            return;
        }
        config.searchKeywords[cat].push(val);
        saveCrawlerConfig(config);
        renderKeywords(config);
        input.value = '';
        showToast('「' + val + '」を追加しました');
    });
}


// config JSONダウンロード
var dlConfigBtn = document.getElementById('btn-download-config');
if (dlConfigBtn) {
    dlConfigBtn.addEventListener('click', function() {
        loadCrawlerConfig().then(function(config) {
            var blob = new Blob([JSON.stringify(config, null, 4)], { type: 'application/json' });
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'crawler-config.json';
            a.click();
            URL.revokeObjectURL(a.href);
            showToast('crawler-config.json をダウンロードしました');
        });
    });
}

// タブ切替時にキーワードも描画
document.querySelectorAll('.tab-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
        if (btn.getAttribute('data-tab') === 'crawler-tab') {
            renderCrawlerTargets();
            loadCrawlerConfig().then(renderKeywords);
        }
    });
});
