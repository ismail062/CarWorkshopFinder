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
    showManualLocationInput();
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(function(position) {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            updateMap(lat, lon);
            getWorkshops(lat, lon);
        }, function(error) {
            console.error("Error getting user location:", error);
        });
    }
}

function showManualLocationInput() {
    const manualLocationForm = document.createElement('div');
    manualLocationForm.innerHTML = `
        <h3 class="text-lg font-semibold mb-2">Enter your location</h3>
        <input type="text" id="manual-location" class="border rounded p-2 mr-2" placeholder="City, Country">
        <input type="text" id="postcode" class="border rounded p-2 mr-2" placeholder="UK Postcode">
        <button onclick="useLocation()" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">Search</button>
    `;
    document.getElementById('manual-location-container').innerHTML = '';
    document.getElementById('manual-location-container').appendChild(manualLocationForm);
}

function useLocation() {
    const locationInput = document.getElementById('manual-location').value;
    const postcodeInput = document.getElementById('postcode').value;

    if (postcodeInput) {
        fetchPostcodeLocation(postcodeInput);
    } else if (locationInput) {
        fetchManualLocation(locationInput);
    } else {
        alert('Please enter a location or UK postcode.');
    }
}

function fetchPostcodeLocation(postcode) {
    fetch(`/get_postcode_location?postcode=${encodeURIComponent(postcode)}`)
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert(data.error);
            } else {
                updateMap(data.lat, data.lon);
                getWorkshops(data.lat, data.lon);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('An error occurred while fetching the postcode location. Please try again.');
        });
}

function fetchManualLocation(location) {
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`)
        .then(response => response.json())
        .then(data => {
            if (data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lon = parseFloat(data[0].lon);
                updateMap(lat, lon);
                getWorkshops(lat, lon);
            } else {
                alert('Location not found. Please try again.');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('An error occurred while fetching the location. Please try again.');
        });
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
        console.log("Received workshops data:", workshops);
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
            <p>Average Rating: ${workshop.rating.toFixed(1)} / 5 (${workshop.total_reviews} ${workshop.total_reviews === 1 ? 'review' : 'reviews'})</p>
            <button onclick="getDirections(${workshop.lat}, ${workshop.lon})" class="mt-2 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                Get Directions
            </button>
            <button onclick="showReviewForm('${workshop.id}')" class="mt-2 ml-2 bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded">
                Add Review
            </button>
            <div id="review-form-${workshop.id}" class="hidden mt-4">
                <textarea id="review-text-${workshop.id}" class="w-full p-2 border rounded" placeholder="Write your review"></textarea>
                <div class="star-rating mt-2" data-workshop-id="${workshop.id}">
                    <i class="fas fa-star" data-rating="1"></i>
                    <i class="fas fa-star" data-rating="2"></i>
                    <i class="fas fa-star" data-rating="3"></i>
                    <i class="fas fa-star" data-rating="4"></i>
                    <i class="fas fa-star" data-rating="5"></i>
                </div>
                <button onclick="submitReview('${workshop.id}')" class="mt-2 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                    Submit Review
                </button>
            </div>
            <div class="mt-4">
                <h4 class="font-semibold">Recent Reviews:</h4>
                <ul>
                    ${workshop.reviews.slice(0, 3).map(review => `
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
    initializeStarRatings();
}

function initializeStarRatings() {
    const starContainers = document.querySelectorAll('.star-rating');
    starContainers.forEach(container => {
        const stars = container.querySelectorAll('.fa-star');
        stars.forEach(star => {
            star.addEventListener('click', () => {
                const rating = star.getAttribute('data-rating');
                updateStarRating(container, rating);
            });
            star.addEventListener('mouseover', () => {
                const rating = star.getAttribute('data-rating');
                highlightStars(container, rating);
            });
            star.addEventListener('mouseout', () => {
                resetStars(container);
            });
        });
    });
}

function updateStarRating(container, rating) {
    container.setAttribute('data-rating', rating);
    resetStars(container);
}

function highlightStars(container, rating) {
    const stars = container.querySelectorAll('.fa-star');
    stars.forEach(star => {
        if (star.getAttribute('data-rating') <= rating) {
            star.classList.add('text-yellow-400');
        } else {
            star.classList.remove('text-yellow-400');
        }
    });
}

function resetStars(container) {
    const currentRating = container.getAttribute('data-rating') || 0;
    const stars = container.querySelectorAll('.fa-star');
    stars.forEach(star => {
        if (star.getAttribute('data-rating') <= currentRating) {
            star.classList.add('text-yellow-400');
        } else {
            star.classList.remove('text-yellow-400');
        }
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
    return (latlng1.distanceTo(latlng2) / 1000);
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
    const ratingContainer = document.querySelector(`.star-rating[data-workshop-id="${workshopId}"]`);
    const rating = ratingContainer.getAttribute('data-rating');

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
            rating: parseInt(rating),
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
            getUserLocation();
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