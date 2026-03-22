import os
import uuid
import shutil
import certifi
import bcrypt
import jwt
import requests
import uvicorn
from datetime import datetime, timedelta
from typing import Optional
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from pymongo import MongoClient

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("uploads", exist_ok=True)
# This serves both wardrobe uploads AND profile pictures
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

client = MongoClient("mongodb+srv://admin:admin123@cluster0.fzt0yhs.mongodb.net/?appName=Cluster0", tlsCAFile=certifi.where())
db = client["stylist_engine"]
users_collection = db["users"]

JWT_SECRET = "super_secret_jwt_key_12345"
AI_BACKEND_URL = "http://localhost:8000"
BASE_URL = "http://localhost:8001"

class UserRegister(BaseModel):
    username: str
    password: str

class SuggestionReq(BaseModel):
    prompt: str
    skin_tone: Optional[str] = "#e0ac69"
    body_shape: Optional[str] = "rectangular"

def verify_token(authorization: str):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid or missing token")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload["sub"]
    except:
        raise HTTPException(status_code=401, detail="Token expired or invalid")

# ==========================================
# AUTHENTICATION & ONBOARDING
# ==========================================

@app.post("/api/register")
def register(user: UserRegister):
    if users_collection.find_one({"username": user.username}):
        raise HTTPException(status_code=400, detail="Username already exists")
    
    hashed = bcrypt.hashpw(user.password.encode('utf-8'), bcrypt.gensalt())
    user_id = str(uuid.uuid4())
    
    # NEW: Initialize empty profile fields and onboarding status
    users_collection.insert_one({
        "userID": user_id,
        "username": user.username,
        "password": hashed,
        "is_onboarded": False,
        "body_shape": None,
        "skin_tone": None,
        "profile_picture_url": None
    })
    
    token = jwt.encode(
        {"sub": user_id, "exp": datetime.utcnow() + timedelta(days=7)},
        JWT_SECRET,
        algorithm="HS256"
    )
    
    return {
        "success": True, 
        "token": token, 
        "userID": user_id,
        "username": user.username,
        "is_onboarded": False
    }

@app.post("/api/login")
def login(user: UserRegister):
    db_user = users_collection.find_one({"username": user.username})
    if not db_user or not bcrypt.checkpw(user.password.encode('utf-8'), db_user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = jwt.encode(
        {"sub": db_user["userID"], "exp": datetime.utcnow() + timedelta(days=7)},
        JWT_SECRET,
        algorithm="HS256"
    )
    
    # NEW: Return all profile data on login
    return {
        "token": token, 
        "userID": db_user["userID"],
        "username": db_user["username"],
        "is_onboarded": db_user.get("is_onboarded", False),
        "body_shape": db_user.get("body_shape"),
        "skin_tone": db_user.get("skin_tone"),
        "profile_picture_url": db_user.get("profile_picture_url")
    }

# ==========================================
# USER PROFILE MANAGEMENT
# ==========================================

@app.get("/api/profile")
def get_profile(authorization: str = Header(None)):
    user_id = verify_token(authorization)
    db_user = users_collection.find_one({"userID": user_id}, {"_id": 0, "password": 0})
    
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    return db_user

@app.post("/api/profile")
def update_profile(
    authorization: str = Header(None),
    body_shape: str = Form(None),
    skin_tone: str = Form(None),
    profile_picture: UploadFile = File(None)
):
    user_id = verify_token(authorization)
    update_data = {"is_onboarded": True} # If they hit this endpoint, mark as onboarded
    
    if body_shape:
        update_data["body_shape"] = body_shape
    if skin_tone:
        update_data["skin_tone"] = skin_tone
        
    # Handle Profile Picture Upload
    if profile_picture:
        file_ext = profile_picture.filename.split(".")[-1]
        file_name = f"profile_{user_id}.{file_ext}"
        file_path = f"uploads/{file_name}"
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(profile_picture.file, buffer)
            
        update_data["profile_picture_url"] = f"{BASE_URL}/{file_path}"
        
    # Update the database
    users_collection.update_one(
        {"userID": user_id},
        {"$set": update_data}
    )
    
    # Return the updated profile
    updated_user = users_collection.find_one({"userID": user_id}, {"_id": 0, "password": 0})
    return updated_user


# ==========================================
# AI ENGINE PROXIES
# ==========================================

@app.post("/api/upload")
def upload_image(authorization: str = Header(None), file: UploadFile = File(...)):
    user_id = verify_token(authorization)
    
    file_path = f"uploads/{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    image_link = f"{BASE_URL}/{file_path}"
    
    resp = requests.post(f"{AI_BACKEND_URL}/api/upload", json={
        "userID": user_id,
        "image_link": image_link
    })
    
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail=resp.json())
        
    return resp.json()

@app.get("/api/wardrobe")
def get_wardrobe(authorization: str = Header(None)):
    user_id = verify_token(authorization)
    
    resp = requests.get(f"{AI_BACKEND_URL}/api/wardrobe/{user_id}")
    
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail=resp.json())
        
    return resp.json()

@app.post("/api/suggest")
def suggest(req: SuggestionReq, authorization: str = Header(None)):
    user_id = verify_token(authorization)
    
    # We now fetch skin_tone and body_shape from DB if the frontend didn't pass it
    user_profile = users_collection.find_one({"userID": user_id})
    final_skin_tone = req.skin_tone or user_profile.get("skin_tone", "#e0ac69")
    final_body_shape = req.body_shape or user_profile.get("body_shape", "rectangular")
    
    resp = requests.post(f"{AI_BACKEND_URL}/api/suggest", json={
        "userID": user_id,
        "prompt": req.prompt,
        "skin_tone": final_skin_tone,
        "body_shape": final_body_shape
    })
    
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail=resp.json())
        
    return resp.json()

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)