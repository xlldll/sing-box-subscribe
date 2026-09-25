import os
import requests

from flask import (
    Flask,
    request,
    Response,
    jsonify,
)

app = Flask(__name__)


@app.get("/api")
def home():
    return jsonify({
        "status": "ok",
        "service": "vercel-python",
    })


@app.get("/api/test")
def test():
    return jsonify({
        "status": "ok",
        "route": "/api/test",
        "relay_key_configured": bool(
            os.getenv("RELAY_KEY")
        ),
        "b_sub_url_configured": bool(
            os.getenv("B_SUB_URL")
        ),
    })


@app.get("/api/gensub")
def gensub():
    relay_key = os.getenv("RELAY_KEY")
    b_sub_url = os.getenv("B_SUB_URL")

    key = request.args.get("key")

    if not relay_key:
        return jsonify({
            "status": "error",
            "type": "config_error",
            "message": "RELAY_KEY is not configured",
        }), 500

    if key != relay_key:
        return jsonify({
            "status": "error",
            "type": "auth_error",
            "message": "Invalid relay key",
        }), 401

    if not b_sub_url:
        return jsonify({
            "status": "error",
            "type": "config_error",
            "message": "B_SUB_URL is not configured",
        }), 500

    try:
        r = requests.get(
            b_sub_url,
            headers={
                "User-Agent": "mihomo",
                "Accept": "*/*",
            },
            timeout=15,
        )

        response = Response(
            r.content,
            status=r.status_code,
        )

        response.headers["Content-Type"] = (
            r.headers.get(
                "Content-Type"
            )
            or
            "text/plain; charset=utf-8"
        )

        response.headers[
            "Cache-Control"
        ] = "no-store"

        response.headers[
            "X-Upstream-Status"
        ] = str(r.status_code)

        if r.headers.get("cf-ray"):
            response.headers[
                "X-Upstream-CF-Ray"
            ] = r.headers["cf-ray"]

        return response

    except requests.Timeout:
        return jsonify({
            "status": "error",
            "type": "timeout",
            "message": "Upstream timeout",
        }), 502

    except Exception as e:
        return jsonify({
            "status": "error",
            "type": "fetch_error",
            "message": str(e),
        }), 502