from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import json
import os

from main import generate_config_from_providers  # 使用 main.py 中的封装函数


class handler(BaseHTTPRequestHandler):
    """
    Vercel / 无服务器环境使用的 HTTP 处理器。

    约定：
        - GET /api/generate?providers=<json>
        - 或通过环境变量 SUB_CONFIG 传入 providers 配置。

    返回：
        - 成功：生成的配置（JSON 格式）
        - 失败：包含 error/detail 的 JSON 错误信息
    """

    def _send_json(self, status_code: int, data):
        """
        统一返回 JSON 响应。

        参数：
            status_code: int
                HTTP 状态码，例如 200, 400, 500 等。
            data: Any
                将被 json.dumps 序列化为响应体。
        """
        body = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        # 允许跨域，方便在浏览器或其他前端直接调用
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        """
        处理 GET 请求。

        支持两种用法：
            1. 调试模式：
               /api/generate?debug
               - 用于检查 SUB_CONFIG 是否被正确读取。

            2. 正常生成配置：
               /api/generate?providers=<urlencoded_json>
               - 若 query 中没有 providers，则回退到环境变量 SUB_CONFIG。
        """
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)

        # ---------------------------
        # Debug 模式：观察 SUB_CONFIG 的真实内容
        # ---------------------------
        if "debug" in qs:
            env_val = os.environ.get("SUB_CONFIG")
            return self._send_json(200, {
                "debug_mode": True,
                "env_SUB_CONFIG": env_val,
                "env_is_none": env_val is None,
                "env_len": len(env_val) if isinstance(env_val, str) else None
            })

        # ---------------------------
        # 读取 providers 参数（优先 query，其次环境变量）
        # ---------------------------
        providers_raw = qs.get("providers", [None])[0]

        # 如果 URL 参数中没有 providers，则尝试从 SUB_CONFIG 读取
        if not providers_raw or not isinstance(providers_raw, str) or not providers_raw.strip():
            env_val = os.environ.get("SUB_CONFIG", "").strip()
            providers_raw = env_val

        # 仍然为空，则无法继续
        if not providers_raw:
            return self._send_json(400, {
                "error": "missing providers configuration",
                "detail": "no providers param and SUB_CONFIG is empty"
            })

        # ---------------------------
        # 尝试解析 providers 的 JSON 内容
        # ---------------------------
        try:
            providers = json.loads(providers_raw)
        except Exception as e:
            return self._send_json(400, {
                "error": "invalid providers json",
                "detail": str(e),
                # 只回显前 200 字符，避免过长
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
                "detail": str(e)
            })

        # ---------------------------
        # 正常返回生成的配置
        # ---------------------------
        return self._send_json(200, config)