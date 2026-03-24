/**
 * 美容医療 学会・勉強会ポータル – Webクローラー
 * 
 * 主要な美容医療学会サイトをスクレイピングし、
 * events-data.json の official 配列に新規イベントを追加する。
 * 
 * 使い方:
 *   npm install        (初回のみ)
 *   npm run crawl       (クロール実行)
 * 
 * タスクスケジューラで週1回自動実行も可能:
 *   powershell -File setup-scheduler.ps1
 */

const fetch = require('node-fetch');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

// ===== 設定 =====
const DATA_FILE = path.join(__dirname, 'events-data.json');
const LOG_FILE = path.join(__dirname, 'crawler-log.txt');

// クロール対象サイト
const CRAWL_TARGETS = [
    // --- 国内学会 ---
    {
        name: 'JSAPS（日本美容外科学会）',
        url: 'https://www.jsaps.com/',
        parser: parseJSAPS,
        category: '美容外科'
    },
    {
        name: 'JSAS（日本美容外科学会）',
        url: 'https://www.jsas.or.jp/',
        parser: parseGenericConference,
        category: '美容外科'
    },
    {
        name: '日本美容皮膚科学会',
        url: 'https://www.aesthet-derm.org/',
        parser: parseGenericConference,
        category: '美容皮膚科'
    },
    {
        name: '日本レーザー医学会 (JSLMS)',
        url: 'https://www.jslms.or.jp/',
        parser: parseGenericConference,
        category: '総合'
    },
    {
        name: '日本抗加齢医学会 (JSAAM)',
        url: 'https://www.anti-aging.gr.jp/',
        parser: parseGenericConference,
        category: '総合'
    },
    {
        name: '日本美容医療学会（JAPSA）',
        url: 'https://japsa.or.jp/',
        parser: parseGenericConference,
        category: '総合'
    },
    {
        name: 'kenkyuukai.jp（研究会情報）',
        url: 'https://www.kenkyuukai.jp/biyo/',
        parser: parseKenkyuukai,
        category: '総合'
    },
    // --- 海外・国際学会 ---
    { name: 'ISAPS', url: 'https://www.isaps.org/', parser: parseInternationalConference, category: '美容外科' },
    { name: 'IMCAS', url: 'https://www.imcas.com/', parser: parseInternationalConference, category: '総合' },
    { name: 'UIME', url: 'https://www.uime.org/', parser: parseInternationalConference, category: '総合' },
    { name: 'ASPS', url: 'https://www.plasticsurgery.org/', parser: parseInternationalConference, category: '美容外科' },
    { name: 'The Aesthetic Society', url: 'https://www.theaestheticsociety.org/', parser: parseInternationalConference, category: '美容外科' },
    { name: 'AAD', url: 'https://www.aad.org/', parser: parseInternationalConference, category: '美容皮膚科' },
    { name: 'OSAPS', url: 'http://www.osaps.org/', parser: parseInternationalConference, category: '美容外科' },
    { name: 'ESAPS', url: 'https://esaps.org/', parser: parseInternationalConference, category: '美容外科' },
    { name: 'ISHRS', url: 'https://ishrs.org/', parser: parseInternationalConference, category: '美容外科' },
    { name: 'ASLMS', url: 'https://www.aslms.org/', parser: parseInternationalConference, category: '総合' },
    { name: 'WOSAAM', url: 'https://wosaam.net/', parser: parseInternationalConference, category: '総合' },
    { name: 'A4M', url: 'https://www.a4m.com/', parser: parseInternationalConference, category: '総合' }
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
        // タイトルの類似度チェック（正規化して比較）
        const normalize = (str) => str.replace(/[\s　]/g, '').replace(/第(\d+)回/g, '$1').toLowerCase();
        const titleA = normalize(e.title);
        const titleB = normalize(newEvent.title);
        
        // 完全一致 or 80%以上の文字が含まれていれば重複とみなす
        if (titleA === titleB) return true;
        if (titleA.includes(titleB) || titleB.includes(titleA)) return true;
        
        return false;
    });
}

// ===== ページ取得 =====
async function fetchPage(url) {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) BeautyPortalCrawler/1.0',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'ja,en;q=0.9'
            },
            timeout: 15000
        });
        
        if (!response.ok) {
            log(`  HTTP ${response.status}: ${url}`);
            return null;
        }
        
        return await response.text();
    } catch (e) {
        log(`  フェッチエラー (${url}): ${e.message}`);
        return null;
    }
}

// ===== パーサー: JSAPS学術集会ページ =====
async function parseJSAPS(html, target) {
    const events = [];
    const $ = cheerio.load(html);
    
    // 学術集会の情報を探す
    $('h2, h3, h4, .meeting-title, .event-title, td, li').each((i, el) => {
        const text = $(el).text().trim();
        
        // 「第○○回」「学術集会」「総会」を含む要素を探す
        const meetingMatch = text.match(/(第\d+回[^。\n]*(?:学術集会|総会|大会))/);
        if (meetingMatch) {
            const title = meetingMatch[1].trim();
            
            // 周辺テキストから日付を探す
            const parent = $(el).parent().text();
            const dateMatch = parent.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
            
            if (dateMatch) {
                events.push({
                    title: title,
                    date: `${dateMatch[1]}年${dateMatch[2]}月${dateMatch[3]}日`,
                    sortDate: `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`,
                    category: target.category,
                    region: '関東', // デフォルト。後で修正可能
                    location: '',
                    organizer: target.name,
                    description: '',
                    url: target.url,
                    source: 'auto'
                });
            }
        }
    });
    
    return events;
}

// ===== パーサー: 汎用学会サイト =====
async function parseGenericConference(html, target) {
    const events = [];
    const $ = cheerio.load(html);
    
    // ページ内のテキストからイベント情報を抽出
    const bodyText = $('body').text();
    
    // 「第○○回」パターン
    const patterns = [
        /第(\d+)回[^。\n]{2,60}(?:学術集会|総会|大会|研究会|学術大会)/g,
        /(\d{4})年(\d{1,2})月(\d{1,2})日/g
    ];
    
    // 学会名を抽出
    const titleMatches = bodyText.matchAll(patterns[0]);
    for (const match of titleMatches) {
        const title = match[0].trim();
        
        // 近傍のテキストから日付を探す
        const nearbyText = bodyText.substring(
            Math.max(0, match.index - 200),
            Math.min(bodyText.length, match.index + 300)
        );
        
        const dateMatch = nearbyText.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
        
        if (dateMatch && parseInt(dateMatch[1]) >= 2026) {
            events.push({
                title: title,
                date: `${dateMatch[1]}年${dateMatch[2]}月${dateMatch[3]}日`,
                sortDate: `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`,
                category: target.category,
                region: '',
                location: '',
                organizer: target.name,
                description: '',
                url: target.url,
                source: 'auto'
            });
        }
    }
    
    return events;
}

// ===== パーサー: kenkyuukai.jp =====
async function parseKenkyuukai(html, target) {
    const events = [];
    const $ = cheerio.load(html);
    
    // 研究会リストをパース
    $('a[href*="kenkyuukai"]').each((i, el) => {
        const text = $(el).text().trim();
        const href = $(el).attr('href');
        
        if (text.length > 5 && (text.includes('学会') || text.includes('研究会') || text.includes('セミナー'))) {
            events.push({
                title: text,
                date: '',
                sortDate: '',
                category: target.category,
                region: '',
                location: '',
                organizer: '',
                description: '',
                url: href.startsWith('http') ? href : `https://www.kenkyuukai.jp${href}`,
                source: 'auto'
            });
        }
    });
    
    return events;
}

// ===== パーサー: 海外学会サイト =====
async function parseInternationalConference(html, target) {
    const events = [];
    const $ = cheerio.load(html);
    
    // 英語サイトの本文を結合してキーワード検索
    const bodyText = $('body').text().replace(/\s+/g, ' ');
    
    // "Congress", "Annual Meeting" 等と 2026以降の年が一緒に登場する箇所を探す
    const patterns = [
        /(?:International\s+)?(?:Congress|Annual\s+Meeting|Symposium|Conference|Forum)[^.]{0,120}?(202[6-9])/gi
    ];
    
    const titleMatches = bodyText.matchAll(patterns[0]);
    for (const match of titleMatches) {
        const title = match[0].trim();
        const yearMatch = match[1]; // e.g. 2026
        
        // 重複チェック
        if (!events.some(e => e.title.includes(title))) {
            events.push({
                title: `${target.name} ${yearMatch} (${title.substring(0, 50)}...)`,
                date: `${yearMatch}年 (詳細は公式サイトで確認)`,
                sortDate: `${yearMatch}-01-01`, // 仮の日付
                category: target.category,
                region: '海外',
                location: '',
                organizer: target.name,
                description: '海外学会のイベント候補です。正確な開催日程・場所は公式サイトをご確認ください。',
                url: target.url,
                source: 'auto'
            });
        }
    }
    
    // ノイズを減らすため最大3件まで
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
    return '関東'; // デフォルト
}

// ===== メイン処理 =====
async function main() {
    log('=== クロール開始 ===');
    
    const data = loadData();
    const allExisting = [...data.official, ...data.approved];
    let newCount = 0;
    let nextId = Math.max(...allExisting.map(e => e.id || 0), 0) + 100; // IDの衝突回避
    
    for (const target of CRAWL_TARGETS) {
        log(`クロール中: ${target.name} (${target.url})`);
        
        const html = await fetchPage(target.url);
        if (!html) {
            log(`  スキップ: ページ取得失敗`);
            continue;
        }
        
        try {
            const events = await target.parser(html, target);
            log(`  ${events.length} 件のイベント候補を検出`);
            
            for (const event of events) {
                // 日付がないものはスキップ
                if (!event.date || !event.title) continue;
                
                // 過去のイベントはスキップ（sortDateがある場合）
                if (event.sortDate && event.sortDate < '2026-03-01') continue;
                
                // 重複チェック
                if (isDuplicate(allExisting, event)) {
                    log(`  重複スキップ: ${event.title}`);
                    continue;
                }
                
                // 地域推定
                if (!event.region) {
                    event.region = guessRegion(event.title + event.location);
                }
                
                // ID付与
                event.id = nextId++;
                
                data.official.push(event);
                allExisting.push(event); // 以降の重複チェックにも使う
                newCount++;
                log(`  ✅ 新規追加: ${event.title}`);
            }
        } catch (e) {
            log(`  パースエラー: ${e.message}`);
        }
    }
    
    // official 配列を sortDate でソート
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
