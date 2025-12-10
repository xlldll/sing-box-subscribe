#!/usr/bin/env python3
import json, os, tool, time, requests, sys, importlib, argparse, yaml, ruamel.yaml
import re
from datetime import datetime
from urllib.parse import urlparse
from collections import OrderedDict
from api.app import TEMP_DIR
from parsers.clash2base64 import clash2v2ray
from gh_proxy_helper import set_gh_proxy

parsers_mod = {}
providers = None
color_code = [31, 32, 33, 34, 35, 36, 91, 92, 93, 94, 95, 96]


def loop_color(text):
    """
    轮流使用 color_code 中的颜色代码为终端输出着色。

    参数：
        text: str
            需要加颜色的文本。

    返回：
        str: 已包裹 ANSI 颜色转义序列的字符串。
    """
    text = '\033[1;{color}m{text}\033[0m'.format(
        color=color_code[0],
        text=text
    )
    # 将当前颜色代码移动到列表末尾，实现循环使用
    color_code.append(color_code.pop(0))
    return text


def init_parsers():
    """
    初始化协议解析模块。

    扫描 parsers 目录下所有 .py 文件，
    并通过 importlib 动态导入，填充 parsers_mod 映射：
        文件名 -> 对应模块对象
    """
    for path, dirs, files in os.walk('parsers'):
        for file in files:
            name, ext = os.path.splitext(file)
            if ext == '.py':
                parsers_mod[name] = importlib.import_module('parsers.' + name)


def get_template():
    """
    获取配置模板名称列表（不含 .json 后缀）。

    返回：
        list[str]: 按名称排序的模板文件名列表。
    """
    template_dir = 'config_template'
    template_files = os.listdir(template_dir)
    # 只保留 .json 结尾的文件，并去掉扩展名
    template_list = [
        os.path.splitext(file)[0]
        for file in template_files
        if file.endswith('.json')
    ]
    template_list.sort()
    return template_list


def load_json(path):
    """
    从指定路径读取 JSON 文件并解析为 Python 对象。

    参数：
        path: str
            JSON 文件路径。

    返回：
        Any: 解析后的对象（通常是 dict / list）。
    """
    return json.loads(tool.readFile(path))


def process_subscribes(subscribes):
    """
    处理所有订阅配置，生成按 tag 分组的节点字典。

    流程：
        - 跳过未启用的订阅（enabled = false）
        - 跳过指向自身服务的订阅（防止循环订阅）
        - 拉取订阅中的节点列表
        - 为节点添加前缀 / emoji
        - 根据 ex-node-name 做节点过滤
        - 如果设置了 subgroup，将其附加到订阅 tag 上
        - 将节点按最终 tag 分组累加

    返回：
        dict[str, list[dict]]: { tag: [node, ...], ... }
    """
    nodes = {}
    for subscribe in subscribes:
        # 跳过未启用的订阅
        if 'enabled' in subscribe and not subscribe['enabled']:
            continue

        # 避免递归调用自身提供的订阅服务
        if 'sing-box-subscribe-doraemon.vercel.app' in subscribe['url']:
            continue

        _nodes = get_nodes(subscribe['url'])
        if _nodes and len(_nodes) > 0:
            add_prefix(_nodes, subscribe)
            add_emoji(_nodes, subscribe)
            nodefilter(_nodes, subscribe)

            # subgroup 存在时，将其拼接到 tag，中间增加标记 "subgroup"
            if subscribe.get('subgroup'):
                subscribe['tag'] = (
                    subscribe['tag'] + '-' + subscribe['subgroup'] + '-' + 'subgroup'
                )

            if not nodes.get(subscribe['tag']):
                nodes[subscribe['tag']] = []
            nodes[subscribe['tag']] += _nodes
        else:
            print('没有在此订阅下找到节点，跳过')

    # 去重节点名称，防止同名节点过多
    tool.proDuplicateNodeName(nodes)
    return nodes


def action_keywords(nodes, action, keywords):
    """
    按节点名称 (tag) 中的关键字进行过滤。

    参数：
        nodes: list[dict]
            节点列表。
        action: str
            "include" → 只保留匹配关键字的节点
            "exclude" → 移除匹配关键字的节点
        keywords: list[str]
            关键字列表，会以 | 拼成正则表达式。

    说明：
        对 tag 执行正则匹配，比如：
        keywords = ["HK", "🇭🇰"]
        会变成正则：  "HK|🇭🇰"
    """
    temp_nodes = []
    exclude_mode = (action == "exclude")

    # 如果没有关键字，不执行过滤
    combined_pattern = "|".join(keywords or [])
    if not combined_pattern or combined_pattern.isspace():
        return nodes

    regex = re.compile(combined_pattern)

    for node in nodes:
        tag = node.get("tag", "")
        matched = bool(regex.search(tag))

        # include →  matched == True  时保留
        # exclude →  matched == False 时保留
        # 使用 XOR（异或）来统一逻辑：
        # matched ^ exclude_mode
        #   include: matched ^ False → matched
        #   exclude: matched ^ True  → not matched
        if matched ^ exclude_mode:
            temp_nodes.append(node)

    return temp_nodes



def nodes_filter(nodes, filters, group):
    """
    对节点列表依次应用过滤规则 filters。

    支持 3 类规则（按优先级顺序执行）：

    ① 按 server 正则过滤（最高优先级）
        只保留 server 是 IPv4 的节点
        {
        "action": "include",
        "server_regex": "^(?:\\d{1,3}\\.){3}\\d{1,3}$"
        }
        排除所有域名节点
        {
        "action": "exclude",
        "server_regex": "^(?!\\d{1,3}(?:\\.\\d{1,3}){3}$).+"
        }

    ② 按节点协议类型过滤
       {
         "action": "include" / "exclude",
         "type": ["hysteria2", "trojan"]
       }

    ③ 按 tag 关键字过滤
       {
         "action": "include" / "exclude",
         "keywords": ["HK", "日本", "🇯🇵"]
       }

    额外字段：
       "for": ["Asia", "America"]
       → 当 group 在 for 列表中时，该过滤规则才会生效。

    返回：
       list[dict] → 过滤后的节点列表
    """

    for f in filters:

        # 如果规则指定了适用分组，但当前不匹配，则跳过
        if f.get("for") and group not in f["for"]:
            continue

        # -------------------------------------------------------------------
        # ① server 正则过滤（你新加的能力：匹配 server 字段）
        # -------------------------------------------------------------------
        if "server_regex" in f:
            regex = re.compile(f["server_regex"])
            exclude_mode = (f["action"] == "exclude")

            filtered = []
            for node in nodes:
                server = node.get("server", "")
                matched = bool(regex.search(server))

                # include: matched → 保留
                # exclude: not matched → 保留
                if matched ^ exclude_mode:
                    filtered.append(node)

            nodes = filtered
            continue

        # -------------------------------------------------------------------
        # ② 协议类型过滤
        # -------------------------------------------------------------------
        if "type" in f:
            # action_types 是你已有的函数，不改动
            nodes = action_types(nodes, f["action"], f["type"])
            continue

        # -------------------------------------------------------------------
        # ③ 按 tag 名称关键字过滤
        # -------------------------------------------------------------------
        nodes = action_keywords(nodes, f["action"], f.get("keywords", []))

    return nodes

def action_types(nodes, action, types):
    """
    按节点协议类型进行过滤。

    参数：
        nodes: list[dict]
            要过滤的节点列表。
        action: str
            "include"：只保留 type 在列表中的节点
            "exclude"：移除 type 在列表中的节点
        types: list[str]
            协议类型列表，例如 ["hysteria2", "trojan", "vmess"]。

    返回：
        list[dict]: 过滤后的节点列表。
    """
    temp_nodes = []
    flag = False
    if action == 'exclude':
        flag = True

    # 标准化协议类型：去空白并转小写
    type_set = {t.strip().lower() for t in (types or []) if t.strip()}
    if not type_set:
        # 如果未提供有效类型，不执行任何过滤
        return nodes

    for node in nodes:
        node_type = str(node.get('type', '')).lower()
        match_flag = node_type in type_set

        # 同样使用 XOR 决定是否保留
        if match_flag ^ flag:
            temp_nodes.append(node)

    return temp_nodes


def add_prefix(nodes, subscribe):
    """
    为节点名称和 detour 名称添加前缀。

    参数：
        nodes: list[dict]
            节点列表。
        subscribe: dict
            当前订阅配置，若包含 'prefix' 则生效。
    """
    if subscribe.get('prefix'):
        for node in nodes:
            node['tag'] = subscribe['prefix'] + node['tag']
            if node.get('detour'):
                node['detour'] = subscribe['prefix'] + node['detour']


def add_emoji(nodes, subscribe):
    """
    根据订阅配置为节点名称和 detour 名称自动添加 emoji。

    参数：
        nodes: list[dict]
            节点列表。
        subscribe: dict
            当前订阅配置，若 'emoji' 为真，则调用 tool.rename 做重命名。
    """
    if subscribe.get('emoji'):
        for node in nodes:
            node['tag'] = tool.rename(node['tag'])
            if node.get('detour'):
                node['detour'] = tool.rename(node['detour'])


def nodefilter(nodes, subscribe):
    """
    根据订阅配置中的 'ex-node-name' 字段，排除节点。

    规则：
        ex-node-name 为字符串，可用逗号或竖线分隔多个片段：
            "HK,JP|Netflix"
        只要节点 tag 中包含任意一个片段，该节点即被移除。

    参数：
        nodes: list[dict]
            当前订阅获取的节点列表（函数会在此列表上原地删除元素）。
        subscribe: dict
            当前订阅配置。
    """
    if subscribe.get('ex-node-name'):
        ex_nodename = re.split(r'[,\|]', subscribe['ex-node-name'])
        for exns in ex_nodename:
            # 遍历 nodes 的副本，避免在迭代时直接修改原列表导致跳项
            for node in nodes[:]:
                if exns in node['tag']:
                    nodes.remove(node)


def get_nodes(url):
    """
    从订阅 URL 或本地内容中提取节点列表。

    支持：
        - sub:// 开头的 base64 订阅（先解码获得真实 URL）
        - 纯 base64 文本订阅（直接解码后按行解析）
        - 本地文件路径（无法识别为 URL 且非 base64 时）
        - 远程 URL（正常 HTTP/HTTPS 链接）
        - Clash 格式配置（含 proxies）
        - sing-box 格式配置（含 outbounds）

    返回：
        list[dict]: 节点字典列表。
    """
    if url.startswith('sub://'):
        # 处理 sub:// 包裹的订阅地址（内部为 base64）
        url = tool.b64Decode(url[6:]).decode('utf-8')

    urlstr = urlparse(url)
    if not urlstr.scheme:
        # 无 scheme：先尝试按 base64 解码为纯文本节点链接
        try:
            content = tool.b64Decode(url).decode('utf-8')
            data = parse_content(content)

            # 展开 shadowtls 等返回为 tuple 的节点结构
            processed_list = []
            for item in data:
                if isinstance(item, tuple):
                    processed_list.extend([item[0], item[1]])
                else:
                    processed_list.append(item)
            return processed_list
        except:
            # base64 解码失败，则当作本地文件路径处理
            content = get_content_form_file(url)
    else:
        # 有 scheme：按远程 URL 处理
        content = get_content_from_url(url)

    # content 为 dict：可能是 Clash 或 sing-box 配置
    if isinstance(content, dict):
        # Clash 配置：从 proxies 中转换为通用链接，再统一解析
        if 'proxies' in content:
            share_links = []
            for proxy in content['proxies']:
                share_links.append(clash2v2ray(proxy))
            data = '\n'.join(share_links)
            data = parse_content(data)

            processed_list = []
            for item in data:
                if isinstance(item, tuple):
                    processed_list.extend([item[0], item[1]])
                else:
                    processed_list.append(item)
            return processed_list

        # sing-box 配置：从 outbounds 中提取真实节点
        elif 'outbounds' in content:
            print("sing-box 配置")
            outbounds = []
            # 排除不需要的类型，仅保留真实出站节点
            excluded_types = {"selector", "urltest", "direct", "block", "dns"}
            filtered_outbounds = [
                outbound
                for outbound in content['outbounds']
                if outbound.get("type") not in excluded_types
            ]
            outbounds.extend(filtered_outbounds)
            print(outbounds)
            return outbounds

    # content 为纯文本：按通用节点分享链接格式解析
    data = parse_content(content)
    processed_list = []
    for item in data:
        if isinstance(item, tuple):
            processed_list.extend([item[0], item[1]])
        else:
            processed_list.append(item)
    return processed_list


def parse_content(content):
    """
    将多行节点分享链接文本解析为节点列表。

    每一行：
        - 去除首尾空白
        - 根据协议选择对应解析器（get_parser）
        - 解析失败则跳过该行
        - 解析成功则为节点附加默认的 domain_resolver = "dns_direct"

    返回：
        list[dict]: 解析得到的节点列表。
    """
    nodelist = []
    print("parse_content")
    for t in content.splitlines():
        t = t.strip()
        if len(t) == 0:
            continue

        factory = get_parser(t)
        if not factory:
            continue

        try:
            node = factory(t)
        except Exception:
            # 单个节点解析失败，忽略该行
            node = None

        if node:
            # 默认为每个节点指定域名解析器
            # node["domain_resolver"] = "dns_direct"
            nodelist.append(node)

    return nodelist


def get_parser(node):
    """
    根据分享链接文本判断协议类型，并返回对应的解析函数。

    逻辑：
        - 通过 tool.get_protocol 获取协议（如 vmess, trojan, hysteria2 等）
        - 若 providers 中配置了 exclude_protocol，则排除对应协议
          （支持 "hy2" 自动映射为 "hysteria2"）
        - 若协议不在 parsers_mod 中，或被排除，则返回 None

    参数：
        node: str
            单行节点分享链接。

    返回：
        Callable | None: 对应协议的解析函数，
        若无法解析或被排除，则返回 None。
    """
    proto = tool.get_protocol(node)

    # 处理需要排除的协议列表
    if providers.get('exclude_protocol'):
        eps = providers['exclude_protocol'].split(',')
        if len(eps) > 0:
            eps = [protocol.strip() for protocol in eps]
            # 将短写 "hy2" 兼容为 "hysteria2"
            if 'hy2' in eps:
                index = eps.index('hy2')
                eps[index] = 'hysteria2'
            if proto in eps:
                return None

    if not proto or proto not in parsers_mod.keys():
        return None

    return parsers_mod[proto].parse

def get_content_from_url(url, n=10):
    """
    从远程订阅 / 链接中获取内容，并根据内容类型进行解析。

    支持的情况：
        1. 直接为单个节点分享链接（vmess://, ss://, trojan:// 等）：
           - 直接去空白行后返回纯文本内容。
        2. 机场订阅（普通 URL）：
           - 根据 providers["subscribes"] 中配置的 User-Agent 请求。
           - 如失败会自动重试最多 n 次。
           - 若返回内容为：
               - 纯节点文本（含 vmess:// 等）：解码并返回文本。
               - 含 'proxies'：视为 Clash YAML，解析为 dict 返回。
               - 含 'outbounds'：视为 sing-box JSON 配置，解析为 dict 返回。
               - Base64 编码内容：尝试解码为文本返回。

    参数：
        url: str
            订阅链接或单节点链接。
        n: int
            请求失败时最大重试次数。

    返回：
        str 或 dict 或 None：
            - 字符串：节点分享链接文本。
            - dict：解析后的 Clash 或 sing-box 配置。
            - None：内容为空或仅空白。
    """
    UA = ''
    print('处理: \033[31m' + url + '\033[0m')

    prefixes = [
        "vmess://", "vless://", "ss://", "ssr://", "trojan://", "tuic://",
        "hysteria://", "hysteria2://", "hy2://", "wg://", "wireguard://",
        "http2://", "socks://", "socks5://"
    ]

    # 情况一：直接是单个节点链接，直接返回（处理去空行）
    if any(url.startswith(prefix) for prefix in prefixes):
        response_text = tool.noblankLine(url)
        return response_text

    # 情况二：为机场订阅 URL，从 providers 中查找自定义 User-Agent
    for subscribe in providers["subscribes"]:
        if 'enabled' in subscribe and not subscribe['enabled']:
            continue
        if subscribe['url'] == url:
            UA = subscribe.get('User-Agent', '')

    response = tool.getResponse(url, custom_user_agent=UA)
    concount = 1

    # 自动重试 n 次
    while concount <= n and not response:
        print('连接出错，正在进行第 ' + str(concount) + ' 次重试，最多重试 ' + str(n) + ' 次...')
        response = tool.getResponse(url)
        concount = concount + 1
        time.sleep(1)

    if not response:
        print('获取错误，跳过此订阅')
        print('----------------------------')
        # 返回 None，表示本次订阅获取失败
        return None

    # 尝试按 UTF-8（兼容 BOM）解码响应内容
    try:
        response_content = response.content
        response_text = response_content.decode('utf-8-sig')  # utf-8-sig 可以忽略 BOM
    except Exception:
        return ''

    # 仅包含空白字符，视为无有效内容
    if response_text.isspace():
        print('没有从订阅链接获取到任何内容')
        return None

    # 若解码结果为空字符串，再尝试一次请求并使用默认 UA
    if not response_text:
        response = tool.getResponse(url, custom_user_agent='clashmeta')
        response_text = response.text

    # 若返回内容本身是节点分享链接列表，直接去空行后返回
    if any(response_text.startswith(prefix) for prefix in prefixes):
        response_text = tool.noblankLine(response_text)
        return response_text

    # 若包含 'proxies' 字段，尝试按 Clash YAML 解析
    elif 'proxies' in response_text:
        yaml_content = response.content.decode('utf-8')
        # 将制表符替换为空格，避免 YAML 解析报错
        response_text_no_tabs = yaml_content.replace('\t', ' ')
        yaml = ruamel.yaml.YAML()
        try:
            response_text = dict(yaml.load(response_text_no_tabs))
            return response_text
        except Exception:
            # YAML 解析失败，则继续后续尝试
            pass

    # 若包含 'outbounds' 字段，尝试按 sing-box JSON 解析
    elif 'outbounds' in response_text:
        try:
            response_text = json.loads(response.text)
            return response_text
        except Exception:
            # 去掉以 // 开头的行注释后再次尝试解析 JSON
            response_text = re.sub(r'//.*', '', response_text)
            response_text = json.loads(response_text)
            return response_text

    # 若以上均不符合，则尝试按 Base64 文本解码为节点分享内容
    else:
        try:
            response_text = tool.b64Decode(response_text)
            response_text = response_text.decode(encoding="utf-8")
        except Exception:
            # Base64 解码失败，则保持原始文本
            pass

    return response_text


def get_content_form_file(url):
    """
    从本地文件中读取订阅内容。

    支持：
        - .yaml：按 Clash YAML 格式解析 proxies 字段并转换为节点分享链接文本。
        - 其他文件：按 UTF-8 文本读取，并去除空行后返回。

    参数：
        url: str
            本地文件路径。

    返回：
        str: 节点分享链接文本（多行）。
    """
    print('处理: \033[31m' + url + '\033[0m')

    file_extension = os.path.splitext(url)[1].lower()

    # YAML 文件，按 Clash 订阅格式读取
    if file_extension == '.yaml':
        with open(url, 'rb') as file:
            content = file.read()
        yaml_data = dict(yaml.safe_load(content))
        share_links = []
        for proxy in yaml_data['proxies']:
            share_links.append(clash2v2ray(proxy))
        node = '\n'.join(share_links)
        processed_list = tool.noblankLine(node)
        return processed_list

    # 其他文件按文本处理
    data = tool.readFile(url)
    data = bytes.decode(data, encoding='utf-8')
    data = tool.noblankLine(data)
    return data


def save_config(path, nodes):
    """
    将最终生成的 nodes 写入配置文件。

    逻辑：
        - 若 providers 中配置 auto_backup = True：
            - 旧文件会重命名为 path.YYYYMMDDHHMMSS.bak
        - 若 path 已存在，先删除再写入。
        - 写入失败时：
            - 尝试从 temp_json_data 中读取 save_config_path
            - 将配置写入 /tmp 下对应文件
            - 若仍失败则删除该文件并打印错误信息。

    参数：
        path: str
            主配置文件保存路径。
        nodes: Any
            要写入的配置内容（通常是 dict）。
    """
    try:
        # 处理自动备份逻辑
        if 'auto_backup' in providers and providers['auto_backup']:
            now = datetime.now().strftime('%Y%m%d%H%M%S')
            if os.path.exists(path):
                os.rename(path, f'{path}.{now}.bak')

        if os.path.exists(path):
            os.remove(path)
            print(f"已删除文件，并重新保存：\033[33m{path}\033[0m")
        else:
            print(f"文件不存在，正在保存：\033[33m{path}\033[0m")

        tool.saveFile(path, json.dumps(nodes, indent=2, ensure_ascii=False))
    except Exception as e:
        print(f"保存配置文件时出错：{str(e)}")

        # 保存出错时，尝试使用临时路径 /tmp/config.json
        config_path = json.loads(temp_json_data).get("save_config_path", "config.json")
        CONFIG_FILE_NAME = config_path
        config_file_path = os.path.join('/tmp', CONFIG_FILE_NAME)

        try:
            if os.path.exists(config_file_path):
                os.remove(config_file_path)
                print(f"已删除文件，并重新保存：\033[33m{config_file_path}\033[0m")
            else:
                print(f"文件不存在，正在保存：\033[33m{config_file_path}\033[0m")

            tool.saveFile(config_file_path, json.dumps(nodes, indent=2, ensure_ascii=False))
        except Exception as e:
            # 再次失败则删除文件并输出错误
            if os.path.exists(config_file_path):
                os.remove(config_file_path)
                print(f"已删除文件：\033[33m{config_file_path}\033[0m")
            print(f"再次保存配置文件时出错：{str(e)}")


def set_proxy_rule_dns(config):
    """
    根据路由规则自动生成对应的 DNS 规则，减少 DNS 泄露风险。

    逻辑：
        - 遍历 route.rules：
            - 对每一个非 block / dns-out 出站规则：
                - 若出站为非 direct：
                    - 从 dns.servers 中复制一个模板（tag = auto_set_outbounds_dns["proxy"]）
                    - 生成新的 server：tag = outbound + '_dns'，detour = outbound
                    - 避免重复添加到 outbound_dns 列表
                - 按 route 规则生成对应的 dns.rules 项：
                    - type = logical 时，递归处理子 rules
                    - 其他情况使用 pro_dns_from_route_rules 进行映射
        - 最后去重 dns.rules，并将新生成的 DNS server 写入 config['dns']['servers']。
    """
    config_rules = config['route']['rules']
    outbound_dns = []
    dns_rules = config['dns']['rules']
    asod = providers["auto_set_outbounds_dns"]

    for rule in config_rules:
        if rule['outbound'] in ['block', 'dns-out']:
            continue

        # 非 direct 出站规则，需要为其生成专用 DNS server
        if rule['outbound'] != 'direct':
            outbounds_dns_template = list(
                filter(
                    lambda server: server['tag'] == asod["proxy"],
                    config['dns']['servers']
                )
            )[0]
            dns_obj = outbounds_dns_template.copy()
            dns_obj['tag'] = rule['outbound'] + '_dns'
            dns_obj['detour'] = rule['outbound']
            if dns_obj not in outbound_dns:
                outbound_dns.append(dns_obj)

        # 构造 DNS 规则条目
        if rule.get('type') and rule['type'] == 'logical':
            dns_rule_obj = {
                'type': 'logical',
                'mode': rule['mode'],
                'rules': [],
                'server': rule['outbound'] + '_dns' if rule['outbound'] != 'direct' else asod["direct"]
            }
            for _rule in rule['rules']:
                child_rule = pro_dns_from_route_rules(_rule)
                if child_rule:
                    dns_rule_obj['rules'].append(child_rule)
            if len(dns_rule_obj['rules']) == 0:
                dns_rule_obj = None
        else:
            dns_rule_obj = pro_dns_from_route_rules(rule)

        if dns_rule_obj:
            dns_rules.append(dns_rule_obj)

    # 去重 DNS 规则
    _dns_rules = []
    for dr in dns_rules:
        if dr not in _dns_rules:
            _dns_rules.append(dr)
    config['dns']['rules'] = _dns_rules

    # 将为各出站生成的 DNS server 追加到 config['dns']['servers']
    config['dns']['servers'].extend(outbound_dns)


def pro_dns_from_route_rules(route_rule):
    """
    将单条 route 规则映射为对应的 dns 规则条目。

    只拷贝与 DNS 匹配条件相关的字段，
    并根据 route_rule['outbound'] 设置对应的 server。

    参数：
        route_rule: dict
            route.rules 中的一条规则。

    返回：
        dict 或 None:
            映射后的 dns 规则，若无匹配字段则返回 None。
    """
    dns_route_same_list = [
        "inbound", "ip_version", "network", "protocol",
        "domain", "domain_suffix", "domain_keyword", "domain_regex", "geosite",
        "source_geoip", "source_ip_cidr", "source_port", "source_port_range",
        "port", "port_range", "process_name", "process_path", "package_name",
        "user", "user_id", "clash_mode", "invert"
    ]

    dns_rule_obj = {}
    for key in route_rule:
        if key in dns_route_same_list:
            dns_rule_obj[key] = route_rule[key]

    if len(dns_rule_obj) == 0:
        return None

    if route_rule.get('outbound'):
        dns_rule_obj['server'] = (
            route_rule['outbound'] + '_dns'
            if route_rule['outbound'] != 'direct'
            else providers["auto_set_outbounds_dns"]['direct']
        )

    return dns_rule_obj


def pro_node_template(data_nodes, config_outbound, group):
    """
    根据当前出站模板 config_outbound 对 data_nodes 做过滤，
    并返回过滤后节点的 tag 列表。

    参数：
        data_nodes: list[dict]
            某个分组下的节点列表。
        config_outbound: dict
            模板中定义的出站对象（可能包含 filter 字段）。
        group: str
            当前分组名称（用于 nodes_filter 中的 for 匹配）。

    返回：
        list[str]: 过滤后节点的 tag 字符串列表。
    """
    if config_outbound.get('filter'):
        data_nodes = nodes_filter(data_nodes, config_outbound['filter'], group)
    return [node.get('tag') for node in data_nodes]


def combin_to_config(config, data):
    """
    将根据订阅生成的节点数据 data 合并到配置模板 config 中。

    主要工作：
        1. 处理模板中的 selector/urltest 等出站引用：
           - 支持 {group} / {all} 占位符展开为实际节点 tag 列表。
           - 若某个出站在展开后无任何节点，则降级为 direct。
        2. 将 data 中的真实节点追加到 config['outbounds'] 中。
        3. 若 providers["auto_set_outbounds_dns"] 配置完整，自动根据 route 生成 DNS 规则。
        4. 针对 type = "wireguard" 的出站：
           - 提取到单独的 endpoints 字段中。
           - 并从 outbounds 中移除 wireguard 类型，满足部分模板要求。

    参数：
        config: dict
            配置模板（包含 outbounds、route、dns 等）。
        data: dict[str, list[dict]]
            订阅生成的节点数据，key 为分组名，value 为节点列表。

    返回：
        dict: 合并后的完整配置。
    """
    config_outbounds = config["outbounds"] if config.get("outbounds") else None
    i = 0

    # 先处理带 subgroup 标记的分组，对 Proxy 进行分组插入
    for group in data:
        if 'subgroup' in group:
            i += 1
            for out in config_outbounds:
                if out.get("outbounds") and out['tag'] == 'Proxy':
                    out["outbounds"] = (
                        [out["outbounds"]]
                        if isinstance(out["outbounds"], str)
                        else out["outbounds"]
                    )
                    # 处理 {all} 占位，替换为当前 subgroup 标记
                    if '{all}' in out["outbounds"]:
                        index_of_all = out["outbounds"].index('{all}')
                        out["outbounds"][index_of_all] = (
                            group.rsplit("-", 1)[0]
                        ).rsplit("-", 1)[-1]
                        i += 1
                    else:
                        out["outbounds"].insert(
                            i,
                            (group.rsplit("-", 1)[0]).rsplit("-", 1)[-1]
                        )

            new_outbound = {
                'tag': (group.rsplit("-", 1)[0]).rsplit("-", 1)[-1],
                'type': 'selector',
                'outbounds': ['{' + group + '}']
            }
            # 在倒数第二个位置插入新的 selector 出站
            config_outbounds.insert(-2, new_outbound)

            # 如果 group 不包含 'subgroup'，原逻辑会为 Proxy 追加 '{group}'
            if 'subgroup' not in group:
                for out in config_outbounds:
                    if out.get("outbounds") and out['tag'] == 'Proxy':
                        out["outbounds"] = (
                            [out["outbounds"]]
                            if isinstance(out["outbounds"], str)
                            else out["outbounds"]
                        )
                        out["outbounds"].append('{' + group + '}')

    temp_outbounds = []
    if config_outbounds:
        # 找到 type = 'direct' 的出站，用于占位时兜底
        direct_item = next(
            (item for item in config_outbounds if item.get('type') == 'direct'),
            None
        )

        # 预处理包含 {all} 的模板，避免展开重复
        for po in config_outbounds:
            if po.get("outbounds"):
                if '{all}' in po["outbounds"]:
                    o1 = []
                    for item in po["outbounds"]:
                        if item.startswith('{') and item.endswith('}'):
                            _item = item[1:-1]
                            if _item == 'all':
                                o1.append(item)
                        else:
                            o1.append(item)
                    po['outbounds'] = o1

                t_o = []
                check_dup = []

                for oo in po["outbounds"]:
                    # 避免重复节点
                    if oo in check_dup:
                        continue
                    else:
                        check_dup.append(oo)

                    # 模板占位符：{group} 或 {all}
                    if oo.startswith('{') and oo.endswith('}'):
                        oo_key = oo[1:-1]
                        if data.get(oo_key):
                            nodes = data[oo_key]
                            t_o.extend(pro_node_template(nodes, po, oo_key))
                        else:
                            if oo_key == 'all':
                                # {all} 表示展开所有分组
                                for group in data:
                                    nodes = data[group]
                                    t_o.extend(pro_node_template(nodes, po, group))
                    else:
                        # 普通字符串，直接保留
                        t_o.append(oo)

                # 若展开后该出站无任何节点，降级为 direct
                if len(t_o) == 0:
                    t_o.append(direct_item['tag'])
                    print(
                        '发现 {} 出站下的节点数量为 0 ，会导致sing-box无法运行，请检查config模板是否正确。'
                        .format(po['tag'])
                    )

                po['outbounds'] = t_o

                # 出站模板中的 filter 字段已使用完毕，需删除
                if po.get('filter'):
                    del po['filter']

    # 将 data 中的真实节点累加到临时 outbounds 列表
    for group in data:
        temp_outbounds.extend(data[group])

    # 最终 outbounds = 模板中的出站 + 订阅生成的真实节点
    config['outbounds'] = config_outbounds + temp_outbounds

    # 自动根据 route 规则生成对应 DNS 规则，避免 DNS 泄露
    dns_tags = [server.get('tag') for server in config['dns']['servers']]
    asod = providers.get("auto_set_outbounds_dns")
    if (
        asod
        and asod.get('proxy')
        and asod.get('direct')
        and asod['proxy'] in dns_tags
        and asod['direct'] in dns_tags
    ):
        set_proxy_rule_dns(config)

    # 提取所有 wireguard 类型出站，单独生成 endpoints 字段
    wireguard_items = [
        item for item in config['outbounds'] if item.get('type') == 'wireguard'
    ]
    if wireguard_items:
        endpoints = []
        for item in wireguard_items:
            endpoints.append(item)

        # 使用 OrderedDict 确保 'endpoints' 插入到 'outbounds' 之后
        new_config = OrderedDict()
        for key, value in config.items():
            new_config[key] = value
            if key == 'outbounds':
                new_config['endpoints'] = endpoints

        config = new_config

        # 从 outbounds 中移除 wireguard 类型出站
        config['outbounds'] = [
            item for item in config['outbounds'] if item.get('type') != 'wireguard'
        ]

    return config


def updateLocalConfig(local_host, path):
    """
    通过 sing-box 本地面板 API 更新配置文件路径。

    参数：
        local_host: str
            本地 API 地址，例如 "http://127.0.0.1:9090"。
        path: str
            要加载的配置文件路径。
    """
    header = {
        'Content-Type': 'application/json'
    }
    r = requests.put(
        local_host + '/configs?force=false',
        json={"path": path},
        headers=header
    )
    print(r.text)


def display_template(tl):
    """
    在终端中以彩色输出所有配置模板名称。

    参数：
        tl: list[str]
            模板名称列表。
    """
    print_str = ''
    for i in range(len(tl)):
        print_str += loop_color(
            '{index}、{name} '.format(index=i + 1, name=tl[i])
        )
    print(print_str)


def select_config_template(tl, selected_template_index=None):
    """
    交互式选择配置模板索引。

    优先级：
        1. 若命令行参数 args.template_index 不为空，直接使用；
        2. 否则，提示用户输入序号：
            - 回车：默认选择第一个模板（索引 0）
            - 输入非法数字或越界：提示错误并递归重试。

    参数：
        tl: list[str]
            模板名称列表。
        selected_template_index: Any
            保留参数（当前逻辑未使用）。

    返回：
        int: 选中的模板索引（从 0 开始）。
    """
    if args.template_index is not None:
        uip = args.template_index
    else:
        uip = input('输入序号，载入对应config模板（直接回车默认选第一个配置模板）：')
        try:
            if uip == '':
                return 0
            uip = int(uip)
            if uip < 1 or uip > len(tl):
                print('输入了错误信息！重新输入')
                return select_config_template(tl)
            else:
                uip -= 1
        except Exception:
            print('输入了错误信息！重新输入')
            return select_config_template(tl)
    return uip


# 自定义函数，用于解析命令行参数为 JSON 格式
def parse_json(value):
    """
    argparse 的辅助函数：
    将命令行传入的字符串解析为 JSON 对象。

    示例：
        --config '{"a": 1, "b": 2}'

    参数：
        value: str
            命令行传进来的字符串。

    返回：
        Any: json.loads 解析结果。

    异常：
        若字符串不是合法 JSON，则抛出 argparse.ArgumentTypeError。
    """
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        raise argparse.ArgumentTypeError(f"Invalid JSON: {value}")

def generate_config_from_providers(providers_data: dict):
    """
    给 Vercel / API 使用的封装函数。

    输入:
        providers_data: dict
            从 SUB_CONFIG 或 URL 传进来的完整配置，
            结构与原来的 providers.json 一致。

    输出:
        final_config: dict 或 list
            - 当 Only-nodes = true 时：返回节点列表（list）
            - 当 Only-nodes = false 时：返回完整 sing-box 配置（dict）
    """
    if not isinstance(providers_data, dict):
        raise ValueError("providers_data 必须是 dict")

    # 仍沿用原脚本中的全局 providers 变量
    global providers
    providers = providers_data

    # 初始化各协议解析器
    init_parsers()

    # 1) 处理 config_template （可为远程 URL 或本地路径）
    config = None
    config_template_path = (providers.get("config_template") or "").strip()

    if config_template_path:
        # 远程模板地址（HTTP / HTTPS）
        if config_template_path.startswith("http://") or config_template_path.startswith("https://"):
            resp = requests.get(config_template_path, timeout=10)
            resp.raise_for_status()
            # 优先按 JSON 解析，不行再尝试 YAML
            try:
                config = resp.json()
            except Exception:
                try:
                    config = yaml.safe_load(resp.text)
                except Exception as e:
                    raise ValueError(f"读取远程模板失败: {e}")
        else:
            # 本地模板文件
            config = load_json(config_template_path)

    # 2) 处理订阅列表，生成各订阅下的节点
    if "subscribes" not in providers or not providers["subscribes"]:
        raise ValueError("providers 中缺少 subscribes 字段，或为空")

    nodes = process_subscribes(providers["subscribes"])

    # 3) 根据 Only-nodes 决定返回节点列表，还是结合模板生成完整配置
    if providers.get("Only-nodes"):
        # 只返回节点列表（不套模板）
        combined_contents = []
        for sub_tag, contents in nodes.items():
            for content in contents:
                combined_contents.append(content)
        final_config = combined_contents
    else:
        # 需要完整配置，但没有模板 → 在无交互环境直接报错说明
        if config is None:
            raise ValueError(
                "config_template 为空且 Only-nodes 为 false："
                "在无交互环境（如 Vercel）下无法选择模板。"
                "请在 SUB_CONFIG 中提供 config_template，或把 Only-nodes 设为 true。"
            )
        # 使用原有逻辑，将节点合并入模板
        final_config = combin_to_config(config, nodes)

    # 不在此处写文件，由上层 API 决定如何使用返回结果
    return final_config


if __name__ == '__main__':
    # 本地/命令行模式入口（保留原逻辑）
    init_parsers()
    parser = argparse.ArgumentParser()
    parser.add_argument('--temp_json_data', type=parse_json, help='临时内容（JSON 字符串）')
    parser.add_argument('--template_index', type=int, help='模板序号')
    parser.add_argument('--gh_proxy_index', type=str, help='GitHub 加速链接索引')
    args = parser.parse_args()

    temp_json_data = args.temp_json_data
    gh_proxy_index = args.gh_proxy_index

    # 1) 加载 providers：优先使用命令行传入的 JSON，其次读本地 providers.json
    if temp_json_data and temp_json_data != '{}':
        providers = json.loads(temp_json_data)
    else:
        providers = load_json('providers.json')

    # 2) 加载配置模板（支持远程 config_template，也支持本地交互选择）
    if providers.get('config_template'):
        # 远程模板模式
        config_template_path = providers['config_template']
        print('选择: \033[33m' + config_template_path + '\033[0m')
        response = requests.get(providers['config_template'])
        response.raise_for_status()
        config = response.json()
    else:
        # 本地模板交互选择模式
        template_list = get_template()
        if len(template_list) < 1:
            print('没有找到模板文件')
            sys.exit()
        display_template(template_list)
        uip = select_config_template(template_list, selected_template_index=args.template_index)
        config_template_path = 'config_template/' + template_list[uip] + '.json'
        print('选择: \033[33m' + template_list[uip] + '.json\033[0m')
        config = load_json(config_template_path)

    # 3) 根据 subscribes 拉取所有机场节点
    nodes = process_subscribes(providers["subscribes"])

    # 4) 处理 GitHub 加速（对 config["route"]["rule_set"] 中的 URL 进行替换）
    if hasattr(args, 'gh_proxy_index') and str(args.gh_proxy_index).isdigit():
        gh_proxy_index = int(args.gh_proxy_index)
        print(gh_proxy_index)
        urls = [item["url"] for item in config["route"]["rule_set"]]
        new_urls = set_gh_proxy(urls, gh_proxy_index)
        for item, new_url in zip(config["route"]["rule_set"], new_urls):
            item["url"] = new_url

    # 5) 根据 Only-nodes 决定输出形式（节点列表 / 完整配置）
    if providers.get('Only-nodes'):
        combined_contents = []
        for sub_tag, contents in nodes.items():
            # 遍历每个机场的节点内容并扁平化
            for content in contents:
                combined_contents.append(content)
        final_config = combined_contents
    else:
        # 将节点信息合并到模板 config 中
        final_config = combin_to_config(config, nodes)

    # 6) 保存配置文件到 providers["save_config_path"]
    save_config(providers["save_config_path"], final_config)
    # 如果需要，可启用本地面板自动更新：
    # updateLocalConfig('http://127.0.0.1:9090', providers['save_config_path'])