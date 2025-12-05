from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import json
import os

from main import generate_config_from_providers  # 保持你原来逻辑不变


class handler(BaseHTTPRequestHandler):

    def _send_json(self, status_code: int, data):
        """统一输出 JSON"""
        body = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)

        # ---------------------------
        # 🔍 Debug 模式：查看 SUB_CONFIG 真实值
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
        # 读取 providers 参数
        # ---------------------------
        providers_raw = qs.get("providers", [None])[0]

        # providers 参数为空 → 尝试用 SUB_CONFIG
        if not providers_raw or not isinstance(providers_raw, str) or not providers_raw.strip():
            env_val = os.environ.get("SUB_CONFIG", "").strip()
            providers_raw = env_val

        # 如果还是空，直接报错
        if not providers_raw:
            return self._send_json(400, {
                "error": "missing providers configuration",
                "detail": "no providers param and SUB_CONFIG is empty"
            })

        # ---------------------------
        # 尝试解析 JSON
        # ---------------------------
        try:
            providers = json.loads(providers_raw)
        except Exception as e:
            return self._send_json(400, {
                "error": "invalid providers json",
                "detail": str(e),
                "raw_providers": providers_raw[:200]
            })

        # ---------------------------
        # 生成配置
        # ---------------------------
        try:
            config = generate_config_from_providers(providers)
        except Exception as e:
            return self._send_json(500, {
                "error": "generate_config_failed",
                "detail": str(e)
            })

        # ---------------------------
        # 正常返回
        # ---------------------------
        return self._send_json(200, config)