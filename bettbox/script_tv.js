/*
Bettbox / Mihomo - Shield TV Pro 精簡配置
主要用途
- Shield TV Pro 影音播放，以 YouTube、Emby 等海外服務為主。
- 默认代理預設使用「自动选择」，只在不含日本的周邊地區節點中自動測速。
- 可隨時切換至「手动选择」，手動選擇所有保留下來的代理節點。
- 中國、局域網及指定域名直連，其餘全部走默认代理。
- 完全移除 C 機場節點與所有家寬／住宅節點。
- 不建立 AI、社交媒體、Media、Emby、家寬、Relay、鏈式前置等額外分流。
- DNS 僅分為中國直連 DNS 與海外代理 DNS。
- 保留 Fake-IP、TUN、Sniffer、IPv6。
- 不禁止 UDP/443，允許 QUIC 正常使用。
主要設定
- directDomains：指定完整域名直連。
- directDomainSuffixes：指定整個域名後綴直連。
- healthCheck：自动选择健康檢查參數。
*/
const SETTINGS = {
    directDomains: ["fsend.cn", "international-gfe.download.nvidia.com"],
    directDomainSuffixes: ["tuotuoyun.us", "tuotuoyun.vip"],
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
};
const SUPPORTED_PROXY_TYPES = new Set(["vless", "anytls"]);
const C_PROVIDER_RE = /(?:^|[^A-Za-z0-9])C(?:机场|機場)?(?:$|[^A-Za-z0-9])/i;
const RESIDENTIAL_RE =
    /家宽|家寬|家庭宽带|家庭寬頻|住宅(?:IP|网络|網路|寬頻|宽带)?|原生住宅|住宅原生|residential|residential\s*ip|home\s*(?:ip|broadband)|isp\s*ip/i;
const INFO_NODE_RE =
    /群|返利|循环|官网|客服|网站|网址|获取|订阅|流量|到期|下次|版本|官址|备用|过期|已用|联系|邮箱|工单|贩卖|通知|倒卖|防止|国内|地址|频道|无法|说明|使用|提示|访问|支持|教程|关注|更新|作者|加入|超时|收藏|福利|邀请|好友|失联|选择|剩余|公益|发布|DIZTNA|通路|登录|禁止|定时|渠道|牢记|永久|余额|阁下|本站|刷新|导航|建议|重置|以下|⚠️|@|Expire|https?:\/\//iu;
const NEARBY_RE =
    /🇭🇰|香港|(?:^|[^A-Za-z])HK(?:$|[^A-Za-z])|Hong\s*Kong|🇲🇴|澳門|澳门|(?:^|[^A-Za-z])MO(?:$|[^A-Za-z])|Macao|Macau|🇹🇼|台灣|台湾|台北|高雄|(?:^|[^A-Za-z])TW(?:$|[^A-Za-z])|Taiwan|🇰🇷|韓國|韩国|首爾|首尔|(?:^|[^A-Za-z])KR(?:$|[^A-Za-z])|Korea|Seoul|🇸🇬|新加坡|獅城|狮城|(?:^|[^A-Za-z])SG(?:$|[^A-Za-z])|Singapore|🇲🇾|馬來西亞|马来西亚|大馬|大马|(?:^|[^A-Za-z])MY(?:$|[^A-Za-z])|Malaysia|🇹🇭|泰國|泰国|曼谷|(?:^|[^A-Za-z])TH(?:$|[^A-Za-z])|Thailand|Bangkok|🇻🇳|越南|(?:^|[^A-Za-z])VN(?:$|[^A-Za-z])|Vietnam|🇵🇭|菲律賓|菲律宾|馬尼拉|马尼拉|(?:^|[^A-Za-z])PH(?:$|[^A-Za-z])|Philippines|Manila|🇮🇩|印度尼西亞|印度尼西亚|印尼|雅加達|雅加达|(?:^|[^A-Za-z])ID(?:$|[^A-Za-z])|Indonesia|Jakarta|🇧🇳|汶萊|文莱|(?:^|[^A-Za-z])BN(?:$|[^A-Za-z])|Brunei|🇰🇭|柬埔寨|(?:^|[^A-Za-z])KH(?:$|[^A-Za-z])|Cambodia|🇱🇦|寮國|寮国|老撾|老挝|(?:^|[^A-Za-z])LA(?:$|[^A-Za-z])|Laos|🇲🇲|緬甸|缅甸|(?:^|[^A-Za-z])MM(?:$|[^A-Za-z])|Myanmar|Burma/i;
const JAPAN_RE = /🇯🇵|日本|(?:^|[^A-Za-z])JP(?:$|[^A-Za-z])|Japan/i;
const META = "https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta";
function metaDomain(name) {
    return {
        type: "http",
        format: "mrs",
        interval: 86400,
        behavior: "domain",
        url: `${META}/geo/geosite/${name}.mrs`,
        path: `./ruleset/${name}.mrs`,
        "path-in-bundle": `geo/geosite/${name}.mrs`,
    };
}
function metaIp(name, local = name) {
    return {
        type: "http",
        format: "mrs",
        interval: 86400,
        behavior: "ipcidr",
        url: `${META}/geo/geoip/${name}.mrs`,
        path: `./ruleset/${local}.mrs`,
        "path-in-bundle": `geo/geoip/${name}.mrs`,
    };
}
function unique(values) {
    return [...new Set((values || []).filter(Boolean))];
}
function isObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function isCAirportProxy(proxy) {
    const text = [proxy?.name, proxy?.provider, proxy?.["provider-name"], proxy?.source, proxy?._provider].filter(Boolean).join(" ");
    return C_PROVIDER_RE.test(text);
}
function isResidentialProxy(proxy) {
    return RESIDENTIAL_RE.test(String(proxy?.name || ""));
}
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
        throw new Error("沒有可用節點：C 機場、家寬節點與無效資訊節點已被過濾");
    }
    return result;
}
function buildProxyGroups(proxies) {
    const allNames = unique(proxies.map((proxy) => proxy.name));
    const nearbyNames = unique(
        proxies
            .filter((proxy) => {
                const name = String(proxy.name || "");
                return NEARBY_RE.test(name) && !JAPAN_RE.test(name);
            })
            .map((proxy) => proxy.name),
    );
    if (!nearbyNames.length) {
        throw new Error("沒有找到可供默认代理使用的周邊地區節點");
    }
    return [
        {
            name: GROUP.DEFAULT,
            type: "select",
            proxies: [GROUP.AUTO, GROUP.MANUAL],
            "default-selected": GROUP.AUTO,
            icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Proxy.png",
        },
        {
            name: GROUP.AUTO,
            type: "url-test",
            proxies: nearbyNames,
            url: SETTINGS.healthCheck.url,
            interval: SETTINGS.healthCheck.interval,
            timeout: SETTINGS.healthCheck.timeout,
            tolerance: SETTINGS.healthCheck.tolerance,
            lazy: SETTINGS.healthCheck.lazy,
            "max-failed-times": SETTINGS.healthCheck.maxFailedTimes,
            "empty-fallback": "REJECT",
            "exclude-type": "DIRECT",
            icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Auto.png",
        },
        {
            name: GROUP.MANUAL,
            type: "select",
            proxies: allNames,
            icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Rocket.png",
        },
    ];
}
function cleanDomain(value) {
    return String(value || "")
        .trim()
        .replace(/^\+\./, "")
        .replace(/^\./, "")
        .toLowerCase();
}
function buildDirectRules() {
    const rules = [];
    for (const value of SETTINGS.directDomains) {
        const domain = cleanDomain(value);
        if (domain) {
            rules.push(`DOMAIN,${domain},DIRECT`);
        }
    }
    for (const value of SETTINGS.directDomainSuffixes) {
        const domain = cleanDomain(value);
        if (domain) {
            rules.push(`DOMAIN-SUFFIX,${domain},DIRECT`);
        }
    }
    return rules;
}
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
function main(config) {
    const proxies = filterProxies(config || {});
    const proxyGroups = buildProxyGroups(proxies);
    const dns = buildDns(config || {});
    const hosts = buildHosts(config || {});
    const ruleProviders = {
        private: metaDomain("private"),
        private_ip: metaIp("private", "private_ip"),
        cn: metaDomain("cn"),
        cn_ip: metaIp("cn", "cn_ip"),
    };
    const rules = [
        ...buildDirectRules(),
        "RULE-SET,private,DIRECT",
        "RULE-SET,private_ip,DIRECT,no-resolve",
        "RULE-SET,cn,DIRECT",
        "RULE-SET,cn_ip,DIRECT,no-resolve",
        `MATCH,${GROUP.DEFAULT}`,
    ];
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
                    ports: [443, 8443],
                },
                QUIC: {
                    ports: [443, 8443],
                },
            },
            "skip-domain": ["Mijia Cloud", "+.push.apple.com"],
        },
        proxies,
        "proxy-groups": proxyGroups,
        "rule-providers": ruleProviders,
        rules,
    };
    assertUniqueNames(proxies, proxyGroups);
    return newConfig;
}
