import os
import requests

def handler(request):
    key = request.args.get("key")

    if not os.getenv("RELAY_KEY") or key != os.getenv("RELAY_KEY"):
        return ("Not Found", 404)

    url = os.getenv("B_SUB_URL")

    if not url:
        return ("B_SUB_URL not configured", 500)

    try:
        r = requests.get(
            url,
            headers={
                "User-Agent": "mihomo",
                "Accept": "*/*",
            },
            timeout=10,
        )

        headers = {
            "Content-Type": r.headers.get(
                "content-type",
                "text/plain; charset=utf-8"
            ),
            "Cache-Control": "no-store",
            "X-Upstream-Status": str(r.status_code),
        }

        return (
            r.text,
            r.status_code,
            headers,
        )

    except requests.Timeout:
        return (
            {
                "status": "error",
                "type": "timeout",
                "message": "Upstream timeout",
            },
            502,
        )

    except Exception as e:
        return (
            {
                "status": "error",
                "type": "fetch_error",
                "message": str(e),
            },
            502,
        )