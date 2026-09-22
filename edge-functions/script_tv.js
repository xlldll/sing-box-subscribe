/**
 * ============================================================================
 * Mihomo 配置覆寫腳本（Bettbox 全量版）
 * ============================================================================
 *
 * 原作者：AIsouler
 * 原倉庫：https://github.com/AIsouler/MyClash
 * 原腳本：
 * https://raw.githubusercontent.com/AIsouler/MyClash/main/Script/mihomoScript.js
 *
 * Bettbox：
 * https://github.com/appshubcc/Bettbox
 *
 * 主要自訂：
 * 1. 僅保留 VLESS / AnyTLS 節點
 * 2. 過濾流量、到期、公告等資訊節點
 * 3. 增加「周邊地區」聚合組
 * 4. 周邊地區包含港澳台、韓國及東南亞，不包含日本
 * 5. 保留獨立香港、日本、美國、新加坡、台灣地區組
 * 6. 支援低倍率 / 高倍率節點分組
 * 7. 使用 Fake-IP + 國內外 DNS 分流
 * 8. 啟用 TUN、IPv4 / IPv6 雙棧
 *
 * 周邊地區範圍：
 * 香港、澳門、台灣、韓國、新加坡、馬來西亞、泰國、越南、
 * 菲律賓、印度尼西亞、汶萊、柬埔寨、寮國、緬甸。
 *
 * 日本刻意不納入「周邊地區」，繼續作為獨立地區組。
 * ============================================================================
 */

/* ============================================================================
 * 01. 分流功能開關
 * ============================================================================
 *
 * true  = 啟用對應服務策略組
 * false = 不生成對應服務策略組及 Rule Provider
 */

const ruleOptionsEnable = {
    AI: true, // 國外 AI 服務
    Media: false, // 國外影音平台
    FCM: false, // Google FCM
    Google: false, // Google
    Microsoft: false, // Microsoft
    Apple: false, // Apple
    Telegram: false, // Telegram
    Steam: false, // Steam
    TikTok: true, // TikTok
    Twitter: false, // Twitter / X
    Emby: true, // Emby
    PikPak: false, // PikPak
    Spotify: false, // Spotify
    AdBlock: true, // 廣告攔截
};

/* ============================================================================
 * 02. 節點過濾設定
 * ============================================================================
 */

/**
 * 是否在全域直接排除高倍率節點。
 *
 * false：
 *   高倍率節點仍然存在，只額外進入「高倍率節點」策略組。
 *
 * true：
 *   高倍率節點會在最初過濾階段直接移除。
 */
const excludeHighRateProxiesEnable = false;

/**
 * 排除機場資訊節點。
 *
 * 很多機場會把：
 * - 剩餘流量
 * - 套餐到期
 * - 重置日期
 * - 官網 / 客服 / 通知
 *
 * 偽裝成正常代理節點，因此在進行地區分類之前先清除。
 */
const excludeFilter =
    /群|返利|循环|官网|客服|网站|网址|获取|订阅|流量|到期|机场|下次|版本|官址|备用|过期|已用|联系|邮箱|工单|贩卖|通知|倒卖|防止|国内|地址|频道|无法|说明|使用|提示|访问|支持|教程|关注|更新|作者|加入|超时|收藏|福利|邀请|好友|失联|选择|剩余|公益|发布|DIZTNA|通路|登录|禁止|定时|渠道|牢记|永久|余额|阁下|本站|刷新|导航|建议|重置|以下|⚠️|@|Expire|http|com/u;

/* ============================================================================
 * 03. 基礎 Rules
 * ============================================================================
 */

const rules = [
    // 禁用國外 QUIC（UDP/443），避免部分應用繞過既定 TCP 路徑
    "AND,((NETWORK,UDP),(DST-PORT,443),(NOT,((OR,((RULE-SET,cn_additional),(RULE-SET,cn_ip,no-resolve)))))),REJECT",

    // 私有網路直連
    "RULE-SET,private,直连",
    "RULE-SET,private_ip,直连,no-resolve",

    // 中國大陸服務直連
    "RULE-SET,games_cn,直连",
    "RULE-SET,epicgames,直连",
    "RULE-SET,nvidia_cn,直连",
    "RULE-SET,apple_cn,直连",
    "RULE-SET,microsoft_cn,直连",

    // 個別直連域名
    "DOMAIN,fsend.cn,直连",
    "DOMAIN,international-gfe.download.nvidia.com,直连",
];

/* ============================================================================
 * 04. 地區與倍率節點定義
 * ============================================================================
 *
 * 同一節點可以同時屬於多個組。
 *
 * 例如：
 * 香港節點
 *   → 香港
 *   → 周邊地區
 *   → 低倍率節點（若名稱同時符合倍率規則）
 *
 * 「周邊地區」用途：
 * 將深圳使用中國移動 / 中國電信時較有實際意義的鄰近海外節點
 * 放入同一個 url-test 候選池。
 *
 * 注意：
 * 日本不屬於「周邊地區」，由「日本」獨立管理。
 */

const regionDefinitions = [
    /* ---------- 香港 ---------- */

    {
        name: "香港",
        regex: /🇭🇰|港|HK|[Hh]ong\s*[Kk]ong/,
        icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Hong_Kong.png",
    },

    /* ---------- 周邊地區 ---------- */

    {
        name: "周邊地區",

        /**
         * 包含：
         *
         * 港澳台
         *   香港、澳門、台灣
         *
         * 東亞
         *   韓國
         *
         * 東南亞
         *   新加坡、馬來西亞、泰國、越南、菲律賓、
         *   印度尼西亞、汶萊、柬埔寨、寮國、緬甸
         *
         * 明確不包含：
         *   日本
         */
        regex:
            /🇭🇰|香港|(?<![A-Za-z])HK(?![A-Za-z])|Hong\s*Kong|🇲🇴|澳門|澳门|(?<![A-Za-z])MO(?![A-Za-z])|Macao|Macau|🇹🇼|台灣|台湾|台北|高雄|(?<![A-Za-z])TW(?![A-Za-z])|Taiwan|🇰🇷|韓國|韩国|首爾|首尔|(?<![A-Za-z])KR(?![A-Za-z])|Korea|Seoul|🇸🇬|新加坡|獅城|狮城|(?<![A-Za-z])SG(?![A-Za-z])|Singapore|🇲🇾|馬來西亞|马来西亚|大馬|大马|(?<![A-Za-z])MY(?![A-Za-z])|Malaysia|🇹🇭|泰國|泰国|曼谷|(?<![A-Za-z])TH(?![A-Za-z])|Thailand|Bangkok|🇻🇳|越南|(?<![A-Za-z])VN(?![A-Za-z])|Vietnam|🇵🇭|菲律賓|菲律宾|馬尼拉|马尼拉|(?<![A-Za-z])PH(?![A-Za-z])|Philippines|Manila|🇮🇩|印度尼西亞|印度尼西亚|印尼|雅加達|雅加达|(?<![A-Za-z])ID(?![A-Za-z])|Indonesia|Jakarta|🇧🇳|汶萊|文莱|(?<![A-Za-z])BN(?![A-Za-z])|Brunei|🇰🇭|柬埔寨|(?<![A-Za-z])KH(?![A-Za-z])|Cambodia|🇱🇦|寮國|寮国|老撾|老挝|(?<![A-Za-z])LA(?![A-Za-z])|Laos|🇲🇲|緬甸|缅甸|(?<![A-Za-z])MM(?![A-Za-z])|Myanmar|Burma/i,

        icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Macao.png",
    },

    /* ---------- 日本（不進入周邊地區） ---------- */

    {
        name: "日本",
        regex: /🇯🇵|日本|JP|[Jj]apan/,
        icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Japan.png",
    },

    /* ---------- 美國 ---------- */

    {
        name: "美国",
        regex: /🇺🇸|美|US|[Aa]merica|[Uu]nited\s*[Ss]tates/,
        icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/United_States.png",
    },

    /* ---------- 新加坡 ---------- */

    {
        name: "新加坡",
        regex: /🇸🇬|新加坡|狮城|SG|[Ss]ingapore/,
        icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Singapore.png",
    },

    /* ---------- 台灣 ---------- */

    {
        name: "台湾省",
        regex: /🇹🇼|台湾|TW|[Tt]aiwan/,
        icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Taiwan.png",
    },

    /* ---------- 低倍率節點 ---------- */

    {
        name: "低倍率节点",
        regex: /^(?!.*(?:剩|期|客户端|软件)).*(?:(?<!\d)0\.[0-5]|下载|低倍)/,
        icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Available_1.png",
    },

    /* ---------- 高倍率節點 ---------- */

    {
        name: "高倍率节点",
        regex:
            /(?:[*×xX✕✖⨉]\s*(?:[2-9]\d*|[1-9]\d+)(?:\.\d+)?)|(?:(?<![\d.])(?:[2-9]\d*|[1-9]\d+)(?:\.\d+)?\s*(?:倍|[*×xX✕✖⨉]))/u,
        icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Airport.png",
    },
];

/* ============================================================================
 * 05. Rule Provider 公共模板
 * ============================================================================
 */

const ruleProviderCommonDomain = {
    type: "http",
    format: "mrs",
    interval: 86400,
    behavior: "domain",
};

const ruleProviderCommonIpcidr = {
    type: "http",
    format: "mrs",
    interval: 86400,
    behavior: "ipcidr",
};

/* ============================================================================
 * 06. 基礎 Rule Providers
 * ============================================================================
 */

const baseRuleProviders = {
    /* ---------- 直連規則 ---------- */

    private: {
        ...ruleProviderCommonDomain,
        url: "https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/private.mrs",
        path: "./ruleset/private.mrs",
        "path-in-bundle": "geo/geosite/private.mrs",
    },

    private_ip: {
        ...ruleProviderCommonIpcidr,
        url: "https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geoip/private.mrs",
        path: "./ruleset/private_ip.mrs",
        "path-in-bundle": "geo/geoip/private.mrs",
    },

    games_cn: {
        ...ruleProviderCommonDomain,
        url: "https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/category-games@cn.mrs",
        path: "./ruleset/category-games@cn.mrs",
        "path-in-bundle": "geo/geosite/category-games@cn.mrs",
    },

    epicgames: {
        ...ruleProviderCommonDomain,
        url: "https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/epicgames.mrs",
        path: "./ruleset/epicgames.mrs",
        "path-in-bundle": "geo/geosite/epicgames.mrs",
    },

    nvidia_cn: {
        ...ruleProviderCommonDomain,
        url: "https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/nvidia@cn.mrs",
        path: "./ruleset/nvidia_cn.mrs",
        "path-in-bundle": "geo/geosite/nvidia@cn.mrs",
    },

    apple_cn: {
        ...ruleProviderCommonDomain,
        url: "https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/apple@cn.mrs",
        path: "./ruleset/apple_cn.mrs",
        "path-in-bundle": "geo/geosite/apple@cn.mrs",
    },

    microsoft_cn: {
        ...ruleProviderCommonDomain,
        url: "https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/microsoft@cn.mrs",
        path: "./ruleset/microsoft_cn.mrs",
        "path-in-bundle": "geo/geosite/microsoft@cn.mrs",
    },

    cn_additional: {
        ...ruleProviderCommonDomain,
        url: "https://static-file-global.353355.xyz/rules/cn-additional-list.mrs",
        path: "./ruleset/cn-additional-list.mrs",
        "path-in-bundle": "geo/geosite/cn.mrs",
    },

    cn_ip: {
        ...ruleProviderCommonIpcidr,
        url: "https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geoip/cn.mrs",
        path: "./ruleset/cn_ip.mrs",
        "path-in-bundle": "geo/geoip/cn.mrs",
    },

    /* ---------- 代理規則 ---------- */

    github: {
        ...ruleProviderCommonDomain,
        url: "https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/github.mrs",
        path: "./ruleset/github.mrs",
        "path-in-bundle": "geo/geosite/github.mrs",
    },

    gfw: {
        ...ruleProviderCommonDomain,
        url: "https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/gfw.mrs",
        path: "./ruleset/gfw.mrs",
        "path-in-bundle": "geo/geosite/gfw.mrs",
    },

    /* ---------- DNS / Fake-IP 輔助規則 ---------- */

    fakeip_filter: {
        ...ruleProviderCommonDomain,
        url: "https://fastly.jsdelivr.net/gh/wwqgtxx/clash-rules@release/fakeip-filter.mrs",
        path: "./ruleset/fakeip-filter.mrs",
        "path-in-bundle": "geo/geosite/private.mrs",
    },

    cn: {
        ...ruleProviderCommonDomain,
        url: "https://fastly.jsdelivr.net/gh/wwqgtxx/clash-rules@release/direct.mrs",
        path: "./ruleset/cn.mrs",
        "path-in-bundle": "geo/geosite/cn.mrs",
    },
};

/* ============================================================================
 * 07. Proxy Group 公共配置
 * ============================================================================
 */

const groupBaseOption = {
    interval: 600,
    timeout: 3000,
    url: "https://g.cn/generate_204",
    lazy: true,
    "max-failed-times": 3,
    "empty-fallback": "REJECT",
};

/**
 * 手動選擇策略組
 */
const selectBaseOption = {
    ...groupBaseOption,
    type: "select",
    hidden: false,
};

/**
 * 自動延遲測試策略組
 *
 * tolerance: 50
 * 表示節點延遲差異很小時不頻繁切換，
 * 避免因數十毫秒波動造成節點抖動。
 */
const urlTestBaseOption = {
    ...groupBaseOption,
    type: "url-test",
    tolerance: 50,
    "exclude-type": "DIRECT",
    icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Auto.png",
    hidden: true,
};

/**
 * 負載均衡策略組
 */
const loadBalanceBaseOption = {
    ...groupBaseOption,
    type: "load-balance",
    strategy: "sticky-sessions",
    "exclude-type": "DIRECT",
    icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Round_Robin.png",
    hidden: true,
};

/* ============================================================================
 * 08. 應用 / 服務分流定義
 * ============================================================================
 *
 * 此區域只描述：
 *
 * Service
 *   → 使用哪些 Rule Provider
 *   → 對應哪些 Rules
 *   → 預設選擇哪個策略組
 *
 * 是否真正啟用，由最前面的 ruleOptionsEnable 控制。
 */

const serviceConfigs = [
    /* ---------- AI ---------- */

    {
        name: "AI",
        defaultSelected: "美国",

        providers: {
            ai: {
                ...ruleProviderCommonDomain,
                url: "https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/category-ai-!cn.mrs",
                path: "./ruleset/ai.mrs",
                "path-in-bundle": "geo/geosite/category-ai-!cn.mrs",
            },
        },

        icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/ChatGPT.png",

        rules: ["RULE-SET,ai,AI"],
    },

    /* ---------- Media ---------- */

    {
        name: "Media",
        defaultSelected: "美国",

        providers: {
            youtube: {
                ...ruleProviderCommonDomain,
                url: "https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/youtube.mrs",
                path: "./ruleset/youtube.mrs",
                "path-in-bundle": "geo/geosite/youtube.mrs",
            },

            instagram: {
                ...ruleProviderCommonDomain,
                url: "https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/instagram.mrs",
                path: "./ruleset/instagram.mrs",
                "path-in-bundle": "geo/geosite/instagram.mrs",
            },

            netflix: {
                ...ruleProviderCommonDomain,
                url: "https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/netflix.mrs",
                path: "./ruleset/netflix.mrs",
                "path-in-bundle": "geo/geosite/netflix.mrs",
            },

            netflix_ip: {
                ...ruleProviderCommonIpcidr,
                url: "https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geoip/netflix.mrs",
                path: "./ruleset/netflix_ip.mrs",
                "path-in-bundle": "geo/geoip/netflix.mrs",
            },

            hbo: {
                ...ruleProviderCommonDomain,
                url: "https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/hbo.mrs",
                path: "./ruleset/hbo.mrs",
                "path-in-bundle": "geo/geosite/hbo.mrs",
            },

            twitch: {
                ...ruleProviderCommonDomain,
                url: "https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/twitch.mrs",
                path: "./ruleset/twitch.mrs",
                "path-in-bundle": "geo/geosite/twitch.mrs",
            },

            disney: {
                ...ruleProviderCommonDomain,
                url: "https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/disney.mrs",
                path: "./ruleset/disney.mrs",
                "path-in-bundle": "geo/geosite/disney.mrs",
            },

            niconico: {
                ...ruleProviderCommonDomain,
                url: "https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/niconico.mrs",
                path: "./ruleset/niconico.mrs",
                "path-in-bundle": "geo/geosite/niconico.mrs",
            },

            bbc: {
                ...ruleProviderCommonDomain,
                url: "https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/bbc.mrs",
                path: "./ruleset/bbc.mrs",
                "path-in-bundle": "geo/geosite/bbc.mrs",
            },

            pornhub: {
                ...ruleProviderCommonDomain,
                url: "https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/pornhub.mrs",
                path: "./ruleset/pornhub.mrs",
                "path-in-bundle": "geo/geosite/pornhub.mrs",
            },
        },

        icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/ForeignMedia.png",

        rules: [
            "RULE-SET,youtube,Media",
            "RULE-SET,instagram,Media",
            "RULE-SET,netflix,Media",
            "RULE-SET,netflix_ip,Media,no-resolve",
            "RULE-SET,hbo,Media",
            "RULE-SET,twitch,Media",
            "RULE-SET,disney,Media",
            "RULE-SET,niconico,Media",
            "RULE-SET,bbc,Media",
            "RULE-SET,pornhub,Media",
        ],
    },

    /* ---------- FCM ---------- */

    {
        name: "FCM",
        direct: true,
        defaultSelected: "直连",

        providers: {
            googlefcm: {
                ...ruleProviderCommonDomain,
                url: "https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/googlefcm.mrs",
                path: "./ruleset/googlefcm.mrs",
                "path-in-bundle": "geo/geosite/googlefcm.mrs",
            },
        },

        icon: "https://fastly.jsdelivr.net/gh/MiToverG422/Qure@master/IconSet/Color/fcm.png",

        rules: ["RULE-SET,googlefcm,FCM"],
    },

    /* ---------- Google ---------- */

    {
        name: "Google",

        providers: {
            google: {
                ...ruleProviderCommonDomain,
                url: "https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/google.mrs",
                path: "./ruleset/google.mrs",
                "path-in-bundle": "geo/geosite/google.mrs",
            },

            google_ip: {
                ...ruleProviderCommonIpcidr,
                url: "https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geoip/google.mrs",
                path: "./ruleset/google_ip.mrs",
                "path-in-bundle": "geo/geoip/google.mrs",
            },
        },

        icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Google_Search.png",

        rules: ["RULE-SET,google,Google", "RULE-SET,google_ip,Google,no-resolve"],
    },

    /* ---------- Microsoft ---------- */

    {
        name: "Microsoft",
        direct: true,

        providers: {
            microsoft: {
                ...ruleProviderCommonDomain,
                url: "https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/microsoft.mrs",
                path: "./ruleset/microsoft.mrs",
                "path-in-bundle": "geo/geosite/microsoft.mrs",
            },
        },

        icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Microsoft.png",

        rules: ["RULE-SET,microsoft,Microsoft"],
    },

    /* ---------- Apple ---------- */

    {
        name: "Apple",
        direct: true,

        providers: {
            apple: {
                ...ruleProviderCommonDomain,
                url: "https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/apple.mrs",
                path: "./ruleset/apple.mrs",
                "path-in-bundle": "geo/geosite/apple.mrs",
            },
        },

        icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Apple.png",

        rules: ["RULE-SET,apple,Apple"],
    },

    /* ---------- Telegram ---------- */

    {
        name: "Telegram",

        providers: {
            telegram: {
                ...ruleProviderCommonDomain,
                url: "https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/telegram.mrs",
                path: "./ruleset/telegram.mrs",
                "path-in-bundle": "geo/geosite/telegram.mrs",
            },

            telegram_ip: {
                ...ruleProviderCommonIpcidr,
                url: "https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geoip/telegram.mrs",
                path: "./ruleset/telegram_ip.mrs",
                "path-in-bundle": "geo/geoip/telegram.mrs",
            },
        },

        icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Telegram.png",

        rules: [
            "RULE-SET,telegram,Telegram",
            "RULE-SET,telegram_ip,Telegram,no-resolve",
        ],
    },

    /* ---------- Steam ---------- */

    {
        name: "Steam",
        direct: true,

        providers: {
            steam: {
                ...ruleProviderCommonDomain,
                url: "https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/steam.mrs",
                path: "./ruleset/steam.mrs",
                "path-in-bundle": "geo/geosite/steam.mrs",
            },
        },

        icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Steam.png",

        rules: ["RULE-SET,steam,Steam"],
    },

    /* ---------- TikTok ---------- */

    {
        name: "TikTok",
        defaultSelected: "美国",

        providers: {
            tiktok: {
                ...ruleProviderCommonDomain,
                url: "https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/tiktok.mrs",
                path: "./ruleset/tiktok.mrs",
                "path-in-bundle": "geo/geosite/tiktok.mrs",
            },
        },

        icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/TikTok.png",

        rules: ["RULE-SET,tiktok,TikTok"],
    },

    /* ---------- Twitter / X ---------- */

    {
        name: "Twitter",

        providers: {
            twitter: {
                ...ruleProviderCommonDomain,
                url: "https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/twitter.mrs",
                path: "./ruleset/twitter.mrs",
                "path-in-bundle": "geo/geosite/twitter.mrs",
            },

            twitter_ip: {
                ...ruleProviderCommonIpcidr,
                url: "https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geoip/twitter.mrs",
                path: "./ruleset/twitter_ip.mrs",
                "path-in-bundle": "geo/geoip/twitter.mrs",
            },
        },

        icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Twitter.png",

        rules: [
            "RULE-SET,twitter,Twitter",
            "RULE-SET,twitter_ip,Twitter,no-resolve",
        ],
    },

    /* ---------- Emby ---------- */

    {
        name: "Emby",
        direct: true,

        providers: {
            emby: {
                ...ruleProviderCommonDomain,
                url: "https://fastly.jsdelivr.net/gh/666OS/rules@release/mihomo/domain/Emby.mrs",
                path: "./ruleset/emby.mrs",
                "path-in-bundle": "geo/geosite/category-emby.mrs",
            },
        },

        icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Emby.png",

        rules: [
            "RULE-SET,emby,Emby",
            "DOMAIN-SUFFIX,mb3admin.com,Emby",
            "DOMAIN-KEYWORD,emby,Emby",
        ],
    },

    /* ---------- PikPak ---------- */

    {
        name: "PikPak",
        direct: true,

        providers: {
            pikpak: {
                ...ruleProviderCommonDomain,
                url: "https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/pikpak.mrs",
                path: "./ruleset/pikpak.mrs",
                "path-in-bundle": "geo/geosite/pikpak.mrs",
            },
        },

        icon: "https://fastly.jsdelivr.net/gh/lige47/QuanX-icon-rule@main/icon/03CNSoft/pikpak.png",

        rules: ["RULE-SET,pikpak,PikPak"],
    },

    /* ---------- Spotify ---------- */

    {
        name: "Spotify",
        direct: true,

        providers: {
            spotify: {
                ...ruleProviderCommonDomain,
                url: "https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/spotify.mrs",
                path: "./ruleset/spotify.mrs",
                "path-in-bundle": "geo/geosite/spotify.mrs",
            },
        },

        icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Spotify.png",

        rules: ["RULE-SET,spotify,Spotify"],
    },

    /* ---------- AdBlock ---------- */

    {
        name: "AdBlock",
        reject: true,

        providers: {
            adblockmihomolite: {
                ...ruleProviderCommonDomain,
                url: "https://fastly.jsdelivr.net/gh/217heidai/adblockfilters@main/rules/adblockmihomolite.mrs",
                path: "./ruleset/adblockmihomolite.mrs",
                "path-in-bundle": "geo/geosite/category-ads-all.mrs",
            },
        },

        icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Advertising.png",

        rules: ["RULE-SET,adblockmihomolite,AdBlock"],
    },
];

/* ============================================================================
 * 09. 地區策略組生成器
 * ============================================================================
 *
 * 每個地區自動生成兩個策略組：
 *
 * 地區-自动选择
 *   → url-test
 *   → 自動測試該地區所有節點
 *
 * 地區
 *   → select
 *   → 可以選「自动选择」或直接手動指定節點
 *
 * 例如：
 *
 * 周邊地區
 *   ├─ 周邊地區-自动选择
 *   ├─ 香港節點
 *   ├─ 台灣節點
 *   ├─ 韓國節點
 *   └─ 東南亞節點
 */

function createRegionGroup(name, icon, proxies) {
    const urlTestName = `${name}-自动选择`;

    return [
        {
            ...urlTestBaseOption,
            name: urlTestName,
            proxies,
        },

        {
            ...selectBaseOption,
            name,
            icon,
            proxies: [urlTestName, ...proxies],
        },
    ];
}

/* ============================================================================
 * 10. DNS / Hosts 域名匹配工具
 * ============================================================================
 *
 * 用於判斷原訂閱中的：
 *
 * nameserver-policy
 * proxy-server-nameserver-policy
 * hosts
 *
 * 是否與實際代理節點 server 域名有關。
 *
 * 支援：
 * example.com
 * +.example.com
 * .example.com
 * *.example.com
 * example.*.com
 */

function matchDomainPattern(pattern, domains) {
    pattern = pattern.toLowerCase();

    /* ---------- 精確匹配 ---------- */

    if (
        !pattern.includes("*") &&
        !pattern.startsWith("+.") &&
        !pattern.startsWith(".")
    ) {
        return domains.has(pattern);
    }

    /* ---------- +.example.com ---------- */

    if (pattern.startsWith("+.")) {
        const suffix = pattern.slice(2);

        for (const domain of domains) {
            if (domain === suffix || domain.endsWith(`.${suffix}`)) {
                return true;
            }
        }

        return false;
    }

    /* ---------- .example.com ---------- */

    if (pattern.startsWith(".")) {
        const suffix = pattern.slice(1);

        for (const domain of domains) {
            if (domain !== suffix && domain.endsWith(`.${suffix}`)) {
                return true;
            }
        }

        return false;
    }

    /* ---------- 通配符匹配 ---------- */

    const patternParts = pattern.split(".");

    for (const domain of domains) {
        const domainParts = domain.split(".");

        // 標籤數量必須一致
        if (patternParts.length !== domainParts.length) {
            continue;
        }

        let matched = true;

        for (let i = 0; i < patternParts.length; i++) {
            if (patternParts[i] !== "*" && patternParts[i] !== domainParts[i]) {
                matched = false;
                break;
            }
        }

        if (matched) {
            return true;
        }
    }

    return false;
}

/* ============================================================================
 * 11. 主入口
 * ============================================================================
 */

function main(config) {
    /*
     * 不直接修改 Bettbox 傳入的 config，
     * 而是重新建立最終 Mihomo 配置。
     */
    const newConfig = {};

    /* ========================================================================
     * 11.1 高倍率節點排除條件
     * ========================================================================
     */

    const highRateRegex = excludeHighRateProxiesEnable
        ? regionDefinitions.find((region) => region.name === "高倍率节点")?.regex
        : null;

    /* ========================================================================
     * 11.2 節點清洗
     * ========================================================================
     *
     * 只接受：
     * VLESS
     * AnyTLS
     *
     * 同時排除：
     * 資訊節點
     * 高倍率節點（若開關啟用）
     */

    const filteredProxies = (config.proxies || []).filter(function (proxy) {
        let type = "";
        let name = "";

        if (proxy && proxy.type) {
            type = String(proxy.type).toLowerCase();
        }

        if (proxy && proxy.name) {
            name = String(proxy.name);
        }

        return (
            (type === "vless" || type === "anytls") &&
            !excludeFilter.test(name) &&
            !(highRateRegex && highRateRegex.test(name))
        );
    });

    /*
     * 沒有可用節點時立即停止，
     * 避免生成一份看似正常但實際完全不可用的配置。
     */
    if (!filteredProxies.length) {
        throw new Error(
            "配置文件中未找到符合要求的代理节点，仅允许：VLESS、AnyTLS",
        );
    }

    /* ========================================================================
     * 11.3 節點地區分類
     * ========================================================================
     */

    const regionGroups = Object.fromEntries(
        regionDefinitions.map((region) => [
            region.name,
            {
                ...region,
                proxies: [],
            },
        ]),
    );

    const otherProxies = [];

    /*
     * 一個節點允許同時進入多個策略組。
     *
     * 例如：
     * 新加坡 0.5x
     *
     * 可以同時進入：
     * 新加坡
     * 周邊地區
     * 低倍率节点
     */
    for (const proxy of filteredProxies) {
        let matched = false;

        for (const region of regionDefinitions) {
            if (region.regex.test(proxy.name)) {
                regionGroups[region.name].proxies.push(proxy.name);

                /*
                 * 倍率組只是附加分類，
                 * 不代表節點已完成「地區分類」。
                 */
                if (region.name !== "低倍率节点" && region.name !== "高倍率节点") {
                    matched = true;
                }
            }
        }

        /*
         * 沒有命中任何真正地區組的節點，
         * 統一放入「其他节点」。
         */
        if (!matched) {
            otherProxies.push(proxy.name);
        }
    }

    /* ========================================================================
     * 11.4 建立地區策略組
     * ========================================================================
     */

    const generatedRegionGroups = regionDefinitions
        .filter((region) => regionGroups[region.name].proxies.length > 0)
        .flatMap((region) =>
            createRegionGroup(
                region.name,
                region.icon,
                regionGroups[region.name].proxies,
            ),
        );

    /*
     * 建立其他節點組。
     */
    if (otherProxies.length > 0) {
        generatedRegionGroups.push(
            ...createRegionGroup(
                "其他节点",
                "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/World_Map.png",
                otherProxies,
            ),
        );
    }

    /* ========================================================================
     * 11.5 建立功能策略組
     * ========================================================================
     */

    const functionalGroups = [];

    const finalRules = [...rules];

    const finalRuleProviders = {
        ...baseRuleProviders,
    };

    /*
     * 只取得 select 類型的地區組。
     *
     * 不把隱藏的：
     * 香港-自动选择
     * 周邊地區-自动选择
     * ...
     *
     * 直接塞進上層功能組。
     */
    const groupNamesOfSelect = generatedRegionGroups
        .filter((group) => group.type === "select")
        .map((group) => group.name);

    /* ========================================================================
     * 11.6 基礎代理策略
     * ========================================================================
     */

    functionalGroups.push(
        /* ---------- 預設代理 ---------- */

        {
            ...selectBaseOption,
            name: "默认代理",

            proxies: [...groupNamesOfSelect, "手动选择", "自动选择", "负载均衡"],

            icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Proxy.png",
        },

        /* ---------- 手動選擇 ---------- */

        {
            ...selectBaseOption,
            name: "手动选择",

            "include-all": true,
            "exclude-type": "DIRECT",

            icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Rocket.png",
        },

        /* ---------- 全域自動選擇 ---------- */

        {
            ...urlTestBaseOption,
            name: "自动选择",

            "include-all": true,
        },

        /* ---------- 全域負載均衡 ---------- */

        {
            ...loadBalanceBaseOption,
            name: "负载均衡",

            "include-all": true,
        },
    );

    /* ========================================================================
     * 11.7 應用服務策略組
     * ========================================================================
     */

    for (const svc of serviceConfigs) {
        // 未啟用的服務完全跳過
        if (!ruleOptionsEnable[svc.name]) {
            continue;
        }

        /*
         * 加入服務對應的：
         * Rules
         * Rule Providers
         */
        finalRules.push(...svc.rules);

        Object.assign(finalRuleProviders, svc.providers || {});

        /*
         * AdBlock 類型只需要 REJECT。
         *
         * 一般服務則可以選：
         *
         * 默认代理
         * 手动选择
         * 自动选择
         * 负载均衡
         * 各地區組
         * 直连（若 direct = true）
         */
        const groupProxies = svc.reject
            ? ["REJECT", "REJECT-DROP", "PASS"]
            : [
                "默认代理",
                "手动选择",
                "自动选择",
                "负载均衡",
                ...groupNamesOfSelect,
                ...(svc.direct ? ["直连"] : []),
            ];

        functionalGroups.push({
            ...selectBaseOption,

            name: svc.name,
            icon: svc.icon,
            proxies: groupProxies,

            /*
             * 只有明確設定 defaultSelected 時
             * 才輸出 default-selected。
             */
            ...(svc.defaultSelected !== undefined && {
                "default-selected": svc.defaultSelected,
            }),
        });
    }

    /* ========================================================================
     * 11.8 兜底與直連策略
     * ========================================================================
     */

    functionalGroups.push(
        /* ---------- 漏網之魚 ---------- */

        {
            ...selectBaseOption,

            name: "漏网之鱼",

            proxies: ["默认代理", "直连"],

            icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Stack.png",
        },

        /* ---------- 中國直連 ---------- */

        {
            ...selectBaseOption,

            name: "直连",

            proxies: ["🇨🇳 直连 | 双栈", "🇨🇳 直连 | IPv4优先", "🇨🇳 直连 | IPv6优先"],

            url: "https://connectivitycheck.platform.hicloud.com/generate_204",

            icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/China_Map.png",
        },
    );

    /* ========================================================================
     * 11.9 GLOBAL 策略組
     * ========================================================================
     */

    const globalGroup = {
        ...selectBaseOption,

        name: "GLOBAL",

        proxies: [
            ...functionalGroups.map((group) => group.name),

            ...generatedRegionGroups.map((group) => group.name),
        ],

        icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Global.png",
    };

    /* ========================================================================
     * 12. DNS 配置
     * ========================================================================
     *
     * 設計：
     *
     * 中國域名
     *   → AliDNS / DNSPod
     *   → DIRECT
     *
     * 國外域名
     *   → Cloudflare / Google DoH
     *   → 默认代理
     *
     * 代理節點域名
     *   → 優先保留原機場提供的特殊 DNS Policy
     */

    /*
     * 保存原訂閱 DNS，
     * 用於提取機場可能依賴的私有 DNS。
     */
    const originalDnsConfig = config.dns || {};

    /*
     * 公共 DNS 不需要從原訂閱重複繼承。
     */
    const commonDnsRegex =
        /(223\.5\.5\.5|223\.6\.6\.6|119\.29\.29\.29|1\.12\.12\.12|120\.53\.53\.53|114\.114\.114\.114|180\.76\.76\.76|1\.1\.1\.1|1\.0\.0\.1|8\.8\.8\.8|8\.8\.4\.4|94\.140\.14\.14|94\.140\.15\.15|127\.0\.0\.1|alidns|doh\.pub|dot\.pub|dnspod|dns\.baidu|dns\.google|cloudflare|adguard|system)/i;

    const originalProxyServerNameserver = (
        originalDnsConfig["proxy-server-nameserver"] || []
    ).filter((dns) => !commonDnsRegex.test(String(dns)));

    /*
     * 收集所有代理節點 server 域名。
     */
    const proxyDomains = new Set(
        filteredProxies
            .filter((proxy) => typeof proxy.server === "string")
            .map((proxy) => proxy.server.toLowerCase()),
    );

    /*
     * 從原訂閱 DNS Policy 中，
     * 只保留與代理節點 server 有關的條目。
     */
    const originalPolicyNameserver = {};

    for (const policy of [
        originalDnsConfig["nameserver-policy"] || {},
        originalDnsConfig["proxy-server-nameserver-policy"] || {},
    ]) {
        for (const [domain, dns] of Object.entries(policy)) {
            if (matchDomainPattern(domain, proxyDomains)) {
                originalPolicyNameserver[domain] = dns;
            }
        }
    }

    /* ---------- 中國 DNS ---------- */

    const chinaDNS = [
        "https://dns.alidns.com/dns-query#DIRECT",
        "https://doh.pub/dns-query#DIRECT",
    ];

    /* ---------- 國外 DNS ---------- */

    const foreignDNS = [
        "https://dns.cloudflare.com/dns-query#默认代理",
        "https://dns.google/dns-query#默认代理",
    ];

    /* ---------- 最終 DNS ---------- */

    newConfig["dns"] = {
        enable: true,

        // DNS 允許返回 AAAA
        ipv6: true,

        "use-hosts": true,
        "use-system-hosts": true,

        "cache-algorithm": "arc",

        "enhanced-mode": "fake-ip",

        "fake-ip-range": "198.18.0.1/16",

        "fake-ip-filter": ["rule-set:private", "rule-set:fakeip_filter"],

        /*
         * 代理 server 域名解析。
         */
        "proxy-server-nameserver": [...chinaDNS, ...originalProxyServerNameserver],

        /*
         * 如果機場對自己的節點域名有特殊 DNS，
         * 則保留下來。
         */
        ...(Object.keys(originalPolicyNameserver).length > 0 && {
            "proxy-server-nameserver-policy": originalPolicyNameserver,
        }),

        /*
         * 用於解析 DoH server 自身域名。
         */
        "default-nameserver": ["223.5.5.5", "119.29.29.29"],

        /*
         * 國外域名預設 DNS。
         */
        nameserver: [...foreignDNS],

        /*
         * 中國域名指定使用中國 DNS。
         */
        "nameserver-policy": {
            "rule-set:cn": [...chinaDNS],
        },

        /*
         * DIRECT 流量 DNS。
         */
        "direct-nameserver": ["system", "223.5.5.5", "119.29.29.29"],
    };

    /* ========================================================================
     * 13. Hosts 配置
     * ========================================================================
     */

    /*
     * 從原訂閱 hosts 中，
     * 保留代理 server 所依賴的記錄。
     */
    const originalHosts = config.hosts || {};

    const proxyHosts = {};

    for (const [domain, value] of Object.entries(originalHosts)) {
        if (matchDomainPattern(domain, proxyDomains)) {
            proxyHosts[domain] = value;
        }
    }

    newConfig["hosts"] = {
        /* ---------- DoH Bootstrap ---------- */

        "dns.alidns.com": ["223.5.5.5", "223.6.6.6"],

        "doh.pub": ["1.12.12.12", "120.53.53.53"],

        "dns.cloudflare.com": ["1.1.1.1", "1.0.0.1"],

        "dns.google": ["8.8.8.8", "8.8.4.4"],

        /* ---------- Google Play 相容性 ---------- */

        "services.googleapis.cn": ["services.googleapis.com"],

        /* ---------- Bilibili PCDN ---------- */

        "+.mcdn.bilivideo.com": ["0.0.0.0"],

        "+.mcdn.bilivideo.cn": ["0.0.0.0"],

        "+.edge.mountaintoys.cn": ["0.0.0.0"],

        /* ---------- 機場原始 Hosts ---------- */

        ...proxyHosts,
    };

    /* ========================================================================
     * 14. Mihomo 全域配置
     * ========================================================================
     */

    // 允許 LAN
    newConfig["allow-lan"] = true;

    // 啟用 IPv6
    newConfig["ipv6"] = true;

    // Rule 模式
    newConfig["mode"] = "rule";

    // 日誌級別
    newConfig["log-level"] = "info";

    // LAN 綁定
    newConfig["bind-address"] = "*";

    // 統一延遲計算
    newConfig["unified-delay"] = true;

    // TCP 並發建立
    newConfig["tcp-concurrent"] = true;

    // TCP Keep Alive
    // newConfig['keep-alive-idle'] = 600;
    // newConfig['keep-alive-interval'] = 60;

    // Process Match
    newConfig["find-process-mode"] = "strict";

    /* ========================================================================
     * 15. Controller / Web UI
     * ========================================================================
     */

    newConfig["external-controller"] = "127.0.0.1:9090";

    newConfig["external-ui"] = "ui";

    newConfig["external-ui-url"] =
        "https://github.com/Zephyruso/zashboard/releases/latest/download/dist.zip";

    /* ========================================================================
     * 16. Profile
     * ========================================================================
     */

    newConfig["profile"] = {
        "store-selected": true,
        "store-fake-ip": true,
    };

    /* ========================================================================
     * 17. NTP
     * ========================================================================
     */

    newConfig["ntp"] = {
        enable: true,

        "write-to-system": false,

        server: "ntp.aliyun.com",

        port: 123,

        interval: 60,
    };

    /* ========================================================================
     * 18. TUN
     * ========================================================================
     *
     * Bettbox / Android TV 的核心透明代理入口。
     *
     * strict-route：
     * 盡量避免流量繞過 TUN。
     *
     * dns-hijack：
     * 將普通 53 端口 DNS 導入 Mihomo DNS。
     */

    newConfig["tun"] = {
        enable: true,

        stack: "system",

        "auto-route": true,

        "strict-route": true,

        "auto-redirect": false,

        "auto-detect-interface": true,

        "dns-hijack": ["any:53", "tcp://any:53"],
    };

    /* ========================================================================
     * 19. 最終代理節點
     * ========================================================================
     *
     * 原始訂閱：
     *   → 節點清洗
     *   → 僅保留 VLESS / AnyTLS
     *
     * 然後增加三個 DIRECT 出站：
     *
     * 雙棧
     * IPv4 優先
     * IPv6 優先
     */

    newConfig["proxies"] = [
        ...filteredProxies,

        /* ---------- DIRECT：雙棧 ---------- */

        {
            name: "🇨🇳 直连 | 双栈",
            type: "direct",
        },

        /* ---------- DIRECT：IPv4 優先 ---------- */

        {
            name: "🇨🇳 直连 | IPv4优先",
            type: "direct",
            "ip-version": "ipv4-prefer",
        },

        /* ---------- DIRECT：IPv6 優先 ---------- */

        {
            name: "🇨🇳 直连 | IPv6优先",
            type: "direct",
            "ip-version": "ipv6-prefer",
        },
    ];

    /* ========================================================================
     * 20. 最終 Proxy Groups
     * ========================================================================
     *
     * GLOBAL
     * 功能策略組
     * 地區策略組
     */

    newConfig["proxy-groups"] = [
        globalGroup,
        ...functionalGroups,
        ...generatedRegionGroups,
    ];

    /* ========================================================================
     * 21. 最終 Rule Providers
     * ========================================================================
     */

    newConfig["rule-providers"] = finalRuleProviders;

    /* ========================================================================
     * 22. 最終 Rules
     * ========================================================================
     *
     * 規則順序：
     *
     * GitHub
     *   ↓
     * 基礎規則
     *   ↓
     * 已啟用服務規則
     *   ↓
     * GFW
     *   ↓
     * 中國域名 / IP
     *   ↓
     * MATCH
     */

    newConfig["rules"] = [
        /* ---------- GitHub ---------- */

        "RULE-SET,github,默认代理",

        /* ---------- 基礎 + Service Rules ---------- */

        ...finalRules,

        /* ---------- GFW ---------- */

        "RULE-SET,gfw,默认代理",

        /* ---------- 中國直連 ---------- */

        "RULE-SET,cn_additional,直连",

        "RULE-SET,cn_ip,直连",

        /* ---------- 最終兜底 ---------- */

        "MATCH,漏网之鱼",
    ];

    /* ========================================================================
     * 23. 返回 Bettbox / Mihomo 最終配置
     * ========================================================================
     */

    return newConfig;
}
