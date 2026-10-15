/**
 * Bettbox / Mihomo - Shield TV Pro 精簡配置
 *
 * 主要用途
 * - 完全移除 C 機場節點、家寬／住宅節點與資訊節點。
 * - 保留 VLESS / AnyTLS / Hysteria2 節點，形成唯一的「所有節點池」。
 * - 自动选择與手动选择均使用全部保留節點。
 * - 從所有節點池衍生：
 *   1. 不含日本
 *   2. 周边地区
 *   3. 欧美地区
 *   4. M节点
 *   四個自動測速組。
 * - 默认代理預設使用「自动选择」。
 * - 中國、局域網及指定域名直連，其餘預設走默认代理。
 * - Emby 獨立分流，預設使用「不含日本」。
 * - Emby 可選：不含日本、周边地区、欧美地区、M节点、手动选择、DIRECT。
 * - Emby 不提供「自动选择」與「默认代理」，避免間接回到全節點自動池。
 * - DNS 僅分為中國直連 DNS 與海外代理 DNS。
 * - 保留 Fake-IP、TUN、Sniffer、IPv6。
 * - 不禁止 UDP/443，允許 QUIC 正常使用。
 */

const SETTINGS = {
    directDomains: ["fsend.cn", "international-gfe.download.nvidia.com"],

    directDomainSuffixes: ["tuotuoyun.us", "tuotuoyun.vip"],

    // 額外指定走 Emby 分流的完整域名
    embyDomains: [
        // "emby.example.com",
        "link01.okemby.org",
        "emby.bangumi.ca",
    ],

    // 額外指定走 Emby 分流的域名後綴
    embyDomainSuffixes: [
        // "example.com",
    ],

    healthCheck: {
        interval: 900,
        timeout: 5000,
        tolerance: 100,
        lazy: true,
        maxFailedTimes: 2,
        url: "https://g.cn/generate_204",
    },
};

const GROUP = {
    DEFAULT: "默认代理",

    AUTO: "自动选择",

    MANUAL: "手动选择",

    NO_JAPAN: "不含日本",

    NEARBY: "周边地区",

    EURO_US: "欧美地区",

    M: "M节点",

    EMBY: "Emby",
};

const ICON = {
    default: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Proxy.png",

    auto: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Auto.png",

    manual: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Rocket.png",

    nearby: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Macao.png",

    euroUs: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/World_Map.png",

    m: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Available_1.png",

    emby: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Emby.png",
};

const SUPPORTED_PROXY_TYPES = new Set(["vless", "anytls", "hysteria2"]);

/*
 * C 機場識別
 */
const C_PROVIDER_RE = /(?:^|[^A-Za-z0-9])C(?:机场|機場)?(?:$|[^A-Za-z0-9])/i;

/*
 * M 節點識別
 *
 * 支援：
 * M
 * M机场
 * M機場
 * M节点
 * M節點
 *
 * 使用邊界判斷，避免誤匹配 Miami、Milan 等名稱。
 */
const M_PROVIDER_RE = /(?:^|[^A-Za-z0-9])M(?:机场|機場|节点|節點)?(?:$|[^A-Za-z0-9])/i;

/*
 * 家寬／住宅節點
 */
const RESIDENTIAL_RE =
    /家宽|家寬|家庭宽带|家庭寬頻|住宅(?:IP|网络|網路|寬頻|宽带)?|原生住宅|住宅原生|residential|residential\s*ip|home\s*(?:ip|broadband)|isp\s*ip/i;

/*
 * 資訊節點
 */
const INFO_NODE_RE =
    /群|返利|循环|官网|客服|网站|网址|获取|订阅|流量|到期|下次|版本|官址|备用|过期|已用|联系|邮箱|工单|贩卖|通知|倒卖|防止|国内|地址|频道|无法|说明|使用|提示|访问|支持|教程|关注|更新|作者|加入|超时|收藏|福利|邀请|好友|失联|选择|剩余|公益|发布|DIZTNA|通路|登录|禁止|定时|渠道|牢记|永久|余额|阁下|本站|刷新|导航|建议|重置|以下|⚠️|@|Expire|https?:\/\//iu;

/*
 * 中國周邊地區／國家
 *
 * 明確不包含日本。
 */
const NEARBY_RE =
    /🇭🇰|香港|(?:^|[^A-Za-z])HK(?:$|[^A-Za-z])|Hong\s*Kong|🇲🇴|澳門|澳门|(?:^|[^A-Za-z])MO(?:$|[^A-Za-z])|Macao|Macau|🇹🇼|台灣|台湾|台北|高雄|(?:^|[^A-Za-z])TW(?:$|[^A-Za-z])|Taiwan|🇰🇷|韓國|韩国|首爾|首尔|(?:^|[^A-Za-z])KR(?:$|[^A-Za-z])|Korea|Seoul|🇸🇬|新加坡|獅城|狮城|(?:^|[^A-Za-z])SG(?:$|[^A-Za-z])|Singapore|🇲🇾|馬來西亞|马来西亚|大馬|大马|(?:^|[^A-Za-z])MY(?:$|[^A-Za-z])|Malaysia|🇹🇭|泰國|泰国|曼谷|(?:^|[^A-Za-z])TH(?:$|[^A-Za-z])|Thailand|Bangkok|🇻🇳|越南|(?:^|[^A-Za-z])VN(?:$|[^A-Za-z])|Vietnam|🇵🇭|菲律賓|菲律宾|馬尼拉|马尼拉|(?:^|[^A-Za-z])PH(?:$|[^A-Za-z])|Philippines|Manila|🇮🇩|印度尼西亞|印度尼西亚|印尼|雅加達|雅加达|(?:^|[^A-Za-z])ID(?:$|[^A-Za-z])|Indonesia|Jakarta|🇧🇳|汶萊|文莱|(?:^|[^A-Za-z])BN(?:$|[^A-Za-z])|Brunei|🇰🇭|柬埔寨|(?:^|[^A-Za-z])KH(?:$|[^A-Za-z])|Cambodia|🇱🇦|寮國|寮国|老撾|老挝|(?:^|[^A-Za-z])LA(?:$|[^A-Za-z])|Laos|🇲🇲|緬甸|缅甸|(?:^|[^A-Za-z])MM(?:$|[^A-Za-z])|Myanmar|Burma/i;

/*
 * 日本
 */
const JAPAN_RE = /🇯🇵|日本|(?:^|[^A-Za-z])JP(?:$|[^A-Za-z])|Japan/i;

/*
 * 歐美地區
 *
 * 美國 + 歐洲。
 * 不把加拿大、墨西哥、澳洲、中東等地區算入。
 */
const EURO_US_RE =
    /🇺🇸|美国|美國|(?:^|[^A-Za-z])US(?:$|[^A-Za-z])|United\s*States|America|🇬🇧|英国|英國|(?:^|[^A-Za-z])UK(?:$|[^A-Za-z])|(?:^|[^A-Za-z])GB(?:$|[^A-Za-z])|United\s*Kingdom|Britain|England|🇩🇪|德国|德國|(?:^|[^A-Za-z])DE(?:$|[^A-Za-z])|Germany|🇫🇷|法国|法國|(?:^|[^A-Za-z])FR(?:$|[^A-Za-z])|France|🇳🇱|荷兰|荷蘭|(?:^|[^A-Za-z])NL(?:$|[^A-Za-z])|Netherlands|Holland|🇨🇭|瑞士|(?:^|[^A-Za-z])CH(?:$|[^A-Za-z])|Switzerland|🇮🇹|意大利|義大利|(?:^|[^A-Za-z])IT(?:$|[^A-Za-z])|Italy|🇪🇸|西班牙|(?:^|[^A-Za-z])ES(?:$|[^A-Za-z])|Spain|🇵🇹|葡萄牙|(?:^|[^A-Za-z])PT(?:$|[^A-Za-z])|Portugal|🇮🇪|爱尔兰|愛爾蘭|(?:^|[^A-Za-z])IE(?:$|[^A-Za-z])|Ireland|🇧🇪|比利时|比利時|(?:^|[^A-Za-z])BE(?:$|[^A-Za-z])|Belgium|🇦🇹|奥地利|奧地利|(?:^|[^A-Za-z])AT(?:$|[^A-Za-z])|Austria|🇵🇱|波兰|波蘭|(?:^|[^A-Za-z])PL(?:$|[^A-Za-z])|Poland|🇨🇿|捷克|(?:^|[^A-Za-z])CZ(?:$|[^A-Za-z])|Czech|🇭🇺|匈牙利|(?:^|[^A-Za-z])HU(?:$|[^A-Za-z])|Hungary|🇷🇴|罗马尼亚|羅馬尼亞|(?:^|[^A-Za-z])RO(?:$|[^A-Za-z])|Romania|🇬🇷|希腊|希臘|(?:^|[^A-Za-z])GR(?:$|[^A-Za-z])|Greece|🇩🇰|丹麦|丹麥|(?:^|[^A-Za-z])DK(?:$|[^A-Za-z])|Denmark|🇳🇴|挪威|(?:^|[^A-Za-z])NO(?:$|[^A-Za-z])|Norway|🇸🇪|瑞典|(?:^|[^A-Za-z])SE(?:$|[^A-Za-z])|Sweden|🇫🇮|芬兰|芬蘭|(?:^|[^A-Za-z])FI(?:$|[^A-Za-z])|Finland|🇮🇸|冰岛|冰島|(?:^|[^A-Za-z])IS(?:$|[^A-Za-z])|Iceland|🇱🇺|卢森堡|盧森堡|(?:^|[^A-Za-z])LU(?:$|[^A-Za-z])|Luxembourg|🇧🇬|保加利亚|保加利亞|(?:^|[^A-Za-z])BG(?:$|[^A-Za-z])|Bulgaria|🇭🇷|克罗地亚|克羅地亞|(?:^|[^A-Za-z])HR(?:$|[^A-Za-z])|Croatia|🇸🇮|斯洛文尼亚|斯洛文尼亞|(?:^|[^A-Za-z])SI(?:$|[^A-Za-z])|Slovenia|🇸🇰|斯洛伐克|(?:^|[^A-Za-z])SK(?:$|[^A-Za-z])|Slovakia|🇪🇪|爱沙尼亚|愛沙尼亞|(?:^|[^A-Za-z])EE(?:$|[^A-Za-z])|Estonia|🇱🇻|拉脱维亚|拉脫維亞|(?:^|[^A-Za-z])LV(?:$|[^A-Za-z])|Latvia|🇱🇹|立陶宛|(?:^|[^A-Za-z])LT(?:$|[^A-Za-z])|Lithuania/i;

const META = "https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta";

/*
 * 通用 Rule Provider
 */
function ruleProvider(behavior, url, path, pathInBundle) {
    return {
        type: "http",

        format: "mrs",

        interval: 86400,

        behavior,

        url,

        path,

        "path-in-bundle": pathInBundle,
    };
}

/*
 * MetaCubeX Domain Rule Provider
 */
function metaDomain(name) {
    return ruleProvider(
        "domain",

        `${META}/geo/geosite/${name}.mrs`,

        `./ruleset/${name}.mrs`,

        `geo/geosite/${name}.mrs`,
    );
}

/*
 * MetaCubeX IP Rule Provider
 */
function metaIp(name, local = name) {
    return ruleProvider(
        "ipcidr",

        `${META}/geo/geoip/${name}.mrs`,

        `./ruleset/${local}.mrs`,

        `geo/geoip/${name}.mrs`,
    );
}

/*
 * 去重
 */
function unique(values) {
    return [...new Set((values || []).filter(Boolean))];
}

/*
 * 判斷普通 Object
 */
function isObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/*
 * 將節點名稱、provider 等來源資訊合併，
 * 用於識別 C / M 機場。
 */
function proxyIdentityText(proxy) {
    return [proxy?.name, proxy?.provider, proxy?.["provider-name"], proxy?.source, proxy?._provider].filter(Boolean).join(" ");
}

/*
 * C 機場
 */
function isCAirportProxy(proxy) {
    return C_PROVIDER_RE.test(proxyIdentityText(proxy));
}

/*
 * M 節點
 */
function isMAirportProxy(proxy) {
    return M_PROVIDER_RE.test(proxyIdentityText(proxy));
}

/*
 * 家寬／住宅節點
 */
function isResidentialProxy(proxy) {
    return RESIDENTIAL_RE.test(String(proxy?.name || ""));
}

/*
 * 建立新的「所有節點池」
 *
 * 只保留：
 * VLESS
 * AnyTLS
 * Hysteria2
 *
 * 完全移除：
 * C 機場
 * 家寬／住宅
 * 資訊節點
 */
function filterProxies(config) {
    const proxies = Array.isArray(config?.proxies) ? config.proxies : [];

    const result = [];

    for (const proxy of proxies) {
        if (!isObject(proxy)) {
            continue;
        }

        const type = String(proxy.type || "").toLowerCase();

        const name = String(proxy.name || "").trim();

        if (!name || !SUPPORTED_PROXY_TYPES.has(type)) {
            continue;
        }

        if (isCAirportProxy(proxy)) {
            continue;
        }

        if (isResidentialProxy(proxy)) {
            continue;
        }

        if (INFO_NODE_RE.test(name)) {
            continue;
        }

        result.push(proxy);
    }

    if (!result.length) {
        throw new Error("沒有可用節點：C 機場、家寬／住宅節點與無效資訊節點已被過濾");
    }

    return result;
}

/*
 * 建立 URL Test 組
 */
function createUrlTestGroup(name, proxies, icon = ICON.auto) {
    return {
        name,

        type: "url-test",

        proxies,

        url: SETTINGS.healthCheck.url,

        interval: SETTINGS.healthCheck.interval,

        timeout: SETTINGS.healthCheck.timeout,

        tolerance: SETTINGS.healthCheck.tolerance,

        lazy: SETTINGS.healthCheck.lazy,

        "max-failed-times": SETTINGS.healthCheck.maxFailedTimes,

        "empty-fallback": "REJECT",

        "exclude-type": "DIRECT",

        icon,
    };
}

/*
 * 建立代理組
 */
function buildProxyGroups(proxies) {
    /*
     * 所有節點池
     *
     * 已經完成：
     * C 機場過濾
     * 家寬／住宅過濾
     * 資訊節點過濾
     */
    const allNames = unique(proxies.map((proxy) => proxy.name));

    /*
     * 1. 不含日本
     */
    const noJapanNames = unique(
        proxies

            .filter((proxy) => !JAPAN_RE.test(String(proxy.name || "")))

            .map((proxy) => proxy.name),
    );

    /*
     * 2. 周邊地區
     *
     * 僅中國周邊國家／地區，
     * 並明確排除日本。
     */
    const nearbyNames = unique(
        proxies

            .filter((proxy) => {
                const name = String(proxy.name || "");

                return NEARBY_RE.test(name) && !JAPAN_RE.test(name);
            })

            .map((proxy) => proxy.name),
    );

    /*
     * 3. 歐美地區
     *
     * 僅：
     * 美國
     * 歐洲
     *
     * 並排除日本。
     */
    const euroUsNames = unique(
        proxies

            .filter((proxy) => {
                const name = String(proxy.name || "");

                return EURO_US_RE.test(name) && !JAPAN_RE.test(name);
            })

            .map((proxy) => proxy.name),
    );

    /*
     * 4. M 節點
     */
    const mNames = unique(
        proxies

            .filter(isMAirportProxy)

            .map((proxy) => proxy.name),
    );

    /*
     * Emby 必須依賴「不含日本」，
     * 因此這一組不能為空。
     */
    if (!noJapanNames.length) {
        throw new Error("沒有找到可供「不含日本」使用的節點");
    }

    /*
     * 四個衍生自動測速組。
     *
     * 若某分類沒有任何節點，
     * 則不生成該空組，
     * 避免 Mihomo 配置無效。
     */
    const derivedGroups = [];

    const availableDerivedGroupNames = [];

    const addUrlTestGroup = (name, names, icon) => {
        if (!names.length) {
            return;
        }

        derivedGroups.push(createUrlTestGroup(name, names, icon));

        availableDerivedGroupNames.push(name);
    };

    addUrlTestGroup(GROUP.NO_JAPAN, noJapanNames, ICON.auto);

    addUrlTestGroup(GROUP.NEARBY, nearbyNames, ICON.nearby);

    addUrlTestGroup(GROUP.EURO_US, euroUsNames, ICON.euroUs);

    addUrlTestGroup(GROUP.M, mNames, ICON.m);

    /*
     * 默认代理
     *
     * 默认：
     * 自动选择
     *
     * 可以手動切換：
     * 自动选择
     * 不含日本
     * 周边地区
     * 欧美地区
     * M节点
     * 手动选择
     */
    const defaultCandidates = [GROUP.AUTO, ...availableDerivedGroupNames, GROUP.MANUAL];

    /*
     * Emby
     *
     * 明確不提供：
     * 自动选择
     * 默认代理
     *
     * 防止 Emby 間接回到所有節點自動池。
     *
     * 默认：
     * 不含日本
     */
    const embyCandidates = [
        GROUP.NO_JAPAN,

        ...availableDerivedGroupNames.filter((name) => name !== GROUP.NO_JAPAN),

        GROUP.MANUAL,

        "DIRECT",
    ];

    const groups = [
        /*
         * 默认代理
         */
        {
            name: GROUP.DEFAULT,

            type: "select",

            proxies: defaultCandidates,

            "default-selected": GROUP.AUTO,

            icon: ICON.default,
        },

        /*
         * 自动选择
         *
         * 使用全部保留節點，
         * 包含日本。
         */
        createUrlTestGroup(
            GROUP.AUTO,

            allNames,

            ICON.auto,
        ),

        /*
         * 四個衍生自動測速組
         */
        ...derivedGroups,

        /*
         * 手动选择
         *
         * 使用全部保留節點，
         * 包含日本。
         */
        {
            name: GROUP.MANUAL,

            type: "select",

            proxies: allNames,

            icon: ICON.manual,
        },

        /*
         * Emby
         */
        {
            name: GROUP.EMBY,

            type: "select",

            proxies: unique(embyCandidates),

            "default-selected": GROUP.NO_JAPAN,

            icon: ICON.emby,
        },
    ];

    return groups;
}

/*
 * 清理域名
 */
function cleanDomain(value) {
    return String(value || "")
        .trim()

        .replace(/^\+\./, "")

        .replace(/^\./, "")

        .toLowerCase();
}

/*
 * 通用域名規則產生器
 */
function buildDomainRules(domains, suffixes, target) {
    const rules = [];

    for (const value of domains || []) {
        const domain = cleanDomain(value);

        if (domain) {
            rules.push(`DOMAIN,${domain},${target}`);
        }
    }

    for (const value of suffixes || []) {
        const domain = cleanDomain(value);

        if (domain) {
            rules.push(`DOMAIN-SUFFIX,${domain},${target}`);
        }
    }

    return rules;
}

/*
 * 自訂直連規則
 */
function buildDirectRules() {
    return buildDomainRules(
        SETTINGS.directDomains,

        SETTINGS.directDomainSuffixes,

        "DIRECT",
    );
}

/*
 * Emby 規則
 *
 * 包含：
 * 666OS Emby Rule Set
 * mb3admin.com
 * DOMAIN-KEYWORD,emby
 * 自訂完整域名
 * 自訂域名後綴
 */
function buildEmbyRules() {
    return [
        "RULE-SET,emby,Emby",

        "DOMAIN-SUFFIX,mb3admin.com,Emby",

        "DOMAIN-KEYWORD,emby,Emby",

        ...buildDomainRules(
            SETTINGS.embyDomains,

            SETTINGS.embyDomainSuffixes,

            GROUP.EMBY,
        ),
    ];
}

/*
 * 直連 DNS Policy
 */
function buildDirectDnsPolicy(chinaDNS) {
    const policy = {};

    for (const value of SETTINGS.directDomains) {
        const domain = cleanDomain(value);

        if (domain) {
            policy[domain] = chinaDNS;
        }
    }

    for (const value of SETTINGS.directDomainSuffixes) {
        const domain = cleanDomain(value);

        if (domain) {
            policy[`+.${domain}`] = chinaDNS;
        }
    }

    return policy;
}

/*
 * DNS
 */
function buildDns(config) {
    const chinaDNS = ["https://dns.alidns.com/dns-query#DIRECT", "https://doh.pub/dns-query#DIRECT"];

    const foreignDNS = [`https://dns.cloudflare.com/dns-query#${GROUP.DEFAULT}`, `https://dns.google/dns-query#${GROUP.DEFAULT}`];

    const directDnsPolicy = buildDirectDnsPolicy(chinaDNS);

    return {
        enable: true,

        ipv6: true,

        "use-hosts": true,

        "use-system-hosts": true,

        "cache-algorithm": "arc",

        "enhanced-mode": "fake-ip",

        "fake-ip-range": "198.18.0.1/16",

        "fake-ip-filter": ["rule-set:private"],

        "default-nameserver": ["223.5.5.5", "119.29.29.29"],

        "proxy-server-nameserver": chinaDNS,

        nameserver: foreignDNS,

        "nameserver-policy": {
            ...directDnsPolicy,

            "rule-set:cn": chinaDNS,
        },

        "direct-nameserver": ["system", "223.5.5.5", "119.29.29.29"],
    };
}

/*
 * Hosts
 */
function buildHosts(config) {
    const originalHosts = isObject(config?.hosts) ? config.hosts : {};

    return {
        "dns.alidns.com": ["223.5.5.5", "223.6.6.6"],

        "doh.pub": ["1.12.12.12", "120.53.53.53"],

        "dns.cloudflare.com": ["1.1.1.1", "1.0.0.1"],

        "dns.google": ["8.8.8.8", "8.8.4.4"],

        ...originalHosts,
    };
}

/*
 * 防止節點與代理組名稱重複
 */
function assertUniqueNames(proxies, groups) {
    const names = new Set();

    for (const item of [...proxies, ...groups]) {
        const name = String(item?.name || "");

        if (!name) {
            throw new Error("發現空名稱節點或代理組");
        }

        if (names.has(name)) {
            throw new Error(`名稱重複: ${name}`);
        }

        names.add(name);
    }
}

/*
 * 主程序
 */
function main(config) {
    const sourceConfig = config || {};

    /*
     * 唯一的所有節點池
     */
    const proxies = filterProxies(sourceConfig);

    /*
     * 所有代理組
     */
    const proxyGroups = buildProxyGroups(proxies);

    /*
     * DNS / Hosts
     */
    const dns = buildDns(sourceConfig);

    const hosts = buildHosts(sourceConfig);

    /*
     * Rule Providers
     */
    const ruleProviders = {
        private: metaDomain("private"),

        private_ip: metaIp(
            "private",

            "private_ip",
        ),

        cn: metaDomain("cn"),

        cn_ip: metaIp(
            "cn",

            "cn_ip",
        ),

        emby: ruleProvider(
            "domain",

            "https://fastly.jsdelivr.net/gh/666OS/rules@release/mihomo/domain/Emby.mrs",

            "./ruleset/emby.mrs",

            "geo/geosite/category-emby.mrs",
        ),
    };

    /*
     * Rules
     *
     * 優先級：
     *
     * 自訂直連
     * ↓
     * Private
     * ↓
     * 中國
     * ↓
     * Emby
     * ↓
     * 默认代理
     */
    const rules = [
        ...buildDirectRules(),

        "RULE-SET,private,DIRECT",

        "RULE-SET,private_ip,DIRECT,no-resolve",

        "RULE-SET,cn,DIRECT",

        "RULE-SET,cn_ip,DIRECT,no-resolve",

        ...buildEmbyRules(),

        `MATCH,${GROUP.DEFAULT}`,
    ];

    /*
     * 最終配置
     */
    const newConfig = {
        dns,

        hosts,

        "allow-lan": true,

        ipv6: true,

        mode: "rule",

        "log-level": "silent",

        "bind-address": "*",

        "unified-delay": true,

        "tcp-concurrent": true,

        "find-process-mode": "strict",

        profile: {
            "store-selected": true,

            "store-fake-ip": true,
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

        sniffer: {
            enable: true,

            sniff: {
                HTTP: {
                    ports: [80, "8080-8880"],

                    "override-destination": true,
                },

                TLS: {
                    ports: [
                        443,

                        8443,
                    ],
                },

                QUIC: {
                    ports: [
                        443,

                        8443,
                    ],
                },
            },

            "skip-domain": ["Mijia Cloud", "+.push.apple.com"],
        },

        proxies,

        "proxy-groups": proxyGroups,

        "rule-providers": ruleProviders,

        rules,
    };

    /*
     * 最後檢查名稱衝突
     */
    assertUniqueNames(
        proxies,

        proxyGroups,
    );

    return newConfig;
}
