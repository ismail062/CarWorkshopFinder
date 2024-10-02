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
            <p>Rating: ${workshop.rating.toFixed(1)} / 5</p>
            <button onclick="getDirections(${workshop.lat}, ${workshop.lon})" class="mt-2 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                Get Directions
            </button>
            <button onclick="showReviewForm('${workshop.id}')" class="mt-2 ml-2 bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded">
                Add Review
            </button>
            <div id="review-form-${workshop.id}" class="hidden mt-4">
                <textarea id="review-text-${workshop.id}" class="w-full p-2 border rounded" placeholder="Write your review"></textarea>
                <div class="star-rating mt-2">
                    <input type="radio" id="star5-${workshop.id}" name="rating-${workshop.id}" value="5" />
                    <label for="star5-${workshop.id}" title="5 stars"></label>
                    <input type="radio" id="star4-${workshop.id}" name="rating-${workshop.id}" value="4" />
                    <label for="star4-${workshop.id}" title="4 stars"></label>
                    <input type="radio" id="star3-${workshop.id}" name="rating-${workshop.id}" value="3" />
                    <label for="star3-${workshop.id}" title="3 stars"></label>
                    <input type="radio" id="star2-${workshop.id}" name="rating-${workshop.id}" value="2" />
                    <label for="star2-${workshop.id}" title="2 stars"></label>
                    <input type="radio" id="star1-${workshop.id}" name="rating-${workshop.id}" value="1" />
                    <label for="star1-${workshop.id}" title="1 star"></label>
                </div>
                <button onclick="submitReview('${workshop.id}')" class="mt-2 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                    Submit Review
                </button>
            </div>
            <div class="mt-4">
                <h4 class="font-semibold">Reviews:</h4>
                <ul>
                    ${workshop.reviews.map(review => `
                        <li class="mt-2">
                            <p>Rating: ${review.rating} / 5</p>
                            <p>${review.review}</p>
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
        workshopList.appendChild(li);
    });
}

function addWorkshopsToMap(workshops) {
    workshopMarkers.forEach(marker => map.removeLayer(marker));
    workshopMarkers = [];
    workshops.forEach(workshop => {
        const marker = L.marker([workshop.lat, workshop.lon]).addTo(map);
        marker.bindPopup(`<b>${workshop.name}</b><br>${workshop.address}<br>Rating: ${workshop.rating.toFixed(1)} / 5`);
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

function showReviewForm(workshopId) {
    const formElement = document.getElementById(`review-form-${workshopId}`);
    formElement.classList.toggle('hidden');
}

function submitReview(workshopId) {
    const reviewText = document.getElementById(`review-text-${workshopId}`).value;
    const rating = document.querySelector(`input[name="rating-${workshopId}"]:checked`);

    if (!reviewText.trim()) {
        alert('Please enter a review before submitting.');
        return;
    }

    if (!rating) {
        alert('Please select a rating before submitting.');
        return;
    }

    fetch('/submit_rating_review', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            workshop_id: workshopId,
            rating: parseInt(rating.value),
            review: reviewText
        }),
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            alert('Review submitted successfully!');
            getUserLocation(); // Refresh the workshop list
        } else {
            alert('Failed to submit review: ' + (data.error || 'Unknown error'));
        }
    })
    .catch(error => {
        console.error('Error submitting review:', error);
        alert('An error occurred while submitting the review. Please try again.');
    });
}

document.addEventListener('DOMContentLoaded', function() {
    initMap();
    getUserLocation();
});
