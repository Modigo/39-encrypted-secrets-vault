from fastapi import FastAPI

app = FastAPI(title="Encrypted Secrets Vault")


@app.get("/health")
def health_check():
    return {"status": "ok"}