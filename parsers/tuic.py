import re
from urllib.parse import urlparse, parse_qs, unquote

def parse(data):
    info = data.strip()
    u = urlparse(info)

    # Query params (parse_qs gives list values)
    q = parse_qs(u.query)
    def qget(key, default=None):
        v = q.get(key)
        if v is None:
            return default
        return v[-1]  # take last if multiple

    # netloc format: "<userinfo>@<host>:<port>"
    if "@" not in u.netloc:
        raise ValueError(f"Invalid TUIC URL netloc (missing @): {u.netloc!r}")

    userinfo_raw, hostport = u.netloc.split("@", 1)

    # IMPORTANT: userinfo can be url-escaped, e.g. %3A for ':'
    userinfo = unquote(userinfo_raw)

    # userinfo is usually "uuid:password" (password can be empty/missing)
    if ":" in userinfo:
        uuid, password = userinfo.split(":", 1)  # split once
    else:
        uuid, password = userinfo, qget("password", "")

    uuid = uuid.strip()
    password = (password or "").strip()

    # host may be IPv6 in brackets [::1]
    host = re.sub(r"^\[|\]$", "", hostport.rsplit(":", 1)[0])
    port = int(hostport.rsplit(":", 1)[1])

    # ALPN: could be "h3,h2,http/1.1"
    alpn_raw = qget("alpn", "h3")
    # allow someone to pass "{h3,h2}" etc.
    alpn = [x.strip() for x in str(alpn_raw).strip("{}").split(",") if x.strip()]

    node = {
        "tag": unquote(u.fragment) if u.fragment else "tuic",
        "type": "tuic",
        "server": host,
        "server_port": port,
        "uuid": uuid,
        "password": password,
        "congestion_control": qget("congestion_control", "bbr"),
        # omit udp_relay_mode if not provided (avoid null issues)
        "zero_rtt_handshake": False,
        "heartbeat": "10s",
        "tls": {
            "enabled": True,
            "alpn": alpn,
        },
    }

    # SNI
    sni = qget("sni")
    disable_sni = qget("disable_sni", "0")
    if sni and str(disable_sni) != "1":
        node["tls"]["server_name"] = sni

    # allow_insecure=1
    if qget("allow_insecure") == "1":
        node["tls"]["insecure"] = True

    # udp_relay_mode if present
    udp_mode = qget("udp_relay_mode")
    if udp_mode:
        node["udp_relay_mode"] = udp_mode

    return node