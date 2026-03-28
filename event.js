/**
 * event.js – イベント詳細ページ
 * 
 * URLパラメータ ?id=XXX からイベントIDを取得し、
 * events-data.json から該当イベントを描画。
 * JSON-LD 構造化データを動的挿入。
 */

(function() {
    const DATA_URL = 'events-data.json';
    const container = document.getElementById('event-detail');

    // URLからIDを取得
    const params = new URLSearchParams(window.location.search);
    const eventId = parseInt(params.get('id'));

    if (!eventId) {
        container.innerHTML = '<div class="detail-loading"><i class="fas fa-exclamation-triangle"></i><p>イベントIDが指定されていません。<br><a href="index.html">トップに戻る</a></p></div>';
        return;
    }

    fetch(DATA_URL + '?t=' + Date.now())
        .then(function(res) { return res.json(); })
        .then(function(data) {
            var allEvents = [].concat(
                data.official.map(function(e) { return Object.assign({}, e, { source: 'auto' }); }),
                data.approved.map(function(e) { return Object.assign({}, e, { source: 'approved' }); })
            );

            var event = allEvents.find(function(e) { return e.id === eventId; });

            if (!event) {
                container.innerHTML = '<div class="detail-loading"><i class="fas fa-exclamation-triangle"></i><p>指定されたイベントが見つかりません。<br><a href="index.html">トップに戻る</a></p></div>';
                return;
            }

            renderEvent(event);
            injectSEO(event);
        })
        .catch(function(err) {
            console.error('データ読み込みエラー:', err);
            container.innerHTML = '<div class="detail-loading"><i class="fas fa-exclamation-triangle"></i><p>データの読み込みに失敗しました。<br><a href="index.html">トップに戻る</a></p></div>';
        });

    function renderEvent(event) {
        var categoryClass = '';
        if (event.category === '美容外科') categoryClass = 'surgery';
        else if (event.category === '総合') categoryClass = 'general';

        var sourceBadge = event.source === 'approved'
            ? '<span class="source-badge approved-badge"><i class="fas fa-check-circle"></i> 承認済み掲載</span>'
            : '<span class="source-badge auto-badge"><i class="fas fa-check-circle"></i> 公式情報</span>';

        var externalLink = (event.url && event.url !== '#')
            ? '<a href="' + event.url + '" class="btn-primary" target="_blank" rel="noopener noreferrer"><i class="fas fa-external-link-alt"></i> 公式サイトを見る・参加登録</a>'
            : '';

        container.innerHTML = '<div class="detail-card">'
            + '<div class="detail-header">'
            + '<span class="detail-category">' + event.category + '</span>'
            + '<h1 class="detail-title">' + event.title + '</h1>'
            + '<div class="detail-date"><i class="far fa-calendar-alt"></i> ' + event.date + '</div>'
            + '</div>'
            + '<div class="detail-body">'
            + '<div class="detail-meta">'
            + '<div class="meta-item"><i class="fas fa-map-marker-alt"></i><div><span class="meta-label">開催地域</span><span class="meta-value">' + event.region + '</span></div></div>'
            + '<div class="meta-item"><i class="fas fa-building"></i><div><span class="meta-label">会場</span><span class="meta-value">' + (event.location || '—') + '</span></div></div>'
            + '<div class="meta-item"><i class="fas fa-users"></i><div><span class="meta-label">主催</span><span class="meta-value">' + (event.organizer || '—') + '</span></div></div>'
            + '<div class="meta-item"><i class="fas fa-info-circle"></i><div><span class="meta-label">情報ソース</span>' + sourceBadge + '</div></div>'
            + '</div>'
            + '<div class="detail-description"><h3>概要</h3><p>' + (event.description || '詳細情報は公式サイトをご確認ください。') + '</p></div>'
            + '<div class="detail-actions">'
            + externalLink
            + '<a href="index.html" class="btn-back"><i class="fas fa-arrow-left"></i> イベント一覧に戻る</a>'
            + '</div>'
            + '</div>'
            + '</div>';

        // パンくず更新
        document.getElementById('breadcrumb-title').textContent = event.title;
        // タイトル更新
        document.title = event.title + ' | 美容医療 学会・勉強会 まとめポータル';
        // OGP更新
        setMeta('og:title', event.title + ' | 美容医療 学会・勉強会 まとめポータル');
        setMeta('og:description', (event.description || event.title).substring(0, 150));
        setMeta('description', event.date + ' ' + event.region + ' - ' + (event.description || event.title).substring(0, 120));
    }

    function setMeta(name, content) {
        var el = document.querySelector('meta[property="' + name + '"], meta[name="' + name + '"]');
        if (el) el.setAttribute('content', content);
    }

    function injectSEO(event) {
        var jsonLd = {
            '@context': 'https://schema.org',
            '@type': 'Event',
            'name': event.title,
            'description': event.description || '',
            'startDate': event.sortDate || '',
            'eventAttendanceMode': 'https://schema.org/OfflineEventAttendanceMode',
            'eventStatus': 'https://schema.org/EventScheduled',
            'location': {
                '@type': 'Place',
                'name': event.location || event.region || '',
                'address': {
                    '@type': 'PostalAddress',
                    'addressRegion': event.region || ''
                }
            },
            'organizer': {
                '@type': 'Organization',
                'name': event.organizer || ''
            }
        };

        if (event.url && event.url !== '#') {
            jsonLd.url = event.url;
        }

        var script = document.createElement('script');
        script.type = 'application/ld+json';
        script.textContent = JSON.stringify(jsonLd);
        document.head.appendChild(script);
    }
})();
