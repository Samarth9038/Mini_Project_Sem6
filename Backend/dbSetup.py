import certifi
from pymongo import MongoClient
from pymongo.operations import SearchIndexModel
from pymongo.errors import CollectionInvalid

CONNECTION_STRING = "mongodb+srv://admin:admin123@cluster0.fzt0yhs.mongodb.net/?appName=Cluster0"

def setup_stylist_backend():
    client = MongoClient(CONNECTION_STRING, tlsCAFile=certifi.where())
    db = client["stylist_engine"]
    
    print("🚀 Claiming Namespace and Initializing Cloud Infrastructure...")

    # 1. Manually create the collection to avoid 'NamespaceNotFound'
    try:
        db.create_collection("wardrobe")
        print("✅ Collection 'wardrobe' created.")
    except CollectionInvalid:
        print("ℹ️ Collection 'wardrobe' already exists. Proceeding...")

    wardrobe = db["wardrobe"]
    users = db["users"]

    # 2. Define Vector Search Index
    vector_index_definition = {
        "fields": [
            {
                "type": "vector",
                "path": "embedding",
                "numDimensions": 512,
                "similarity": "cosine"
            },
            {"type": "filter", "path": "userID"},
            {"type": "filter", "path": "category"}
        ]
    }

    index_model = SearchIndexModel(
        definition=vector_index_definition,
        name="vector_index",
        type="vectorSearch"
    )

    # 3. Apply Index & Constraints
    try:
        # Create Vector Index
        wardrobe.create_search_index(model=index_model)
        print("✅ Vector Search index requested (Building on Atlas).")
        
        # Create Unique Index for Users
        users.create_index("userID", unique=True)
        print("✅ User identity index created.")

        # Create collection and index for suggested outfits
        try:
            db.create_collection("suggested_outfits")
            print("✅ Collection 'suggested_outfits' created.")
        except CollectionInvalid:
            print("ℹ️ Collection 'suggested_outfits' already exists. Proceeding...")
        
        suggested_outfits = db["suggested_outfits"]
        suggested_outfits.create_index([("userID", 1), ("items", 1)], unique=True)
        print("✅ Suggested outfit constraint index created.")
        
    except Exception as e:
        print(f"⚠️ Note: {e}")

    print("\n--- Setup Complete ---")

if __name__ == "__main__":
    setup_stylist_backend()