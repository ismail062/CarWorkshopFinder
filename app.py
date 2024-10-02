import os
from flask import Flask, render_template, jsonify, request
import requests
from urllib.parse import quote

app = Flask(__name__)

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
        
        workshops.append({
            'name': name,
            'address': address,
            'lat': lat,
            'lon': lon
        })
    
    return jsonify(workshops)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
