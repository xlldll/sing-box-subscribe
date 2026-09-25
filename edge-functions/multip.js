const express = require("express");
const YAML = require("yaml");
const dns = require("dns").promises;
const app = express();
const PORT = Number(process.env.PORT || 9000);

const FETCH_TIMEOUT = 15000;
const ERROR_BODY_PREVIEW =
    Number(process.env.ERROR_BODY_PREVIEW || 800);

const FETCH_USER_AGENT =
    process.env.FETCH_USER_AGENT ||
    "mihomo";
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
    const key = req.query.key;

    if (
        !process.env.SUBSCRIPTION_KEY ||
        key !== process.env.SUBSCRIPTION_KEY
    ) {
        return res.status(404).send("Not Found");
    }

    const requestStartedAt = Date.now();
    const networkInfo = await getOutboundIp();
    try {
        const activeProviders = PROVIDERS.filter(
            (provider) =>
                typeof provider.url === "string" &&
                provider.url.trim()
        );

        if (activeProviders.length === 0) {
            return sendYaml(res, 500, {
                status: "error",
                generated_at: new Date().toISOString(),
                summary: {
                    providers_total: 0,
                    providers_success: 0,
                    providers_failed: 0,
                    proxies_total: 0,
                    duration_ms: Date.now() - requestStartedAt,
                },
                providers: [],
                errors: [{
                    scope: "aggregator",
                    type: "configuration_error",
                    message: "No subscription providers configured",
                }],
                proxies: [],
            });
        }

        const results = await Promise.allSettled(
            activeProviders.map(fetchProvider)
        );

        const allProxies = [];
        const providerReports = [];
        const errors = [];

        results.forEach((result, index) => {
            const provider = activeProviders[index];

            if (result.status === "fulfilled") {
                allProxies.push(...result.value.proxies);
                providerReports.push(result.value.report);
                return;
            }

            const report = normalizeProviderError(
                provider,
                result.reason
            );

            providerReports.push(report);

            errors.push({
                scope: `provider:${provider.id}`,
                type: report.status,
                message:
                    report.error?.message ||
                    "Unknown error",
            });

            console.error(
                `[Provider ${provider.id}] ` +
                `${report.status}: ` +
                `${report.error?.message || "Unknown error"}`
            );
        });

        const proxies =
            deduplicateProxyNames(allProxies);

        const successCount =
            providerReports.filter(
                (item) =>
                    item.status === "success"
            ).length;

        const failedCount =
            providerReports.length -
            successCount;

        const overallStatus =
            successCount === providerReports.length
                ? "success"
                : successCount > 0
                    ? "partial_success"
                    : "error";

        const output = {
            status: overallStatus,

            generated_at:
                new Date().toISOString(),

            network: {
                outbound_ip:
                    networkInfo.ip,

                status:
                    networkInfo.status,

                source:
                    networkInfo.source,
            },

            summary: {
                providers_total:
                    providerReports.length,

                providers_success:
                    successCount,

                providers_failed:
                    failedCount,

                proxies_total:
                    proxies.length,

                duration_ms:
                    Date.now() -
                    requestStartedAt,
            },

            providers:
                providerReports,

            errors,

            proxies,
        };

        res.set(
            "X-Providers-Success",
            providerReports
                .filter(
                    (p) =>
                        p.status ===
                        "success"
                )
                .map((p) => p.id)
                .join(",")
        );

        const failedIds =
            providerReports
                .filter(
                    (p) =>
                        p.status !==
                        "success"
                )
                .map((p) => p.id)
                .join(",");

        if (failedIds) {
            res.set(
                "X-Providers-Failed",
                failedIds
            );
        }

        res.set(
            "X-Proxy-Count",
            String(proxies.length)
        );

        return sendYaml(
            res,
            proxies.length > 0
                ? 200
                : 502,
            output
        );

    } catch (error) {
        console.error(
            "[Aggregator] unexpected error:",
            error
        );

        return sendYaml(res, 500, {
            status: "error",

            generated_at:
                new Date().toISOString(),

            summary: {
                providers_total: 0,
                providers_success: 0,
                providers_failed: 0,
                proxies_total: 0,

                duration_ms:
                    Date.now() -
                    requestStartedAt,
            },

            providers: [],

            errors: [{
                scope: "aggregator",
                type: "internal_error",

                message:
                    error?.message ||
                    "Unexpected internal error",
            }],

            proxies: [],
        });
    }
});


/*
 * =========================
 * Fetch provider
 * =========================
 */
async function getOutboundIp() {
    const services = [
        "https://api.ipify.org?format=json",
        "https://ifconfig.me/ip",
        "https://icanhazip.com",
    ];

    for (const url of services) {
        const controller =
            new AbortController();

        const timer =
            setTimeout(
                () => controller.abort(),
                5000
            );

        try {
            const response =
                await fetch(
                    url,
                    {
                        method: "GET",

                        headers: {
                            "User-Agent":
                                "subscription-diagnostic",

                            "Accept":
                                "text/plain, application/json",
                        },

                        signal:
                            controller.signal,
                    }
                );

            if (!response.ok) {
                continue;
            }

            const text =
                (
                    await response.text()
                ).trim();

            if (!text) {
                continue;
            }

            try {
                const data =
                    JSON.parse(text);

                if (
                    data &&
                    typeof data.ip === "string" &&
                    data.ip.trim()
                ) {
                    return {
                        status:
                            "success",

                        ip:
                            data.ip.trim(),

                        source:
                            url,
                    };
                }

            } catch {
                if (
                    isValidIp(text)
                ) {
                    return {
                        status:
                            "success",

                        ip:
                            text,

                        source:
                            url,
                    };
                }
            }

        } catch {
            // Try next service.
        } finally {
            clearTimeout(timer);
        }
    }

    return {
        status:
            "failed",

        ip:
            null,

        source:
            null,
    };
}

function isValidIp(value) {
    return (
        /^(?:\d{1,3}\.){3}\d{1,3}$/.test(
            value
        ) ||
        /^[0-9a-f:]+$/i.test(
            value
        )
    );
}

class ProviderFetchError extends Error {
    constructor(
        status,
        message,
        report = {}
    ) {
        super(message);

        this.name =
            "ProviderFetchError";

        this.status =
            status;

        this.report =
            report;
    }
}

async function fetchProvider(provider) {
    const startedAt = Date.now();

    const controller =
        new AbortController();

    const timer =
        setTimeout(
            () => controller.abort(),
            FETCH_TIMEOUT
        );

    const providerHost =
        getProviderHost(provider.url);

    const dnsInfo =
        await resolveHostDiagnostic(
            providerHost
        );

    let response = null;

    try {
        try {
            response = await fetch(
                provider.url,
                {
                    method: "GET",

                    headers: {
                        "User-Agent":
                            FETCH_USER_AGENT,

                        "Accept":
                            "*/*",

                        "Accept-Encoding":
                            "gzip, deflate, br",
                    },

                    redirect: "follow",

                    signal:
                        controller.signal,
                }
            );

        } catch (error) {
            const diagnostic =
                analyzeFetchError(error);

            throw new ProviderFetchError(
                diagnostic.status,

                diagnostic.message,

                {
                    stage:
                        diagnostic.stage,

                    provider_host:
                        providerHost,

                    dns:
                        dnsInfo,

                    request: {
                        method: "GET",
                        user_agent:
                            FETCH_USER_AGENT,
                    },

                    http_status:
                        null,

                    duration_ms:
                        Date.now() -
                        startedAt,

                    error:
                        diagnostic.error,

                    diagnosis:
                        diagnostic.diagnosis,
                }
            );
        }

        const responseHeaders =
            extractDiagnosticHeaders(
                response.headers
            );

        const baseReport = {
            stage:
                "http_response",

            provider_host:
                providerHost,

            dns:
                dnsInfo,

            request: {
                method: "GET",

                user_agent:
                    FETCH_USER_AGENT,
            },

            http_status:
                response.status,

            http_status_text:
                response.statusText ||
                null,

            redirected:
                response.redirected,

            final_host:
                getProviderHost(
                    response.url
                ),

            response_headers:
                responseHeaders,
        };

        /*
         * 非 2xx：
         * 讀取少量 response body，
         * 很多 WAF/CDN/機場會直接把原因寫在這裡。
         */
        if (!response.ok) {
            let body = "";

            try {
                body =
                    await response.text();
            } catch {
                body = "";
            }

            const preview =
                makeSafePreview(body);

            const diagnosis =
                diagnoseHttpFailure(
                    response.status,
                    body,
                    responseHeaders
                );

            const cloudflare =
                extractCloudflareDetails(
                    body,
                    responseHeaders
                );
            throw new ProviderFetchError(
                "http_error",

                `HTTP ${response.status}` +
                (
                    response.statusText
                        ? ` ${response.statusText}`
                        : ""
                ),

                {
                    ...baseReport,

                    response_bytes:
                        Buffer.byteLength(
                            body,
                            "utf8"
                        ),

                    response_preview:
                        makeSafePreview(
                            body
                        ),

                    cloudflare,

                    duration_ms:
                        Date.now() -
                        startedAt,

                    diagnosis,
                }
            );
        }

        let text;

        try {
            text =
                await response.text();

        } catch (error) {
            throw new ProviderFetchError(
                "response_read_error",

                error?.message ||
                "Failed to read response body",

                {
                    ...baseReport,

                    duration_ms:
                        Date.now() -
                        startedAt,

                    error:
                        serializeError(
                            error
                        ),
                }
            );
        }

        if (!text.trim()) {
            throw new ProviderFetchError(
                "empty_response",

                "Empty subscription",

                {
                    ...baseReport,

                    response_bytes:
                        0,

                    duration_ms:
                        Date.now() -
                        startedAt,

                    diagnosis: {
                        category:
                            "empty_response",

                        possible_reason:
                            "Server returned HTTP success but no subscription content",
                    },
                }
            );
        }

        let parsed;

        try {
            parsed =
                parseSubscription(text);

        } catch (error) {
            const preview =
                makeSafePreview(text);

            throw new ProviderFetchError(
                error?.message ===
                    "Unsupported subscription format"
                    ? "unsupported_format"
                    : "parse_error",

                error?.message ||
                "Subscription parsing failed",

                {
                    ...baseReport,

                    response_bytes:
                        Buffer.byteLength(
                            text,
                            "utf8"
                        ),

                    response_preview:
                        preview,

                    duration_ms:
                        Date.now() -
                        startedAt,

                    error:
                        serializeError(
                            error
                        ),

                    diagnosis: {
                        category:
                            "invalid_subscription_response",

                        possible_reason:
                            detectNonSubscriptionResponse(
                                text
                            ),
                    },
                }
            );
        }

        if (
            parsed.proxies.length === 0
        ) {
            throw new ProviderFetchError(
                "no_supported_proxies",

                "No supported proxies found",

                {
                    ...baseReport,

                    response_type:
                        parsed.type,

                    response_bytes:
                        Buffer.byteLength(
                            text,
                            "utf8"
                        ),

                    duration_ms:
                        Date.now() -
                        startedAt,

                    diagnosis: {
                        category:
                            "no_supported_nodes",

                        possible_reason:
                            "Subscription was readable but contained no supported proxy nodes",
                    },
                }
            );
        }

        const proxies =
            parsed.proxies.map(
                (proxy) => ({
                    ...proxy,

                    name:
                        `[${provider.name}] ` +
                        proxy.name,
                })
            );

        return {
            proxies,

            report: {
                id:
                    provider.id,

                name:
                    provider.name,

                status:
                    "success",

                stage:
                    "complete",

                provider_host:
                    providerHost,

                dns:
                    dnsInfo,

                request: {
                    method: "GET",

                    user_agent:
                        FETCH_USER_AGENT,
                },

                http_status:
                    response.status,

                http_status_text:
                    response.statusText ||
                    null,

                redirected:
                    response.redirected,

                final_host:
                    getProviderHost(
                        response.url
                    ),

                response_headers:
                    responseHeaders,

                response_type:
                    parsed.type,

                response_bytes:
                    Buffer.byteLength(
                        text,
                        "utf8"
                    ),

                proxy_count:
                    proxies.length,

                duration_ms:
                    Date.now() -
                    startedAt,

                diagnosis:
                    null,

                error:
                    null,
            },
        };

    } catch (error) {
        if (
            error instanceof
            ProviderFetchError
        ) {
            throw error;
        }

        throw new ProviderFetchError(
            "internal_error",

            error?.message ||
            "Unexpected provider error",

            {
                stage:
                    "internal",

                provider_host:
                    providerHost,

                dns:
                    dnsInfo,

                duration_ms:
                    Date.now() -
                    startedAt,

                error:
                    serializeError(
                        error
                    ),

                diagnosis: {
                    category:
                        "internal_error",

                    possible_reason:
                        "Unexpected application error",
                },
            }
        );

    } finally {
        clearTimeout(timer);
    }
}
function normalizeProviderError(
    provider,
    error
) {
    const report =
        error instanceof
            ProviderFetchError
            ? error.report || {}
            : {};

    return {
        id:
            provider.id,

        name:
            provider.name,

        status:
            error instanceof
                ProviderFetchError
                ? error.status
                : "internal_error",

        stage:
            report.stage ??
            null,

        provider_host:
            report.provider_host ??
            getProviderHost(
                provider.url
            ),
        cloudflare:
            report.cloudflare ??
            null,

        dns:
            report.dns ??
            null,

        request:
            report.request ??
            null,

        http_status:
            report.http_status ??
            null,

        http_status_text:
            report.http_status_text ??
            null,

        redirected:
            report.redirected ??
            null,

        final_host:
            report.final_host ??
            null,

        response_headers:
            report.response_headers ??
            null,

        response_type:
            report.response_type ??
            null,

        response_bytes:
            report.response_bytes ??
            null,

        response_preview:
            report.response_preview ??
            null,

        proxy_count:
            0,

        duration_ms:
            report.duration_ms ??
            null,

        diagnosis:
            report.diagnosis ??
            null,

        error: {
            name:
                error?.name ||
                null,

            message:
                error?.message ||
                "Unknown error",

            code:
                report.error?.code ??
                null,

            cause_code:
                report.error?.cause_code ??
                null,

            cause_message:
                report.error?.cause_message ??
                null,

            errno:
                report.error?.errno ??
                null,

            syscall:
                report.error?.syscall ??
                null,
        },
    };
}

function getProviderHost(value) {
    try {
        return new URL(
            value
        ).hostname;
    } catch {
        return null;
    }
}

async function resolveHostDiagnostic(
    hostname
) {
    if (!hostname) {
        return {
            status: "invalid_host",
            ipv4: [],
            ipv6: [],
        };
    }

    const result = {
        status:
            "success",

        ipv4: [],

        ipv6: [],

        error:
            null,
    };

    try {
        result.ipv4 =
            await dns.resolve4(
                hostname
            );

    } catch (error) {
        result.ipv4 = [];

        if (
            error?.code !==
            "ENODATA" &&
            error?.code !==
            "ENOTFOUND"
        ) {
            result.error = {
                code:
                    error?.code ||
                    null,

                message:
                    error?.message ||
                    null,
            };
        }
    }

    try {
        result.ipv6 =
            await dns.resolve6(
                hostname
            );

    } catch {
        result.ipv6 = [];
    }

    if (
        result.ipv4.length === 0 &&
        result.ipv6.length === 0
    ) {
        result.status =
            "failed";

        result.error =
            result.error || {
                code:
                    "DNS_NO_RECORD",

                message:
                    "No IPv4 or IPv6 DNS record resolved",
            };
    }

    return result;
}

function extractDiagnosticHeaders(
    headers
) {
    const names = [
        "server",
        "content-type",
        "content-length",
        "date",
        "location",
        "retry-after",
        "via",
        "cf-ray",
        "cf-cache-status",
        "x-cache",
        "x-served-by",
        "x-request-id",
    ];

    const result = {};

    for (const name of names) {
        const value =
            headers.get(name);

        if (value) {
            result[name] =
                value;
        }
    }

    return result;
}

function serializeError(error) {
    const cause =
        error?.cause;

    return {
        name:
            error?.name ||
            null,

        message:
            error?.message ||
            null,

        code:
            error?.code ||
            null,

        errno:
            error?.errno ||
            null,

        syscall:
            error?.syscall ||
            null,

        cause_name:
            cause?.name ||
            null,

        cause_code:
            cause?.code ||
            null,

        cause_message:
            cause?.message ||
            null,

        cause_errno:
            cause?.errno ||
            null,

        cause_syscall:
            cause?.syscall ||
            null,
    };
}
function analyzeFetchError(
    error
) {
    const serialized =
        serializeError(error);

    const code =
        serialized.cause_code ||
        serialized.code ||
        "";

    if (
        error?.name ===
        "AbortError"
    ) {
        return {
            status:
                "timeout",

            stage:
                "request",

            message:
                `Timeout after ${FETCH_TIMEOUT}ms`,

            error:
                serialized,

            diagnosis: {
                category:
                    "timeout",

                possible_reason:
                    "Server did not complete the request within the configured timeout",
            },
        };
    }

    if (
        code ===
        "ENOTFOUND" ||
        code ===
        "EAI_AGAIN"
    ) {
        return {
            status:
                "dns_error",

            stage:
                "dns",

            message:
                serialized.cause_message ||
                "DNS resolution failed",

            error:
                serialized,

            diagnosis: {
                category:
                    "dns_failure",

                possible_reason:
                    "DNS resolution failed or upstream DNS temporarily unavailable",
            },
        };
    }

    if (
        code ===
        "ECONNREFUSED"
    ) {
        return {
            status:
                "connection_refused",

            stage:
                "connect",

            message:
                serialized.cause_message ||
                "Connection refused",

            error:
                serialized,

            diagnosis: {
                category:
                    "connection_refused",

                possible_reason:
                    "Remote server actively refused the TCP connection",
            },
        };
    }

    if (
        code ===
        "ECONNRESET"
    ) {
        return {
            status:
                "connection_reset",

            stage:
                "connect",

            message:
                serialized.cause_message ||
                "Connection reset",

            error:
                serialized,

            diagnosis: {
                category:
                    "connection_reset",

                possible_reason:
                    "Remote server, CDN or firewall reset the connection",
            },
        };
    }

    if (
        code ===
        "ETIMEDOUT" ||
        code ===
        "UND_ERR_CONNECT_TIMEOUT"
    ) {
        return {
            status:
                "connection_timeout",

            stage:
                "connect",

            message:
                serialized.cause_message ||
                "Connection timed out",

            error:
                serialized,

            diagnosis: {
                category:
                    "connection_timeout",

                possible_reason:
                    "TCP connection could not be established in time; source IP filtering is one possible cause",
            },
        };
    }

    if (
        [
            "CERT_HAS_EXPIRED",
            "DEPTH_ZERO_SELF_SIGNED_CERT",
            "SELF_SIGNED_CERT_IN_CHAIN",
            "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
            "ERR_TLS_CERT_ALTNAME_INVALID",
        ].includes(code)
    ) {
        return {
            status:
                "tls_error",

            stage:
                "tls",

            message:
                serialized.cause_message ||
                "TLS certificate error",

            error:
                serialized,

            diagnosis: {
                category:
                    "tls_failure",

                possible_reason:
                    "TLS certificate validation or hostname verification failed",
            },
        };
    }

    return {
        status:
            "network_error",

        stage:
            "network",

        message:
            serialized.cause_message ||
            serialized.message ||
            "Network request failed",

        error:
            serialized,

        diagnosis: {
            category:
                "network_failure",

            possible_reason:
                "Network, TLS, CDN, firewall or upstream connectivity failure",
        },
    };
}

function diagnoseHttpFailure(
    status,
    body,
    headers
) {
    const text =
        String(body || "")
            .toLowerCase();

    const server =
        String(
            headers?.server ||
            ""
        ).toLowerCase();

    if (
        status === 401
    ) {
        return {
            category:
                "authentication_rejected",

            possible_reason:
                "Subscription token, authentication or request authorization was rejected",
        };
    }

    if (
        status === 403
    ) {
        let reason =
            "Server refused the request. Possible causes include source IP restriction, region restriction, User-Agent filtering, expired subscription token or WAF policy";

        if (
            text.includes(
                "cloudflare"
            ) ||
            server.includes(
                "cloudflare"
            )
        ) {
            reason +=
                "; Cloudflare appears to be involved";
        }

        if (
            text.includes(
                "access denied"
            ) ||
            text.includes(
                "forbidden"
            )
        ) {
            reason +=
                "; response explicitly indicates access denial";
        }

        if (
            text.includes("country") ||
            text.includes("region") ||
            text.includes("geo")
        ) {
            reason +=
                "; response may indicate geographical restriction";
        }

        if (
            text.includes("ip") &&
            (
                text.includes("block") ||
                text.includes("allow") ||
                text.includes("deny")
            )
        ) {
            reason +=
                "; response may indicate IP-based filtering";
        }

        return {
            category:
                "access_denied",

            possible_reason:
                reason,
        };
    }

    if (
        status === 429
    ) {
        return {
            category:
                "rate_limited",

            possible_reason:
                "Provider is rate-limiting requests; shared Alibaba Cloud egress IPs or frequent subscription requests may trigger this",
        };
    }

    if (
        status === 451
    ) {
        return {
            category:
                "legal_or_region_restriction",

            possible_reason:
                "Server explicitly returned HTTP 451; geographic or policy restriction is possible",
        };
    }

    if (
        status >= 500
    ) {
        return {
            category:
                "upstream_server_error",

            possible_reason:
                "Provider or its CDN/upstream service returned a server-side error",
        };
    }

    return {
        category:
            "http_error",

        possible_reason:
            `Remote server returned HTTP ${status}`,
    };
}

function makeSafePreview(
    value
) {
    if (!value) {
        return null;
    }

    let text =
        String(value)
            .replace(
                /\s+/g,
                " "
            )
            .trim();

    /*
     * 遮掉 URI 中可能存在的
     * UUID / password / token。
     */
    text =
        text.replace(
            /\b(vless|anytls):\/\/[^\s"'<>]+/gi,
            "[REDACTED_PROXY_URI]"
        );

    text =
        text.replace(
            /([?&](?:token|key|auth|password|passwd|uuid)=)[^&\s]+/gi,
            "$1[REDACTED]"
        );

    if (
        text.length >
        ERROR_BODY_PREVIEW
    ) {
        text =
            text.slice(
                0,
                ERROR_BODY_PREVIEW
            ) +
            "...";
    }

    return text;
}
function detectNonSubscriptionResponse(
    body
) {
    const text =
        String(body || "")
            .toLowerCase();

    if (
        text.includes(
            "<!doctype html"
        ) ||
        text.includes(
            "<html"
        )
    ) {
        if (
            text.includes(
                "cloudflare"
            )
        ) {
            return "HTML response detected; Cloudflare challenge or access protection may have been returned";
        }

        if (
            text.includes(
                "access denied"
            ) ||
            text.includes(
                "forbidden"
            )
        ) {
            return "HTML access-denied page returned instead of subscription data";
        }

        return "HTML page returned instead of subscription data";
    }

    if (
        text.includes(
            "captcha"
        )
    ) {
        return "CAPTCHA or anti-bot challenge may have been returned";
    }

    return "Response is not a supported YAML, URI or Base64 subscription";
}

function toNumberOrNull(value) {
    if (
        value == null ||
        value === ""
    ) {
        return null;
    }

    const number =
        Number(value);

    return Number.isFinite(number)
        ? number
        : null;
}

function sendYaml(
    res,
    statusCode,
    data
) {
    const output =
        YAML.stringify(data);

    res.set(
        "Content-Type",
        "text/yaml; charset=utf-8"
    );

    res.set(
        "Cache-Control",
        "no-store"
    );

    return res
        .status(statusCode)
        .send(output);
}

function extractCloudflareDetails(
    body,
    headers = {}
) {
    const text =
        String(body || "");

    const result = {
        detected: false,
        ray_id:
            headers["cf-ray"] ||
            null,
        error_code:
            null,
        title:
            null,
        client_ip:
            null,
    };

    if (
        /cloudflare/i.test(text) ||
        headers.server
            ?.toLowerCase()
            .includes("cloudflare")
    ) {
        result.detected = true;
    }

    const titleMatch =
        text.match(
            /<title>\s*([^<]+?)\s*<\/title>/i
        );

    if (titleMatch) {
        result.title =
            decodeHtmlText(
                titleMatch[1]
            );
    }

    const rayMatch =
        text.match(
            /Ray ID[^a-zA-Z0-9]+([a-f0-9]{12,})/i
        );

    if (
        !result.ray_id &&
        rayMatch
    ) {
        result.ray_id =
            rayMatch[1];
    }

    const errorMatch =
        text.match(
            /Error\s*(?:code)?\s*[:#]?\s*(\d{3,4})/i
        );

    if (errorMatch) {
        result.error_code =
            Number(
                errorMatch[1]
            );
    }

    const ipMatch =
        text.match(
            /(?:Your IP|Client IP)[^0-9a-f:]*([0-9a-f:.]+)/i
        );

    if (ipMatch) {
        result.client_ip =
            ipMatch[1];
    }

    return result;
}

function decodeHtmlText(value) {
    return String(value || "")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .trim();
}

/*
 * =========================
 * Subscription parser¯
 * =========================
 */

function parseSubscription(text) {
    const source =
        text.trim();

    const yamlProxies =
        tryParseYaml(source);

    if (yamlProxies) {
        console.log(
            `[Parser] YAML: ` +
            `${yamlProxies.length} proxies`
        );

        return {
            type: "yaml",
            proxies:
                yamlProxies,
        };
    }

    if (
        looksLikeUriList(source)
    ) {
        const proxies =
            parseUriList(source);

        console.log(
            `[Parser] Plain URI: ` +
            `${proxies.length} proxies`
        );

        return {
            type: "plain_uri",
            proxies,
        };
    }

    const decoded =
        tryDecodeBase64(
            source
        );

    if (
        decoded &&
        looksLikeUriList(decoded)
    ) {
        const proxies =
            parseUriList(decoded);

        console.log(
            `[Parser] Base64 URI: ` +
            `${proxies.length} proxies`
        );

        return {
            type: "base64_uri",
            proxies,
        };
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