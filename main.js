/**
 * 美容医療 学会・勉強会ポータル – フロントエンド
 * 
 * Phase 3: ログイン・お気に入り・カレンダー・フィルター
 */

const DATA_URL = 'events-data.json';
const PENDING_STORAGE_KEY = 'beautyPortal_pendingSubmissions';
const USERS_STORAGE_KEY = 'beautyPortal_users';
const SESSION_KEY = 'beautyPortal_session';

let allDisplayEvents = [];
let currentUser = null; // { id, name, email }
let userFavorites = []; // [eventId, ...]
let showFavOnly = false;

// ===== SHA-256 =====
async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ===== ユーザー管理 =====
function getUsers() {
    try { return JSON.parse(localStorage.getItem(USERS_STORAGE_KEY) || '[]'); }
    catch (e) { return []; }
}

function saveUsers(users) {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

function loadSession() {
    try {
        const session = JSON.parse(sessionStorage.getItem(SESSION_KEY));
        if (session && session.id) {
            currentUser = session;
            loadFavorites();
            return true;
        }
    } catch (e) {}
    return false;
}

function saveSession(user) {
    currentUser = { id: user.id, name: user.name, email: user.email };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));
    loadFavorites();
}

function clearSession() {
    currentUser = null;
    userFavorites = [];
    showFavOnly = false;
    sessionStorage.removeItem(SESSION_KEY);
}

function loadFavorites() {
    if (!currentUser) { userFavorites = []; return; }
    try {
        userFavorites = JSON.parse(localStorage.getItem('beautyPortal_fav_' + currentUser.id) || '[]');
    } catch (e) { userFavorites = []; }
}

function saveFavorites() {
    if (!currentUser) return;
    localStorage.setItem('beautyPortal_fav_' + currentUser.id, JSON.stringify(userFavorites));
}

function toggleFavorite(eventId) {
    if (!currentUser) return false;
    const idx = userFavorites.indexOf(eventId);
    if (idx === -1) { userFavorites.push(eventId); }
    else { userFavorites.splice(idx, 1); }
    saveFavorites();
    return true;
}

function isFavorite(eventId) {
    return userFavorites.includes(eventId);
}

// ===== DOM Ready =====
document.addEventListener('DOMContentLoaded', () => {
    const eventsGrid = document.getElementById('events-grid');
    const searchFilter = document.getElementById('search-filter');
    const categoryFilter = document.getElementById('category-filter');
    const regionFilter = document.getElementById('region-filter');
    const submitBtn = document.getElementById('submit-event-btn');
    const modal = document.getElementById('submit-modal');
    const modalClose = document.getElementById('modal-close');
    const submitForm = document.getElementById('submit-form');

    // Auth elements
    const navGuest = document.getElementById('nav-guest');
    const navUser = document.getElementById('nav-user');
    const navUserName = document.getElementById('nav-user-name');
    const navLoginBtn = document.getElementById('nav-login-btn');
    const navRegisterBtn = document.getElementById('nav-register-btn');
    const navLogoutBtn = document.getElementById('nav-logout-btn');
    const loginModal = document.getElementById('login-modal');
    const registerModal = document.getElementById('register-modal');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginError = document.getElementById('login-error');
    const registerError = document.getElementById('register-error');
    const favFilterBtn = document.getElementById('fav-filter-btn');

    // ===== Auth UI更新 =====
    function updateAuthUI() {
        if (currentUser) {
            navGuest.style.display = 'none';
            navUser.style.display = 'flex';
            navUserName.innerHTML = '<i class="fas fa-user-circle"></i> ' + currentUser.name;
            favFilterBtn.title = 'お気に入りのみ表示';
        } else {
            navGuest.style.display = 'flex';
            navUser.style.display = 'none';
            navUserName.textContent = '';
            favFilterBtn.title = 'ログインするとお気に入りが使えます';
            favFilterBtn.classList.remove('active');
            showFavOnly = false;
        }
    }

    // セッション復帰
    loadSession();
    updateAuthUI();

    // ===== モーダル汎用 =====
    function openModal(m) { m.classList.add('active'); document.body.style.overflow = 'hidden'; }
    function closeModal(m) { m.classList.remove('active'); document.body.style.overflow = ''; }

    // ナビゲーションボタン
    navLoginBtn.addEventListener('click', () => openModal(loginModal));
    navRegisterBtn.addEventListener('click', () => openModal(registerModal));
    document.getElementById('login-modal-close').addEventListener('click', () => closeModal(loginModal));
    document.getElementById('register-modal-close').addEventListener('click', () => closeModal(registerModal));
    document.getElementById('switch-to-register').addEventListener('click', (e) => {
        e.preventDefault(); closeModal(loginModal); openModal(registerModal);
    });
    document.getElementById('switch-to-login').addEventListener('click', (e) => {
        e.preventDefault(); closeModal(registerModal); openModal(loginModal);
    });

    // ログアウト
    navLogoutBtn.addEventListener('click', () => {
        clearSession();
        updateAuthUI();
        filterEvents();
        showToast('ログアウトしました');
    });

    // ===== 新規登録 =====
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        registerError.textContent = '';
        const name = document.getElementById('register-name').value.trim();
        const email = document.getElementById('register-email').value.trim();
        const password = document.getElementById('register-password').value;

        if (password.length < 6) {
            registerError.textContent = 'パスワードは6文字以上で入力してください';
            return;
        }

        const users = getUsers();
        if (users.some(u => u.email === email)) {
            registerError.textContent = 'このメールアドレスは既に登録されています';
            return;
        }

        const hash = await sha256(password);
        const newUser = { id: Date.now(), name, email, passwordHash: hash, createdAt: new Date().toISOString() };
        users.push(newUser);
        saveUsers(users);
        saveSession(newUser);
        updateAuthUI();
        closeModal(registerModal);
        registerForm.reset();
        filterEvents();
        showToast('アカウントを作成しました。ようこそ！');
    });

    // ===== ログイン =====
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginError.textContent = '';
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;

        const users = getUsers();
        const hash = await sha256(password);
        const user = users.find(u => u.email === email && u.passwordHash === hash);

        if (!user) {
            loginError.textContent = 'メールアドレスまたはパスワードが正しくありません';
            return;
        }

        saveSession(user);
        updateAuthUI();
        closeModal(loginModal);
        loginForm.reset();
        filterEvents();
        showToast('ログインしました');
    });

    // ===== お気に入りフィルタ =====
    favFilterBtn.addEventListener('click', () => {
        if (!currentUser) {
            openModal(loginModal);
            return;
        }
        showFavOnly = !showFavOnly;
        favFilterBtn.classList.toggle('active', showFavOnly);
        if (showFavOnly) {
            favFilterBtn.innerHTML = '<i class="fas fa-star"></i> お気に入り';
        } else {
            favFilterBtn.innerHTML = '<i class="far fa-star"></i> お気に入り';
        }
        filterEvents();
    });

    // ===== データ読み込み =====
    async function loadEvents() {
        try {
            const res = await fetch(DATA_URL + '?t=' + Date.now());
            const data = await res.json();
            allDisplayEvents = [
                ...data.official.map(e => ({ ...e, source: 'auto' })),
                ...data.approved.map(e => ({ ...e, source: 'approved' }))
            ];
            allDisplayEvents.sort((a, b) => {
                const dateA = a.sortDate || '9999-12-31';
                const dateB = b.sortDate || '9999-12-31';
                return dateA.localeCompare(dateB);
            });
            filterEvents();
        } catch (e) {
            console.error('データ読み込みエラー:', e);
            eventsGrid.innerHTML = '<div class="no-events"><i class="fas fa-exclamation-triangle" style="font-size:2rem;margin-bottom:1rem;color:var(--primary);display:block;"></i>データの読み込みに失敗しました。<br>ページを再読み込みしてください。</div>';
        }
    }

    // カテゴリ別CSSクラス
    const getCategoryClass = (category) => {
        if (category === "美容外科") return "surgery";
        if (category === "総合") return "general";
        return "";
    };

    // ソースバッジ
    const getSourceBadge = (source) => {
        if (source === 'approved') {
            return '<span class="source-badge approved-badge"><i class="fas fa-check-circle"></i> 承認済み掲載</span>';
        }
        return '<span class="source-badge auto-badge"><i class="fas fa-check-circle"></i> 公式情報</span>';
    };

    // イベント描画
    const renderEvents = (events) => {
        eventsGrid.innerHTML = '';

        if (events.length === 0) {
            eventsGrid.innerHTML = '<div class="no-events"><i class="fas fa-search" style="font-size:2rem;margin-bottom:1rem;color:var(--primary);display:block;"></i>条件に一致するイベントは見つかりませんでした。<br>条件を変更してお試しください。</div>';
            return;
        }

        const countEl = document.getElementById('event-count');
        if (countEl) { countEl.textContent = events.length + ' 件のイベント'; }

        events.forEach((event, index) => {
            const delay = index * 0.07;
            const card = document.createElement('article');
            card.className = 'event-card';
            card.style.animationDelay = delay + 's';

            const faved = isFavorite(event.id);
            const favBtnHtml = currentUser
                ? '<button class="card-fav-btn' + (faved ? ' faved' : '') + '" data-id="' + event.id + '" title="お気に入り"><i class="' + (faved ? 'fas' : 'far') + ' fa-star"></i></button>'
                : '';

            const urlButton = event.url && event.url !== '#'
                ? '<a href="event.html?id=' + event.id + '" class="btn-primary"><i class="fas fa-info-circle"></i> 詳細を見る</a>'
                : '<span class="btn-primary btn-disabled">詳細情報なし</span>';

            card.innerHTML = '<div class="card-header" style="position:relative;">'
                + '<span class="card-category ' + getCategoryClass(event.category) + '">' + event.category + '</span>'
                + favBtnHtml
                + '<div class="card-date"><i class="far fa-calendar-alt"></i> ' + event.date + '</div>'
                + '<h3 class="card-title">' + event.title + '</h3>'
                + '</div>'
                + '<div class="card-body">'
                + '<div class="card-meta">'
                + '<span class="region"><i class="fas fa-map-marker-alt"></i> ' + event.region + '（' + (event.location || '') + '）</span>'
                + (event.organizer ? '<span class="organizer"><i class="fas fa-building"></i> ' + event.organizer + '</span>' : '')
                + '</div>'
                + '<p class="card-desc">' + (event.description || '') + '</p>'
                + '<div class="card-footer">' + getSourceBadge(event.source) + '</div>'
                + urlButton
                + '</div>';

            eventsGrid.appendChild(card);
        });

        // お気に入りボタンのイベント
        eventsGrid.querySelectorAll('.card-fav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.getAttribute('data-id'));
                toggleFavorite(id);
                const nowFaved = isFavorite(id);
                btn.classList.toggle('faved', nowFaved);
                btn.querySelector('i').className = nowFaved ? 'fas fa-star' : 'far fa-star';
                if (showFavOnly && !nowFaved) {
                    filterEvents();
                }
            });
        });
    };

    // ===== ビュー切り替え =====
    const calSection = document.getElementById('calendar-section');
    const viewCalBtn = document.getElementById('view-calendar-btn');
    const viewListBtn = document.getElementById('view-list-btn');

    calSection.classList.add('view-hidden');

    viewCalBtn.addEventListener('click', function() {
        viewCalBtn.classList.add('active');
        viewListBtn.classList.remove('active');
        calSection.classList.remove('view-hidden');
        eventsGrid.classList.add('view-hidden');
    });

    viewListBtn.addEventListener('click', function() {
        viewListBtn.classList.add('active');
        viewCalBtn.classList.remove('active');
        eventsGrid.classList.remove('view-hidden');
        calSection.classList.add('view-hidden');
    });

    // ===== カレンダー =====
    let calYear, calMonth;
    let selectedDate = null;
    const calDays = document.getElementById('cal-days');
    const calTitle = document.getElementById('cal-month-title');
    const calPrev = document.getElementById('cal-prev');
    const calNext = document.getElementById('cal-next');
    const calTodayBtn = document.getElementById('cal-today');
    const calSelectedInfo = document.getElementById('cal-selected-info');
    const calSelectedText = document.getElementById('cal-selected-text');
    const calClear = document.getElementById('cal-clear');

    function initCalendar() {
        const now = new Date();
        calYear = now.getFullYear();
        calMonth = now.getMonth();
        renderCalendar();
    }

    function renderCalendar() {
        calTitle.textContent = calYear + '\u5E74 ' + (calMonth + 1) + '\u6708';
        const firstDay = new Date(calYear, calMonth, 1).getDay();
        const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
        const daysInPrev = new Date(calYear, calMonth, 0).getDate();
        const today = new Date();
        const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

        const eventMap = {};
        allDisplayEvents.forEach(function(ev) {
            if (!ev.sortDate) return;
            const parts = ev.sortDate.split('-');
            if (parts.length < 3) return;
            if (parseInt(parts[0]) === calYear && parseInt(parts[1]) - 1 === calMonth) {
                if (!eventMap[ev.sortDate]) eventMap[ev.sortDate] = [];
                eventMap[ev.sortDate].push(ev.category);
            }
        });

        let html = '';
        for (let i = 0; i < firstDay; i++) {
            html += '<div class="cal-day other-month"><span class="cal-day-num">' + (daysInPrev - firstDay + i + 1) + '</span><span class="cal-day-dots"></span></div>';
        }
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = calYear + '-' + String(calMonth + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
            const dow = new Date(calYear, calMonth, d).getDay();
            let cls = 'cal-day';
            if (dateStr === todayStr) cls += ' today';
            if (dateStr === selectedDate) cls += ' active';
            if (dow === 0) cls += ' sunday';
            if (dow === 6) cls += ' saturday';

            let dots = '';
            if (eventMap[dateStr]) {
                [...new Set(eventMap[dateStr])].forEach(function(cat) {
                    if (cat === '\u7F8E\u5BB9\u76AE\u819A\u79D1') dots += '<span class="cal-dot dot-derma"></span>';
                    else if (cat === '\u7F8E\u5BB9\u5916\u79D1') dots += '<span class="cal-dot dot-surgery"></span>';
                    else dots += '<span class="cal-dot dot-general"></span>';
                });
            }
            html += '<div class="' + cls + '" data-date="' + dateStr + '"><span class="cal-day-num">' + d + '</span><span class="cal-day-dots">' + dots + '</span></div>';
        }
        const totalCells = firstDay + daysInMonth;
        const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
        for (let i = 1; i <= remaining; i++) {
            html += '<div class="cal-day other-month"><span class="cal-day-num">' + i + '</span><span class="cal-day-dots"></span></div>';
        }
        calDays.innerHTML = html;

        calDays.querySelectorAll('.cal-day:not(.other-month)').forEach(function(el) {
            el.addEventListener('click', function() {
                const date = el.getAttribute('data-date');
                if (selectedDate === date) {
                    selectedDate = null;
                    calSelectedInfo.style.display = 'none';
                } else {
                    selectedDate = date;
                    var p = date.split('-');
                    calSelectedText.textContent = p[0] + '\u5E74' + parseInt(p[1]) + '\u6708' + parseInt(p[2]) + '\u65E5 \u306E\u30A4\u30D9\u30F3\u30C8\u3092\u8868\u793A\u4E2D';
                    calSelectedInfo.style.display = 'flex';
                }
                renderCalendar();
                filterEvents();
            });
        });
    }

    calPrev.addEventListener('click', function() { calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } renderCalendar(); });
    calNext.addEventListener('click', function() { calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } renderCalendar(); });
    calTodayBtn.addEventListener('click', function() { var n = new Date(); calYear = n.getFullYear(); calMonth = n.getMonth(); renderCalendar(); });
    calClear.addEventListener('click', function() { selectedDate = null; calSelectedInfo.style.display = 'none'; renderCalendar(); filterEvents(); });

    // ===== フィルター =====
    const filterEvents = () => {
        const searchValue = searchFilter.value.toLowerCase().trim();
        const categoryValue = categoryFilter.value;
        const regionValue = regionFilter.value;

        const filtered = allDisplayEvents.filter(event => {
            const matchSearch = searchValue === '' ||
                event.title.toLowerCase().includes(searchValue) ||
                (event.description || '').toLowerCase().includes(searchValue) ||
                (event.organizer && event.organizer.toLowerCase().includes(searchValue));
            const matchCategory = categoryValue === 'all' || event.category === categoryValue;
            const matchRegion = regionValue === 'all' || event.region === regionValue;

            let matchDate = true;
            if (selectedDate && event.sortDate) { matchDate = event.sortDate === selectedDate; }
            else if (selectedDate && !event.sortDate) { matchDate = false; }

            let matchFav = true;
            if (showFavOnly) { matchFav = isFavorite(event.id); }

            return matchSearch && matchCategory && matchRegion && matchDate && matchFav;
        });

        renderEvents(filtered);
    };

    // === 掲載申請モーダル ===
    if (submitBtn && modal) {
        submitBtn.addEventListener('click', () => openModal(modal));
        modalClose.addEventListener('click', () => closeModal(modal));
        modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(modal); });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            [modal, loginModal, registerModal].forEach(m => { if (m && m.classList.contains('active')) closeModal(m); });
        }
    });

    // === フォーム送信 ===
    if (submitForm) {
        submitForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const fd = new FormData(submitForm);
            const title = fd.get('title')?.trim();
            const date = fd.get('date')?.trim();
            const location = fd.get('location')?.trim();
            const description = fd.get('description')?.trim();
            const applicantName = fd.get('applicantName')?.trim();
            const applicantEmail = fd.get('applicantEmail')?.trim();
            if (!title || !date || !location || !description || !applicantName || !applicantEmail) {
                alert('必須項目をすべて入力してください。');
                return;
            }
            const eventData = {
                id: Date.now(), title, date,
                sortDate: fd.get('sortDate') || '',
                category: fd.get('category'), region: fd.get('region'),
                location, organizer: fd.get('organizer')?.trim() || '',
                description, url: fd.get('url')?.trim() || '#',
                source: 'user', submittedAt: new Date().toISOString(),
                applicant: { name: applicantName, email: applicantEmail, company: fd.get('applicantCompany')?.trim() || '' }
            };
            try {
                const pending = JSON.parse(localStorage.getItem(PENDING_STORAGE_KEY) || '[]');
                pending.push(eventData);
                localStorage.setItem(PENDING_STORAGE_KEY, JSON.stringify(pending));
            } catch (err) { console.error('保存エラー:', err); }
            showToast('掲載申請を受け付けました。管理者の承認後に掲載されます。');
            submitForm.reset();
            closeModal(modal);
        });
    }

    // トースト
    function showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.innerHTML = '<i class="fas fa-check-circle"></i> ' + message;
        document.body.appendChild(toast);
        requestAnimationFrame(() => { toast.classList.add('show'); });
        setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 400); }, 4000);
    }

    // フィルターリスナー
    searchFilter.addEventListener('input', filterEvents);
    categoryFilter.addEventListener('change', filterEvents);
    regionFilter.addEventListener('change', filterEvents);

    // 初期読み込み
    loadEvents().then(function() { initCalendar(); });
});
