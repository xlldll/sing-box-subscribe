from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import json
import os

from main import generate_config_from_providers  # 使用 main.py 中的封装函数
"""
接下来你要做的操作（一步步）：
1）在 Vercel 项目里设置环境变量：
	•	SUB_CONFIG（可选，老默认）
	•	SUB_CONFIG_MAC（给 Mac/SFM 用）
	•	SUB_CONFIG_ROUTER（给路由器用）
值都填成 一行的 JSON 字符串（就是你刚才调好的那种）。

2）访问方式：
	•	Mac/SFM 那套：
	•	https://XXX.vercel.app/api/generate?profile=mac
	•	路由器那套：
	•	https://XXX.vercel.app/api/generate?profile=router
	•	老方式（如果你保留 SUB_CONFIG）：
	•	https://XXX.vercel.app/api/generate

3）如果想确认某个 profile 的 SUB_CONFIG 有没有读对：
	•	https://XXX.vercel.app/api/generate?profile=router&debug
会返回：用的是哪个 env_key，长度多少，方便排错。
"""

class handler(BaseHTTPRequestHandler):
    """
    Vercel / 无服务器环境使用的 HTTP 处理器。

    约定：
        - GET /api/generate?providers=<json>
        - 或 GET /api/generate?profile=<profile_name>
            * profile=mac     → 使用环境变量 SUB_CONFIG_MAC
            * profile=router  → 使用环境变量 SUB_CONFIG_ROUTER
            * 省略 profile    → 使用环境变量 SUB_CONFIG（兼容旧逻辑）

        - 也可以同时传 providers 参数，优先使用 query 里的 providers。

    返回：
        - 成功：生成的配置（JSON 格式）
        - 失败：包含 error/detail 的 JSON 错误信息
    """

    def _send_json(self, status_code: int, data):
        """
        统一返回 JSON 响应。

        参数：
            status_code: int
                HTTP 状态码（例如 200, 400, 500）。
            data: Any
                将被 json.dumps 序列化为响应体。
        """
        body = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        # 允许跨域调用
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        """
        处理 GET 请求。

        模式：
            1）调试模式：
                /api/generate?debug[&profile=router]
                - 用于查看当前 profile 对应读取到哪个环境变量，以及内容长度。

            2）正常生成配置：
                /api/generate?providers=<urlencoded_json>[&profile=xxx]
                或
                /api/generate?profile=mac / router
                - 若 URL 中没有 providers，则按 profile 选择对应环境变量。
        """
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)

        # ---------------------------
        # 读取 profile，决定用哪套 SUB_CONFIG
        # ---------------------------
        profile = qs.get("profile", ["default"])[0].strip() or "default"
        # 不区分大小写，统一转小写
        profile = profile.lower()

        # profile → 环境变量名映射
        profile_env_map = {
            "default": "SUB_CONFIG",       # 兼容旧逻辑
            "mac": "SUB_CONFIG_MAC",      # 给 Mac / SFM 用
            "router": "SUB_CONFIG_ROUTER"  # 给路由器用
        }
        env_key = profile_env_map.get(profile, "SUB_CONFIG")

        # ---------------------------
        # Debug 模式：观察对应 profile 的 SUB_CONFIG
        # ---------------------------
        if "debug" in qs:
            env_val = os.environ.get(env_key)
            return self._send_json(200, {
                "debug_mode": True,
                "profile": profile,
                "env_key": env_key,
                "env_SUB_CONFIG": env_val,
                "env_is_none": env_val is None,
                "env_len": len(env_val) if isinstance(env_val, str) else None
            })

        # ---------------------------
        # 读取 providers 参数（优先用 URL 中的 providers）
        # ---------------------------
        providers_raw = qs.get("providers", [None])[0]

        # 如果 URL 里没有 providers，则按 profile 从环境变量取
        if not providers_raw or not isinstance(providers_raw, str) or not providers_raw.strip():
            env_val = os.environ.get(env_key, "").strip()
            providers_raw = env_val

        # 如果依然为空，直接返回错误
        if not providers_raw:
            return self._send_json(400, {
                "error": "missing providers configuration",
                "detail": (
                    f"no providers param and environment variable {env_key} is empty"
                ),
                "profile": profile,
                "env_key": env_key
            })

        # ---------------------------
        # 尝试解析 providers JSON
        # ---------------------------
        try:
            providers = json.loads(providers_raw)
        except Exception as e:
            return self._send_json(400, {
                "error": "invalid providers json",
                "detail": str(e),
                "profile": profile,
                "env_key": env_key,
                # 只回显前 200 个字符，避免太长
                "raw_providers": providers_raw[:200]
            })

        # ---------------------------
        # 调用核心逻辑生成配置
        # ---------------------------
        try:
            config = generate_config_from_providers(providers)
        except Exception as e:
            return self._send_json(500, {
                "error": "generate_config_failed",
                "detail": str(e),
                "profile": profile,
                "env_key": env_key
            })

        # ---------------------------
        # 正常返回生成的配置
        # ---------------------------
        return self._send_json(200, config)