# api/generate.py
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import json
import os

from main import generate_config_from_providers  # 从你的 main.py 引入刚才那个函数


class handler(BaseHTTPRequestHandler):

    def _send_json(self, status_code: int, data):
        body = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")  # 简单 CORS
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        """
        支持两种用法：
        1. 直接在 URL 里传 providers：
           /api/generate?providers={...json...}

        2. 不传 providers，则从环境变量 SUB_CONFIG 里读取一份默认配置：
           SUB_CONFIG = '{"subscribes":[...], "config_template":"...", ...}'
        """

        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)

        # 1. 取 providers 参数（URL 里的 JSON）
        providers_raw = qs.get("providers", [None])[0]

        # 2. 如果没传，就尝试用环境变量 SUB_CONFIG
        if providers_raw is None:
            providers_raw = os.environ.get("SUB_CONFIG", "{}")

        # 3. 解析 JSON
        try:
            providers = json.loads(providers_raw)
        except Exception as e:
            return self._send_json(400, {
                "error": "invalid providers json",
                "detail": str(e)
            })

        # 4. 调用核心生成逻辑
        try:
            config = generate_config_from_providers(providers)
        except Exception as e:
            return self._send_json(500, {
                "error": "generate_config_failed",
                "detail": str(e)
            })

        # 5. 返回最终配置
        return self._send_json(200, config)

    # 如果你想支持 POST，也可以加一个：
    def do_POST(self):
        """
        支持 POST JSON：
        curl -X POST https://xxx.vercel.app/api/generate -d '{"subscribes":[...]}'
        """
        length = int(self.headers.get("Content-Length", 0) or 0)
        raw_body = self.rfile.read(length).decode("utf-8")
        try:
            providers = json.loads(raw_body or "{}")
        except Exception as e:
            return self._send_json(400, {
                "error": "invalid json body",
                "detail": str(e)
            })

        try:
            config = generate_config_from_providers(providers)
        except Exception as e:
            return self._send_json(500, {
                "error": "generate_config_failed",
                "detail": str(e)
            })

        return self._send_json(200, config)