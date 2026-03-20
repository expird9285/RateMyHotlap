from fastapi import FastAPI

app = FastAPI(title="RateMyHotlap API")

@app.get("/")
def read_root():
    return {"message": "Welcome to RateMyHotlap API!"}

@app.get("/health")
def health_check():
    return {"status": "ok"}
