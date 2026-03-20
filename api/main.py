from fastapi import FastAPI
from api.routers import upload, laps

app = FastAPI(title="RateMyHotlap API")

app.include_router(upload.router)
app.include_router(laps.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to RateMyHotlap API!"}

@app.get("/health")
def health_check():
    return {"status": "ok"}
