import sys
from pathlib import Path

# Add apps/ai-service to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

import asyncio
from app.api.ingest import reindex_all
from app.vectorstore.faiss_store import vector_store

async def main():
    print("Re-indexing all documents from data/raw/...")
    result = await reindex_all()
    print("Re-index result:", result)
    print(f"Total vectors in store: {vector_store.count()}")
    for idx, c in enumerate(vector_store.metadata[:5]):
        print(f"Chunk {idx}: Doc='{c.get('documentTitle')}' verified={c.get('verified')} isTestData={c.get('isTestData')}")

if __name__ == "__main__":
    asyncio.run(main())

