/**
 * 美容医療 学会・勉強会 まとめポータル – Webクローラー (Playwright版)
 * 
 * Playwrightでヘッドレスブラウザを使い、JS描画サイトにも対応。
 * 検索キーワード・パターンは crawler-config.json から読み込み。
 * 
 * 使い方:
 *   npm install        (初回のみ)
 *   npx playwright install chromium  (初回のみ)
 *   npm run crawl       (クロール実行)
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// ===== 設定 =====
const DATA_FILE = path.join(__dirname, 'events-data.json');
const CONFIG_FILE = path.join(__dirname, 'crawler-config.json');
const LOG_FILE = path.join(__dirname, 'crawler-log.txt');

// 設定ファイル読み込み
function loadConfig() {
    try {
        return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    } catch (e) {
        log(`設定ファイル読み込みエラー: ${e.message}`);
        return {
            searchKeywords: {
                domestic: ['学術集会', '総会', '大会', '研究会', '学術大会'],
                international: ['Congress', 'Annual Meeting', 'Symposium', 'Conference', 'Forum'],
                study: ['セミナー', '勉強会', 'ハンズオン', '講習', 'ワークショップ']
            },
            datePatterns: { japanese: '(\\d{4})年(\\d{1,2})月(\\d{1,2})日', yearOnly: '202[6-9]' },
            titlePatterns: {},
            minYear: 2026
        };
    }
}

// クロール対象サイト
const CRAWL_TARGETS = [
    // --- 国内学会 ---
    { name: 'JSAPS（日本美容外科学会）', url: 'https://www.jsaps.com/', parserType: 'jsaps', category: '美容外科', type: '国内学会' },
    { name: 'JSAS（日本美容外科学会）', url: 'https://www.jsas.or.jp/', parserType: 'domestic', category: '美容外科', type: '国内学会' },
    { name: '日本美容皮膚科学会', url: 'https://www.aesthet-derm.org/', parserType: 'domestic', category: '美容皮膚科', type: '国内学会' },
    { name: '日本レーザー医学会 (JSLMS)', url: 'https://www.jslms.or.jp/', parserType: 'domestic', category: '総合', type: '国内学会' },
    { name: '日本抗加齢医学会 (JSAAM)', url: 'https://www.anti-aging.gr.jp/', parserType: 'domestic', category: '総合', type: '国内学会' },
    { name: '日本美容医療学会（JAPSA）', url: 'https://japsa.or.jp/', parserType: 'domestic', category: '総合', type: '国内学会' },
    { name: 'kenkyuukai.jp（研究会情報）', url: 'https://www.kenkyuukai.jp/biyo/', parserType: 'kenkyuukai', category: '総合', type: '勉強会' },
    // --- 海外・国際学会 ---
    { name: 'ISAPS', url: 'https://www.isaps.org/', parserType: 'international', category: '美容外科', type: '海外学会' },
    { name: 'IMCAS', url: 'https://www.imcas.com/', parserType: 'international', category: '総合', type: '海外学会' },
    { name: 'UIME', url: 'https://www.uime.org/', parserType: 'international', category: '総合', type: '海外学会' },
    { name: 'ASPS', url: 'https://www.plasticsurgery.org/', parserType: 'international', category: '美容外科', type: '海外学会' },
    { name: 'The Aesthetic Society', url: 'https://www.theaestheticsociety.org/', parserType: 'international', category: '美容外科', type: '海外学会' },
    { name: 'AAD', url: 'https://www.aad.org/', parserType: 'international', category: '美容皮膚科', type: '海外学会' },
    { name: 'OSAPS', url: 'http://www.osaps.org/', parserType: 'international', category: '美容外科', type: '海外学会' },
    { name: 'ESAPS', url: 'https://esaps.org/', parserType: 'international', category: '美容外科', type: '海外学会' },
    { name: 'ISHRS', url: 'https://ishrs.org/', parserType: 'international', category: '美容外科', type: '海外学会' },
    { name: 'ASLMS', url: 'https://www.aslms.org/', parserType: 'international', category: '総合', type: '海外学会' },
    { name: 'WOSAAM', url: 'https://wosaam.net/', parserType: 'international', category: '総合', type: '海外学会' },
    { name: 'A4M', url: 'https://www.a4m.com/', parserType: 'international', category: '総合', type: '海外学会' }
];

// ===== ログ =====
function log(message) {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${message}`;
    console.log(logLine);
    fs.appendFileSync(LOG_FILE, logLine + '\n', 'utf-8');
}

// ===== データ読み込み・保存 =====
function loadData() {
    try {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        return JSON.parse(raw);
    } catch (e) {
        log(`データファイル読み込みエラー: ${e.message}`);
        return { official: [], pending: [], approved: [], lastCrawled: null };
    }
}

function saveData(data) {
    data.lastCrawled = new Date().toISOString();
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 4), 'utf-8');
    log(`データファイルを更新しました: ${DATA_FILE}`);
}

// ===== 重複チェック =====
function isDuplicate(existing, newEvent) {
    return existing.some(e => {
        const normalize = (str) => str.replace(/[\s　]/g, '').replace(/第(\d+)回/g, '$1').toLowerCase();
        const titleA = normalize(e.title);
        const titleB = normalize(newEvent.title);
        if (titleA === titleB) return true;
        if (titleA.includes(titleB) || titleB.includes(titleA)) return true;
        return false;
    });
}

// ===== パターン構築 =====
function buildKeywordRegex(keywords, flags) {
    const escaped = keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return new RegExp(escaped.join('|'), flags || 'g');
}

function buildTitlePattern(config, parserType) {
    const kw = config.searchKeywords;
    if (parserType === 'jsaps') {
        const kwList = (kw.domestic || []).join('|');
        return new RegExp(`(第\\d+回[^。\\n]*(?:${kwList}))`, 'g');
    }
    if (parserType === 'domestic') {
        const kwList = (kw.domestic || []).join('|');
        return new RegExp(`第(\\d+)回[^。\\n]{2,60}(?:${kwList})`, 'g');
    }
    if (parserType === 'international') {
        const kwList = (kw.international || []).join('|');
        return new RegExp(`(?:International\\s+)?(?:${kwList})[^.]{0,120}?(202[6-9])`, 'gi');
    }
    return null;
}

// ===== ページ取得（Playwright） =====
async function fetchPageContent(page, url) {
    try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
        // JSレンダリング完了を待つ追加の猶予
        await page.waitForTimeout(2000);
        return await page.content();
    } catch (e) {
        log(`  ページ取得エラー (${url}): ${e.message}`);
        return null;
    }
}

// ===== テキスト抽出（Playwright DOM） =====
async function extractPageText(page) {
    return await page.evaluate(() => document.body ? document.body.innerText : '');
}

// ===== パーサー: JSAPS専用 =====
async function parseJSAPS(page, target, config) {
    const events = [];
    const bodyText = await extractPageText(page);
    const titlePattern = buildTitlePattern(config, 'jsaps');
    const datePat = new RegExp(config.datePatterns.japanese, 'g');

    const titleMatches = bodyText.matchAll(titlePattern);
    for (const match of titleMatches) {
        const title = match[1] ? match[1].trim() : match[0].trim();
        const nearbyText = bodyText.substring(
            Math.max(0, match.index - 200),
            Math.min(bodyText.length, match.index + 300)
        );
        const dateMatch = nearbyText.match(new RegExp(config.datePatterns.japanese));
        if (dateMatch) {
            events.push({
                title, date: `${dateMatch[1]}年${dateMatch[2]}月${dateMatch[3]}日`,
                sortDate: `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`,
                category: target.category, type: target.type || '国内学会',
                region: '関東', location: '', organizer: target.name,
                description: '', url: target.url, source: 'auto'
            });
        }
    }
    return events;
}

// ===== パーサー: 国内学会（汎用） =====
async function parseDomestic(page, target, config) {
    const events = [];
    const bodyText = await extractPageText(page);
    const titlePattern = buildTitlePattern(config, 'domestic');
    const minYear = config.minYear || 2026;

    const titleMatches = bodyText.matchAll(titlePattern);
    for (const match of titleMatches) {
        const title = match[0].trim();
        const nearbyText = bodyText.substring(
            Math.max(0, match.index - 200),
            Math.min(bodyText.length, match.index + 300)
        );
        const dateMatch = nearbyText.match(new RegExp(config.datePatterns.japanese));
        if (dateMatch && parseInt(dateMatch[1]) >= minYear) {
            events.push({
                title, date: `${dateMatch[1]}年${dateMatch[2]}月${dateMatch[3]}日`,
                sortDate: `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`,
                category: target.category, type: target.type || '国内学会',
                region: '', location: '', organizer: target.name,
                description: '', url: target.url, source: 'auto'
            });
        }
    }
    return events;
}

// ===== パーサー: kenkyuukai.jp =====
async function parseKenkyuukai(page, target, config) {
    const events = [];
    const studyKeywords = config.searchKeywords.study || ['セミナー', '勉強会'];
    const domesticKeywords = config.searchKeywords.domestic || ['学会', '研究会'];
    const allKeywords = [...studyKeywords, ...domesticKeywords];

    const links = await page.evaluate((keywords) => {
        const results = [];
        document.querySelectorAll('a[href*="kenkyuukai"]').forEach(el => {
            const text = el.textContent.trim();
            const href = el.getAttribute('href') || '';
            if (text.length > 5 && keywords.some(k => text.includes(k))) {
                results.push({ text, href });
            }
        });
        return results;
    }, allKeywords);

    links.forEach(link => {
        events.push({
            title: link.text, date: '', sortDate: '',
            category: target.category, type: target.type || '勉強会',
            region: '', location: '', organizer: '',
            description: '', source: 'auto',
            url: link.href.startsWith('http') ? link.href : `https://www.kenkyuukai.jp${link.href}`
        });
    });
    return events;
}

// ===== パーサー: 海外学会 =====
async function parseInternational(page, target, config) {
    const events = [];
    const bodyText = await extractPageText(page);
    const titlePattern = buildTitlePattern(config, 'international');
    if (!titlePattern) return events;

    const titleMatches = bodyText.matchAll(titlePattern);
    for (const match of titleMatches) {
        const title = match[0].trim();
        const yearMatch = match[1];
        if (!events.some(e => e.title.includes(title))) {
            events.push({
                title: `${target.name} ${yearMatch} (${title.substring(0, 50)}...)`,
                date: `${yearMatch}年 (詳細は公式サイトで確認)`,
                sortDate: `${yearMatch}-01-01`,
                category: target.category, type: target.type || '海外学会',
                region: '海外', location: '', organizer: target.name,
                description: '海外学会のイベント候補です。正確な開催日程・場所は公式サイトをご確認ください。',
                url: target.url, source: 'auto'
            });
        }
    }
    return events.slice(0, 3);
}

// ===== 地域推定 =====
function guessRegion(text) {
    const regionMap = {
        '北海道': '北海道・東北', '札幌': '北海道・東北', '仙台': '北海道・東北',
        '東京': '関東', '横浜': '関東', '千葉': '関東', '埼玉': '関東', '丸の内': '関東',
        '名古屋': '中部', '静岡': '中部', '新潟': '中部',
        '大阪': '関西', '京都': '関西', '神戸': '関西',
        '広島': '中国・四国', '岡山': '中国・四国',
        '福岡': '九州・沖縄', '沖縄': '九州・沖縄', '琉球': '九州・沖縄',
        'オンライン': 'オンライン', 'WEB': 'オンライン', 'Zoom': 'オンライン'
    };
    for (const [keyword, region] of Object.entries(regionMap)) {
        if (text.includes(keyword)) return region;
    }
    return '関東';
}

// パーサー選択
function getParser(parserType) {
    switch (parserType) {
        case 'jsaps': return parseJSAPS;
        case 'domestic': return parseDomestic;
        case 'kenkyuukai': return parseKenkyuukai;
        case 'international': return parseInternational;
        default: return parseDomestic;
    }
}

// ===== メイン処理 =====
async function main() {
    log('=== クロール開始 (Playwright) ===');
    const config = loadConfig();
    log(`設定: 国内KW=${config.searchKeywords.domestic.length}件, 海外KW=${config.searchKeywords.international.length}件, 勉強会KW=${config.searchKeywords.study.length}件`);

    const data = loadData();
    const allExisting = [...data.official, ...data.approved];
    let newCount = 0;
    let nextId = Math.max(...allExisting.map(e => e.id || 0), 0) + 100;

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 BeautyPortalCrawler/2.0',
        locale: 'ja-JP'
    });

    for (const target of CRAWL_TARGETS) {
        log(`クロール中: ${target.name} (${target.url})`);
        const page = await context.newPage();

        const html = await fetchPageContent(page, target.url);
        if (!html) {
            log(`  スキップ: ページ取得失敗`);
            await page.close();
            continue;
        }

        try {
            const parser = getParser(target.parserType);
            const events = await parser(page, target, config);
            log(`  ${events.length} 件のイベント候補を検出`);

            for (const event of events) {
                if (!event.date || !event.title) continue;
                if (event.sortDate && event.sortDate < `${config.minYear}-01-01`) continue;
                if (isDuplicate(allExisting, event)) {
                    log(`  重複スキップ: ${event.title}`);
                    continue;
                }
                if (!event.region) {
                    event.region = guessRegion(event.title + event.location);
                }
                event.id = nextId++;
                data.official.push(event);
                allExisting.push(event);
                newCount++;
                log(`  ✅ 新規追加: ${event.title}`);
            }
        } catch (e) {
            log(`  パースエラー: ${e.message}`);
        }

        await page.close();
    }

    await browser.close();

    // sortDateでソート
    data.official.sort((a, b) => {
        const dateA = a.sortDate || '9999-12-31';
        const dateB = b.sortDate || '9999-12-31';
        return dateA.localeCompare(dateB);
    });

    saveData(data);

    log(`=== クロール完了: ${newCount} 件の新規イベントを追加 ===`);
    log(`  公式イベント合計: ${data.official.length} 件`);
    log(`  承認待ち: ${data.pending.length} 件`);
    log(`  承認済み: ${data.approved.length} 件`);
    log('');
}

main().catch(e => {
    log(`致命的エラー: ${e.message}`);
    process.exit(1);
});
