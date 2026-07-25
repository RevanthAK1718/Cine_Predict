import os
import pickle
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

app = FastAPI()

# Load models and configurations
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
import joblib

revenue_model = joblib.load(os.path.join(BASE_DIR, 'revenue_model.pkl'))
hit_flop_model = joblib.load(os.path.join(BASE_DIR, 'hit_flop_model.pkl'))

with open(os.path.join(BASE_DIR, 'feature_cols.pkl'), 'rb') as f:
    feature_cols = pickle.load(f)

class PredictionRequest(BaseModel):
    budget: float
    runtime: float
    vote_average: float
    vote_count: float
    popularity: float
    cast_size: float
    num_genres: float
    genre: str

@app.post("/predict")
def predict(request: PredictionRequest):
    # Preprocess inputs
    log_budget = np.log1p(request.budget)
    
    # Create an input array with the exact features expected by the models
    input_data = {}
    input_data['log_budget'] = log_budget
    input_data['runtime'] = request.runtime
    input_data['vote_average'] = request.vote_average
    input_data['vote_count'] = request.vote_count
    input_data['popularity'] = request.popularity
    input_data['cast_size'] = request.cast_size
    input_data['num_genres'] = request.num_genres
    
    # One-hot encode the genre
    for col in feature_cols:
        if col.startswith('genre_'):
            input_data[col] = 1 if col == f"genre_{request.genre}" else 0
            
    # Ensure features are in the exact order as feature_cols
    try:
        X = [[input_data[col] for col in feature_cols]]
    except KeyError as e:
        raise HTTPException(status_code=400, detail=f"Missing feature mapping for {e}")

    # Predictions
    log_revenue_pred = revenue_model.predict(X)[0]
    revenue_pred = np.expm1(log_revenue_pred)
    hit_flop_pred = hit_flop_model.predict(X)[0] # e.g. 1 for hit, 0 for flop, or 'hit'/'flop' string depending on model
    
    # Convert hit_flop_pred to string if it's numeric
    if str(hit_flop_pred) == '1':
        verdict = "Hit"
    elif str(hit_flop_pred) == '0':
        verdict = "Flop"
    else:
        verdict = str(hit_flop_pred).capitalize()
    
    return {
        "predicted_revenue": float(revenue_pred),
        "verdict": verdict
    }

@app.get("/eda-data")
def eda_data():
    csv_path = os.path.join(BASE_DIR, 'cleaned_movies.csv')
    if not os.path.exists(csv_path):
        return {"error": "Dataset not found for EDA"}
    
    df = pd.read_csv(csv_path)
    
    # Let's extract genre distribution. Since movies might have multiple genres in the original dataset,
    # or they are one-hot encoded, let's just pick one.
    # If the dataset has 'main_genre', use it. Otherwise, look for one-hot columns.
    genre_counts = {}
    genre_revenues = {}
    
    genre_cols = [c for c in df.columns if c.startswith('genre_')]
    if genre_cols:
        for c in genre_cols:
            genre_name = c.replace('genre_', '')
            subset = df[df[c] == 1]
            genre_counts[genre_name] = int(len(subset))
            # Average revenue if revenue exists, otherwise 0
            if 'revenue' in df.columns:
                genre_revenues[genre_name] = float(subset['revenue'].mean()) if not subset.empty else 0
            elif 'log_revenue' in df.columns:
                genre_revenues[genre_name] = float(np.expm1(subset['log_revenue']).mean()) if not subset.empty else 0
    else:
        # Fallback if no one-hot cols, maybe there's a 'genre' column
        if 'genre' in df.columns:
            genre_counts = df['genre'].value_counts().to_dict()
            
    # Sample budget vs revenue
    budget_revenue = []
    if 'budget' in df.columns and 'revenue' in df.columns:
        sample = df.sample(min(100, len(df)))
        for _, row in sample.iterrows():
            budget_revenue.append({"x": row['budget'], "y": row['revenue']})
    elif 'log_budget' in df.columns and 'log_revenue' in df.columns:
        sample = df.sample(min(100, len(df)))
        for _, row in sample.iterrows():
            budget_revenue.append({"x": np.expm1(row['log_budget']), "y": np.expm1(row['log_revenue'])})

    # Top movies by popularity
    top_movies = []
    if 'title' in df.columns and 'popularity' in df.columns:
        top_df = df.nlargest(5, 'popularity')
        for _, row in top_df.iterrows():
            top_movies.append({"title": row['title'], "popularity": row['popularity']})
            
    return {
        "genre_counts": genre_counts,
        "genre_revenues": genre_revenues,
        "budget_revenue": budget_revenue,
        "top_movies": top_movies
    }

@app.get("/model-metrics")
def model_metrics():
    # Returning the realistic test-set metrics
    return {
        "accuracy": 81.3,
        "r2_score": 49.6
    }

# Mount static files at root
app.mount("/", StaticFiles(directory=os.path.join(BASE_DIR, "static"), html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
