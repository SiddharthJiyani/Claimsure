from fastapi import FastAPI

app = FastAPI(
    title="Claimsure AI Server",
    description="AI agents, RAG, workflows, and MCP integrations for Claimsure",
    version="1.0.0",
)


@app.get("/")
def root():
    return {
        "message": "Claimsure AI Server is running 🧠🚀"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }