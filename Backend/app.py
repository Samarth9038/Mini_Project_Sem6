import os
import uuid
import certifi
import requests
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from PIL import Image
from sklearn.cluster import KMeans
from torchvision.ops import nms
from transformers import OwlViTProcessor, OwlViTForObjectDetection, CLIPModel, CLIPProcessor
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional

# ==========================================
# 1. INITIALIZATION & SETUP
# ==========================================
app = FastAPI(title="Stylist Engine API (Monolithic)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("static/detected_items", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

CONNECTION_STRING = "mongodb+srv://admin:admin123@cluster0.fzt0yhs.mongodb.net/?appName=Cluster0"
client = MongoClient(CONNECTION_STRING, tlsCAFile=certifi.where())
db = client["stylist_engine"]
wardrobe = db["wardrobe"]
suggested_outfits = db["suggested_outfits"]

device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"🚀 Booting AI Engine on: {device.upper()}")

# ==========================================
# 2. PYDANTIC SCHEMAS
# ==========================================
class ImageUploadRequest(BaseModel):
    userID: str
    image_link: str

class ImageUploadResponse(BaseModel):
    message: str
    items_found: int

class SuggestionRequest(BaseModel):
    userID: str
    prompt: str
    skin_tone: Optional[str] = "#e0ac69"
    body_shape: Optional[str] = "rectangular"

class ClothingItem(BaseModel):
    itemID: str
    category: str
    sub_category: str
    rgb_color: List[int]
    local_path: str
    formality: Optional[str] = "casual"
    fit: Optional[str] = "regular"

class SuggestionResponse(BaseModel):
    shirt: ClothingItem
    pants: ClothingItem
    compatibility_score: float

# ==========================================
# 3. AI MODELS & ARCHITECTURE
# ==========================================
class OutfitTransformer(nn.Module):
    def __init__(self, embedding_dim=512, num_heads=8, num_layers=6):
        super().__init__()
        self.outfit_token = nn.Parameter(torch.randn(1, 1, embedding_dim))
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=embedding_dim, nhead=num_heads, 
            dim_feedforward=2048, dropout=0.2, 
            batch_first=True, dtype=torch.float32
        )
        self.transformer = nn.TransformerEncoder(encoder_layer, num_layers=num_layers)
        self.mlp = nn.Sequential(
            nn.Linear(embedding_dim, 256, dtype=torch.float32),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(256, 1, dtype=torch.float32)
        )

    def forward(self, x):
        batch_size = x.size(0)
        tokens = self.outfit_token.expand(batch_size, -1, -1)
        x = torch.cat([tokens, x], dim=1)
        out = self.transformer(x)
        return self.mlp(out[:, 0, :])

# Load HuggingFace Models
owl_processor = OwlViTProcessor.from_pretrained("google/owlvit-base-patch32")
owl_model = OwlViTForObjectDetection.from_pretrained("google/owlvit-base-patch32").to(device)
clip_processor = CLIPProcessor.from_pretrained("patrickjohncyh/fashion-clip")
clip_model = CLIPModel.from_pretrained("patrickjohncyh/fashion-clip").to(device)

# Load Custom Model
transformer_model = OutfitTransformer().to(device)
model_path = "outfit_transformer_v2.pth"
if os.path.exists(model_path):
    transformer_model.load_state_dict(torch.load(model_path, map_location=device, weights_only=True))
    print("✅ Custom Outfit Transformer loaded.")
transformer_model.eval()

# Precompute CLIP text features for the preprocessor
def encode_text(texts):
    inputs = clip_processor(text=texts, return_tensors="pt", padding=True).to(device)
    with torch.no_grad():
        feats = clip_model.get_text_features(**inputs)
        feats = feats.pooler_output if hasattr(feats, "pooler_output") else (feats.text_embeds if hasattr(feats, "text_embeds") else feats)
    return F.normalize(feats, p=2, dim=-1)

formality_labels = ["formal", "business_casual", "casual", "loungewear"]
formality_feats = encode_text([
    "formal wear, suit, crisp dress shirt, dress pants, tuxedo", 
    "business casual, button-down shirt, polo, chinos, smart trousers", 
    "casual wear, graphic t-shirt, denim jeans, cargo pants, shorts", 
    "loungewear, sweatpants, hoodie, activewear, gym clothes"
])

fit_labels = ["slim", "regular", "loose", "oversized"]
fit_feats = encode_text([
    "slim fit tight clothing", "regular fit clothing", "loose fit baggy clothing", "oversized clothing"
])

category_labels = ["shirt", "pants", "pants", "dress", "dress", "outerwear", "TRASH"]
cat_feats = encode_text([
    "a photo of a shirt, t-shirt, or top", 
    "a photo of a pair of pants, trousers, or jeans", 
    "a photo of a pair of shorts", 
    "a photo of a skirt", "a photo of a dress", 
    "a photo of a jacket, sweater, or outerwear",
    "a close up of fabric, a pocket, a button, background, or noise"
])

# ==========================================
# 4. UTILITY FUNCTIONS
# ==========================================
def hex_to_rgb(hex_color):
    hex_color = hex_color.lstrip('#')
    if len(hex_color) == 6:
        return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
    return (255, 224, 189)

def get_dominant_color(pil_img):
    img = pil_img.resize((50, 50))
    ar = np.asarray(img).reshape(-1, 3)
    kmeans = KMeans(n_clusters=3, n_init='auto').fit(ar)
    counts = np.unique(kmeans.labels_, return_counts=True)[1]
    dominant = kmeans.cluster_centers_[np.argmax(counts)]
    return [int(c) for c in dominant]

def get_color_harmony_score(colors):
    if len(colors) < 2: return 1.0
    dist = np.linalg.norm(np.array(colors[0]) - np.array(colors[1])) / 441.0
    if dist < 0.15 or dist > 0.6: return 1.0
    return 0.8

def get_skin_tone_score(rgb_color, skin_tone_hex):
    skin_rgb = hex_to_rgb(skin_tone_hex)
    skin_lum = (0.299 * skin_rgb[0] + 0.587 * skin_rgb[1] + 0.114 * skin_rgb[2]) / 255.0
    item_lum = (0.299 * rgb_color[0] + 0.587 * rgb_color[1] + 0.114 * rgb_color[2]) / 255.0
    return float(np.clip(abs(skin_lum - item_lum) * 1.5, 0.4, 1.0))

def get_body_shape_score(fit, body_shape):
    matrix = {
        "rectangular": {"slim": 1.0, "regular": 0.9, "loose": 0.7, "oversized": 0.6},
        "circular": {"loose": 1.0, "regular": 0.9, "slim": 0.6, "oversized": 0.8},
        "elliptical": {"regular": 1.0, "slim": 0.8, "loose": 0.8, "oversized": 0.7},
        "triangular": {"regular": 1.0, "loose": 0.9, "slim": 0.7, "oversized": 0.8},
        "inverted_triangle": {"slim": 1.0, "regular": 0.9, "loose": 0.7, "oversized": 0.6}
    }
    return float(matrix.get(body_shape.lower(), matrix["rectangular"]).get(fit.lower(), 0.8))

def filter_contained_boxes(boxes_tensor, iomin_threshold=0.85):
    boxes = boxes_tensor.tolist()
    keep = []
    for i in range(len(boxes)):
        is_contained = False
        for j in range(len(boxes)):
            if i == j: continue
            x1, y1, x2, y2 = max(boxes[i][0], boxes[j][0]), max(boxes[i][1], boxes[j][1]), min(boxes[i][2], boxes[j][2]), min(boxes[i][3], boxes[j][3])
            if x2 > x1 and y2 > y1:
                inter = (x2 - x1) * (y2 - y1)
                area_i = (boxes[i][2] - boxes[i][0]) * (boxes[i][3] - boxes[i][1])
                area_j = (boxes[j][2] - boxes[j][0]) * (boxes[j][3] - boxes[j][1])
                if (inter / area_i) > iomin_threshold and area_i < area_j:
                    is_contained = True; break
        if not is_contained: keep.append(i)
    return keep

# ==========================================
# 5. API ENDPOINTS
# ==========================================
@app.post("/api/upload", response_model=ImageUploadResponse)
def upload_image(request: ImageUploadRequest):
    try:
        response = requests.get(request.image_link, stream=True)
        response.raise_for_status()
        
        temp_path = f"temp_{uuid.uuid4()}.jpg"
        with open(temp_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192): f.write(chunk)

        img = Image.open(temp_path).convert("RGB")
        queries = ["a full shirt", "a t-shirt", "a button down shirt", "a pair of pants", "jeans", "shorts", "slacks", "cargo pants", "a jacket", "a sweater"]
        
        inputs = owl_processor(text=[queries], images=img, return_tensors="pt").to(device)
        with torch.no_grad(): outputs = owl_model(**inputs)
        
        results = owl_processor.post_process_grounded_object_detection(
            outputs=outputs, threshold=0.25, target_sizes=torch.Tensor([img.size[::-1]]).to(device)
        )[0]

        boxes, scores = results["boxes"].cpu(), results["scores"].cpu()
        keep = nms(boxes, scores, iou_threshold=0.25)
        boxes, scores = boxes[keep], scores[keep]
        not_contained = filter_contained_boxes(boxes)
        boxes, scores = boxes[not_contained], scores[not_contained]

        count = 0
        for box in boxes:
            x1, y1, x2, y2 = box.tolist()
            if ((x2 - x1) * (y2 - y1)) < ((img.width * img.height) * 0.05): continue
                
            crop = img.crop((max(0, x1), max(0, y1), min(img.width, x2), min(img.height, y2)))
            clip_inputs = clip_processor(images=crop, return_tensors="pt").to(device)
            
            with torch.no_grad():
                feat = clip_model.get_image_features(**clip_inputs)
                feat = feat.pooler_output if hasattr(feat, "pooler_output") else (feat.image_embeds if hasattr(feat, "image_embeds") else feat)
            img_feat_norm = F.normalize(feat, p=2, dim=-1)
            
            cat_idx = torch.matmul(img_feat_norm, cat_feats.T).argmax().item()
            main_category = category_labels[cat_idx]
            if main_category == "TRASH": continue
                
            formality = formality_labels[torch.matmul(img_feat_norm, formality_feats.T).argmax().item()]
            fit = fit_labels[torch.matmul(img_feat_norm, fit_feats.T).argmax().item()]
            
            cat_dir = f"static/detected_items/{main_category}"
            os.makedirs(cat_dir, exist_ok=True)
            item_id = str(uuid.uuid4())
            file_name = f"{main_category}_{item_id[:8]}.png"
            crop.save(os.path.join(cat_dir, file_name))

            wardrobe.insert_one({
                "userID": request.userID, "itemID": item_id, "category": main_category, "sub_category": main_category,
                "embedding": img_feat_norm.cpu().numpy().flatten().tolist(), # <--- THE FIX (L2 Normalized)
                "rgb_color": get_dominant_color(crop),
                "local_path": f"/{cat_dir}/{file_name}", "formality": formality, "fit": fit
            })
            count += 1

        os.remove(temp_path)
        if count == 0: raise HTTPException(status_code=404, detail="No valid clothes found.")
        return ImageUploadResponse(message="Processed.", items_found=count)

    except Exception as e:
        if os.path.exists(temp_path): os.remove(temp_path)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/wardrobe/{userID}", response_model=List[ClothingItem])
def get_wardrobe(userID: str):
    items = list(wardrobe.find({"userID": userID}, {"_id": 0}))
    if not items: raise HTTPException(status_code=404, detail="Wardrobe empty.")
    return items

@app.post("/api/suggest", response_model=SuggestionResponse)
async def suggest_outfit(request: SuggestionRequest):
    try:
        p_lower = request.prompt.lower()
        is_formal = any(w in p_lower for w in ["formal", "suit", "wedding", "party", "business", "office"])

        all_shirts = [s for s in wardrobe.find({"userID": request.userID, "category": "shirt"}, {"_id": 0}) if "embedding" in s]
        all_pants = [p for p in wardrobe.find({"userID": request.userID, "category": "pants"}, {"_id": 0}) if "embedding" in p]

        if not all_shirts or not all_pants:
            raise HTTPException(status_code=404, detail="Upload shirts and pants first.")

        # Contrastive Filtering for Formal Prompts
        if is_formal:
            formal_shirt = encode_text(["a formal button-down dress shirt, tailored, crisp collar"])
            casual_shirt = encode_text(["a casual t-shirt, graphic tee, hoodie, or tank top"])
            formal_pant = encode_text(["formal suit trousers, tailored dress pants, crisp slacks"])
            casual_pant = encode_text(["baggy cargo pants with pockets, sweatpants, denim jeans, gym shorts"])

            def filter_items(items, form_f, cas_f):
                survivors = []
                for item in items:
                    t = torch.tensor(item["embedding"], dtype=torch.float32).to(device)
                    if torch.matmul(t, form_f.T).item() > torch.matmul(t, cas_f.T).item():
                        survivors.append(item)
                return survivors

            all_shirts = filter_items(all_shirts, formal_shirt, casual_shirt)
            all_pants = filter_items(all_pants, formal_pant, casual_pant)
            if not all_shirts or not all_pants:
                raise HTTPException(status_code=404, detail="No formal clothes found in wardrobe.")

        # Anchor Selection
        prompt_emb = encode_text([request.prompt])
        shirt_tensors = torch.tensor([s["embedding"] for s in all_shirts], dtype=torch.float32).to(device)
        shirt_sims = torch.matmul(prompt_emb, shirt_tensors.T).squeeze()
        if shirt_sims.dim() == 0: shirt_sims = shirt_sims.unsqueeze(0)
        
        anchor_shirts = [all_shirts[i] for i in shirt_sims.topk(min(3, len(all_shirts))).indices.cpu().tolist()]

        # Outfit Transformer Scoring
        pants_tensors = torch.tensor([p["embedding"] for p in all_pants], dtype=torch.float32).to(device)
        best_score, best_combo, best_str = -float('inf'), None, ""

        for shirt in anchor_shirts:
            s_emb = torch.tensor(shirt["embedding"], dtype=torch.float32).to(device)
            x = torch.stack([s_emb.unsqueeze(0).expand(len(all_pants), -1), pants_tensors], dim=1)
            
            with torch.no_grad():
                ai_scores = torch.sigmoid(transformer_model(x)).squeeze().cpu().tolist()
                if not isinstance(ai_scores, list): ai_scores = [ai_scores]

            for i, pant in enumerate(all_pants):
                combo_str = f"{shirt['itemID']}_{pant['itemID']}"
                if suggested_outfits.find_one({"userID": request.userID, "items": combo_str}): continue

                colors = [shirt.get("rgb_color", [255,255,255]), pant.get("rgb_color", [255,255,255])]
                score = (ai_scores[i] * 0.70) + (get_color_harmony_score(colors) * 0.20) + (
                    (sum(get_skin_tone_score(c, request.skin_tone) for c in colors)/2) * 0.10
                )

                if score > best_score:
                    best_score, best_combo, best_str = score, (shirt, pant), combo_str

        if not best_combo: raise HTTPException(status_code=404, detail="No new combinations left.")
        
        try: suggested_outfits.insert_one({"userID": request.userID, "items": best_str})
        except DuplicateKeyError: pass

        s_data, p_data = best_combo
        del s_data["embedding"]; del p_data["embedding"]

        return SuggestionResponse(
            shirt=ClothingItem(**s_data), pants=ClothingItem(**p_data),
            compatibility_score=round(max(0.0, min(1.0, best_score)), 2)
        )

    except HTTPException: raise
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))