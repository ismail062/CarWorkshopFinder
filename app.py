import os
from flask import Flask, render_template, jsonify, request
import requests
from urllib.parse import quote
import json

app = Flask(__name__)

# In-memory storage for ratings and reviews (replace with a database in production)
ratings_reviews = {}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/get_workshops', methods=['POST'])
def get_workshops():
    data = request.json
    lat = data['lat']
    lon = data['lon']
    
    # Use Overpass API to fetch car workshops
    overpass_url = "http://overpass-api.de/api/interpreter"
    overpass_query = f"""
    [out:json];
    (
      node["shop"="car_repair"](around:5000,{lat},{lon});
      way["shop"="car_repair"](around:5000,{lat},{lon});
      relation["shop"="car_repair"](around:5000,{lat},{lon});
    );
    out center;
    """
    
    response = requests.get(overpass_url, params={'data': overpass_query})
    data = response.json()
    
    workshops = []
    for element in data['elements']:
        if element['type'] == 'node':
            lat = element['lat']
            lon = element['lon']
        else:
            lat = element['center']['lat']
            lon = element['center']['lon']
        
        name = element['tags'].get('name', 'Unknown')
        address = element['tags'].get('addr:street', '') + ' ' + element['tags'].get('addr:housenumber', '')
        
        workshop_id = f"{lat},{lon}"
        rating_review = ratings_reviews.get(workshop_id, {'rating': 0, 'reviews': []})
        
        workshops.append({
            'id': workshop_id,
            'name': name,
            'address': address,
            'lat': lat,
            'lon': lon,
            'rating': rating_review['rating'],
            'reviews': rating_review['reviews']
        })
    
    return jsonify(workshops)

@app.route('/submit_rating_review', methods=['POST'])
def submit_rating_review():
    data = request.json
    workshop_id = data['workshop_id']
    rating = data['rating']
    review = data['review']
    
    if workshop_id not in ratings_reviews:
        ratings_reviews[workshop_id] = {'rating': 0, 'reviews': []}
    
    workshop_data = ratings_reviews[workshop_id]
    workshop_data['reviews'].append({'rating': rating, 'review': review})
    total_ratings = sum(r['rating'] for r in workshop_data['reviews'])
    workshop_data['rating'] = total_ratings / len(workshop_data['reviews'])
    
    return jsonify({'success': True})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
