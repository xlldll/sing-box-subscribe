import tool, json, re, urllib, sys
from urllib.parse import urlparse, parse_qs, unquote


def parse(data):
    info = data[:]
    server_info = urlparse(info)

    # userinfo: uuid@host:port
    _netloc = server_info.netloc.split("@")
    if len(_netloc) != 2:
        return None

    # query 参数拉平：把 ["x"] 变成 "x"
    netquery = dict(
        (k, v if len(v) > 1 else v[0])
        for k, v in parse_qs(server_info.query).items()
    )

    # 基础字段
    node = {
        'tag': unquote(server_info.fragment) or tool.genName() + '_vless',
        'type': 'vless',
        'server': re.sub(r"\[|\]", "", _netloc[1].rsplit(":", 1)[0]),
        'server_port': int(_netloc[1].rsplit(":", 1)[1]),
        'uuid': _netloc[0],
        'packet_encoding': netquery.get('packetEncoding', 'xudp')
    }

    # flow：使用 URI 中的真实值，不写死 xtls-rprx-vision
    if netquery.get('flow'):
        node['flow'] = netquery['flow']

    # ============ TLS / Reality ============

    security = netquery.get('security', '')

    # 只要 security 不是 none/空，就认为启用 TLS（包括 reality）
    if security not in ['none', '']:
        tls = {
            'enabled': True,
        }

        # insecure：默认 True
        # 如果 query 里显式有 allowInsecure / insecure=1/true 才打开
        insecure_flag = netquery.get('allowInsecure', netquery.get('insecure'))
        if insecure_flag is not None:
            tls['insecure'] = str(insecure_flag).lower() in ('1', 'true', 'yes')
        else:
            tls['insecure'] = True

        # SNI / server_name：优先 sni，其次 host
        sni = netquery.get('sni', netquery.get('host', ''))
        if sni not in ['none', '']:
            tls['server_name'] = sni

        # 统一提取指纹：
        #   支持 fp / client-fingerprint / fingerprint 三种字段名
        fp = (
            netquery.get('fp')
            or netquery.get('client-fingerprint')
            or netquery.get('fingerprint')
        )
        if fp:
            tls['utls'] = {
                'enabled': True,
                'fingerprint': fp
            }

        # Reality：只有 security == reality 时才写 reality 字段
        if security == 'reality':
            reality = {
                'enabled': True,
                'public_key': netquery.get('pbk')  # 必填：public key
            }
            # 可选：short_id
            if netquery.get('sid'):
                reality['short_id'] = netquery['sid']
            tls['reality'] = reality

        node['tls'] = tls

    # ============ 传输层 type / transport ============

    if netquery.get('type'):
        net_type = netquery['type']

        if net_type == 'http':
            node['transport'] = {
                'type': 'http'
            }

        if net_type == 'ws':
            path = netquery.get('path', '')
            path_clean = path.rsplit("?", 1)[0] if path else ''
            host_header = netquery.get('sni', netquery.get('host', ''))

            node['transport'] = {
                'type': 'ws',
                "path": path_clean,
                "headers": {
                    "Host": host_header
                }
            }

            # 早期数据 early data（?ed=xxx），注意 path 可能为空
            if path and '?ed=' in path:
                try:
                    ed_val = int(path.rsplit("?ed=", 1)[1])
                    node['transport']['early_data_header_name'] = 'Sec-WebSocket-Protocol'
                    node['transport']['max_early_data'] = ed_val
                except Exception:
                    pass

        if net_type == 'grpc':
            node['transport'] = {
                'type': 'grpc',
                'service_name': netquery.get('serviceName', '')
            }

    # ============ multiplex（多路复用） ============

    if netquery.get('protocol'):
        node['multiplex'] = {
            'enabled': True,
            'protocol': netquery['protocol'],
            'max_streams': int(netquery.get('max_streams', '0'))
        }
        if netquery.get('max_connections'):
            node['multiplex']['max_connections'] = int(netquery['max_connections'])
        if netquery.get('min_streams'):
            node['multiplex']['min_streams'] = int(netquery['min_streams'])
        if netquery.get('padding') == 'True':
            node['multiplex']['padding'] = True

    return node