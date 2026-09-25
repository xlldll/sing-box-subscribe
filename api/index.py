import os
import requests
from flask import Flask, request, Response, jsonify

app = Flask(__name__)

RELAY_KEY = os.getenv("RELAY_KEY")
B_SUB_URL = os.getenv("B_SUB_URL")


@app.get("/api/gensub")
def gensub():
    key = request.args.get("key")

    if not RELAY_KEY or key != RELAY_KEY:
        return Response(
            "Not Found",
            status=404,
            content_type="text/plain",
        )

    if not B_SUB_URL:
        return jsonify({
            "status": "error",
            "type": "config_error",
            "message": "B_SUB_URL is not configured",
        }), 500

    try:
        r = requests.get(
            B_SUB_URL,
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
            r.headers.get("Content-Type")
            or "text/plain; charset=utf-8"
        )

        response.headers["Cache-Control"] = "no-store"

        response.headers["X-Upstream-Status"] = str(
            r.status_code
        )

        if "cf-ray" in r.headers:
            response.headers["X-Upstream-CF-Ray"] = (
                r.headers["cf-ray"]
            )

        return response

    except requests.Timeout:
        return jsonify({
            "status": "error",
            "type": "timeout",
            "message": "Upstream request timed out",
        }), 502

    except Exception as e:
        return jsonify({
            "status": "error",
            "type": "fetch_error",
            "message": str(e),
        }), 502


@app.get("/api/test")
def test():
    return jsonify({
        "status": "ok",
        "service": "gensub",
    })