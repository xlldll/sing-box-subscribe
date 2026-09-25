from fastapi import FastAPI

app = FastAPI()

@app.get("/api")
def home():
    return {
        "status": "ok",
        "route": "/api"
    }

@app.get("/api/test")
def test():
    return {
        "status": "ok",
        "route": "/api/test"
    }

@app.get("/api/gensub")
def gensub():
    return {
        "status": "ok",
        "route": "/api/gensub"
    }