from fastapi import FastAPI
from fastapi import FastAPI
from app.services.gemini_service import ask_gemini

app = FastAPI()

@app.get("/")
def home():
    return {"message": "FlowForge Backend Running"}

@app.get("/test")
def test():
    result = ask_gemini("Say hello from FlowForge AI.")
    return {"response": result}