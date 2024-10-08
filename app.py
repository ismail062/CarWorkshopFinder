import os
from flask import Flask, render_template, jsonify, request
import requests
from urllib.parse import quote
import json
import logging

app = Flask(__name__)

# Configure logging
logging.basicConfig(level=logging.DEBUG)

# In-memory storage for ratings and reviews (replace with a database in production)
ratings_reviews = {}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/get_location')
def get_location():
    input_value = request.args.get('input')
    if not input_value:
        return jsonify({"error": "Location or postcode is required"}), 400

    headers = {
        'User-Agent': 'CarWorkshopFinder/1.0 (https://replit.com/@YourUsername/YourRepl)'
    }

    try:
        # First, try to fetch as a postcode
        postcode_response = requests.get(f"https://api.postcodes.io/postcodes/{quote(input_value)}", headers=headers)
        postcode_data = postcode_response.json()

        if postcode_response.status_code == 200 and postcode_data['status'] == 200:
            result = postcode_data['result']
            return jsonify({
                "lat": result['latitude'],
                "lon": result['longitude']
            })
        else:
            # If not a valid postcode, try as an address using Nominatim
            nominatim_response = requests.get(f"https://nominatim.openstreetmap.org/search?format=json&q={quote(input_value)}", headers=headers)
            
            if nominatim_response.status_code == 200:
                nominatim_data = nominatim_response.json()
                if nominatim_data and len(nominatim_data) > 0:
                    return jsonify({
                        "lat": float(nominatim_data[0]['lat']),
                        "lon": float(nominatim_data[0]['lon'])
                    })
                else:
                    return jsonify({"error": "Location not found"}), 404
            else:
                app.logger.error(f"Nominatim API error: {nominatim_response.status_code} - {nominatim_response.text}")
                return jsonify({"error": "Error fetching location data"}), 500
    except requests.RequestException as e:
        app.logger.error(f"Request error: {str(e)}")
        return jsonify({"error": "An error occurred while fetching the location"}), 500
    except Exception as e:
        app.logger.error(f"Unexpected error: {str(e)}")
        return jsonify({"error": "An unexpected error occurred"}), 500

@app.route('/get_workshops', methods=['POST'])
def get_workshops():
    data = request.json
    lat = data.get('lat')
    lon = data.get('lon')
    
    if not lat or not lon:
        return jsonify({"error": "Invalid latitude or longitude"}), 400
    
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
        
        # Calculate summary information
        total_reviews = len(rating_review['reviews'])
        average_rating = rating_review['rating'] if total_reviews > 0 else 0
        
        workshops.append({
            'id': workshop_id,
            'name': name,
            'address': address,
            'lat': lat,
            'lon': lon,
            'rating': average_rating,
            'total_reviews': total_reviews,
            'reviews': rating_review['reviews']
        })
    
    app.logger.debug(f"Workshops data: {workshops}")
    return jsonify(workshops)

@app.route('/submit_rating_review', methods=['POST'])
def submit_rating_review():
    try:
        data = request.json
        if data is None:
            raise ValueError("No JSON data received")
        
        workshop_id = data.get('workshop_id')
        rating = data.get('rating')
        review = data.get('review')
        
        if not all([workshop_id, rating, review]):
            raise ValueError("Missing required fields")
        
        if workshop_id not in ratings_reviews:
            ratings_reviews[workshop_id] = {'rating': 0, 'reviews': []}
        
        workshop_data = ratings_reviews[workshop_id]
        workshop_data['reviews'].append({'rating': rating, 'review': review})
        total_ratings = sum(r['rating'] for r in workshop_data['reviews'])
        workshop_data['rating'] = total_ratings / len(workshop_data['reviews'])
        
        app.logger.info(f"Review submitted for workshop {workshop_id}: Rating {rating}, Review: {review}")
        app.logger.debug(f"Updated workshop data: {workshop_data}")
        return jsonify({'success': True})
    except Exception as e:
        app.logger.error(f"Error submitting review: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 400

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
