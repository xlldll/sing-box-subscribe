import json
import os

# 自动使用脚本所在目录作为配置目录
CONFIG_DIR = os.path.dirname(os.path.abspath(__file__))

def load_json(filename: str):
    path = os.path.join(CONFIG_DIR, filename)
    if not os.path.exists(path):
        print(f"[WARN] 找不到 {filename}, 跳过 (path={path})")
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def unwrap(obj, key: str):
    """
    如果是 {"dns": {...}} 这种，就自动取里面那层；
    否则保持原样。
    """
    if isinstance(obj, dict) and key in obj and len(obj) == 1:
        return obj[key]
    return obj

def ensure_array(x):
    """
    inbounds / outbounds 统一变成数组：
    - 如果是 None -> []
    - 如果是 dict 且包含 inbounds/outbounds -> 取内部再处理
    - 如果本来就是 list -> 原样
    - 其他 -> 单元素 list
    """
    if x is None:
        return []
    if isinstance(x, dict):
        # 处理 {"inbounds": [...]} / {"outbounds": [...]} 这种情况
        if "inbounds" in x and isinstance(x["inbounds"], list):
            return x["inbounds"]
        if "outbounds" in x and isinstance(x["outbounds"], list):
            return x["outbounds"]
        if "outbound_providers" in x and isinstance(x["outbound_providers"], list):
            return x["outbound_providers"]
        return [x]
    if isinstance(x, list):
        return x
    return [x]

# 1. 读入各模块
log_cfg  = load_json("log.json")
dns_cfg  = load_json("dns.json")
ntp_cfg  = load_json("ntp.json")
exp_cfg  = load_json("experimental.json")
inb_cfg  = load_json("inbounds.json")
out_cfg  = load_json("outbounds.json")
route_cfg = load_json("route.json")

# 2. 解壳（如果包了一层 log/dns/route）
log_cfg  = unwrap(log_cfg,  "log") if log_cfg  is not None else None
dns_cfg  = unwrap(dns_cfg,  "dns") if dns_cfg  is not None else None
ntp_cfg  = unwrap(ntp_cfg,  "dns") if ntp_cfg  is not None else None
exp_cfg  = unwrap(exp_cfg,  "experimental") if exp_cfg is not None else None
route_cfg = unwrap(route_cfg, "route") if route_cfg is not None else None


# 3. inbounds / outbounds 统一转为数组
inbounds  = ensure_array(inb_cfg)
outbounds = ensure_array(out_cfg)

# 4. 组装最终 sing-box 配置
final_config = {}

if log_cfg is not None:
    final_config["log"] = log_cfg

if dns_cfg is not None:
    final_config["dns"] = dns_cfg

if ntp_cfg is not None:
    final_config["ntp"] = ntp_cfg

if exp_cfg is not None:
    final_config["experimental"] = exp_cfg

final_config["inbounds"] = inbounds
final_config["outbounds"] = outbounds

if route_cfg is not None:
    final_config["route"] = route_cfg

# 5. 写出到 sing-box.json（覆盖旧文件）
output_path = os.path.join("../config_template", "ConfigforMac.json")
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(final_config, f, indent=2, ensure_ascii=False)

print("✔ 合并完成 →", output_path)