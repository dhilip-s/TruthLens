"""
TruthLens - train_model.py
Uses synthetic dataset — no download needed!
Run: python train_model.py
"""
import os, sys, time, json, random, warnings
import numpy as np
import pandas as pd
import joblib
from sklearn.model_selection         import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model            import LogisticRegression
from sklearn.pipeline                import Pipeline
from sklearn.metrics                 import (accuracy_score, precision_score,
                                              recall_score, f1_score,
                                              classification_report)
from sklearn.utils import shuffle
warnings.filterwarnings("ignore")
random.seed(42)

G="\033[92m"; C="\033[96m"; B="\033[1m"; R="\033[91m"; X="\033[0m"
def banner(t): print(f"\n{B}{C}{'='*50}\n  {t}\n{'='*50}{X}")
def ok(t):     print(f"  {G}OK  {t}{X}")
def err(t):    print(f"  {R}ERR {t}{X}"); sys.exit(1)

BASE     = os.path.dirname(os.path.abspath(__file__))
MDL_DIR  = os.path.join(BASE, "models")
MDL_PATH = os.path.join(MDL_DIR, "fake_news_model.pkl")
META_PATH= os.path.join(MDL_DIR, "model_meta.json")
os.makedirs(MDL_DIR, exist_ok=True)

# ════════════════════════════════════════
# SYNTHETIC DATASET GENERATOR
# ════════════════════════════════════════

CONSPIRACIES = [
    "5G towers are spreading deadly radiation",
    "vaccines contain microchips to track the population",
    "the moon landing was completely faked in Hollywood",
    "chemtrails are poisoning our water supply",
    "the deep state is controlling world governments",
    "Bill Gates is funding population control through vaccines",
    "COVID-19 was engineered in a secret government lab",
    "the earth is flat and NASA is lying to everyone",
    "lizard people control all world governments secretly",
    "the new world order is planning mass population reduction",
    "fluoride in water is used to control human minds",
    "secret elites are planning a global economic reset",
    "the government is hiding alien contact from the public",
    "banks are planning to eliminate all cash to control people",
    "5G radiation causes cancer and the government knows it",
    "the deep state staged the election to steal power",
    "pharmaceutical companies have a cure for cancer but hide it",
    "government satellites are used to spy on every citizen",
    "climate change is a hoax invented to control the economy",
    "secret underground tunnels connect elite hideouts globally",
]

FAKE_CLAIMS = [
    "eating raw garlic cures cancer in 24 hours",
    "drinking bleach kills COVID-19 instantly",
    "autism is caused by childhood vaccines according to secret studies",
    "the government controls hurricanes with weather machines",
    "drinking alkaline water reverses aging by 20 years",
    "essential oils cure all diseases doctors refuse to prescribe",
    "GMO foods cause cancer in 100 percent of cases",
    "cell phones cause brain tumors in every long-term user",
    "the pharmaceutical industry has a cure for all cancer",
    "meditation can cure stage 4 cancer without treatment",
    "drinking hydrogen peroxide cures all viral infections",
    "sunlight alone cures diabetes without any medication",
    "this ancient herb banned by FDA cures Alzheimer overnight",
    "magnets cure arthritis and doctors are hiding this secret",
    "baking soda cures all forms of cancer in three days",
]

PLOTS = [
    "planning to microchip the entire world population",
    "using 5G towers to control human thoughts and behavior",
    "adding poison to public water supplies without consent",
    "creating fake pandemics to sell experimental vaccines",
    "suppressing free energy technology for profit",
    "eliminating small businesses to control the global economy",
    "using chemtrails to reduce world population by 90 percent",
    "staging mass shootings to eliminate gun rights forever",
    "manipulating elections through rigged voting machines",
    "creating engineered viruses to depopulate the earth",
]

CURES = [
    "Local man reverses cancer with simple home remedy doctors hate.",
    "Woman cures arthritis instantly with this one banned herb.",
    "Doctor reveals secret cure they have been hiding for decades.",
    "Man loses 50 pounds overnight with this one weird trick.",
    "Simple kitchen ingredient cures diabetes in 48 hours flat.",
]

PERSONS = ["this man", "this woman", "this doctor", "this scientist", "this farmer"]
DISEASES = ["cancer", "diabetes", "COVID", "HIV", "Alzheimer's", "arthritis", "heart disease"]
TOPICS = ["vaccines", "5G towers", "COVID-19", "climate change", "elections", "the moon landing"]

FAKE_TEMPLATES = [
    "BREAKING: {conspiracy} — government covering up the truth!!!",
    "SHOCKING: Scientists confirm {fake_claim} — mainstream media won't report this!!!",
    "Doctors HATE {person}! {cure} Big Pharma doesn't want you to know about.",
    "EXPOSED: Deep state {plot} — leaked documents confirm!!!",
    "Wake up sheeple! {conspiracy} and the government is hiding it from us all.",
    "{fake_claim} — share before this gets deleted!!!",
    "URGENT: {conspiracy} — they don't want you to know this!!!",
    "The truth about {topic} they have been hiding — EXPOSED!!!",
    "BOMBSHELL: {fake_claim} — mainstream media is covering it up!!!",
    "Scientists BANNED from revealing {fake_claim} — wake up people!!!",
    "New world order {plot} — leaked documents prove it all!!!",
    "Big Pharma {plot} — doctors hate this one weird trick!!!",
    "MIRACLE: {cure} — they don't want you to know about this!!!",
    "Deep state elites planning {plot} — share before deleted!!!",
    "CHEMTRAILS: Government {plot} poisoning our water supply — wake up sheeple!!!",
    "5G towers {fake_claim} — government covering up thousands of deaths!!!",
    "HOAX EXPOSED: {topic} was completely fabricated by mainstream media!!!",
    "False flag {topic} — crisis actors confirmed wake up people!!!",
    "Illuminati {plot} — they control everything share before deleted!!!",
    "QAnon confirms {fake_claim} — the deep state is real wake up!!!",
    "{person} cures {disease} overnight with one weird kitchen trick!!!",
    "BANNED: The video they don't want you to see — {fake_claim}!!!",
    "Anonymous source confirms {conspiracy} — mainstream media completely silent!!!",
    "You won't believe what {person} just revealed about {topic} — SHOCKING!!!",
    "The globalists are {plot} — share this before they take it down!!!",
    "Government CONFIRMED: {conspiracy} they lied to us all along!!!",
    "LEAKED: Secret documents prove {conspiracy} share everywhere now!!!",
    "They are hiding {fake_claim} from the public — spread the truth!!!",
    "Deep state EXPOSED: {plot} — whistleblower reveals all!!!",
    "WAKE UP: {conspiracy} and nobody is talking about it!!!",
]

ORGS = ["WHO", "CDC", "FDA", "NIH", "NASA", "UN", "Federal Reserve",
        "European Commission", "World Bank", "UNICEF", "Pentagon", "Treasury Department"]
UNIVERSITIES = ["Harvard University", "MIT", "Stanford University", "Oxford University",
                "Cambridge University", "Johns Hopkins University", "Yale University",
                "Princeton University", "University of Michigan", "UCLA"]
JOURNALS = ["Nature", "Science", "The Lancet", "New England Journal of Medicine",
            "JAMA", "Cell", "PLOS ONE", "BMJ", "Scientific Reports"]
OUTLETS = ["Reuters", "BBC", "Associated Press", "The New York Times",
           "Washington Post", "NPR", "The Guardian", "Bloomberg"]
INSTITUTIONS = ["Federal Reserve", "World Bank", "IMF", "European Central Bank",
                "Supreme Court", "Department of Health", "Treasury"]
REAL_EVENTS = [
    "interest rates were raised by 25 basis points",
    "a new vaccine passed phase 3 clinical trials successfully",
    "economic growth slowed to 2.1 percent this quarter",
    "inflation declined for the third consecutive month",
    "a new peace agreement was signed between two nations",
    "carbon emissions fell by 8 percent globally this year",
    "unemployment dropped to a historic 50-year low",
    "a new cancer treatment showed 87 percent efficacy",
    "GDP growth exceeded all analyst expectations",
    "a trade deal was finalized after months of negotiation",
    "new climate data confirmed record global temperatures",
    "the budget deficit was reduced by 15 percent",
    "a major breakthrough in renewable energy was achieved",
    "new safety regulations on technology were officially passed",
    "disease rates fell significantly following vaccination campaigns",
]
FINDINGS = [
    "daily exercise reduces heart disease risk by 35 percent",
    "the new drug reduces tumor size in 78 percent of patients",
    "sleep deprivation significantly increases dementia risk",
    "plant-based diets lower cholesterol by an average of 20 percent",
    "early childhood education improves lifetime earnings by 25 percent",
    "air pollution causes 7 million premature deaths annually worldwide",
    "the mRNA vaccine showed 94 percent efficacy against severe illness",
    "renewable energy now accounts for 30 percent of global power",
    "antibiotic resistance is growing at an alarming rate globally",
    "mental health interventions reduce workplace absenteeism by 40 percent",
    "the new treatment extended survival rates by an average of 3 years",
    "regular meditation reduces cortisol levels by 20 percent",
    "a Mediterranean diet reduces stroke risk by 30 percent",
    "childhood obesity rates declined for the first time in a decade",
    "electric vehicles now outsell combustion engines in 12 countries",
]
METRICS = ["interest rates", "inflation", "GDP growth", "unemployment rates", "carbon emissions"]
CONTEXTS = [
    "inflation data shows gradual decline toward the target",
    "economic indicators remain broadly stable",
    "global markets show signs of steady recovery",
    "supply chain disruptions begin to ease",
    "consumer confidence rises for the fourth month",
    "quarterly earnings beat analyst expectations",
    "trade conditions continue to improve",
    "data shows sustained improvement across key sectors",
]
DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
UNITS = ["basis points", "percent", "million dollars", "billion dollars", "percentage points"]
NUMBERS = ["25", "50", "87", "12", "3.5", "15", "42", "78", "94", "0.5", "2.1", "300"]

REAL_TEMPLATES = [
    "{org} officials confirmed {real_event} according to a statement released on {day}.",
    "Researchers at {university} published a peer-reviewed study in {journal} showing {finding}.",
    "The {institution} raised {metric} by {number} {unit} according to officials as {context}.",
    "{outlet} reports that {real_event} following {context}.",
    "A new study published in {journal} confirms {finding} after years of clinical research.",
    "{org} announced {real_event} in an official press conference held on {day}.",
    "According to {outlet} {real_event} amid {context}.",
    "Scientists at {university} confirmed {finding} in a clinical trial with {number} participants.",
    "{institution} data shows {finding} with {metric} rising {number} {unit} this quarter.",
    "Officials from {org} stated that {real_event} following months of {context}.",
    "The {institution} released a report confirming {finding} based on data from multiple countries.",
    "{outlet} confirmed {real_event} after {org} officials released the official findings.",
    "Peer-reviewed research from {university} indicates {finding} with high statistical confidence.",
    "According to {org} data {finding} as global {context} continues steadily.",
    "{institution} spokesperson confirmed {real_event} in an official statement on {day}.",
    "A {university} study published in {journal} found {finding} among {number} thousand participants.",
    "{org} and {outlet} jointly confirmed {real_event} based on verified data and reports.",
    "New research from {journal} shows {finding} consistent with previous peer-reviewed studies.",
    "{outlet} reported that {org} confirmed {real_event} following an extensive investigation.",
    "According to officials at {institution} {real_event} marking a significant development.",
]

def make_fake():
    t = random.choice(FAKE_TEMPLATES)
    return t.format(
        conspiracy = random.choice(CONSPIRACIES),
        fake_claim = random.choice(FAKE_CLAIMS),
        plot       = random.choice(PLOTS),
        cure       = random.choice(CURES),
        person     = random.choice(PERSONS),
        disease    = random.choice(DISEASES),
        topic      = random.choice(TOPICS),
    )

def make_real():
    t = random.choice(REAL_TEMPLATES)
    return t.format(
        org         = random.choice(ORGS),
        university  = random.choice(UNIVERSITIES),
        journal     = random.choice(JOURNALS),
        outlet      = random.choice(OUTLETS),
        institution = random.choice(INSTITUTIONS),
        real_event  = random.choice(REAL_EVENTS),
        finding     = random.choice(FINDINGS),
        metric      = random.choice(METRICS),
        context     = random.choice(CONTEXTS),
        day         = random.choice(DAYS),
        unit        = random.choice(UNITS),
        number      = random.choice(NUMBERS),
    )

# ════════════════════════════════════════
# MAIN TRAINING SCRIPT
# ════════════════════════════════════════

banner("STEP 1 - Generating Synthetic Dataset")
N = 8000
fakes = [make_fake() for _ in range(N)]
reals = [make_real() for _ in range(N)]
df = pd.DataFrame({
    "text" : fakes + reals,
    "label": [1]*N + [0]*N,   # 1=Fake, 0=Real
})
df = df.sample(frac=1, random_state=42).reset_index(drop=True)
ok(f"Generated {len(df):,} samples  (Fake: {N:,}  Real: {N:,})")

X = df["text"].values
y = df["label"].values

banner("STEP 2 - Train/Val/Test Split 70/10/20")
X_temp, X_te, y_temp, y_te = train_test_split(X, y, test_size=0.20, random_state=42, stratify=y)
X_tr, X_val, y_tr, y_val   = train_test_split(X_temp, y_temp, test_size=0.125, random_state=42, stratify=y_temp)
ok(f"Train: {len(X_tr):,}  Val: {len(X_val):,}  Test: {len(X_te):,}")

banner("STEP 3 - Building Pipeline")
pipe = Pipeline([
    ("tfidf", TfidfVectorizer(
        max_features = 50000,
        ngram_range  = (1, 3),
        sublinear_tf = True,
        min_df       = 1,
        strip_accents= "unicode",
    )),
    ("clf", LogisticRegression(
        C            = 2.0,
        max_iter     = 1000,
        solver       = "lbfgs",
        n_jobs       = -1,
        random_state = 42,
        class_weight = "balanced",
    )),
])
ok("TfidfVectorizer(50k, trigrams)")
ok("LogisticRegression(C=2, balanced)")

banner("STEP 4 - Training...")
t0 = time.time()
pipe.fit(X_tr, y_tr)
ok(f"Done in {time.time()-t0:.1f}s")

classes  = pipe.named_steps["clf"].classes_.tolist()
fake_idx = classes.index(1)
real_idx = classes.index(0)
ok(f"Classes: {classes}  fake_idx={fake_idx}  real_idx={real_idx}")

banner("STEP 5 - Evaluation")
y_pred = pipe.predict(X_te)
acc  = accuracy_score (y_te, y_pred)
prec = precision_score(y_te, y_pred, pos_label=1)
rec  = recall_score   (y_te, y_pred, pos_label=1)
f1   = f1_score       (y_te, y_pred, pos_label=1)
ok(f"Accuracy  : {acc *100:.2f}%")
ok(f"Precision : {prec*100:.2f}%")
ok(f"Recall    : {rec *100:.2f}%")
ok(f"F1 Score  : {f1  *100:.2f}%")

banner("STEP 6 - Sanity Check")
test_cases = [
    ("FAKE", "BREAKING Deep state using 5G towers spread deadly radiation government covering up thousands of deaths Share before deleted"),
    ("FAKE", "Doctors HATE this man He cures cancer overnight with one weird kitchen trick Big Pharma does not want you to know"),
    ("FAKE", "SHOCKING Scientists confirm mainstream media hiding truth about chemtrails poisoning water supply Wake up sheeple"),
    ("FAKE", "Deep state elites planning to microchip entire population through COVID vaccine leaked documents confirm"),
    ("FAKE", "Wake up sheeple Chemtrails are poisoning our water supply and government is hiding the truth from us all"),
    ("REAL", "Federal Reserve raised interest rates by 25 basis points according to officials inflation data shows gradual decline"),
    ("REAL", "Researchers at University of Oxford published peer reviewed study in Nature vaccine reduced infection rates by 87 percent"),
    ("REAL", "WHO officials confirmed new malaria vaccine showed 75 percent efficacy in clinical trials across three countries"),
    ("REAL", "Apple reported record quarterly earnings of 89 billion dollars according to officials beating analyst expectations"),
    ("REAL", "NASA confirmed James Webb Space Telescope captured new images of galaxy 13 billion light years away"),
]
all_correct = True
for expected, text in test_cases:
    p         = pipe.predict_proba([text])[0]
    prob_fake = p[fake_idx] * 100
    verdict   = "FAKE" if prob_fake >= 50 else "REAL"
    mark      = "✔" if verdict == expected else "✘ WRONG"
    if verdict != expected: all_correct = False
    print(f"  [{mark}] Expected:{expected} Got:{verdict} fake={prob_fake:.1f}%  {text[:55]}")

if all_correct:
    ok("All 10 sanity checks passed!")
else:
    ok("Saving model anyway...")

banner("STEP 7 - Saving Model")
model_data = {
    "pipeline"  : pipe,
    "fake_idx"  : fake_idx,
    "real_idx"  : real_idx,
    "threshold" : 0.50,
    "classes"   : classes,
}
joblib.dump(model_data, MDL_PATH, compress=3)
ok(f"Model saved: {MDL_PATH}")

feat_names = np.array(pipe.named_steps["tfidf"].get_feature_names_out())
coefs      = pipe.named_steps["clf"].coef_[0]
top_fake   = feat_names[coefs.argsort()[-20:][::-1]].tolist()
top_real   = feat_names[coefs.argsort()[:20]].tolist()

meta = {
    "model"          : "TF-IDF(50k,trigrams) + LR(C=2,balanced) — Synthetic Dataset",
    "dataset"        : "Synthetic (8K fake + 8K real)",
    "fake_idx"       : fake_idx,
    "real_idx"       : real_idx,
    "threshold"      : 0.50,
    "accuracy"       : round(acc *100, 2),
    "precision"      : round(prec*100, 2),
    "recall"         : round(rec *100, 2),
    "f1_score"       : round(f1  *100, 2),
    "train_size"     : int(len(X_tr)),
    "test_size"      : int(len(X_te)),
    "vocab_size"     : int(len(feat_names)),
    "top_fake_words" : top_fake,
    "top_real_words" : top_real,
}
with open(META_PATH, "w") as f:
    json.dump(meta, f, indent=2)
ok(f"Metadata saved: {META_PATH}")

banner("DONE - Model Ready!")
print(f"  Now run:  uvicorn api:app --reload --port 8000\n")
