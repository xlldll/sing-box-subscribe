const express = require("express");
const YAML = require("yaml");
const fs = require("node:fs/promises");
const path = require("node:path");

const app = express();

const PORT = Number(process.env.PORT || 9000);
const TIMEOUT = Number(process.env.FETCH_TIMEOUT || 15000);
const USER_AGENT = process.env.FETCH_USER_AGENT || "mihomo";

const REMOTE_PROVIDERS = [
    {
        id: "A",
        name: process.env.SUB_A_NAME || "A",
        url: process.env.SUB_A_URL
    },
    {
        id: "B",
        name: process.env.SUB_B_NAME || "B",
        url: process.env.SUB_B_URL
    }
].filter(p => p.url);

const LOCAL_PROVIDERS = [
    {
        id: "C",
        name: "C",
        file: process.env.SUB_C_FILE || path.join(__dirname, "config", "Tuo.yaml")
    }
];

app.get("/", (_, res) => {
    res.send("OK");
});

app.get("/sub", async (req, res) => {
    if (
        !process.env.SUBSCRIPTION_KEY ||
        req.query.key !== process.env.SUBSCRIPTION_KEY
    ) {
        return res.status(404).send("Not Found");
    }

    const tasks = [
        ...REMOTE_PROVIDERS.map(loadRemoteProvider),
        ...LOCAL_PROVIDERS.map(loadLocalProvider)
    ];

    const results = await Promise.allSettled(tasks);

    const proxies = [];
    const success = [];
    const failed = [];

    results.forEach((result, i) => {
        const providers = [...REMOTE_PROVIDERS, ...LOCAL_PROVIDERS];
        const provider = providers[i];

        if (result.status === "fulfilled") {
            proxies.push(...result.value);
            success.push(provider.id);
        } else {
            failed.push(provider.id);

            console.error(
                `[${provider.id}] ${result.reason?.message || result.reason}`
            );
        }
    });

    const output = dedupeNames(proxies);

    res.set("Content-Type", "text/yaml; charset=utf-8");
    res.set("Cache-Control", "no-store");
    res.set("X-Proxy-Count", String(output.length));
    res.set("X-Providers-Success", success.join(","));

    if (failed.length) {
        res.set("X-Providers-Failed", failed.join(","));
    }

    return res
        .status(output.length ? 200 : 502)
        .send(YAML.stringify({ proxies: output }));
});

async function loadRemoteProvider(provider) {
    const response = await fetch(provider.url, {
        headers: {
            "User-Agent": USER_AGENT,
            "Accept": "*/*"
        },
        redirect: "follow",
        signal: AbortSignal.timeout(TIMEOUT)
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();

    if (!text.trim()) {
        throw new Error("Empty subscription");
    }

    return parseSubscription(text).map(proxy =>
        tagProxy(proxy, provider.name)
    );
}

async function loadLocalProvider(provider) {
    const text = await fs.readFile(provider.file, "utf8");
    const config = YAML.parse(text);

    if (!config || !Array.isArray(config.proxies)) {
        throw new Error(
            `${path.basename(provider.file)} does not contain proxies`
        );
    }

    return config.proxies
        .filter(isValidProxy)
        .map(proxy => tagProxy(proxy, provider.name));
}

function parseSubscription(text) {
    const source = text.trim();

    const yaml = parseYamlProxies(source);
    if (yaml) return yaml;

    if (looksLikeUriList(source)) {
        return parseUriList(source);
    }

    const decoded = decodeBase64(source);

    if (decoded && looksLikeUriList(decoded)) {
        return parseUriList(decoded);
    }

    throw new Error("Unsupported subscription format");
}

function parseYamlProxies(text) {
    try {
        const config = YAML.parse(text);

        if (!config || !Array.isArray(config.proxies)) {
            return null;
        }

        return config.proxies.filter(isValidProxy);
    } catch {
        return null;
    }
}

function decodeBase64(text) {
    try {
        let value = text.replace(/\s+/g, "");

        if (!/^[A-Za-z0-9+/_=-]+$/.test(value)) {
            return null;
        }

        value = value
            .replace(/-/g, "+")
            .replace(/_/g, "/");

        value += "=".repeat((4 - value.length % 4) % 4);

        const decoded = Buffer
            .from(value, "base64")
            .toString("utf8");

        return decoded.includes("://")
            ? decoded
            : null;
    } catch {
        return null;
    }
}

function looksLikeUriList(text) {
    return /(?:^|\n)(?:vless|anytls):\/\//i.test(text);
}

function getParam(params, ...keys) {
    for (const key of keys) {
        const value = params.get(key);

        if (value != null && value !== "") {
            return value;
        }
    }

    return null;
}

function getBoolParam(params, ...keys) {
    const value = getParam(
        params,
        ...keys
    );

    return value != null &&
        /^(1|true|yes)$/i.test(value);
}

function parseUriList(text) {
    return text
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => {
            try {
                if (/^vless:\/\//i.test(line)) {
                    return parseVless(line);
                }

                if (/^anytls:\/\//i.test(line)) {
                    return parseAnyTLS(line);
                }

                return null;
            } catch (error) {
                console.error(`[Parser] ${error.message}`);
                return null;
            }
        })
        .filter(isValidProxy);
}

function cleanWsPath(path) {
    if (!path) {
        return "/";
    }

    return path.replace(
        /[?&]ed=\d+.*$/i,
        ""
    ) || "/";
}

function extractWsEarlyData(path) {
    if (!path) {
        return null;
    }

    const match =
        path.match(
            /(?:[?&])ed=(\d+)/i
        );

    return match
        ? toPositiveInt(match[1])
        : null;
}

function toPositiveInt(value) {
    if (value == null) {
        return null;
    }

    const n = Number(value);

    return Number.isInteger(n) &&
        n > 0
        ? n
        : null;
}

function toNonNegativeInt(value) {
    if (value == null) {
        return null;
    }

    const n = Number(value);

    return Number.isInteger(n) &&
        n >= 0
        ? n
        : null;
}

function nodeName(url) {
    if (!url.hash) {
        return `${url.hostname}:${url.port}`;
    }

    try {
        return decodeURIComponent(url.hash.slice(1));
    } catch {
        return url.hash.slice(1);
    }
}

function parsePort(value) {
    const n = Number(value);

    if (!Number.isInteger(n) || n < 1 || n > 65535) {
        throw new Error(`Invalid port: ${value}`);
    }

    return n;
}

function isValidProxy(proxy) {
    return Boolean(
        proxy &&
        typeof proxy === "object" &&
        typeof proxy.name === "string" &&
        proxy.name.trim() &&
        typeof proxy.type === "string" &&
        proxy.type.trim() &&
        typeof proxy.server === "string" &&
        proxy.server.trim() &&
        Number.isInteger(proxy.port)
    );
}

function tagProxy(proxy, provider) {
    return {
        ...proxy,
        name: `[${provider}] ${proxy.name}`
    };
}

function dedupeNames(proxies) {
    const names = new Map();

    return proxies.map(proxy => {
        const count = (names.get(proxy.name) || 0) + 1;
        names.set(proxy.name, count);

        if (count === 1) {
            return proxy;
        }

        return {
            ...proxy,
            name: `${proxy.name} #${count}`
        };
    });
}

function parseAnyTLS(uri) {
    const url = new URL(uri);

    if (
        url.protocol !== "anytls:" ||
        !url.username ||
        !url.hostname ||
        !url.port
    ) {
        throw new Error("Invalid AnyTLS URI");
    }

    const q = url.searchParams;

    const proxy = {
        name: nodeName(url),
        type: "anytls",
        server: url.hostname,
        port: parsePort(url.port),
        password: decodeURIComponent(url.username),
        udp: true
    };

    const sni = getParam(
        q,
        "sni",
        "host",
        "serverName",
        "servername"
    );

    if (sni && sni !== "none") {
        proxy.sni = sni;
    }

    const fingerprint = getParam(
        q,
        "fp",
        "client-fingerprint",
        "fingerprint"
    );

    if (fingerprint) {
        proxy["client-fingerprint"] =
            fingerprint;
    }

    if (
        getBoolParam(
            q,
            "allowInsecure",
            "insecure",
            "skip-cert-verify"
        )
    ) {
        proxy["skip-cert-verify"] = true;
    }

    const alpn = getParam(q, "alpn");

    if (alpn) {
        proxy.alpn = alpn
            .split(",")
            .map(v => v.trim())
            .filter(Boolean);
    }

    return proxy;
}

function parseVless(uri) {
    const url = new URL(uri);

    if (
        url.protocol !== "vless:" ||
        !url.username ||
        !url.hostname ||
        !url.port
    ) {
        throw new Error("Invalid VLESS URI");
    }

    const q = url.searchParams;

    const network = (
        getParam(q, "type", "network") ||
        "tcp"
    ).toLowerCase();

    const security = (
        getParam(q, "security") ||
        ""
    ).toLowerCase();

    const proxy = {
        name: nodeName(url),
        type: "vless",
        server: url.hostname,
        port: parsePort(url.port),
        uuid: decodeURIComponent(url.username),
        udp: true
    };

    // VLESS flow
    const flow = getParam(q, "flow");

    if (flow) {
        proxy.flow = flow;
    }

    // VLESS encryption
    const encryption = getParam(q, "encryption");

    if (encryption) {
        proxy.encryption = encryption;
    }

    // UDP packet encoding
    const packetEncoding = getParam(
        q,
        "packetEncoding",
        "packet-encoding"
    );

    if (packetEncoding) {
        proxy["packet-encoding"] = packetEncoding;
    }

    // TLS / Reality
    if (
        security === "tls" ||
        security === "reality"
    ) {
        proxy.tls = true;

        const sni = getParam(
            q,
            "sni",
            "serverName",
            "servername"
        );

        if (sni && sni !== "none") {
            proxy.servername = sni;
        }

        const fingerprint = getParam(
            q,
            "fp",
            "client-fingerprint",
            "fingerprint"
        );

        if (fingerprint) {
            proxy["client-fingerprint"] = fingerprint;
        }

        if (
            getBoolParam(
                q,
                "allowInsecure",
                "insecure",
                "skip-cert-verify"
            )
        ) {
            proxy["skip-cert-verify"] = true;
        }

        const alpn = getParam(q, "alpn");

        if (alpn) {
            proxy.alpn = alpn
                .split(",")
                .map(v => v.trim())
                .filter(Boolean);
        }
    }

    // Reality
    if (security === "reality") {
        const publicKey = getParam(
            q,
            "pbk",
            "publicKey",
            "public-key"
        );

        if (!publicKey) {
            throw new Error(
                "Reality VLESS missing public key"
            );
        }

        proxy["reality-opts"] = {
            "public-key": publicKey
        };

        const shortId = getParam(
            q,
            "sid",
            "shortId",
            "short-id"
        );

        if (shortId) {
            proxy["reality-opts"]["short-id"] =
                shortId;
        }
    }

    // Transport
    if (
        ["ws", "http", "h2", "grpc", "xhttp"]
            .includes(network)
    ) {
        proxy.network = network;
    }

    // WebSocket
    if (network === "ws") {
        const path =
            getParam(q, "path") ||
            "/";

        const host = getParam(
            q,
            "host",
            "sni"
        );

        const wsOpts = {
            path: cleanWsPath(path)
        };

        if (host && host !== "none") {
            wsOpts.headers = {
                Host: host
            };
        }

        const earlyData =
            extractWsEarlyData(path) ??
            toPositiveInt(
                getParam(
                    q,
                    "ed",
                    "maxEarlyData",
                    "max-early-data"
                )
            );

        if (earlyData) {
            wsOpts["max-early-data"] =
                earlyData;

            wsOpts["early-data-header-name"] =
                getParam(
                    q,
                    "eh",
                    "earlyDataHeaderName",
                    "early-data-header-name"
                ) ||
                "Sec-WebSocket-Protocol";
        }

        proxy["ws-opts"] = wsOpts;
    }

    // gRPC
    if (network === "grpc") {
        const serviceName = getParam(
            q,
            "serviceName",
            "service-name"
        );

        const grpcOpts = {};

        if (serviceName) {
            grpcOpts["grpc-service-name"] =
                serviceName;
        }

        if (
            getBoolParam(
                q,
                "multiMode",
                "multi-mode"
            )
        ) {
            grpcOpts["grpc-use-tls"] = true;
        }

        if (Object.keys(grpcOpts).length) {
            proxy["grpc-opts"] = grpcOpts;
        }
    }

    // HTTP / H2
    if (
        network === "http" ||
        network === "h2"
    ) {
        const path =
            getParam(q, "path") ||
            "/";

        const host =
            getParam(q, "host");

        const h2Opts = {
            path
        };

        if (host) {
            h2Opts.host = host
                .split(",")
                .map(v => v.trim())
                .filter(Boolean);
        }

        proxy["h2-opts"] = h2Opts;
    }

    // XHTTP
    if (network === "xhttp") {
        const xhttpOpts = {};

        const path = getParam(q, "path");
        const host = getParam(q, "host");
        const mode = getParam(q, "mode");

        if (path) {
            xhttpOpts.path = path;
        }

        if (host) {
            xhttpOpts.host = host;
        }

        if (mode) {
            xhttpOpts.mode = mode;
        }

        if (Object.keys(xhttpOpts).length) {
            proxy["xhttp-opts"] =
                xhttpOpts;
        }
    }

    // Mihomo SMUX
    const muxProtocol = getParam(
        q,
        "protocol",
        "mux",
        "smux"
    );

    if (muxProtocol) {
        proxy.smux = {
            enabled: true,
            protocol: muxProtocol
        };

        const maxStreams =
            toNonNegativeInt(
                getParam(
                    q,
                    "max_streams",
                    "maxStreams"
                )
            );

        const minStreams =
            toNonNegativeInt(
                getParam(
                    q,
                    "min_streams",
                    "minStreams"
                )
            );

        const maxConnections =
            toNonNegativeInt(
                getParam(
                    q,
                    "max_connections",
                    "maxConnections"
                )
            );

        if (maxStreams != null) {
            proxy.smux["max-streams"] =
                maxStreams;
        }

        if (minStreams != null) {
            proxy.smux["min-streams"] =
                minStreams;
        }

        if (maxConnections != null) {
            proxy.smux["max-connections"] =
                maxConnections;
        }

        if (getBoolParam(q, "padding")) {
            proxy.smux.padding = true;
        }
    }

    return proxy;
}

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Subscription API listening on ${PORT}`);
});