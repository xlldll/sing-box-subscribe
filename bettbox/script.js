const ruleOptionsEnable = {
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
};

const excludeHighRateProxiesEnable = false;

const excludeFilter =
    /群|返利|循环|官网|客服|网站|网址|获取|订阅|流量|到期|机场|下次|版本|官址|备用|过期|已用|联系|邮箱|工单|贩卖|通知|倒卖|防止|国内|地址|频道|无法|说明|使用|提示|访问|支持|教程|关注|更新|作者|加入|超时|收藏|福利|邀请|好友|失联|选择|剩余|公益|发布|DIZTNA|通路|登录|禁止|定时|渠道|牢记|永久|余额|阁下|本站|刷新|导航|建议|重置|以下|⚠️|@|Expire|http|com/u;

const cAirportDefinition = {
    regex: /(?:^|[\s|｜_\-【\[(])C(?:机场|機場)?(?:$|[\s|｜_\-】\])])/i,
};

const residentialProxyDefinition = {
    name: "家宽",
    regex: /家宽|家寬|家庭宽带|家庭寬頻|住宅(?:IP|网络|網路)?|residential|home\s*(?:ip|broadband)/i,
    icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Xbox.png",
};

function isCAirportProxy(proxy) {
    const text = [
        proxy?.name,
        proxy?.provider,
        proxy?.["provider-name"],
        proxy?.source,
        proxy?._provider,
    ].filter(Boolean).join(" ");

    return cAirportDefinition.regex.test(text);
}

const rules = [
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

const regionDefinitions = [
    {
        name: "香港",
        regex: /🇭🇰|港|HK|[Hh]ong\s*[Kk]ong/,
        icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Hong_Kong.png",
    },

    {
        name: "周邊地區",
        regex:
            /🇭🇰|香港|(?<![A-Za-z])HK(?![A-Za-z])|Hong\s*Kong|🇲🇴|澳門|澳门|(?<![A-Za-z])MO(?![A-Za-z])|Macao|Macau|🇹🇼|台灣|台湾|台北|高雄|(?<![A-Za-z])TW(?![A-Za-z])|Taiwan|🇰🇷|韓國|韩国|首爾|首尔|(?<![A-Za-z])KR(?![A-Za-z])|Korea|Seoul|🇸🇬|新加坡|獅城|狮城|(?<![A-Za-z])SG(?![A-Za-z])|Singapore|🇲🇾|馬來西亞|马来西亚|大馬|大马|(?<![A-Za-z])MY(?![A-Za-z])|Malaysia|🇹🇭|泰國|泰国|曼谷|(?<![A-Za-z])TH(?![A-Za-z])|Thailand|Bangkok|🇻🇳|越南|(?<![A-Za-z])VN(?![A-Za-z])|Vietnam|🇵🇭|菲律賓|菲律宾|馬尼拉|马尼拉|(?<![A-Za-z])PH(?![A-Za-z])|Philippines|Manila|🇮🇩|印度尼西亞|印度尼西亚|印尼|雅加達|雅加达|(?<![A-Za-z])ID(?![A-Za-z])|Indonesia|Jakarta|🇧🇳|汶萊|文莱|(?<![A-Za-z])BN(?![A-Za-z])|Brunei|🇰🇭|柬埔寨|(?<![A-Za-z])KH(?![A-Za-z])|Cambodia|🇱🇦|寮國|寮国|老撾|老挝|(?<![A-Za-z])LA(?![A-Za-z])|Laos|🇲🇲|緬甸|缅甸|(?<![A-Za-z])MM(?![A-Za-z])|Myanmar|Burma/i,
        icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Macao.png",
    },

    {
        name: "日本",
        regex: /🇯🇵|日本|JP|[Jj]apan/,
        icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Japan.png",
    },

    {
        name: "美国",
        regex: /🇺🇸|美|US|[Aa]merica|[Uu]nited\s*[Ss]tates/,
        icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/United_States.png",
    },

    {
        name: "新加坡",
        regex: /🇸🇬|新加坡|狮城|SG|[Ss]ingapore/,
        icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Singapore.png",
    },

    {
        name: "台湾",
        regex: /🇹🇼|台湾|TW|[Tt]aiwan/,
        icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Taiwan.png",
    },

    {
        name: "低倍率节点",
        regex: /^(?!.*(?:剩|期|客户端|软件)).*(?:(?<!\d)0\.[0-5]|下载|低倍)/,
        icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Available_1.png",
    },

    {
        name: "高倍率节点",
        regex:
            /(?:[*×xX✕✖⨉]\s*(?:[2-9]\d*|[1-9]\d+)(?:\.\d+)?)|(?:(?<![\d.])(?:[2-9]\d*|[1-9]\d+)(?:\.\d+)?\s*(?:倍|[*×xX✕✖⨉]))/u,
        icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Airport.png",
    },
];

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

const baseRuleProviders = {
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

const groupBaseOption = {
    interval: 1800,
    timeout: 3000,
    url: "https://g.cn/generate_204",
    lazy: true,
    "max-failed-times": 2,
    "empty-fallback": "REJECT",
};

const selectBaseOption = {
    ...groupBaseOption,
    type: "select",
    hidden: false,
};

const urlTestBaseOption = {
    ...groupBaseOption,
    type: "url-test",
    tolerance: 50,
    "exclude-type": "DIRECT",
    icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Auto.png",
    hidden: true,
};

const loadBalanceBaseOption = {
    ...groupBaseOption,
    type: "load-balance",
    strategy: "sticky-sessions",
    "exclude-type": "DIRECT",
    icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Round_Robin.png",
    hidden: true,
};

const serviceConfigs = [
    {
        name: "AI",
        defaultSelected: "台灣",
        preferResidential: true,
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

    {
        name: "Facebook",
        defaultSelected: "台湾",
        preferResidential: true,
        providers: {
            facebook: {
                ...ruleProviderCommonDomain,
                url: "https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/facebook.mrs",
                path: "./ruleset/facebook.mrs",
                "path-in-bundle": "geo/geosite/facebook.mrs",
            },
            facebook_ip: {
                ...ruleProviderCommonIpcidr,
                url: "https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geoip/facebook.mrs",
                path: "./ruleset/facebook_ip.mrs",
                "path-in-bundle": "geo/geoip/facebook.mrs",
            },
            instagram_sensitive: {
                ...ruleProviderCommonDomain,
                url: "https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/instagram.mrs",
                path: "./ruleset/instagram_sensitive.mrs",
                "path-in-bundle": "geo/geosite/instagram.mrs",
            },
            threads: {
                ...ruleProviderCommonDomain,
                url: "https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/threads.mrs",
                path: "./ruleset/threads.mrs",
                "path-in-bundle": "geo/geosite/threads.mrs",
            },
        },
        icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Facebook.png",
        rules: [
            "RULE-SET,facebook,Facebook",
            "RULE-SET,facebook_ip,Facebook,no-resolve",
            "RULE-SET,instagram_sensitive,Facebook",
            "RULE-SET,threads,Facebook",
        ],
    },

    {
        name: "GoogleAccount",
        defaultSelected: "台湾",
        preferResidential: true,
        icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Google_Search.png",
        providers: {},
        rules: [
            "DOMAIN,accounts.google.com,GoogleAccount",
            "DOMAIN,myaccount.google.com,GoogleAccount",
            "DOMAIN,oauth2.googleapis.com,GoogleAccount",
        ],
    },

    {
        name: "MicrosoftAccount",
        defaultSelected: "台湾",
        preferResidential: true,
        icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Microsoft.png",
        providers: {},
        rules: [
            "DOMAIN,login.live.com,MicrosoftAccount",
            "DOMAIN,account.microsoft.com,MicrosoftAccount",
            "DOMAIN,login.microsoftonline.com,MicrosoftAccount",
            "DOMAIN,login.windows.net,MicrosoftAccount",
        ],
    },

    {
        name: "AppleID",
        defaultSelected: "台湾",
        preferResidential: true,
        icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Apple.png",
        providers: {},
        rules: [
            "DOMAIN,appleid.apple.com,AppleID",
            "DOMAIN,idmsa.apple.com,AppleID",
            "DOMAIN,account.apple.com,AppleID",
        ],
    },

    {
        name: "Media",
        defaultSelected: "台湾",
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
        rules: [
            "RULE-SET,google,Google",
            "RULE-SET,google_ip,Google,no-resolve",
        ],
    },

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

    {
        name: "Twitter",
        preferResidential: true,
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

    {
        name: "Reddit",
        preferResidential: true,
        providers: {
            reddit: {
                ...ruleProviderCommonDomain,
                url: "https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/reddit.mrs",
                path: "./ruleset/reddit.mrs",
                "path-in-bundle": "geo/geosite/reddit.mrs",
            },
        },
        icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Reddit.png",
        rules: ["RULE-SET,reddit,Reddit"],
    },

    {
        name: "PayPal",
        preferResidential: true,
        providers: {
            paypal: {
                ...ruleProviderCommonDomain,
                url: "https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/paypal.mrs",
                path: "./ruleset/paypal.mrs",
                "path-in-bundle": "geo/geosite/paypal.mrs",
            },
        },
        icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/PayPal.png",
        rules: ["RULE-SET,paypal,PayPal"],
    },

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

function matchDomainPattern(pattern, domains) {
    pattern = pattern.toLowerCase();

    if (
        !pattern.includes("*") &&
        !pattern.startsWith("+.") &&
        !pattern.startsWith(".")
    ) {
        return domains.has(pattern);
    }

    if (pattern.startsWith("+.")) {
        const suffix = pattern.slice(2);

        for (const domain of domains) {
            if (domain === suffix || domain.endsWith(`.${suffix}`)) {
                return true;
            }
        }

        return false;
    }

    if (pattern.startsWith(".")) {
        const suffix = pattern.slice(1);

        for (const domain of domains) {
            if (domain !== suffix && domain.endsWith(`.${suffix}`)) {
                return true;
            }
        }

        return false;
    }

    const patternParts = pattern.split(".");

    for (const domain of domains) {
        const domainParts = domain.split(".");

        if (patternParts.length !== domainParts.length) {
            continue;
        }

        let matched = true;

        for (let i = 0; i < patternParts.length; i++) {
            if (
                patternParts[i] !== "*" &&
                patternParts[i] !== domainParts[i]
            ) {
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

function main(config) {
    const newConfig = {};

    const highRateRegex = excludeHighRateProxiesEnable
        ? regionDefinitions.find(
            (region) => region.name === "高倍率节点",
        )?.regex
        : null;

    const filteredProxies = [];
    const residentialProxies = [];
    const regularProxies = [];

    for (const proxy of config.proxies || []) {
        const type = String(proxy?.type || "").toLowerCase();
        const name = String(proxy?.name || "");

        if (type !== "vless" && type !== "anytls") continue;

        if (highRateRegex && highRateRegex.test(name)) continue;

        const isC = isCAirportProxy(proxy);
        const isResidential =
            residentialProxyDefinition.regex.test(name);

        const infoCheckName = isC
            ? name.replace(/C\s*(?:机场|機場)/gi, "")
            : name;

        if (excludeFilter.test(infoCheckName)) continue;

        if (isC && !isResidential) continue;

        filteredProxies.push(proxy);

        if (isC && isResidential) {
            residentialProxies.push(proxy);
        } else {
            regularProxies.push(proxy);
        }
    }

    if (!filteredProxies.length) {
        throw new Error(
            "沒有可用節點：僅保留 VLESS / AnyTLS，且 C 機場只保留家寬節點",
        );
    }

    const residentialProxyNames =
        residentialProxies.map((proxy) => proxy.name);

    const regularProxyNames =
        regularProxies.map((proxy) => proxy.name);

    const hasResidentialProxies =
        residentialProxyNames.length > 0;

    const hasRegularProxies =
        regularProxyNames.length > 0;

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

    for (const proxy of regularProxies) {
        let matched = false;

        for (const region of regionDefinitions) {
            if (region.regex.test(proxy.name)) {
                regionGroups[region.name].proxies.push(
                    proxy.name,
                );

                if (
                    region.name !== "低倍率节点" &&
                    region.name !== "高倍率节点"
                ) {
                    matched = true;
                }
            }
        }

        if (!matched) {
            otherProxies.push(proxy.name);
        }
    }

    const generatedRegionGroups = regionDefinitions
        .filter(
            (region) =>
                regionGroups[region.name].proxies.length > 0,
        )
        .flatMap((region) =>
            createRegionGroup(
                region.name,
                region.icon,
                regionGroups[region.name].proxies,
            ),
        );

    if (otherProxies.length > 0) {
        generatedRegionGroups.push(
            ...createRegionGroup(
                "其他节点",
                "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/World_Map.png",
                otherProxies,
            ),
        );
    }

    const residentialGroups = hasResidentialProxies
        ? [
            {
                ...selectBaseOption,
                name: residentialProxyDefinition.name,
                icon: residentialProxyDefinition.icon,
                proxies: residentialProxyNames,
            },
        ]
        : [];

    const functionalGroups = [];

    const finalRules = [...rules];

    const finalRuleProviders = {
        ...baseRuleProviders,
    };

    const groupNamesOfSelect = generatedRegionGroups
        .filter((group) => group.type === "select")
        .map((group) => group.name);

    const normalBaseGroupNames = hasRegularProxies
        ? ["手动选择", "自动选择", "负载均衡"]
        : [];

    const defaultProxyCandidates = [
        ...groupNamesOfSelect,

        ...(hasResidentialProxies
            ? [residentialProxyDefinition.name]
            : []),

        ...normalBaseGroupNames,
    ];


    /*
     * 默认代理
     */
    functionalGroups.push({
        ...selectBaseOption,

        name: "默认代理",

        proxies: defaultProxyCandidates,

        icon:
            "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Proxy.png",
    });


    /*
     * 敏感代理组
     *
     * 只包含：
     * 默认代理
     * 家宽
     *
     * 手动选择。
     */
    const sensitiveProxyGroup = {
        ...selectBaseOption,

        name: "敏感代理组",

        proxies: [
            "默认代理",

            ...(hasResidentialProxies
                ? [residentialProxyDefinition.name]
                : []),
        ],

        icon:
            "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Proxy.png",
    };


    /*
     * 基础代理组
     */
    if (hasRegularProxies) {
        functionalGroups.push(
            {
                ...selectBaseOption,

                name: "手动选择",

                proxies: [
                    ...regularProxyNames,
                    ...residentialProxyNames,
                ],

                icon:
                    "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Rocket.png",
            },

            {
                ...loadBalanceBaseOption,

                name: "负载均衡",

                proxies: regularProxyNames,
            },

            {
                ...urlTestBaseOption,

                name: "自动选择",

                proxies: regularProxyNames,
            },
        );

    } else if (hasResidentialProxies) {

        functionalGroups.push({
            ...selectBaseOption,

            name: "手动选择",

            proxies: residentialProxyNames,

            icon:
                "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Rocket.png",
        });
    }


    /*
     * 服务分流组
     */
    for (const svc of serviceConfigs) {

        if (!ruleOptionsEnable[svc.name]) {
            continue;
        }

        finalRules.push(...svc.rules);

        Object.assign(
            finalRuleProviders,
            svc.providers || {},
        );


        /*
         * preferResidential = true
         * 代表敏感服务。
         *
         * 敏感服务：
         * 敏感代理组放第一位。
         *
         * 普通服务：
         * 保持原来的组结构。
         */
        const groupProxies = svc.reject

            ? [
                "REJECT",
                "REJECT-DROP",
                "PASS",
            ]

            : [
                ...(svc.preferResidential
                    ? ["敏感代理组"]
                    : []),

                "默认代理",

                ...(hasResidentialProxies
                    ? [residentialProxyDefinition.name]
                    : []),

                ...normalBaseGroupNames,

                ...groupNamesOfSelect,

                ...(svc.direct
                    ? ["直连"]
                    : []),
            ];


        let effectiveDefaultSelected;


        if (!svc.reject) {

            /*
             * 原来：
             *
             * preferResidential
             * → 家宽
             *
             * 现在：
             *
             * preferResidential
             * → 敏感代理组
             */
            const requestedDefault =
                svc.preferResidential &&
                    hasResidentialProxies

                    ? "敏感代理组"

                    : svc.defaultSelected;


            if (
                requestedDefault &&
                groupProxies.includes(
                    requestedDefault
                )
            ) {

                effectiveDefaultSelected =
                    requestedDefault;

            } else {

                effectiveDefaultSelected =
                    "默认代理";
            }
        }


        functionalGroups.push({
            ...selectBaseOption,

            name: svc.name,

            icon: svc.icon,

            proxies: groupProxies,

            ...(
                effectiveDefaultSelected !==
                undefined && {

                    "default-selected":
                        effectiveDefaultSelected,
                }
            ),
        });
    }


    /*
     * 漏网之鱼 / 直连
     */
    functionalGroups.push(
        {
            ...selectBaseOption,

            name: "漏网之鱼",

            proxies: [
                "默认代理",
                "直连",
            ],

            icon:
                "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Stack.png",
        },

        {
            ...selectBaseOption,

            name: "直连",

            proxies: [
                "🇨🇳 直连 | 双栈",
                "🇨🇳 直连 | IPv4优先",
                "🇨🇳 直连 | IPv6优先",
            ],

            url:
                "https://connectivitycheck.platform.hicloud.com/generate_204",

            icon:
                "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/China_Map.png",
        },
    );


    /*
     * GLOBAL
     */
    const globalGroup = {
        ...selectBaseOption,

        name: "GLOBAL",

        proxies: [
            "敏感代理组",

            ...residentialGroups.map(
                (group) => group.name,
            ),

            ...functionalGroups.map(
                (group) => group.name,
            ),

            ...generatedRegionGroups.map(
                (group) => group.name,
            ),
        ],

        icon:
            "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Global.png",
    };

    const originalDnsConfig =
        config.dns || {};

    const commonDnsRegex =
        /(223\.5\.5\.5|223\.6\.6\.6|119\.29\.29\.29|1\.12\.12\.12|120\.53\.53\.53|114\.114\.114\.114|180\.76\.76\.76|1\.1\.1\.1|1\.0\.0\.1|8\.8\.8\.8|8\.8\.4\.4|94\.140\.14\.14|94\.140\.15\.15|127\.0\.0\.1|alidns|doh\.pub|dot\.pub|dnspod|dns\.baidu|dns\.google|cloudflare|adguard|system)/i;

    const originalProxyServerNameserver = (
        originalDnsConfig[
        "proxy-server-nameserver"
        ] || []
    ).filter(
        (dns) =>
            !commonDnsRegex.test(String(dns)),
    );

    const proxyDomains = new Set(
        filteredProxies
            .filter(
                (proxy) =>
                    typeof proxy.server === "string",
            )
            .map((proxy) =>
                proxy.server.toLowerCase(),
            ),
    );

    const originalPolicyNameserver = {};

    for (const policy of [
        originalDnsConfig[
        "nameserver-policy"
        ] || {},

        originalDnsConfig[
        "proxy-server-nameserver-policy"
        ] || {},
    ]) {
        for (const [domain, dns] of Object.entries(
            policy,
        )) {
            if (
                matchDomainPattern(
                    domain,
                    proxyDomains,
                )
            ) {
                originalPolicyNameserver[domain] =
                    dns;
            }
        }
    }

    const chinaDNS = [
        "https://dns.alidns.com/dns-query#DIRECT",
        "https://doh.pub/dns-query#DIRECT",
    ];

    const foreignDNS = [
        "https://dns.cloudflare.com/dns-query#默认代理",
        "https://dns.google/dns-query#默认代理",
    ];

    newConfig["dns"] = {
        enable: true,
        ipv6: true,

        "use-hosts": true,
        "use-system-hosts": true,

        "cache-algorithm": "arc",

        "enhanced-mode": "fake-ip",

        "fake-ip-range": "198.18.0.1/16",

        "fake-ip-filter": [
            "rule-set:private",
            "rule-set:fakeip_filter",
        ],

        "proxy-server-nameserver": [
            ...chinaDNS,
            ...originalProxyServerNameserver,
        ],

        ...(Object.keys(
            originalPolicyNameserver,
        ).length > 0 && {
            "proxy-server-nameserver-policy":
                originalPolicyNameserver,
        }),

        "default-nameserver": [
            "223.5.5.5",
            "119.29.29.29",
        ],

        nameserver: [...foreignDNS],

        "nameserver-policy": {
            "rule-set:cn": [...chinaDNS],
        },

        "direct-nameserver": [
            "system",
            "223.5.5.5",
            "119.29.29.29",
        ],
    };

    const originalHosts =
        config.hosts || {};

    const proxyHosts = {};

    for (const [domain, value] of Object.entries(
        originalHosts,
    )) {
        if (
            matchDomainPattern(
                domain,
                proxyDomains,
            )
        ) {
            proxyHosts[domain] = value;
        }
    }

    newConfig["hosts"] = {
        "dns.alidns.com": [
            "223.5.5.5",
            "223.6.6.6",
        ],

        "doh.pub": [
            "1.12.12.12",
            "120.53.53.53",
        ],

        "dns.cloudflare.com": [
            "1.1.1.1",
            "1.0.0.1",
        ],

        "dns.google": [
            "8.8.8.8",
            "8.8.4.4",
        ],

        "services.googleapis.cn": [
            "services.googleapis.com",
        ],

        "+.mcdn.bilivideo.com": [
            "0.0.0.0",
        ],

        "+.mcdn.bilivideo.cn": [
            "0.0.0.0",
        ],

        "+.edge.mountaintoys.cn": [
            "0.0.0.0",
        ],

        ...proxyHosts,
    };

    newConfig["allow-lan"] = true;

    newConfig["ipv6"] = true;

    newConfig["mode"] = "rule";

    newConfig["log-level"] = "info";

    newConfig["bind-address"] = "*";

    newConfig["unified-delay"] = true;

    newConfig["tcp-concurrent"] = true;

    newConfig["find-process-mode"] =
        "strict";

    newConfig["external-controller"] =
        "127.0.0.1:9090";

    newConfig["external-ui"] = "ui";

    newConfig["external-ui-url"] =
        "https://github.com/Zephyruso/zashboard/releases/latest/download/dist.zip";

    newConfig["profile"] = {
        "store-selected": true,
        "store-fake-ip": true,
    };

    newConfig["ntp"] = {
        enable: true,
        "write-to-system": false,
        server: "ntp.aliyun.com",
        port: 123,
        interval: 60,
    };

    newConfig["tun"] = {
        enable: true,
        stack: "system",
        "auto-route": true,
        "strict-route": true,
        "auto-redirect": false,
        "auto-detect-interface": true,
        "dns-hijack": [
            "any:53",
            "tcp://any:53",
        ],
    };

    newConfig["proxies"] = [
        ...filteredProxies,

        {
            name: "🇨🇳 直连 | 双栈",
            type: "direct",
        },

        {
            name: "🇨🇳 直连 | IPv4优先",
            type: "direct",
            "ip-version": "ipv4-prefer",
        },

        {
            name: "🇨🇳 直连 | IPv6优先",
            type: "direct",
            "ip-version": "ipv6-prefer",
        },
    ];

    newConfig["proxy-groups"] = [
        sensitiveProxyGroup,
        globalGroup,
        ...functionalGroups,
        ...residentialGroups,
        ...generatedRegionGroups,
    ];

    newConfig["rule-providers"] =
        finalRuleProviders;

    newConfig["rules"] = [
        "RULE-SET,github,默认代理",

        ...finalRules,

        "RULE-SET,gfw,默认代理",

        "RULE-SET,cn_additional,直连",

        "RULE-SET,cn_ip,直连",

        "MATCH,漏网之鱼",
    ];

    return newConfig;
}