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

function parseVless(uri) {
    const url = new URL(uri);
    const p = url.searchParams;

    const network = (p.get("type") || "tcp").toLowerCase();
    const security = (p.get("security") || "").toLowerCase();

    const proxy = {
        name: nodeName(url),
        type: "vless",
        server: url.hostname,
        port: port(url.port),
        uuid: decodeURIComponent(url.username),
        udp: true
    };

    const flow = p.get("flow");
    if (flow) proxy.flow = flow;

    const encryption = p.get("encryption");
    if (encryption) proxy.encryption = encryption;

    const packetEncoding =
        p.get("packetEncoding") ||
        p.get("packet-encoding");

    if (packetEncoding) {
        proxy["packet-encoding"] = packetEncoding;
    }

    if (security === "tls" || security === "reality") {
        proxy.tls = true;
    }

    const sni = p.get("sni");
    if (sni) proxy.servername = sni;

    const fp = p.get("fp");
    if (fp) proxy["client-fingerprint"] = fp;

    if (/^(?:1|true)$/i.test(p.get("insecure") || "")) {
        proxy["skip-cert-verify"] = true;
    }

    if (security === "reality") {
        const publicKey = p.get("pbk");
        const shortId = p.get("sid");

        if (publicKey) {
            proxy["reality-opts"] = {
                "public-key": publicKey
            };

            if (shortId) {
                proxy["reality-opts"]["short-id"] = shortId;
            }
        }
    }

    if (network !== "tcp" && network !== "none") {
        proxy.network = network;
    }

    if (network === "ws") {
        const ws = {};

        const wsPath = p.get("path");
        const host = p.get("host");

        if (wsPath) ws.path = wsPath;
        if (host) ws.headers = { Host: host };

        if (Object.keys(ws).length) {
            proxy["ws-opts"] = ws;
        }
    }

    if (network === "grpc") {
        const service =
            p.get("serviceName") ||
            p.get("service-name");

        if (service) {
            proxy["grpc-opts"] = {
                "grpc-service-name": service
            };
        }
    }

    return proxy;
}

function parseAnyTLS(uri) {
    const url = new URL(uri);
    const p = url.searchParams;

    const proxy = {
        name: nodeName(url),
        type: "anytls",
        server: url.hostname,
        port: port(url.port),
        password: decodeURIComponent(url.username),
        udp: true
    };

    const sni = p.get("sni");
    if (sni) proxy.sni = sni;

    const fp = p.get("fp");
    if (fp) proxy["client-fingerprint"] = fp;

    if (/^(?:1|true)$/i.test(p.get("insecure") || "")) {
        proxy["skip-cert-verify"] = true;
    }

    const alpn = p.get("alpn");

    if (alpn) {
        proxy.alpn = alpn
            .split(",")
            .map(v => v.trim())
            .filter(Boolean);
    }

    return proxy;
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

function port(value) {
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

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Subscription API listening on ${PORT}`);
});