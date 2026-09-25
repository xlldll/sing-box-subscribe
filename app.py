from fastapi import FastAPI

app = FastAPI()


@app.get("/")
def home():
    return {
        "status": "ok"
    }


@app.get("/test")
def test():
    return {
        "status": "ok",
        "route": "/test"
    }


@app.get("/gensub")
def gensub():
    return {
        "status": "ok",
        "route": "/gensub"
    }