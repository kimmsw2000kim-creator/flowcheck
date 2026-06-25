from fastapi import FastAPI

app = FastAPI(title="FlowCheck API")


@app.get("/health")
def health_check():
    return {"status": "ok"}