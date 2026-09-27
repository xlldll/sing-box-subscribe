// Bettbox / Mihomo 配置生成腳本
// 重構版：保留原功能，集中配置、降低重複、避免鏈式循環，增加完整性檢查。
/* =========================
 * 1. 使用者設定
 * ========================= */
const SETTINGS = {
    enableServices: {
        AI: true,
        Facebook: true,
        GoogleAccount: true,
        MicrosoftAccount: true,
        AppleID: true,
        Twitter: true,
        Reddit: true,
        PayPal: true,
        Media: false,
        FCM: false,
        Google: false,
        Microsoft: false,
        Apple: false,
        Telegram: false,
        Steam: false,
        TikTok: false,
        Emby: false,
        PikPak: false,
        Spotify: false,
        AdBlock: false,
    },
    excludeHighRateProxies: false,
    healthCheck: {
        interval: 1800,
        timeout: 15000,
        url: "https://g.cn/generate_204",
        lazy: true,
        maxFailedTimes: 3,
        "empty-fallback": "REJECT",
    },
};
/* =========================
 * 2. 名稱常量
 * ========================= */
const GROUP = {
    DEFAULT: "默认代理",
    SENSITIVE: "敏感代理组",
    RESIDENTIAL: "家宽",
    RELAY: "链式前置",
    MANUAL: "手动选择",
    AUTO: "自动选择",
    BALANCE: "负载均衡",
    DIRECT: "直连",
    FALLBACK: "漏网之鱼",
    GLOBAL: "GLOBAL",
};
const DIRECT_PROXY = {
    DUAL: "🇨🇳 直连 | 双栈",
    IPV4: "🇨🇳 直连 | IPv4优先",
    IPV6: "🇨🇳 直连 | IPv6优先",
};
const BUILTIN_TARGETS = new Set(["DIRECT", "REJECT", "REJECT-DROP", "PASS"]);
const SUPPORTED_PROXY_TYPES = new Set(["vless", "anytls"]);
/* =========================
 * 3. 圖標
 * ========================= */
const QURE = "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color";
const ICON = {
    proxy: `${QURE}/Proxy.png`,
    auto: `${QURE}/Auto.png`,
    balance: `${QURE}/Round_Robin.png`,
    rocket: `${QURE}/Rocket.png`,
    residential: `${QURE}/Xbox.png`,
    world: `${QURE}/World_Map.png`,
    stack: `${QURE}/Stack.png`,
    china: `${QURE}/China_Map.png`,
    global: `${QURE}/Global.png`,
    taiwan: `${QURE}/Taiwan.png`,
    macao: `${QURE}/Macao.png`,
    hongkong: `${QURE}/Hong_Kong.png`,
    japan: `${QURE}/Japan.png`,
    usa: `${QURE}/United_States.png`,
    singapore: `${QURE}/Singapore.png`,
    airport: `${QURE}/Airport.png`,
    available: `${QURE}/Available_1.png`,
    chatgpt: `${QURE}/ChatGPT.png`,
    facebook: `${QURE}/Facebook.png`,
    google: `${QURE}/Google_Search.png`,
    microsoft: `${QURE}/Microsoft.png`,
    apple: `${QURE}/Apple.png`,
    media: `${QURE}/ForeignMedia.png`,
    telegram: `${QURE}/Telegram.png`,
    steam: `${QURE}/Steam.png`,
    tiktok: `${QURE}/TikTok.png`,
    twitter: `${QURE}/Twitter.png`,
    reddit: `${QURE}/Reddit.png`,
    paypal: `${QURE}/PayPal.png`,
    emby: `${QURE}/Emby.png`,
    spotify: `${QURE}/Spotify.png`,
    adblock: `${QURE}/Advertising.png`,
};
/* =========================
 * 4. 節點識別
 * ========================= */
const RESIDENTIAL_RE =
    /家宽|家寬|家庭宽带|家庭寬頻|住宅(?:IP|网络|網路|寬頻|宽带)?|原生住宅|住宅原生|residential|residential\s*ip|home\s*(?:ip|broadband)|isp\s*ip/i;
// 過濾公告、流量資訊等假節點。
// 不再單獨使用 com，避免誤傷 Telecom。
const INFO_NODE_RE =
    /群|返利|循环|官网|客服|网站|网址|获取|订阅|流量|到期|机场|下次|版本|官址|备用|过期|已用|联系|邮箱|工单|贩卖|通知|倒卖|防止|国内|地址|频道|无法|说明|使用|提示|访问|支持|教程|关注|更新|作者|加入|超时|收藏|福利|邀请|好友|失联|选择|剩余|公益|发布|DIZTNA|通路|登录|禁止|定时|渠道|牢记|永久|余额|阁下|本站|刷新|导航|建议|重置|以下|⚠️|@|Expire|https?:\/\/|(?:^|[\s./])com(?:$|[\s/])/iu;
// 支援：
//
// [C]
// C机场
// C機場
// C
//
const C_PROVIDER_RE = /(?:^|[^A-Za-z0-9])C(?:机场|機場)?(?:$|[^A-Za-z0-9])/i;
/* =========================
 * 5. 區域定義
 * ========================= */
const REGION_DEFINITIONS = [
    {
        name: "台湾",
        regex: /🇹🇼|台湾|台灣|台北|高雄|(?:^|[^A-Za-z])TW(?:$|[^A-Za-z])|Taiwan/i,
        icon: ICON.taiwan,
    },
    {
        name: "周邊地區",
        regex: /🇭🇰|香港|(?:^|[^A-Za-z])HK(?:$|[^A-Za-z])|Hong\s*Kong|🇲🇴|澳門|澳门|(?:^|[^A-Za-z])MO(?:$|[^A-Za-z])|Macao|Macau|🇹🇼|台灣|台湾|台北|高雄|(?:^|[^A-Za-z])TW(?:$|[^A-Za-z])|Taiwan|🇰🇷|韓國|韩国|首爾|首尔|(?:^|[^A-Za-z])KR(?:$|[^A-Za-z])|Korea|Seoul|🇸🇬|新加坡|獅城|狮城|(?:^|[^A-Za-z])SG(?:$|[^A-Za-z])|Singapore|🇲🇾|馬來西亞|马来西亚|大馬|大马|(?:^|[^A-Za-z])MY(?:$|[^A-Za-z])|Malaysia|🇹🇭|泰國|泰国|曼谷|(?:^|[^A-Za-z])TH(?:$|[^A-Za-z])|Thailand|Bangkok|🇻🇳|越南|(?:^|[^A-Za-z])VN(?:$|[^A-Za-z])|Vietnam|🇵🇭|菲律賓|菲律宾|馬尼拉|马尼拉|(?:^|[^A-Za-z])PH(?:$|[^A-Za-z])|Philippines|Manila|🇮🇩|印度尼西亞|印度尼西亚|印尼|雅加達|雅加达|(?:^|[^A-Za-z])ID(?:$|[^A-Za-z])|Indonesia|Jakarta|🇧🇳|汶萊|文莱|(?:^|[^A-Za-z])BN(?:$|[^A-Za-z])|Brunei|🇰🇭|柬埔寨|(?:^|[^A-Za-z])KH(?:$|[^A-Za-z])|Cambodia|🇱🇦|寮國|寮国|老撾|老挝|(?:^|[^A-Za-z])LA(?:$|[^A-Za-z])|Laos|🇲🇲|緬甸|缅甸|(?:^|[^A-Za-z])MM(?:$|[^A-Za-z])|Myanmar|Burma/i,
        icon: ICON.macao,
    },
    {
        name: "香港",
        regex: /🇭🇰|香港|港|(?:^|[^A-Za-z])HK(?:$|[^A-Za-z])|Hong\s*Kong/i,
        icon: ICON.hongkong,
    },
    {
        name: "日本",
        regex: /🇯🇵|日本|(?:^|[^A-Za-z])JP(?:$|[^A-Za-z])|Japan/i,
        icon: ICON.japan,
    },
    {
        name: "美国",
        regex: /🇺🇸|美国|美國|美|(?:^|[^A-Za-z])US(?:$|[^A-Za-z])|America|United\s*States/i,
        icon: ICON.usa,
    },
    {
        name: "新加坡",
        regex: /🇸🇬|新加坡|獅城|狮城|(?:^|[^A-Za-z])SG(?:$|[^A-Za-z])|Singapore/i,
        icon: ICON.singapore,
    },
    {
        name: "低倍率节点",
        regex: /^(?!.*(?:剩|期|客户端|软件)).*(?:(?<!\d)0\.[0-5]|下载|低倍)/,
        icon: ICON.available,
    },
    {
        name: "高倍率节点",
        regex: /(?:[*×xX✕✖⨉]\s*(?:[2-9]\d*|[1-9]\d+)(?:\.\d+)?)|(?:(?<![\d.])(?:[2-9]\d*|[1-9]\d+)(?:\.\d+)?\s*(?:倍|[*×xX✕✖⨉]))/u,
        icon: ICON.airport,
    },
];
/* =========================
 * 6. Rule Provider helpers
 * ========================= */
const META = "https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta";
function ruleProvider(behavior, url, path, bundle) {
    return {
        type: "http",
        format: "mrs",
        interval: 86400,
        behavior,
        url,
        path,
        "path-in-bundle": bundle,
    };
}
function metaDomain(remote, local = remote, bundle = remote) {
    return ruleProvider("domain", `${META}/geo/geosite/${remote}.mrs`, `./ruleset/${local}.mrs`, `geo/geosite/${bundle}.mrs`);
}
function metaIp(remote, local = remote, bundle = remote) {
    return ruleProvider("ipcidr", `${META}/geo/geoip/${remote}.mrs`, `./ruleset/${local}.mrs`, `geo/geoip/${bundle}.mrs`);
}
/* =========================
 * 7. 基礎 Rule Providers
 * ========================= */
const BASE_RULE_PROVIDERS = {
    private: metaDomain("private"),
    private_ip: metaIp("private", "private_ip", "private"),
    games_cn: metaDomain("category-games@cn"),
    epicgames: metaDomain("epicgames"),
    nvidia_cn: metaDomain("nvidia@cn", "nvidia_cn", "nvidia@cn"),
    apple_cn: metaDomain("apple@cn", "apple_cn", "apple@cn"),
    microsoft_cn: metaDomain("microsoft@cn", "microsoft_cn", "microsoft@cn"),
    cn_additional: ruleProvider(
        "domain",
        "https://static-file-global.353355.xyz/rules/cn-additional-list.mrs",
        "./ruleset/cn-additional-list.mrs",
        "geo/geosite/cn.mrs",
    ),
    cn_ip: metaIp("cn", "cn_ip", "cn"),
    github: metaDomain("github"),
    gfw: metaDomain("gfw"),
    fakeip_filter: ruleProvider(
        "domain",
        "https://fastly.jsdelivr.net/gh/wwqgtxx/clash-rules@release/fakeip-filter.mrs",
        "./ruleset/fakeip-filter.mrs",
        "geo/geosite/private.mrs",
    ),
    cn: ruleProvider(
        "domain",
        "https://fastly.jsdelivr.net/gh/wwqgtxx/clash-rules@release/direct.mrs",
        "./ruleset/cn.mrs",
        "geo/geosite/cn.mrs",
    ),
};
/* =========================
 * 8. 基礎規則
 * ========================= */
const BASE_RULES = [
    "DOMAIN-SUFFIX,ipsuper.com,敏感代理组",
    "DOMAIN-SUFFIX,ipwhois.io,敏感代理组",
    "DOMAIN-SUFFIX,ippure.com,敏感代理组",
    "DOMAIN-SUFFIX,ping0.cc,敏感代理组",
    "DOMAIN-SUFFIX,ip2location.com,敏感代理组",
    "DOMAIN-SUFFIX,db-ip.com,敏感代理组",
    "AND,((NETWORK,UDP),(DST-PORT,443),(NOT,((OR,((RULE-SET,cn_additional),(RULE-SET,cn_ip,no-resolve)))))),REJECT",
    "RULE-SET,private,直连",
    "RULE-SET,private_ip,直连,no-resolve",
    "RULE-SET,games_cn,直连",
    "RULE-SET,epicgames,直连",
    "RULE-SET,nvidia_cn,直连",
    "RULE-SET,apple_cn,直连",
    "RULE-SET,microsoft_cn,直连",
    "DOMAIN,fsend.cn,直连",
    "DOMAIN,international-gfe.download.nvidia.com,直连",
    "DOMAIN-SUFFIX,tuotuoyun.us,直连",
    "DOMAIN-SUFFIX,tuotuoyun.vip,直连",
];
/* =========================
 * 9. 服務配置
 * ========================= */
const SERVICE_CONFIGS = [
    {
        name: "AI",
        defaultSelected: "敏感代理组",
        preferResidential: true,
        providers: {
            ai: metaDomain("category-ai-!cn", "ai", "category-ai-!cn"),
        },
        icon: ICON.chatgpt,
        rules: ["RULE-SET,ai,AI"],
    },
    {
        name: "Facebook",
        defaultSelected: "敏感代理组",
        preferResidential: true,
        providers: {
            facebook: metaDomain("facebook"),
            facebook_ip: metaIp("facebook", "facebook_ip", "facebook"),
            instagram_sensitive: metaDomain("instagram", "instagram_sensitive", "instagram"),
            threads: metaDomain("threads"),
        },
        icon: ICON.facebook,
        rules: [
            "RULE-SET,facebook,Facebook",
            "RULE-SET,facebook_ip,Facebook,no-resolve",
            "RULE-SET,instagram_sensitive,Facebook",
            "RULE-SET,threads,Facebook",
        ],
    },
    {
        name: "GoogleAccount",
        defaultSelected: "敏感代理组",
        preferResidential: true,
        providers: {},
        icon: ICON.google,
        rules: [
            "DOMAIN,accounts.google.com,GoogleAccount",
            "DOMAIN,myaccount.google.com,GoogleAccount",
            "DOMAIN,oauth2.googleapis.com,GoogleAccount",
        ],
    },
    {
        name: "MicrosoftAccount",
        defaultSelected: "敏感代理组",
        preferResidential: true,
        providers: {},
        icon: ICON.microsoft,
        rules: [
            "DOMAIN,login.live.com,MicrosoftAccount",
            "DOMAIN,account.microsoft.com,MicrosoftAccount",
            "DOMAIN,login.microsoftonline.com,MicrosoftAccount",
            "DOMAIN,login.windows.net,MicrosoftAccount",
        ],
    },
    {
        name: "AppleID",
        defaultSelected: "敏感代理组",
        preferResidential: true,
        providers: {},
        icon: ICON.apple,
        rules: ["DOMAIN,appleid.apple.com,AppleID", "DOMAIN,idmsa.apple.com,AppleID", "DOMAIN,account.apple.com,AppleID"],
    },
    {
        name: "Media",
        defaultSelected: "台湾",
        providers: {
            youtube: metaDomain("youtube"),
            instagram: metaDomain("instagram"),
            netflix: metaDomain("netflix"),
            netflix_ip: metaIp("netflix", "netflix_ip", "netflix"),
            hbo: metaDomain("hbo"),
            twitch: metaDomain("twitch"),
            disney: metaDomain("disney"),
            niconico: metaDomain("niconico"),
            bbc: metaDomain("bbc"),
            pornhub: metaDomain("pornhub"),
        },
        icon: ICON.media,
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
    {
        name: "FCM",
        direct: true,
        defaultSelected: "直连",
        providers: {
            googlefcm: metaDomain("googlefcm"),
        },
        icon: "https://fastly.jsdelivr.net/gh/MiToverG422/Qure@master/IconSet/Color/fcm.png",
        rules: ["RULE-SET,googlefcm,FCM"],
    },
    {
        name: "Google",
        providers: {
            google: metaDomain("google"),
            google_ip: metaIp("google", "google_ip", "google"),
        },
        icon: ICON.google,
        rules: ["RULE-SET,google,Google", "RULE-SET,google_ip,Google,no-resolve"],
    },
    {
        name: "Microsoft",
        direct: true,
        providers: {
            microsoft: metaDomain("microsoft"),
        },
        icon: ICON.microsoft,
        rules: ["RULE-SET,microsoft,Microsoft"],
    },
    {
        name: "Apple",
        direct: true,
        providers: {
            apple: metaDomain("apple"),
        },
        icon: ICON.apple,
        rules: ["RULE-SET,apple,Apple"],
    },
    {
        name: "Telegram",
        providers: {
            telegram: metaDomain("telegram"),
            telegram_ip: metaIp("telegram", "telegram_ip", "telegram"),
        },
        icon: ICON.telegram,
        rules: ["RULE-SET,telegram,Telegram", "RULE-SET,telegram_ip,Telegram,no-resolve"],
    },
    {
        name: "Steam",
        direct: true,
        providers: {
            steam: metaDomain("steam"),
        },
        icon: ICON.steam,
        rules: ["RULE-SET,steam,Steam"],
    },
    {
        name: "TikTok",
        defaultSelected: "美国",
        providers: {
            tiktok: metaDomain("tiktok"),
        },
        icon: ICON.tiktok,
        rules: ["RULE-SET,tiktok,TikTok"],
    },
    {
        name: "Twitter",
        preferResidential: true,
        providers: {
            twitter: metaDomain("twitter"),
            twitter_ip: metaIp("twitter", "twitter_ip", "twitter"),
        },
        icon: ICON.twitter,
        rules: ["RULE-SET,twitter,Twitter", "RULE-SET,twitter_ip,Twitter,no-resolve"],
    },
    {
        name: "Reddit",
        preferResidential: true,
        providers: {
            reddit: metaDomain("reddit"),
        },
        icon: ICON.reddit,
        rules: ["RULE-SET,reddit,Reddit"],
    },
    {
        name: "PayPal",
        preferResidential: true,
        providers: {
            paypal: metaDomain("paypal"),
        },
        icon: ICON.paypal,
        rules: ["RULE-SET,paypal,PayPal"],
    },
    {
        name: "Emby",
        direct: true,
        providers: {
            emby: ruleProvider(
                "domain",
                "https://fastly.jsdelivr.net/gh/666OS/rules@release/mihomo/domain/Emby.mrs",
                "./ruleset/emby.mrs",
                "geo/geosite/category-emby.mrs",
            ),
        },
        icon: ICON.emby,
        rules: ["RULE-SET,emby,Emby", "DOMAIN-SUFFIX,mb3admin.com,Emby", "DOMAIN-KEYWORD,emby,Emby"],
    },
    {
        name: "PikPak",
        direct: true,
        providers: {
            pikpak: metaDomain("pikpak"),
        },
        icon: "https://fastly.jsdelivr.net/gh/lige47/QuanX-icon-rule@main/icon/03CNSoft/pikpak.png",
        rules: ["RULE-SET,pikpak,PikPak"],
    },
    {
        name: "Spotify",
        direct: true,
        providers: {
            spotify: metaDomain("spotify"),
        },
        icon: ICON.spotify,
        rules: ["RULE-SET,spotify,Spotify"],
    },
    {
        name: "AdBlock",
        reject: true,
        providers: {
            adblockmihomolite: ruleProvider(
                "domain",
                "https://fastly.jsdelivr.net/gh/217heidai/adblockfilters@main/rules/adblockmihomolite.mrs",
                "./ruleset/adblockmihomolite.mrs",
                "geo/geosite/category-ads-all.mrs",
            ),
        },
        icon: ICON.adblock,
        rules: ["RULE-SET,adblockmihomolite,AdBlock"],
    },
];
/* =========================
 * 10. 通用 helper
 * ========================= */
function unique(values) {
    return [...new Set((values || []).filter(Boolean))];
}
function toArray(value) {
    if (Array.isArray(value)) {
        return value;
    }
    if (value == null) {
        return [];
    }
    return [value];
}
function isObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
/* =========================
 * 11. Proxy Group helpers
 * ========================= */
function selectGroup(name, proxies, extra = {}) {
    return {
        interval: SETTINGS.healthCheck.interval,
        timeout: SETTINGS.healthCheck.timeout,
        url: SETTINGS.healthCheck.url,
        lazy: SETTINGS.healthCheck.lazy,
        "max-failed-times": SETTINGS.healthCheck.maxFailedTimes,
        "empty-fallback": "REJECT",
        type: "select",
        hidden: false,
        ...extra,
        name,
        proxies: unique(proxies),
    };
}
function urlTestGroup(name, proxies, extra = {}) {
    return {
        interval: SETTINGS.healthCheck.interval,
        timeout: SETTINGS.healthCheck.timeout,
        url: SETTINGS.healthCheck.url,
        lazy: SETTINGS.healthCheck.lazy,
        "max-failed-times": SETTINGS.healthCheck.maxFailedTimes,
        "empty-fallback": "REJECT",
        type: "url-test",
        tolerance: 50,
        "exclude-type": "DIRECT",
        icon: ICON.auto,
        hidden: true,
        ...extra,
        name,
        proxies: unique(proxies),
    };
}
function loadBalanceGroup(name, proxies, extra = {}) {
    return {
        interval: SETTINGS.healthCheck.interval,
        timeout: SETTINGS.healthCheck.timeout,
        url: SETTINGS.healthCheck.url,
        lazy: SETTINGS.healthCheck.lazy,
        "max-failed-times": SETTINGS.healthCheck.maxFailedTimes,
        "empty-fallback": "REJECT",
        type: "load-balance",
        strategy: "sticky-sessions",
        "exclude-type": "DIRECT",
        icon: ICON.balance,
        hidden: true,
        ...extra,
        name,
        proxies: unique(proxies),
    };
}
/* =========================
 * 12. 節點識別 helper
 * ========================= */
function isCAirportProxy(proxy) {
    const text = [proxy?.name, proxy?.provider, proxy?.["provider-name"], proxy?.source, proxy?._provider].filter(Boolean).join(" ");
    return C_PROVIDER_RE.test(text);
}
function isResidentialProxy(proxy) {
    return RESIDENTIAL_RE.test(String(proxy?.name || ""));
}
//必須是家寬節點+名稱包含 Relay
function isRelayProxy(proxy) {
    return isResidentialProxy(proxy) && /relay/i.test(String(proxy?.name || ""));
}
/* =========================
 * 14. 區域 Group
 * ========================= */
function createRegionGroups(name, icon, proxies) {
    const autoName = `${name}-自动选择`;
    return [
        urlTestGroup(autoName, proxies),
        selectGroup(name, [autoName, ...proxies], {
            icon,
        }),
    ];
}
/* =========================
 * 15. Domain pattern
 * ========================= */
function matchDomainPattern(pattern, domains) {
    const value = String(pattern || "").toLowerCase();
    if (!value) {
        return false;
    }
    // exact
    if (!value.includes("*") && !value.startsWith("+.") && !value.startsWith(".")) {
        return domains.has(value);
    }
    // +.example.com
    //
    // example.com
    // a.example.com
    //
    if (value.startsWith("+.")) {
        const suffix = value.slice(2);
        for (const domain of domains) {
            if (domain === suffix || domain.endsWith(`.${suffix}`)) {
                return true;
            }
        }
        return false;
    }
    // .example.com
    //
    // a.example.com
    // 不包含 example.com 本身
    //
    if (value.startsWith(".")) {
        const suffix = value.slice(1);
        for (const domain of domains) {
            if (domain !== suffix && domain.endsWith(`.${suffix}`)) {
                return true;
            }
        }
        return false;
    }
    // *.example.com
    const patternParts = value.split(".");
    for (const domain of domains) {
        const domainParts = domain.split(".");
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
/* =========================
 * 16. 節點過濾與分類
 * ========================= */
function filterAndClassifyProxies(config) {
    const input = Array.isArray(config?.proxies) ? config.proxies : [];
    const highRateRegex = SETTINGS.excludeHighRateProxies ? REGION_DEFINITIONS.find((region) => region.name === "高倍率节点")?.regex : null;
    const filtered = [];
    const residential = [];
    const regular = [];
    for (const proxy of input) {
        if (!isObject(proxy)) {
            continue;
        }
        const type = String(proxy.type || "").toLowerCase();
        const name = String(proxy.name || "").trim();
        if (!name || !SUPPORTED_PROXY_TYPES.has(type)) {
            continue;
        }
        if (highRateRegex && highRateRegex.test(name)) {
            continue;
        }
        const isC = isCAirportProxy(proxy);
        const isResidential = isResidentialProxy(proxy);
        // C 機場僅保留家寬節點。
        if (isC && !isResidential) {
            continue;
        }
        const infoCheckName = isC ? name.replace(/C\s*(?:机场|機場)/gi, "") : name;
        if (INFO_NODE_RE.test(infoCheckName)) {
            continue;
        }
        filtered.push(proxy);
        if (isResidential) {
            residential.push(proxy);
        } else {
            regular.push(proxy);
        }
    }
    if (!filtered.length) {
        throw new Error("沒有可用節點：僅保留 VLESS / AnyTLS，且 C 機場只保留家寬節點");
    }
    return {
        filtered,
        residential,
        regular,
    };
}
/* =========================
 * 17. 建立區域 Groups
 * ========================= */
function buildRegionGroups(regularProxies) {
    const buckets = Object.fromEntries(
        REGION_DEFINITIONS.map((region) => [
            region.name,
            {
                ...region,
                proxies: [],
            },
        ]),
    );
    const other = [];
    for (const proxy of regularProxies) {
        let matchedLocation = false;
        for (const region of REGION_DEFINITIONS) {
            if (!region.regex.test(proxy.name)) {
                continue;
            }
            buckets[region.name].proxies.push(proxy.name);
            if (region.name !== "低倍率节点" && region.name !== "高倍率节点") {
                matchedLocation = true;
            }
        }
        if (!matchedLocation) {
            other.push(proxy.name);
        }
    }
    const groups = REGION_DEFINITIONS.filter((region) => buckets[region.name].proxies.length).flatMap((region) =>
        createRegionGroups(region.name, region.icon, unique(buckets[region.name].proxies)),
    );
    if (other.length) {
        groups.push(...createRegionGroups("其他节点", ICON.world, unique(other)));
    }
    return groups;
}
/* =========================
 * 19. 最終 Proxy
 * ========================= */
function buildFinalProxies(filteredProxies, hasRegularProxies) {
    const result = [];
    for (const proxy of filteredProxies) {
        const finalProxy = {
            ...proxy,
        };
        if (isRelayProxy(finalProxy)) {
            if (!hasRegularProxies) {
                throw new Error(`Relay 節點 [${finalProxy.name}] 需要 [${GROUP.RELAY}]，但目前沒有可用的普通機場節點`);
            }
            finalProxy["dialer-proxy"] = GROUP.RELAY;
        }
        result.push(finalProxy);
    }
    result.push(
        {
            name: DIRECT_PROXY.DUAL,
            type: "direct",
        },
        {
            name: DIRECT_PROXY.IPV4,
            type: "direct",
            "ip-version": "ipv4-prefer",
        },
        {
            name: DIRECT_PROXY.IPV6,
            type: "direct",
            "ip-version": "ipv6-prefer",
        },
    );
    return result;
}
/* =========================
 * 20. Proxy Groups
 * ========================= */
function buildProxyGroups({ regularProxies, residentialProxies, regionGroups }) {
    const regularNames = unique(regularProxies.map((proxy) => proxy.name));
    const residentialNames = unique(residentialProxies.map((proxy) => proxy.name));
    const hasRegular = regularNames.length > 0;
    const hasResidential = residentialNames.length > 0;
    const regionSelectNames = regionGroups.filter((group) => group.type === "select").map((group) => group.name);
    const normalBaseGroupNames = hasRegular ? [GROUP.MANUAL, GROUP.AUTO, GROUP.BALANCE] : [];
    const functionalGroups = [];
    /**
     * 链式前置
     *
     * 只允許普通機場節點。
     *
     * 不允許：
     * 家宽
     * 默认代理
     * 手动选择
     *
     * 從結構上杜絕循環。
     */
    if (hasRegular) {
        functionalGroups.push(
            selectGroup(GROUP.RELAY, regularNames, {
                icon: ICON.proxy,
            }),
        );
    }
    /*
     * 默认代理
     */
    const defaultCandidates = unique([...regionSelectNames, ...(hasResidential ? [GROUP.RESIDENTIAL] : []), ...normalBaseGroupNames]);
    functionalGroups.push(
        selectGroup(GROUP.DEFAULT, defaultCandidates, {
            icon: ICON.proxy,
        }),
    );
    /*
     * 基礎 Groups
     */
    if (hasRegular) {
        functionalGroups.push(
            selectGroup(GROUP.MANUAL, [...regularNames, ...residentialNames], {
                icon: ICON.rocket,
            }),
            loadBalanceGroup(GROUP.BALANCE, regularNames),
            urlTestGroup(GROUP.AUTO, regularNames),
        );
    } else if (hasResidential) {
        functionalGroups.push(
            selectGroup(GROUP.MANUAL, residentialNames, {
                icon: ICON.rocket,
            }),
        );
    }
    /*
     * Rules / Providers
     */
    const finalRules = [...BASE_RULES];
    const finalRuleProviders = {
        ...BASE_RULE_PROVIDERS,
    };
    /*
     * 服務 Groups
     */
    for (const service of SERVICE_CONFIGS) {
        if (!SETTINGS.enableServices[service.name]) {
            continue;
        }
        finalRules.push(...service.rules);
        Object.assign(finalRuleProviders, service.providers || {});
        /*
         * Reject 類型。
         */
        if (service.reject) {
            functionalGroups.push(
                selectGroup(service.name, ["REJECT", "REJECT-DROP", "PASS"], {
                    icon: service.icon,
                }),
            );
            continue;
        }
        /*
         * 普通服務。
         */
        const members = unique([
            ...(service.preferResidential ? [GROUP.SENSITIVE] : []),
            GROUP.DEFAULT,
            ...(hasResidential ? [GROUP.RESIDENTIAL] : []),
            ...normalBaseGroupNames,
            ...regionSelectNames,
            ...(service.direct ? [GROUP.DIRECT] : []),
        ]);
        /*
         * Default selection
         */
        const requestedDefault = service.preferResidential && hasResidential ? GROUP.SENSITIVE : service.defaultSelected;
        const effectiveDefault = requestedDefault && members.includes(requestedDefault) ? requestedDefault : GROUP.DEFAULT;
        functionalGroups.push(
            selectGroup(service.name, members, {
                icon: service.icon,
                "default-selected": effectiveDefault,
            }),
        );
    }
    /*
     * 漏网之鱼
     */
    functionalGroups.push(
        selectGroup(GROUP.FALLBACK, [GROUP.DEFAULT, GROUP.DIRECT], {
            icon: ICON.stack,
        }),
        /*
         * 直连
         */
        selectGroup(GROUP.DIRECT, [DIRECT_PROXY.DUAL, DIRECT_PROXY.IPV4, DIRECT_PROXY.IPV6], {
            url: "https://connectivitycheck.platform.hicloud.com/generate_204",
            icon: ICON.china,
        }),
    );
    /*
     * 家宽
     */
    const residentialGroups = hasResidential
        ? [
              selectGroup(GROUP.RESIDENTIAL, residentialNames, {
                  icon: ICON.residential,
              }),
          ]
        : [];
    /*
     * 敏感代理组
     */
    const sensitiveGroup = selectGroup(GROUP.SENSITIVE, [GROUP.DEFAULT, ...(hasResidential ? [GROUP.RESIDENTIAL] : [])], {
        icon: ICON.proxy,
    });
    /*
     * GLOBAL
     */
    const globalGroup = selectGroup(
        GROUP.GLOBAL,
        unique([
            GROUP.SENSITIVE,
            ...residentialGroups.map((group) => group.name),
            ...functionalGroups.map((group) => group.name),
            ...regionGroups.map((group) => group.name),
        ]),
        {
            icon: ICON.global,
        },
    );
    return {
        proxyGroups: [sensitiveGroup, globalGroup, ...functionalGroups, ...residentialGroups, ...regionGroups],
        finalRules,
        finalRuleProviders,
    };
}
/* =========================
 * 21. DNS
 * ========================= */
const COMMON_DNS_RE =
    /(223\.5\.5\.5|223\.6\.6\.6|119\.29\.29\.29|1\.12\.12\.12|120\.53\.53\.53|114\.114\.114\.114|180\.76\.76\.76|1\.1\.1\.1|1\.0\.0\.1|8\.8\.8\.8|8\.8\.4\.4|94\.140\.14\.14|94\.140\.15\.15|127\.0\.0\.1|alidns|doh\.pub|dot\.pub|dnspod|dns\.baidu|dns\.google|cloudflare|adguard|system)/i;
/* =========================
 * 22. DNS / Hosts builder
 * ========================= */
function buildDnsAndHosts(config, filteredProxies) {
    const originalDns = isObject(config?.dns) ? config.dns : {};
    const originalHosts = isObject(config?.hosts) ? config.hosts : {};
    /*
     * 保留來源訂閱中的特殊
     * proxy-server-nameserver。
     */
    const originalProxyServerNameserver = toArray(originalDns["proxy-server-nameserver"]).filter((dns) => !COMMON_DNS_RE.test(String(dns)));
    /*
     * 所有 proxy server。
     */
    const proxyDomains = new Set(
        filteredProxies
            .filter((proxy) => typeof proxy.server === "string" && proxy.server.trim())
            .map((proxy) => proxy.server.toLowerCase()),
    );
    /*
     * 保留與 Proxy Server
     * 有關的 DNS policy。
     */
    const originalPolicyNameserver = {};
    for (const policy of [originalDns["nameserver-policy"], originalDns["proxy-server-nameserver-policy"]]) {
        if (!isObject(policy)) {
            continue;
        }
        for (const [domain, dns] of Object.entries(policy)) {
            if (matchDomainPattern(domain, proxyDomains)) {
                originalPolicyNameserver[domain] = dns;
            }
        }
    }
    /*
     * China DNS
     */
    const chinaDNS = ["https://dns.alidns.com/dns-query#DIRECT", "https://doh.pub/dns-query#DIRECT"];
    /*
     * Foreign DNS
     */
    const foreignDNS = [`https://dns.cloudflare.com/dns-query#${GROUP.DEFAULT}`, `https://dns.google/dns-query#${GROUP.DEFAULT}`];
    const dns = {
        enable: true,
        ipv6: true,
        "use-hosts": true,
        "use-system-hosts": true,
        "cache-algorithm": "arc",
        "enhanced-mode": "fake-ip",
        "fake-ip-range": "198.18.0.1/16",
        "fake-ip-filter": ["rule-set:private", "rule-set:fakeip_filter"],
        "proxy-server-nameserver": unique([...chinaDNS, ...originalProxyServerNameserver]),
        ...(Object.keys(originalPolicyNameserver).length
            ? {
                  "proxy-server-nameserver-policy": originalPolicyNameserver,
              }
            : {}),
        "default-nameserver": ["223.5.5.5", "119.29.29.29"],
        nameserver: foreignDNS,
        "nameserver-policy": {
            "rule-set:cn": chinaDNS,
        },
        "direct-nameserver": ["system", "223.5.5.5", "119.29.29.29"],
    };
    /*
     * Hosts
     */
    const proxyHosts = {};
    for (const [domain, value] of Object.entries(originalHosts)) {
        if (matchDomainPattern(domain, proxyDomains)) {
            proxyHosts[domain] = value;
        }
    }
    const hosts = {
        "dns.alidns.com": ["223.5.5.5", "223.6.6.6"],
        "doh.pub": ["1.12.12.12", "120.53.53.53"],
        "dns.cloudflare.com": ["1.1.1.1", "1.0.0.1"],
        "dns.google": ["8.8.8.8", "8.8.4.4"],
        "services.googleapis.cn": ["services.googleapis.com"],
        "+.mcdn.bilivideo.com": ["0.0.0.0"],
        "+.mcdn.bilivideo.cn": ["0.0.0.0"],
        "+.edge.mountaintoys.cn": ["0.0.0.0"],
        ...proxyHosts,
    };
    return {
        dns,
        hosts,
    };
}
/* =========================
 * 23. 完整性檢查
 * ========================= */
function assertUniqueNames(items, label) {
    const seen = new Set();
    for (const item of items) {
        const name = String(item?.name || "");
        if (!name) {
            throw new Error(`${label} 存在空名稱`);
        }
        if (seen.has(name)) {
            throw new Error(`${label} 存在重複名稱: ${name}`);
        }
        seen.add(name);
    }
}
/* =========================
 * 24. 引用與循環檢查
 * ========================= */
function assertConfigIntegrity(config) {
    const proxies = toArray(config.proxies);
    const groups = toArray(config["proxy-groups"]);
    /*
     * 重複名稱檢查
     */
    assertUniqueNames(proxies, "proxy");
    assertUniqueNames(groups, "proxy-group");
    const proxyNames = new Set(proxies.map((proxy) => proxy.name));
    const groupNames = new Set(groups.map((group) => group.name));
    /*
     * Proxy 和 Group
     * 不能同名。
     */
    for (const name of proxyNames) {
        if (groupNames.has(name)) {
            throw new Error(`proxy 與 proxy-group 名稱衝突: ${name}`);
        }
    }
    /*
     * 所有合法 target。
     */
    const knownTargets = new Set([...proxyNames, ...groupNames, ...BUILTIN_TARGETS]);
    /*
     * dialer-proxy 檢查。
     */
    for (const proxy of proxies) {
        const dialer = proxy?.["dialer-proxy"];
        if (dialer && !knownTargets.has(dialer)) {
            throw new Error(`proxy [${proxy.name}] dialer-proxy [${dialer}] not found`);
        }
    }
    /*
     * Group member 檢查。
     */
    for (const group of groups) {
        for (const target of toArray(group.proxies)) {
            if (!knownTargets.has(target)) {
                throw new Error(`proxy-group [${group.name}] target [${target}] not found`);
            }
        }
    }
    /*
     * 建立依賴圖。
     *
     * group
     * → member
     *
     * proxy
     * → dialer-proxy
     *
     * 可以檢測：
     *
     * Chicken
     * → 手动选择
     * → Chicken
     *
     * 這類循環。
     */
    const graph = new Map();
    for (const name of [...proxyNames, ...groupNames]) {
        graph.set(name, []);
    }
    /*
     * Proxy → dialer
     */
    for (const proxy of proxies) {
        const dialer = proxy?.["dialer-proxy"];
        if (dialer && graph.has(proxy.name) && graph.has(dialer)) {
            graph.get(proxy.name).push(dialer);
        }
    }
    /*
     * Group → member
     */
    for (const group of groups) {
        for (const target of toArray(group.proxies)) {
            if (graph.has(target)) {
                graph.get(group.name).push(target);
            }
        }
    }
    /*
     * DFS cycle detection
     */
    const state = new Map();
    const stack = [];
    function visit(node) {
        const current = state.get(node) || 0;
        if (current === 2) {
            return;
        }
        if (current === 1) {
            const start = stack.indexOf(node);
            const cycle = [...stack.slice(start), node].join(" -> ");
            throw new Error(`檢測到代理循環依賴: ${cycle}`);
        }
        state.set(node, 1);
        stack.push(node);
        for (const next of graph.get(node) || []) {
            visit(next);
        }
        stack.pop();
        state.set(node, 2);
    }
    for (const node of graph.keys()) {
        visit(node);
    }
}
/* =========================
 * 25. Main
 * ========================= */
function main(config) {
    const { filtered, residential, regular } = filterAndClassifyProxies(config || {});
    const regionGroups = buildRegionGroups(regular);
    const { proxyGroups, finalRules, finalRuleProviders } = buildProxyGroups({
        regularProxies: regular,
        residentialProxies: residential,
        regionGroups,
    });
    const hasRegular = regular.length > 0;
    const finalProxies = buildFinalProxies(filtered, hasRegular);
    /*
     * 6.
     * DNS / Hosts
     */
    const { dns, hosts } = buildDnsAndHosts(config || {}, filtered);
    /*
     * 7.
     * 最終 Config
     */
    const newConfig = {
        dns,
        hosts,
        "allow-lan": true,
        ipv6: true,
        mode: "rule",
        "log-level": "info",
        "bind-address": "*",
        "unified-delay": true,
        "tcp-concurrent": true,
        "find-process-mode": "strict",
        "external-controller": "127.0.0.1:9090",
        "external-ui": "ui",
        "external-ui-url": "https://github.com/Zephyruso/zashboard/releases/latest/download/dist.zip",
        profile: {
            "store-selected": true,
            "store-fake-ip": true,
        },
        ntp: {
            enable: true,
            "write-to-system": false,
            server: "ntp.aliyun.com",
            port: 123,
            interval: 60,
        },
        tun: {
            enable: true,
            stack: "system",
            "auto-route": true,
            "strict-route": true,
            "auto-redirect": false,
            "auto-detect-interface": true,
            "dns-hijack": ["any:53", "tcp://any:53"],
        },
        proxies: finalProxies,
        "proxy-groups": proxyGroups,
        "rule-providers": finalRuleProviders,
        rules: [
            `RULE-SET,github,${GROUP.DEFAULT}`,
            ...finalRules,
            `RULE-SET,gfw,${GROUP.DEFAULT}`,
            `RULE-SET,cn_additional,${GROUP.DIRECT}`,
            `RULE-SET,cn_ip,${GROUP.DIRECT}`,
            `MATCH,${GROUP.FALLBACK}`,
        ],
    };
    /*
     * 8.
     * 最終檢查
     *
     * 在 Bettbox 把錯誤配置交給
     * Mihomo 之前直接報出明確原因。
     */
    assertConfigIntegrity(newConfig);
    return newConfig;
}
