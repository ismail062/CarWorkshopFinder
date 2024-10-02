let map;
let userMarker;
let workshopMarkers = [];

function initMap() {
    map = L.map('map').setView([0, 0], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
}

function getUserLocation() {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(function(position) {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            updateMap(lat, lon);
            getWorkshops(lat, lon);
        }, function(error) {
            console.error("Error getting user location:", error);
            alert("Unable to get your location. Please enable location services and try again.");
        });
    } else {
        alert("Geolocation is not supported by your browser.");
    }
}

function updateMap(lat, lon) {
    map.setView([lat, lon], 13);
    if (userMarker) {
        map.removeLayer(userMarker);
    }
    userMarker = L.marker([lat, lon]).addTo(map);
    userMarker.bindPopup("You are here").openPopup();
}

function getWorkshops(lat, lon) {
    fetch('/get_workshops', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ lat, lon }),
    })
    .then(response => response.json())
    .then(workshops => {
        displayWorkshops(workshops);
        addWorkshopsToMap(workshops);
    })
    .catch(error => console.error('Error fetching workshops:', error));
}

function displayWorkshops(workshops) {
    const workshopList = document.getElementById('workshop-list');
    workshopList.innerHTML = '';
    workshops.forEach(workshop => {
        const li = document.createElement('li');
        li.className = 'mb-4 p-4 bg-white rounded shadow';
        li.innerHTML = `
            <h3 class="font-bold">${workshop.name}</h3>
            <p>${workshop.address}</p>
            <p>Distance: ${calculateDistance(userMarker.getLatLng(), L.latLng(workshop.lat, workshop.lon)).toFixed(2)} km</p>
            <button onclick="getDirections(${workshop.lat}, ${workshop.lon})" class="mt-2 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                Get Directions
            </button>
        `;
        workshopList.appendChild(li);
    });
}

function addWorkshopsToMap(workshops) {
    workshopMarkers.forEach(marker => map.removeLayer(marker));
    workshopMarkers = [];
    workshops.forEach(workshop => {
        const marker = L.marker([workshop.lat, workshop.lon]).addTo(map);
        marker.bindPopup(`<b>${workshop.name}</b><br>${workshop.address}`);
        workshopMarkers.push(marker);
    });
}

function calculateDistance(latlng1, latlng2) {
    return (latlng1.distanceTo(latlng2) / 1000); // Convert meters to kilometers
}

function getDirections(lat, lon) {
    const userLat = userMarker.getLatLng().lat;
    const userLon = userMarker.getLatLng().lng;
    const url = `https://www.openstreetmap.org/directions?engine=osrm_car&route=${userLat},${userLon};${lat},${lon}`;
    window.open(url, '_blank');
}

document.addEventListener('DOMContentLoaded', function() {
    initMap();
    getUserLocation();
});
