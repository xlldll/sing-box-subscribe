const express = require("express");
const YAML = require("yaml");

const app = express();
const PORT = Number(process.env.PORT || 9000);

const FETCH_TIMEOUT = 15000;

/*
 * =========================
 * Provider configuration
 * =========================
 *
 * Environment variables:
 *
 * SUB_A_URL
 * SUB_A_NAME
 *
 * SUB_B_URL
 * SUB_B_NAME
 *
 * SUB_C_URL
 * SUB_C_NAME
 */

const PROVIDERS = [
    {
        id: "A",
        name: process.env.SUB_A_NAME || "A",
        url: process.env.SUB_A_URL,
    },
    {
        id: "B",
        name: process.env.SUB_B_NAME || "B",
        url: process.env.SUB_B_URL,
    }
];


/*
 * =========================
 * Health check
 * =========================
 */

app.get("/", (req, res) => {
    res.status(200).send("OK");
});


/*
 * =========================
 * Aggregated subscription
 * =========================
 */

app.get("/sub", async (req, res) => {

    /*
     * Authentication
     */

    const key = req.query.key;

    if (
        !process.env.SUBSCRIPTION_KEY ||
        key !== process.env.SUBSCRIPTION_KEY
    ) {
        return res.status(404).send("Not Found");
    }


    /*
     * Enabled providers
     */

    const activeProviders = PROVIDERS.filter(
        (provider) =>
            typeof provider.url === "string" &&
            provider.url.trim()
    );

    if (activeProviders.length === 0) {
        return res
            .status(500)
            .send("No subscription providers configured");
    }


    /*
     * Fetch providers concurrently
     */

    const results = await Promise.allSettled(
        activeProviders.map(fetchProvider)
    );


    const allProxies = [];

    const successfulProviders = [];
    const failedProviders = [];


    results.forEach((result, index) => {

        const provider = activeProviders[index];

        if (result.status === "fulfilled") {

            successfulProviders.push({
                id: provider.id,
                count: result.value.length,
            });

            allProxies.push(...result.value);

        } else {

            const error =
                result.reason?.message ||
                "Unknown error";

            failedProviders.push({
                id: provider.id,
                error,
            });

            console.error(
                `[Provider ${provider.id}] ${error}`
            );
        }
    });


    /*
     * No usable provider
     */

    if (allProxies.length === 0) {

        console.error(
            "All subscription providers failed:",
            failedProviders
        );

        return res
            .status(502)
            .send("All subscription providers failed");
    }


    /*
     * Ensure unique names
     */

    const proxies =
        deduplicateProxyNames(allProxies);


    /*
     * Output minimal Mihomo YAML
     */

    const output = YAML.stringify({
        proxies,
    });


    res.set(
        "Content-Type",
        "text/yaml; charset=utf-8"
    );

    res.set(
        "Cache-Control",
        "no-store"
    );

    res.set(
        "X-Providers-Success",
        successfulProviders
            .map((p) => p.id)
            .join(",")
    );

    if (failedProviders.length > 0) {

        res.set(
            "X-Providers-Failed",
            failedProviders
                .map((p) => p.id)
                .join(",")
        );
    }

    res.set(
        "X-Proxy-Count",
        String(proxies.length)
    );


    return res
        .status(200)
        .send(output);
});


/*
 * =========================
 * Fetch provider
 * =========================
 */

async function fetchProvider(provider) {

    const controller =
        new AbortController();

    const timer =
        setTimeout(
            () => controller.abort(),
            FETCH_TIMEOUT
        );

    try {

        const response = await fetch(
            provider.url,
            {
                method: "GET",

                headers: {
                    "User-Agent": "mihomo",
                    "Accept": "*/*",
                },

                signal: controller.signal,
            }
        );


        if (!response.ok) {
            throw new Error(
                `HTTP ${response.status}`
            );
        }


        const text =
            await response.text();


        if (!text.trim()) {
            throw new Error(
                "Empty subscription"
            );
        }


        console.log(
            `[Provider ${provider.id}] ` +
            `HTTP=${response.status} ` +
            `Length=${text.length}`
        );


        /*
         * Detect and parse:
         *
         * YAML
         * Base64 URI
         * Plain URI
         */

        const proxies =
            parseSubscription(text);


        if (proxies.length === 0) {
            throw new Error(
                "No supported proxies found"
            );
        }


        /*
         * Add provider prefix
         */

        const result =
            proxies.map((proxy) => ({
                ...proxy,

                name:
                    `[${provider.name}] ` +
                    proxy.name,
            }));


        console.log(
            `[Provider ${provider.id}] ` +
            `parsed=${result.length}`
        );


        return result;

    } catch (error) {

        if (error.name === "AbortError") {

            throw new Error(
                `Timeout after ${FETCH_TIMEOUT}ms`
            );
        }

        throw error;

    } finally {

        clearTimeout(timer);
    }
}


/*
 * =========================
 * Subscription parser
 * =========================
 */

function parseSubscription(text) {

    const source =
        text.trim();


    /*
     * 1. Try Mihomo / Clash YAML
     */

    const yamlProxies =
        tryParseYaml(source);

    if (yamlProxies) {

        console.log(
            `[Parser] YAML: ${yamlProxies.length} proxies`
        );

        return yamlProxies;
    }


    /*
     * 2. Plain URI subscription
     */

    if (looksLikeUriList(source)) {

        const proxies =
            parseUriList(source);

        console.log(
            `[Parser] URI: ${proxies.length} proxies`
        );

        return proxies;
    }


    /*
     * 3. Base64 subscription
     */

    const decoded =
        tryDecodeBase64(source);

    if (
        decoded &&
        looksLikeUriList(decoded)
    ) {

        const proxies =
            parseUriList(decoded);

        console.log(
            `[Parser] Base64 URI: ${proxies.length} proxies`
        );

        return proxies;
    }


    throw new Error(
        "Unsupported subscription format"
    );
}


/*
 * =========================
 * YAML parser
 * =========================
 */

function tryParseYaml(text) {

    try {

        const config =
            YAML.parse(text);

        if (
            config &&
            typeof config === "object" &&
            Array.isArray(config.proxies)
        ) {

            return config.proxies
                .filter(isValidProxy);
        }

    } catch {
        // Not YAML.
    }

    return null;
}


/*
 * =========================
 * Base64 decoder
 * =========================
 */

function tryDecodeBase64(text) {

    try {

        /*
         * Remove whitespace/newlines
         */

        let normalized =
            text.replace(/\s+/g, "");


        /*
         * Basic validation
         */

        if (
            !/^[A-Za-z0-9+/_=-]+$/.test(
                normalized
            )
        ) {
            return null;
        }


        /*
         * URL-safe Base64
         */

        normalized =
            normalized
                .replace(/-/g, "+")
                .replace(/_/g, "/");


        /*
         * Add padding if needed
         */

        const remainder =
            normalized.length % 4;

        if (remainder) {

            normalized +=
                "=".repeat(
                    4 - remainder
                );
        }


        const decoded =
            Buffer
                .from(
                    normalized,
                    "base64"
                )
                .toString("utf8");


        /*
         * Prevent random strings being
         * treated as valid Base64.
         */

        if (
            !decoded.includes("://")
        ) {
            return null;
        }


        return decoded;

    } catch {

        return null;
    }
}


/*
 * =========================
 * URI detection
 * =========================
 */

function looksLikeUriList(text) {

    return (
        text.includes("vless://") ||
        text.includes("anytls://")
    );
}


/*
 * =========================
 * URI list parser
 * =========================
 */

function parseUriList(text) {

    const lines =
        text
            .split(/\r?\n/)
            .map(
                (line) => line.trim()
            )
            .filter(Boolean);


    const proxies = [];


    for (const line of lines) {

        try {

            let proxy = null;


            if (
                line
                    .toLowerCase()
                    .startsWith("vless://")
            ) {

                proxy =
                    parseVless(line);

            } else if (
                line
                    .toLowerCase()
                    .startsWith("anytls://")
            ) {

                proxy =
                    parseAnyTLS(line);

            } else {

                /*
                 * Unsupported protocol.
                 *
                 * Skip instead of failing
                 * the whole provider.
                 */

                continue;
            }


            if (
                proxy &&
                isValidProxy(proxy)
            ) {

                proxies.push(proxy);
            }

        } catch (error) {

            /*
             * Do NOT print complete URI.
             * It contains credentials.
             */

            console.error(
                `[Parser] skipped node: ` +
                `${error.message}`
            );
        }
    }


    return proxies;
}


/*
 * =========================
 * VLESS parser
 * =========================
 */

function parseVless(uri) {

    const url =
        new URL(uri);


    const params =
        url.searchParams;


    const name =
        getNodeName(url);


    const network =
        (
            params.get("type") ||
            "tcp"
        ).toLowerCase();


    const security =
        (
            params.get("security") ||
            ""
        ).toLowerCase();


    const proxy = {

        name,

        type: "vless",

        server:
            url.hostname,

        port:
            parsePort(url.port),

        uuid:
            decodeURIComponent(
                url.username
            ),

        udp: true,
    };


    /*
     * VLESS encryption
     */

    const encryption =
        params.get("encryption");

    if (encryption) {
        proxy.encryption =
            encryption;
    }


    /*
     * Flow
     */

    const flow =
        params.get("flow");

    if (flow) {
        proxy.flow = flow;
    }


    /*
     * Packet encoding
     */

    const packetEncoding =
        params.get("packetEncoding") ||
        params.get("packet-encoding");

    if (packetEncoding) {

        proxy["packet-encoding"] =
            packetEncoding;
    }


    /*
     * TLS / Reality
     */

    if (
        security === "tls" ||
        security === "reality"
    ) {

        proxy.tls = true;
    }


    /*
     * SNI
     */

    const sni =
        params.get("sni");

    if (sni) {
        proxy.servername = sni;
    }


    /*
     * Skip certificate verification
     */

    const insecure =
        params.get("insecure");

    if (
        insecure === "1" ||
        insecure === "true"
    ) {

        proxy["skip-cert-verify"] =
            true;
    }


    /*
     * Client fingerprint
     */

    const fp =
        params.get("fp");

    if (fp) {

        proxy["client-fingerprint"] =
            fp;
    }


    /*
     * Reality
     */

    if (security === "reality") {

        const publicKey =
            params.get("pbk");

        const shortId =
            params.get("sid");


        if (publicKey) {

            proxy["reality-opts"] = {
                "public-key":
                    publicKey,
            };


            if (shortId) {

                proxy[
                    "reality-opts"
                ][
                    "short-id"
                ] = shortId;
            }
        }
    }


    /*
     * Transport
     */

    if (
        network !== "tcp" &&
        network !== "none"
    ) {

        proxy.network =
            network;
    }


    /*
     * WebSocket
     */

    if (network === "ws") {

        const wsOpts = {};


        const path =
            params.get("path");

        if (path) {

            wsOpts.path =
                path;
        }


        const host =
            params.get("host");

        if (host) {

            wsOpts.headers = {
                Host: host,
            };
        }


        if (
            Object.keys(wsOpts).length > 0
        ) {

            proxy["ws-opts"] =
                wsOpts;
        }
    }


    /*
     * gRPC
     */

    if (network === "grpc") {

        const serviceName =
            params.get("serviceName") ||
            params.get("service-name");


        if (serviceName) {

            proxy["grpc-opts"] = {
                "grpc-service-name":
                    serviceName,
            };
        }
    }


    return proxy;
}


/*
 * =========================
 * AnyTLS parser
 * =========================
 */

function parseAnyTLS(uri) {

    const url =
        new URL(uri);


    const params =
        url.searchParams;


    const proxy = {

        name:
            getNodeName(url),

        type:
            "anytls",

        server:
            url.hostname,

        port:
            parsePort(url.port),

        password:
            decodeURIComponent(
                url.username
            ),

        udp:
            true,
    };


    /*
     * SNI
     */

    const sni =
        params.get("sni");

    if (sni) {

        proxy.sni = sni;
    }


    /*
     * Client fingerprint
     */

    const fp =
        params.get("fp");

    if (fp) {

        proxy[
            "client-fingerprint"
        ] = fp;
    }


    /*
     * insecure=1
     */

    const insecure =
        params.get("insecure");

    if (
        insecure === "1" ||
        insecure === "true"
    ) {

        proxy[
            "skip-cert-verify"
        ] = true;
    }


    /*
     * ALPN
     */

    const alpn =
        params.get("alpn");

    if (alpn) {

        proxy.alpn =
            alpn
                .split(",")
                .map(
                    (item) =>
                        item.trim()
                )
                .filter(Boolean);
    }


    return proxy;
}


/*
 * =========================
 * Node name
 * =========================
 */

function getNodeName(url) {

    if (!url.hash) {

        return (
            `${url.hostname}:` +
            `${url.port}`
        );
    }


    const raw =
        url.hash.slice(1);


    try {

        return (
            decodeURIComponent(raw) ||
            `${url.hostname}:${url.port}`
        );

    } catch {

        return (
            raw ||
            `${url.hostname}:${url.port}`
        );
    }
}


/*
 * =========================
 * Port
 * =========================
 */

function parsePort(port) {

    const value =
        Number(port);


    if (
        !Number.isInteger(value) ||
        value < 1 ||
        value > 65535
    ) {

        throw new Error(
            `Invalid port`
        );
    }


    return value;
}


/*
 * =========================
 * Proxy validation
 * =========================
 */

function isValidProxy(proxy) {

    if (
        !proxy ||
        typeof proxy !== "object"
    ) {
        return false;
    }


    if (
        typeof proxy.name !== "string" ||
        !proxy.name.trim()
    ) {
        return false;
    }


    if (
        typeof proxy.type !== "string" ||
        !proxy.type.trim()
    ) {
        return false;
    }


    if (
        typeof proxy.server !== "string" ||
        !proxy.server.trim()
    ) {
        return false;
    }


    if (
        !Number.isInteger(proxy.port)
    ) {
        return false;
    }


    return true;
}


/*
 * =========================
 * Deduplicate proxy names
 * =========================
 */

function deduplicateProxyNames(
    proxies
) {

    const counts =
        new Map();


    return proxies.map(
        (proxy) => {

            const originalName =
                proxy.name;


            const count =
                (
                    counts.get(
                        originalName
                    ) || 0
                ) + 1;


            counts.set(
                originalName,
                count
            );


            if (count === 1) {

                return proxy;
            }


            return {
                ...proxy,

                name:
                    `${originalName} #${count}`,
            };
        }
    );
}


/*
 * =========================
 * Start server
 * =========================
 */

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `Subscription aggregator ` +
            `listening on port ${PORT}`
        );
    }
);