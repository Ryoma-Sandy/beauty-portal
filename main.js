/**
 * 美容医療 学会・勉強会 まとめポータル – フロントエンド
 * 
 * クイックフィルタ・カレンダー・インフィード広告
 */

const DATA_URL = 'events-data.json';
const PENDING_STORAGE_KEY = 'beautyPortal_pendingSubmissions';
const AD_INTERVAL = 6; // N件ごとにインフィード広告を挿入

let allDisplayEvents = [];
let activeQuickRange = 'all';

// ===== DOM Ready =====
document.addEventListener('DOMContentLoaded', () => {
    const eventsGrid = document.getElementById('events-grid');
    const searchFilter = document.getElementById('search-filter');
    const categoryFilter = document.getElementById('category-filter');
    const typeFilter = document.getElementById('type-filter');
    const regionFilter = document.getElementById('region-filter');
    
    // 申請モーダル
    const submitBtn = document.getElementById('nav-submit-btn');
    const modal = document.getElementById('submit-modal');
    const modalClose = document.getElementById('submit-close-btn') || document.getElementById('modal-close');
    const submitForm = document.getElementById('submit-form');

    // お問い合わせモーダル
    const inquiryBtn = document.getElementById('nav-inquiry-btn');
    const inquiryFooterLink = document.getElementById('footer-inquiry-link');
    const inquiryModal = document.getElementById('inquiry-modal');
    const inquiryCloseBtn = document.getElementById('inquiry-close-btn');
    const inquiryForm = document.getElementById('inquiry-form');

    // ===== モーダル =====
    function openModal(m) { if(m) { m.classList.add('active'); document.body.style.overflow = 'hidden'; } }
    function closeModal(m) { if(m) { m.classList.remove('active'); document.body.style.overflow = ''; } }

    // ===== クイック日付フィルタ =====
    const quickFilterBtns = document.querySelectorAll('.quick-filter-btn');
    quickFilterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            quickFilterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeQuickRange = btn.getAttribute('data-range');
            filterEvents();
        });
    });

    function getQuickDateRange(range) {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth();
        switch (range) {
            case 'thisMonth':
                return {
                    start: `${y}-${String(m + 1).padStart(2, '0')}-01`,
                    end: `${y}-${String(m + 1).padStart(2, '0')}-${String(new Date(y, m + 1, 0).getDate()).padStart(2, '0')}`
                };
            case 'nextMonth': {
                const ny = m === 11 ? y + 1 : y;
                const nm = m === 11 ? 0 : m + 1;
                return {
                    start: `${ny}-${String(nm + 1).padStart(2, '0')}-01`,
                    end: `${ny}-${String(nm + 1).padStart(2, '0')}-${String(new Date(ny, nm + 1, 0).getDate()).padStart(2, '0')}`
                };
            }
            case 'thisYear':
                return { start: `${y}-01-01`, end: `${y}-12-31` };
            default:
                return null;
        }
    }

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

    // インフィード広告HTML
    function createInFeedAd() {
        const ad = document.createElement('div');
        ad.className = 'ad-infeed';
        ad.innerHTML = '<span class="ad-label">Advertisement</span><div>インフィード広告枠</div>';
        return ad;
    }

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
            // インフィード広告の挿入
            if (index > 0 && index % AD_INTERVAL === 0) {
                eventsGrid.appendChild(createInFeedAd());
            }

            const delay = Math.min(index * 0.05, 1);
            const card = document.createElement('article');
            card.className = 'event-card';
            card.style.animationDelay = delay + 's';

            const urlButton = event.url && event.url !== '#'
                ? '<a href="event.html?id=' + event.id + '" class="btn-primary"><i class="fas fa-info-circle"></i> 詳細を見る</a>'
                : '<span class="btn-primary btn-disabled">詳細情報なし</span>';

            card.innerHTML = '<div class="card-header">'
                + '<span class="card-category ' + getCategoryClass(event.category) + '">' + event.category + '</span>'
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
        const quickRange = getQuickDateRange(activeQuickRange);

        const filtered = allDisplayEvents.filter(event => {
            const matchSearch = searchValue === '' ||
                event.title.toLowerCase().includes(searchValue) ||
                (event.description || '').toLowerCase().includes(searchValue) ||
                (event.organizer && event.organizer.toLowerCase().includes(searchValue));
            const matchCategory = categoryValue === 'all' || event.category === categoryValue;
            const typeValue = typeFilter ? typeFilter.value : 'all';
            const matchType = typeValue === 'all' || event.type === typeValue;
            const matchRegion = regionValue === 'all' || event.region === regionValue;

            let matchDate = true;
            if (selectedDate && event.sortDate) { matchDate = event.sortDate === selectedDate; }
            else if (selectedDate && !event.sortDate) { matchDate = false; }

            // クイック日付フィルタ
            let matchQuick = true;
            if (quickRange && event.sortDate) {
                matchQuick = event.sortDate >= quickRange.start && event.sortDate <= quickRange.end;
            } else if (quickRange && !event.sortDate) {
                matchQuick = false;
            }

            return matchSearch && matchCategory && matchType && matchRegion && matchDate && matchQuick;
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
            if (modal && modal.classList.contains('active')) closeModal(modal);
            if (inquiryModal && inquiryModal.classList.contains('active')) closeModal(inquiryModal);
        }
    });

    // === お問い合わせモーダル ===
    if (inquiryBtn && inquiryModal) inquiryBtn.addEventListener('click', (e) => { e.preventDefault(); openModal(inquiryModal); });
    if (inquiryFooterLink && inquiryModal) inquiryFooterLink.addEventListener('click', (e) => { e.preventDefault(); openModal(inquiryModal); });
    if (inquiryCloseBtn && inquiryModal) inquiryCloseBtn.addEventListener('click', () => closeModal(inquiryModal));
    if (inquiryModal) inquiryModal.addEventListener('click', (e) => { if (e.target === inquiryModal) closeModal(inquiryModal); });

    // === お問い合わせ送信（Web3Forms API） ===
    if (inquiryForm) {
        inquiryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fd = new FormData(inquiryForm);
            if (!fd.get('name') || !fd.get('email') || !fd.get('message')) {
                alert('必須項目を入力してください。');
                return;
            }
            const submitButton = inquiryForm.querySelector('button[type="submit"]');
            const originalText = submitButton.innerHTML;
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 送信中...';
            submitButton.disabled = true;
            try {
                const res = await fetch('https://api.web3forms.com/submit', {
                    method: 'POST',
                    body: fd
                });
                const result = await res.json();
                if (result.success) {
                    showToast('お問い合わせを受け付けました。担当者よりご連絡いたします。');
                    inquiryForm.reset();
                    closeModal(inquiryModal);
                } else {
                    alert('送信に失敗しました。時間をおいて再度お試しください。');
                }
            } catch (err) {
                console.error('送信エラー:', err);
                alert('通信エラーが発生しました。インターネット接続を確認してください。');
            } finally {
                submitButton.innerHTML = originalText;
                submitButton.disabled = false;
            }
        });
    }

    // === フォーム送信（Web3Forms API + localStorage） ===
    if (submitForm) {
        submitForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fd = new FormData(submitForm);
            const title = fd.get('title')?.trim();
            const dateStart = fd.get('dateStart');
            const dateEnd = fd.get('dateEnd') || dateStart;
            const location = fd.get('location')?.trim();
            const description = fd.get('description')?.trim();
            const applicantName = fd.get('applicantName')?.trim();
            const applicantEmail = fd.get('applicantEmail')?.trim();
            if (!title || !dateStart || !location || !description || !applicantName || !applicantEmail) {
                alert('必須項目をすべて入力してください。');
                return;
            }
            const submitButton = submitForm.querySelector('button[type="submit"]');
            const originalText = submitButton.innerHTML;
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 送信中...';
            submitButton.disabled = true;

            // 日付文字列を生成
            const formatDate = (d) => {
                const [y, m, dd] = d.split('-');
                return `${y}年${parseInt(m)}月${parseInt(dd)}日`;
            };
            let dateStr = formatDate(dateStart);
            if (dateEnd && dateEnd !== dateStart) {
                dateStr += ' - ' + formatDate(dateEnd);
            }
            // 掲載開始日: 最終日の1年前
            const endDate = new Date(dateEnd || dateStart);
            const displayFrom = new Date(endDate);
            displayFrom.setFullYear(displayFrom.getFullYear() - 1);

            const eventData = {
                id: Date.now(), title, date: dateStr,
                sortDate: dateStart,
                dateStart: dateStart,
                dateEnd: dateEnd || dateStart,
                displayFrom: displayFrom.toISOString().split('T')[0],
                category: fd.get('category'), region: fd.get('region'),
                location, organizer: fd.get('organizer')?.trim() || '',
                description, url: fd.get('url')?.trim() || '',
                sns: {
                    line: fd.get('line')?.trim() || '',
                    instagram: fd.get('instagram')?.trim() || '',
                    facebook: fd.get('facebook')?.trim() || ''
                },
                source: 'user', submittedAt: new Date().toISOString(),
                applicant: { name: applicantName, email: applicantEmail, company: fd.get('applicantCompany')?.trim() || '' }
            };

            // localStorage に保存（管理画面用）
            try {
                const pending = JSON.parse(localStorage.getItem(PENDING_STORAGE_KEY) || '[]');
                pending.push(eventData);
                localStorage.setItem(PENDING_STORAGE_KEY, JSON.stringify(pending));
            } catch (err) { console.error('保存エラー:', err); }

            // Web3Forms APIへ送信（メール通知）
            try {
                const res = await fetch('https://api.web3forms.com/submit', {
                    method: 'POST',
                    body: fd
                });
                const result = await res.json();
                if (result.success) {
                    showToast('掲載申請を受け付けました。管理者の承認後に掲載されます。');
                } else {
                    showToast('掲載申請を受け付けました（メール通知に失敗しましたが、データは保存されています）。');
                }
            } catch (err) {
                console.error('Web3Forms送信エラー:', err);
                showToast('掲載申請を受け付けました（メール通知に失敗しましたが、データは保存されています）。');
            } finally {
                submitButton.innerHTML = originalText;
                submitButton.disabled = false;
            }
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
    if (typeFilter) typeFilter.addEventListener('change', filterEvents);
    regionFilter.addEventListener('change', filterEvents);

    // 初期読み込み
    loadEvents().then(function() { initCalendar(); });
});
