"""
TruthLens - api.py  (fixed label orientation)
Run: uvicorn api:app --reload --port 8000
"""
import os, re, json, time
import numpy as np
import joblib
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List

BASE      = os.path.dirname(os.path.abspath(__file__))
MDL_PATH  = os.path.join(BASE, "models", "fake_news_model.pkl")
META_PATH = os.path.join(BASE, "models", "model_meta.json")

print("Loading model...", end=" ", flush=True)
if not os.path.exists(MDL_PATH):
    raise FileNotFoundError(f"Model not found: {MDL_PATH} -- Run: python train_model.py")

model_data = joblib.load(MDL_PATH)
pipeline   = model_data["pipeline"]
FAKE_IDX   = model_data["fake_idx"]
REAL_IDX   = model_data["real_idx"]
THRESHOLD  = model_data["threshold"]
model_meta = json.load(open(META_PATH)) if os.path.exists(META_PATH) else {}
print(f"done! (fake_idx={FAKE_IDX}, threshold={THRESHOLD})")

app = FastAPI(title="TruthLens API", version="2.0.0")
app.add_middleware(CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

FAKE_SIG = {
    "all-caps alarm word"  : r"\b(BREAKING|URGENT|BOMBSHELL|EXPLOSIVE|SHOCKING)\b",
    "government cover-up"  : r"government\s+(covering|hiding|suppressing)",
    "deep state"           : r"deep\s+state|QAnon|plandemic",
    "miracle cure"         : r"miracle\s+(cure|pill|remedy)",
    "doctors hate him"     : r"doctors?\s+hate\s+him",
    "5G conspiracy"        : r"\b5[Gg]\s+(causes?|spreads?)",
    "vaccine conspiracy"   : r"vaccines?\s+(cause|linked\s+to)\s+(autism|death|microchip)",
    "weird trick"          : r"weird\s+trick",
    "share before deleted" : r"share\s+before\s+(deleted|removed)",
    "chemtrail"            : r"chemtrail",
    "false flag"           : r"false\s+flag|crisis\s+actor",
    "hoax claim"           : r"\bhoax\b",
    "excessive exclamation": r"!!!+",
}
REAL_SIG = {
    "major org cited"   : r"according\s+to\s+(WHO|CDC|FDA|NIH|NASA|Reuters|AP|BBC)",
    "peer-reviewed"     : r"peer.reviewed",
    "university cited"  : r"university\s+of\s+\w+",
    "journal published" : r"published\s+in\s+(journal|nature|science|lancet)",
    "trusted outlet"    : r"\b(Reuters|Associated\s+Press|BBC|New\s+York\s+Times)\b",
    "clinical trial"    : r"clinical\s+trial",
    "official statement": r"officials?\s+(said|confirmed|announced)",
    "health authority"  : r"\b(FDA|CDC|WHO|NIH)\b",
    "statistical data"  : r"\d+\.?\d*\s*(percent|%)",
}

def get_signals(text):
    red, green = [], []
    for label, pat in FAKE_SIG.items():
        if re.search(pat, text, re.I): red.append(label)
    for label, pat in REAL_SIG.items():
        if re.search(pat, text, re.I): green.append(label)
    words    = text.split()
    caps     = [w for w in words if len(w) > 2 and w.isupper()]
    caps_pct = len(caps) / max(len(words), 1) * 100
    excl     = text.count("!")
    return [
        {"label":"Fake Indicators",     "value": f"{len(red)} found: {', '.join(red[:3])}"     if red   else "None detected", "flag": "red"   if red   else "green"},
        {"label":"Credibility Markers", "value": f"{len(green)} found: {', '.join(green[:3])}" if green else "None found",    "flag": "green" if green else "red"},
        {"label":"ALL-CAPS Density",    "value": f"{caps_pct:.1f}%",   "flag": "red"     if caps_pct > 20 else "neutral"},
        {"label":"Exclamation Marks",   "value": f"{excl} found",      "flag": "red"     if excl >= 3     else "neutral"},
        {"label":"Word Count",          "value": f"{len(words)} words","flag": "neutral"},
        {"label":"Engine",              "value": "Python WELFake model","flag": "neutral"},
    ], red, green

class PredictRequest(BaseModel):
    text  : str           = Field(..., min_length=5, max_length=100000)
    title : Optional[str] = None

class PredictResponse(BaseModel):
    verdict        : str
    verdict_class  : str
    confidence     : float
    prob_fake      : float
    prob_real      : float
    signals        : list
    top_fake_words : List[str]
    top_real_words : List[str]
    word_count     : int
    char_count     : int
    processing_ms  : float
    engine         : str

@app.get("/health")
def health():
    return {"status": "ok", "model": "TF-IDF+LR", "fake_idx": FAKE_IDX}

@app.get("/metrics")
def metrics():
    if not model_meta:
        raise HTTPException(404, "Run train_model.py first")
    return model_meta

@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    t0 = time.perf_counter()
    content = req.text.strip()
    if req.title:
        content = req.title.strip() + " " + content
    content = " ".join(content.split())

    try:
        probs     = pipeline.predict_proba([content])[0]
        prob_fake = float(probs[FAKE_IDX]) * 100
        prob_real = float(probs[REAL_IDX]) * 100
    except Exception as e:
        raise HTTPException(500, f"Model error: {e}")

    if   prob_fake >= 55: verdict, cls, conf = "LIKELY FAKE", "false",     prob_fake
    elif prob_fake <= 40: verdict, cls, conf = "LIKELY REAL", "true",      prob_real
    else:                 verdict, cls, conf = "UNCERTAIN",   "uncertain", max(prob_fake, prob_real)

    signals, red, green = get_signals(content)
    top_fake = model_meta.get("top_fake_words", red)[:8]
    top_real = model_meta.get("top_real_words", green)[:8]
    ms       = round((time.perf_counter() - t0) * 1000, 2)

    return PredictResponse(
        verdict        = verdict,
        verdict_class  = cls,
        confidence     = round(conf, 1),
        prob_fake      = round(prob_fake, 2),
        prob_real      = round(prob_real, 2),
        signals        = signals,
        top_fake_words = top_fake,
        top_real_words = top_real,
        word_count     = len(content.split()),
        char_count     = len(content),
        processing_ms  = ms,
        engine         = "Python WELFake TF-IDF + LogisticRegression",
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
