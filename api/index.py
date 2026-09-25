from flask import Flask, jsonify

app = Flask(__name__)


@app.get("/api")
def home():
    return jsonify({
        "route": "/api",
        "status": "ok"
    })


@app.get("/api/test")
def test():
    return jsonify({
        "route": "/api/test",
        "status": "ok"
    })


@app.get("/api/gensub")
def gensub():
    return jsonify({
        "route": "/api/gensub",
        "status": "ok"
    })