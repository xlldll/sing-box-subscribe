import tool, re
from urllib.parse import urlparse, parse_qs, unquote


def parse(data):
    """
    解析 AnyTLS 分享链接

    示例：
        anytls://PASSWORD@HOST:PORT/?insecure=0&sni=example.com#TAG

    输出：
        {
            "tag": "...",
            "type": "anytls",
            "server": "...",
            "server_port": 1234,
            "password": "...",
            "domain_resolver": "local",
            "tls": {
                "enabled": True,
                "insecure": False,
                "alpn": ["h2", "http/1.1"],
                "server_name": "..."
            }
        }
    """
    info = data[:]

    try:
        server_info = urlparse(info)
    except Exception as e:
        print(f"[WARN][anytls] urlparse failed: {e}")
        return None

    if server_info.scheme.lower() != "anytls":
        print(f"[WARN][anytls] invalid scheme: {server_info.scheme}")
        return None

    # userinfo@host:port
    _netloc = server_info.netloc.split("@")
    if len(_netloc) != 2:
        print(f"[WARN][anytls] invalid netloc: {server_info.netloc}")
        return None

    # 这里就是你要的 password
    password = _netloc[0]
    hostport = _netloc[1]

    if ":" not in hostport:
        print(f"[WARN][anytls] missing port in hostport: {hostport}")
        return None

    try:
        server = re.sub(r"\[|\]", "", hostport.rsplit(":", 1)[0])
        server_port = int(hostport.rsplit(":", 1)[1])
    except Exception as e:
        print(f"[WARN][anytls] parse host/port failed: {e}")
        return None

    try:
        netquery = dict(
            (k, v if len(v) > 1 else v[0])
            for k, v in parse_qs(server_info.query).items()
        )
    except Exception as e:
        print(f"[WARN][anytls] parse_qs failed: {e}")
        return None

    tag = unquote(server_info.fragment) if server_info.fragment else ""
    if not tag:
        tag = tool.genName() + "_anytls"

    node = {
        "tag": tag,
        "type": "anytls",
        "server": server,
        "server_port": server_port,
        "password": password,
        "domain_resolver": "dns_direct",
        "tls": {
            "enabled": True,
            "insecure": False,
            "alpn": ["h2", "http/1.1"],
        }
    }

    # insecure / allowInsecure
    insecure_flag = netquery.get("allowInsecure", netquery.get("insecure"))
    if insecure_flag is not None:
        node["tls"]["insecure"] = str(insecure_flag).lower() in ("1", "true", "yes")

    # sni / host -> server_name
    sni = netquery.get("sni", netquery.get("host", ""))
    if sni:
        node["tls"]["server_name"] = sni

    return node