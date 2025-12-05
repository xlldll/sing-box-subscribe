# sing-box-subscribe

[中文](https://github.com/Toperlock/sing-box-subscribe/blob/main/README.md) | [EN](https://github.com/Toperlock/sing-box-subscribe/blob/main/instructions/README.md)

请注意：这是本人 FORK 修改的版本，加入了自己使用的特性。

# 如何使用

- pip install -r requirements.txt


```python

"""
脚本名称：main.py

核心作用：
多机场订阅总控脚本：
1）从多个订阅（subscribes）批量拉取/解析节点
2）按配置规则给节点加前缀、加 emoji、过滤节点
3）把节点按“机场分组 tag”组织成字典
4）将节点合并进 sing-box 配置模板，自动生成最终 config.json
5）支持“只输出节点数组”或“输出完整 sing-box 配置”两种模式

适用场景： - 你有多个机场订阅（Clash / v2ray / sing-box / 各种分享链接 混在一起） - 想要统一收集 → 统一命名 → 统一过滤 → 自动写入 sing-box 模板 - 最终得到一个给 PuerNya 内核使用的 config.json（包含 outbounds / endpoints / dns / route 等）

主要依赖与目录约定： - parsers/ 存放各种协议解析器，每个协议一个 xxx.py，内含 parse() 函数
· 例如：vmess.py / vless.py / trojan.py / hysteria2.py / wireguard.py 等
· 本脚本启动时自动 import 全部解析模块，建立 parsers_mod 映射表 - config_template/ 存放 sing-box 配置模板（\*.json）
· 模板中通常预先写好：inbounds、dns、route、基础 outbounds 框架、{all} 占位等 - providers.json 主配置文件（如果没传入 --temp_json_data，就从这里加载）
· 定义全局选项 + 多个订阅源（subscribes） - 其它模块
· tool 自己封装的工具函数（读文件、HTTP 请求、去重、字符串处理等）
· api.app.TEMP_DIR Web UI / 本地 API 使用的临时目录
· parsers.clash2base64.clash2v2ray 用于把 Clash 代理条目转成标准 v2ray 分享链接
· gh_proxy_helper.set_gh_proxy 预留的 GitHub 加速设置函数（本文件中目前未直接调用）

一、启动入口与命令行参数：
if **name** == '**main**':
1）init_parsers() - 扫描 parsers 目录，动态 import 每个 .py 文件 - 将模块名（不含扩展名）作为 key，模块对象作为 value，存入 parsers_mod - 之后 get_parser() 会根据协议字符串从 parsers_mod 中找到对应的 parse 函数

        2）argparse 解析参数：
            --temp_json_data   传入一段 JSON 字符串（作为临时 providers 配置）
            --template_index   本地模板序号（从 0 开始，或用户输入数字选择）
            --gh_proxy_index   预留的 GitHub 加速入口（当前版本未显式使用）

        3）加载 providers 配置：
            - 如果传入了 --temp_json_data 且不为空：
                providers = json.loads(temp_json_data)
            - 否则：
                providers = load_json('providers.json')
            - load_json(path) 只是读文件 + json.loads

        4）选择配置模板（config_template）：
            - 情况 A：providers 里给出了远程模板 URL（config_template 字段）
                · 打印选择信息
                · requests.get() 拉取远程 JSON 模板，作为 config
            - 情况 B：本地模板模式
                · get_template() 列出 config_template/ 下所有 .json 文件（去掉扩展名）
                · display_template() 把可用模板打印出来
                · select_config_template()：
                    - 如果命令行给了 template_index，则直接用
                    - 否则让用户交互输入序号（回车默认选择第一个）
                · 根据选择的模板名加载本地 JSON 文件，作为 config

二、订阅处理主流程：process_subscribes()

    def process_subscribes(subscribes):
        - 输入：providers["subscribes"] 列表，每个元素描述一个机场订阅，例如：
            {
                "tag": "某机场",
                "url": "订阅链接或本地文件或 sub://base64...",
                "enabled": true/false,
                "prefix": "[前缀]",
                "emoji": true/false,
                "ex-node-name": "关键字1,关键字2|支持正则",
                "subgroup": "可选子分组名",
                ...
            }
        - 输出：nodes 字典，结构类似：
            {
                "机场A": [node1, node2, ...],
                "机场B-sub1-subgroup": [node3, node4, ...],
                ...
            }

    逻辑步骤：
        1）初始化 nodes = {}
        2）遍历 subscribes：
            - 如果存在 enabled 且为 False：跳过
            - 如果 url 中包含特定黑名单域名（如 sing-box-subscribe-doraemon.vercel.app）：跳过
            - 调用 get_nodes(subscribe['url']) 获取该订阅下的所有节点对象列表
            - 如果 _nodes 非空：
                a. add_prefix(_nodes, subscribe)
                    · 如果 subscribe['prefix'] 存在，则给每个 node['tag'] 前面加上前缀
                    · 若 node 有 detour 字段，也同步加前缀
                b. add_emoji(_nodes, subscribe)
                    · 如果 subscribe['emoji'] 为真：
                        - 使用 tool.rename() 对每个 tag 做 emoji / 重命名处理
                        - detour 字段同样处理
                c. nodefilter(_nodes, subscribe)
                    · 如果订阅配置中有 ex-node-name：
                        - 用正则 re.split(r'[,\|]', ...) 拆分出多个排除关键字
                        - 如果节点名中包含任一关键字，就从列表中移除该节点
                d. subgroup 处理：
                    · 若 subscribe['subgroup'] 存在，会把 tag 修改为：
                      原tag + '-' + subgroup + '-subgroup'
                      用于后续按子分组再区分节点组
                e. 将 _nodes 追加到 nodes[订阅 tag] 里：
                    - 若该 tag 还没有对应键，则先创建空列表
                    - 然后 nodes[tag] += _nodes
            - 否则打印“没有在此订阅下找到节点，跳过”

        3）tool.proDuplicateNodeName(nodes)
            - 对所有节点名做去重处理（避免 tag 冲突/重复）
        4）返回 nodes 字典

三、单个订阅内容的解析：get_nodes() + parse_content()

    def get_nodes(url):
        1）如果 url 以 'sub://' 开头：
            - 去掉前缀 'sub://'
            - 对剩余部分做 Base64 解码得到真实订阅 URL
        2）用 urlparse(url) 判断是否含有 scheme（http/https 等）
            - 如果没有 scheme：
                · 尝试认为它是 Base64 编码的纯内容：
                    content = tool.b64Decode(url).decode('utf-8')
                    data = parse_content(content)
                · 若 Base64 解码失败：
                    content = get_content_form_file(url)
                    （从本地文件读取订阅内容）
            - 如果有 scheme（http/https 等）：
                · content = get_content_from_url(url)

        3）处理 content 类型：
            - 若 content 是 dict 且包含 'proxies'：
                · 视为 Clash 配置，遍历 proxies，用 clash2v2ray(proxy) 转成 v2ray 分享链接
                · 把这些分享链接拼接成文本，再走 parse_content() 统一解析
            - 若 content 是 dict 且包含 'outbounds'：
                · 视为已是 sing-box 配置，过滤掉 type 为 selector/urltest/direct/block/dns 的出站
                · 剩余 outbounds 直接作为节点列表返回
            - 其它情况（普通订阅文本 / share link 列表）：
                · 直接调用 parse_content(content)

    def parse_content(content):
        - 把内容按行 split，逐行处理：
            · 去掉空行
            · 通过 get_parser(t) 判断这行链接属于哪种协议（vmess/vless/...）
            · factory = 对应协议模块 parsers_mod[proto].parse
            · 调用 factory(t) 把链接解析为一个 node 对象
            · 如果返回的是 tuple（用于 shadowtls 一类一连二出站的特殊场景），就把两个都加入列表
            · 普通情况下直接 append(node)
        - 返回节点对象列表 nodelist

    def get_parser(node):
        - 使用 tool.get_protocol(node) 解析出协议名 proto
        - 若 providers['exclude_protocol'] 配置了需要排除的协议集合：
            · 按逗号/空格拆分
            · 把 hy2 规范化为 hysteria2
            · 如果 proto 在排除列表中，则返回 None（不解析此节点）
        - 如果 proto 不在 parsers_mod（未实现解析器），返回 None
        - 否则返回 parsers_mod[proto].parse

    def get_content_from_url(url, n=10):
        - 打印当前处理的 URL
        - 如果 url 本身就是一个单节点分享链接（前缀在 vmess:// / vless:// / ss:// / trojan:// / hysteria2:// / wireguard:// 等列表内）：
            · 直接将该字符串用于后续处理（视为单节点文本）
        - 否则：
            · 找到 providers["subscribes"] 中对应 url 的条目，看是否设定了自定义 User-Agent
            · 用 tool.getResponse(url, custom_user_agent=UA) 请求订阅
            · 最多重试 n 次（默认 10 次），请求失败则稍等再试
            · 若一直失败则返回 None
        - 请求成功时，把响应内容做 noblankLine 处理后返回字符串

四、节点过滤与分组：nodes_filter() + action_keywords()

    def nodes_filter(nodes, filter, group):
        - 用于对某一出站组内部的节点按配置条件过滤
        - filter 的结构类似：
            "filter":[
                {"action":"include","keywords":["香港","HK"]},
                {"action":"exclude","keywords":["IPLC","IEPL"]},
                ...
            ]
        - 遍历 filter 列表：
            · 如果某条规则 a 带有 'for' 字段，且当前 group 不在 a['for'] 中，则跳过（该规则仅对特定分组生效）
            · 否则调用 action_keywords(nodes, a['action'], a['keywords'])
        - 返回过滤后的 nodes 列表

    def action_keywords(nodes, action, keywords):
        - 支持 action = 'include' 或 'exclude'
        - 关键逻辑：
            · 把 keywords 列表用 '|' 合并成一个正则模式 combined_pattern
            · 若关键字列表为空或都是空白，直接返回原 nodes
            · compiled_pattern = re.compile(combined_pattern)
            · 对每个 node['tag'] 做正则匹配：
                - include：只保留匹配到的一部分
                - exclude：移除匹配到的一部分
        - 返回过滤后的节点列表

    def add_prefix(nodes, subscribe):
        - 若订阅定义了 prefix，则将 prefix 加到：
            · 每个 node['tag'] 前面
            · 每个 node['detour'] 前面（若存在）

    def add_emoji(nodes, subscribe):
        - 若订阅定义了 emoji 为 True：
            · 调用 tool.rename() 对 node['tag'] 做 emoji/改名处理
            · node['detour'] 同样处理

    def nodefilter(nodes, subscribe):
        - 若订阅中配置了 ex-node-name：
            · 用正则 re.split(r'[,\|]', ex-node-name) 将排除关键词拆成列表
            · 遍历节点副本，对任一节点：
                - 如果 tag 中包含某个排除关键字，就从原列表中删除该节点

五、把节点合成最终 sing-box 配置：combin_to_config()

    输入：
        config  —— 已加载好的 sing-box 模板（dict）
        data    —— process_subscribes() 返回的 nodes 字典
                  { group_tag1: [nodes...], group_tag2: [nodes...], ... }

    主要步骤：
        1）config_outbounds = config["outbounds"]
           - 这是模板中原本的出站配置（可能包含 selector、Proxy、URLTest 等）

        2）先处理有 'subgroup' 的分组：
           - 对每个 group（键名）：
               · 如果 group 名中包含 'subgroup' 标记：
                    - 在 tag='Proxy' 的 selector outbounds 中插入该子分组标签（或替换 {all}）
                    - 额外创建一个新的 selector 出站：
                        {
                            "tag": 子分组简化名,
                            "type": "selector",
                            "outbounds": ["{原group名}"]
                        }
                    - 这样就能在面板中按 subgroup 维度单独选择节点组

        3）处理 {all} 模板占位：
           - 在每个包含 "outbounds" 字段的出站配置中：
               · 如果出现 '{all}'：
                    - 保留该占位，但后续会用所有 group 的节点填充
               · 同时确保非占位项正常保留，避免被误删

        4）用 pro_node_template 生成每个 selector 的出站列表：
           def pro_node_template(data_nodes, config_outbound, group):
                - 如果 config_outbound 里有 filter 字段：
                    · 对 data_nodes 调用 nodes_filter() 做精细过滤
                - 返回该 group 下所有 node['tag'] 的列表
           - 对每个带有 "outbounds" 的模板出站 po：
                · 遍历 po["outbounds"] 中的每个元素 oo：
                    - 若 oo 形如 "{group_name}"：
                        · 去掉花括号，查 data 中是否存在同名 group：
                            - 存在：t_o.extend( pro_node_template(nodes, po, group) )
                            - 不存在但名称为 'all'：
                                · 对 data 中所有 group 均调用 pro_node_template
                    - 若 oo 不是占位（普通出站 tag）：直接 append 到 t_o
                · 若最终 t_o 为空（没有任何节点符合条件）：
                    - 取出 config_outbounds 中 type='direct' 的项
                    - 将其 tag 作为兜底出站加入 t_o，避免 sing-box 无法启动
                    - 同时打印警告信息
                · 将 po["outbounds"] 替换为 t_o，并删除 po['filter'] 字段（避免进入最终配置）

        5）将所有节点实体附加到 config['outbounds'] 中：
           - 把 data 中每个 group 的节点列表展开，追加到 temp_outbounds
           - 最终：
                config['outbounds'] = config_outbounds（处理后的 selector 等） + temp_outbounds（真正的节点出站）

        6）自动为 DNS 规则配置对应 outbounds（防止 DNS 泄漏）：
           - if providers["auto_set_outbounds_dns"] 存在并且配置了 proxy / direct：
                · 调用 set_proxy_rule_dns(config)
                · 会根据 route.rules 中的 outbound，自动为 dns.rules 添加 detour（proxy 或 direct）

        7）WireGuard 特例处理：
           - 找出所有 type='wireguard' 的 outbounds，放入 endpoints 列表
           - 使用 OrderedDict 把 endpoints 字段插入到 config 中的 outbounds 后面
           - 同时从 config['outbounds'] 中移除这些 wireguard 项
           - 这样生成的配置符合 sing-box 对 endpoints/wireguard 的结构要求

        8）返回最终 config 字典

六、只输出节点模式：Only-nodes

    在 main 逻辑的最后阶段：
        - 如果 providers.get('Only-nodes') 为真：
            · 将 nodes 字典中所有 group 的内容简单合并成一个列表 combined_contents
            · final_config = combined_contents
              （即只输出一个节点数组，适合给其它系统继续加工）
        - 否则：
            · final_config = combin_to_config(config, nodes)
              （把节点合并进模板，成为完整 sing-box 配置）

七、配置保存：save_config()

    def save_config(path, nodes_or_config):
        1）如果启用了 auto_backup：
            - now = 当前时间戳 'YYYYmmddHHMMSS'
            - 若目标 path 已存在：
                · 将旧文件重命名为 path.YYYYmmddHHMMSS.bak
        2）如果 path 已存在：
            - 先删除，再保存新文件
            - 打印“已删除文件，并重新保存：xxx”
        3）否则：
            - 打印“文件不存在，正在保存：xxx”
        4）用 json.dump() 按 UTF-8 写入最终配置（带缩进）

        注：updateLocalConfig() 函数中预留了向本地管理端口（如 9090）推送配置的 HTTP 接口，但在 main 中默认被注释掉，你可以根据需要开启。

使用方式总结：
1）准备 providers.json： - 定义全局：
· save_config_path 输出 config.json 的保存路径
· auto_backup 是否自动备份老配置
· config_template 可选，远程模板 URL（否则读取本地 config_template/\*.json）
· auto_set_outbounds_dns 自动为 DNS 规则设置 proxy/direct 出站
· Only-nodes 是否只输出节点数组而不套模板
· exclude_protocol 需要全局排除的协议列表（例如 "ssr,hysteria"） - 定义 subscribes 列表：
· 每个订阅一个 dict：url / tag / prefix / emoji / ex-node-name / subgroup / enabled / filter 等

    2）准备 parsers/ 目录：
        - 确保对你需要支持的协议（vmess/vless/trojan/hy2/wireguard/…）都有相应的解析器模块，且模块名与协议字符串一致（或在 tool.get_protocol 中做了映射）

    3）准备 config_template/ 模板：
        - 模板中写好基本结构（dns / route / inbounds / 基础 outbounds）
        - 使用占位符 {groupTag} 或 {all} 来告诉脚本“在这里填充各机场节点组”
        - 可以给 selector 出站配置 filter，用于进一步包含/排除节点名称

    4）运行本脚本：
        - 本地直接：
            python3 main.py
        - 或通过其它程序/面板传入临时 JSON：
            python3 main.py --temp_json_data '{"save_config_path": "...", "subscribes":[...], ...}' --template_index 0

    5）脚本运行结束后：
        - 在 save_config_path 指定的位置生成最终配置：
            · 若 Only-nodes=True：为节点列表（outbound 配置块列表）
            · 否则：为完整 sing-box config.json，可直接给 PuerNya 内核加载使用

注意： - 该脚本不负责真正“启动 sing-box”或“修改防火墙规则”，它只负责“订阅收集 + 节点解析 + 筛选 + 合并模板 + 生成配置文件”这一层。 - 与 Sbshell / 路由器 TProxy/TUN/nftables 等协作时，你通常会：
· 先用 main.py 自动生成 config.json
· 再由外层脚本（例如 Sbshell 的 auto_update.sh / start_singbox.sh）负责重启 sing-box 与路由规则。
"""

```
