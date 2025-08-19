// Global variables
let recognition = null;
let speechSynthesis = null;

// Navigation function
function navigate(screenId) {
  const screens = document.querySelectorAll('.screen');
  screens.forEach(screen => screen.classList.add('hidden'));
  document.getElementById(screenId).classList.remove('hidden');
  localStorage.setItem('lastScreen', screenId);
}

// Image preview function
function previewImage(event, id) {
  const reader = new FileReader();
  reader.onload = function() {
    const output = document.getElementById(id);
    output.src = reader.result;
  };
  reader.readAsDataURL(event.target.files[0]);
}

// Water Estimation Functions
function predictWaterFromImage(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Show loading
  document.getElementById('waterLoading').classList.remove('hidden');
  document.getElementById('waterResults').classList.add('hidden');
  document.getElementById('waterError').classList.add('hidden');

  const formData = new FormData();
  formData.append('image', file);

  fetch('http://localhost:5000/predict_water', {
    method: 'POST',
    body: formData
  })
  .then(res => res.json())
  .then(data => {
    document.getElementById('waterLoading').classList.add('hidden');
    
    if (data.error) {
      showWaterError(data.error);
      return;
    }
    
    displayWaterResults(data);
  })
  .catch(err => {
    document.getElementById('waterLoading').classList.add('hidden');
    showWaterError('Failed to predict water requirements. Please try again.');
    console.error(err);
  });
}

function displayWaterResults(data) {
  // Set water amount
  document.getElementById('waterAmount').textContent = data.water_needed;
  
  // Set detected conditions
  const analysis = data.image_analysis;
  document.getElementById('detectedCrop').textContent = analysis.crop_type.charAt(0).toUpperCase() + analysis.crop_type.slice(1);
  document.getElementById('detectedGrowth').textContent = analysis.growth_stage.charAt(0).toUpperCase() + analysis.growth_stage.slice(1);
  document.getElementById('detectedSoil').textContent = analysis.soil_type.charAt(0).toUpperCase() + analysis.soil_type.slice(1);
  document.getElementById('detectedWeather').textContent = analysis.weather_condition.replace('_', ' ').charAt(0).toUpperCase() + analysis.weather_condition.replace('_', ' ').slice(1);
  document.getElementById('detectedMoisture').textContent = analysis.soil_moisture.charAt(0).toUpperCase() + analysis.soil_moisture.slice(1);
  document.getElementById('detectedDisease').textContent = analysis.disease_status;
  
  // Set breakdown values
  document.getElementById('baseWater').textContent = `${data.base_water} × 1.0`;
  document.getElementById('growthAdjustment').textContent = `× ${data.growth_multiplier}`;
  document.getElementById('soilAdjustment').textContent = `× ${data.soil_multiplier}`;
  document.getElementById('weatherAdjustment').textContent = `× ${data.weather_multiplier}`;
  document.getElementById('diseaseAdjustment').textContent = `× ${data.disease_multiplier}`;
  document.getElementById('moistureAdjustment').textContent = `× ${data.moisture_adjustment}`;
  
  // Set recommendations
  const recommendationsList = document.getElementById('waterRecommendations');
  recommendationsList.innerHTML = '';
  data.recommendations.forEach(rec => {
    const li = document.createElement('li');
    li.textContent = rec;
    recommendationsList.appendChild(li);
  });
  
  // Show results
  document.getElementById('waterResults').classList.remove('hidden');
}

function showWaterError(message) {
  const errorDiv = document.getElementById('waterError');
  errorDiv.textContent = message;
  errorDiv.classList.remove('hidden');
}

// Voice Assistant Functions
function startVoice() {
  try {
    recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = false;
    
    recognition.onstart = function() {
      document.getElementById('voiceBtn').style.display = 'none';
      document.getElementById('stopBtn').style.display = 'block';
      document.getElementById('voiceIndicator').classList.remove('hidden');
      document.getElementById('voiceText').textContent = '';
      document.getElementById('assistantText').textContent = '';
      document.getElementById('speakBtn').style.display = 'none';
    };
    
    recognition.onresult = function(event) {
      const transcript = event.results[0][0].transcript;
      document.getElementById('voiceText').textContent = transcript;
      
      // Generate response based on user input
      const response = generateVoiceResponse(transcript);
      document.getElementById('assistantText').textContent = response;
      document.getElementById('speakBtn').style.display = 'block';
    };
    
    recognition.onerror = function(event) {
      console.error('Speech recognition error:', event.error);
      stopVoice();
      document.getElementById('assistantText').textContent = 'Sorry, I couldn\'t understand. Please try again.';
    };
    
    recognition.onend = function() {
      stopVoice();
    };
    
    recognition.start();
    
  } catch (error) {
    console.error('Speech recognition not supported:', error);
    document.getElementById('assistantText').textContent = 'Speech recognition is not supported in this browser.';
  }
}

function stopVoice() {
  if (recognition) {
    recognition.stop();
  }
  document.getElementById('voiceBtn').style.display = 'block';
  document.getElementById('stopBtn').style.display = 'none';
  document.getElementById('voiceIndicator').classList.add('hidden');
}

function generateVoiceResponse(userInput) {
  const input = userInput.toLowerCase();
  
  // Disease-related queries
  if (input.includes('disease') || input.includes('sick') || input.includes('blight')) {
    if (input.includes('early blight')) {
      return 'Early blight is a fungal disease that causes dark brown spots with concentric rings on leaves. To treat it, remove infected leaves, improve air circulation, and apply fungicide. Make sure to water at the base of plants to avoid wetting the leaves.';
    } else if (input.includes('late blight')) {
      return 'Late blight is a serious fungal disease that can quickly destroy plants. Immediate action is required: remove infected plants, apply fungicide, and improve drainage. This disease spreads rapidly in cool, wet conditions.';
    } else {
      return 'Common plant diseases include early blight, late blight, and powdery mildew. To prevent diseases, ensure proper spacing between plants, avoid overhead watering, and maintain good air circulation. Remove infected plant parts immediately.';
    }
  }
  
  // Watering queries
  if (input.includes('water') || input.includes('irrigation') || input.includes('watering')) {
    if (input.includes('how much') || input.includes('amount')) {
      return 'Most crops need about 1 to 1.5 inches of water per week. Water deeply but less frequently to encourage deep root growth. Check soil moisture by sticking your finger 2 inches into the soil. If it feels dry, it\'s time to water.';
    } else if (input.includes('when') || input.includes('time')) {
      return 'The best time to water is early morning, between 6 AM and 10 AM. This allows plants to absorb water before the heat of the day and reduces evaporation. Avoid watering in the evening as it can promote fungal diseases.';
    } else {
      return 'Proper watering is crucial for plant health. Water at the base of plants, not on leaves. Use mulch to retain soil moisture and reduce water evaporation. Consider using drip irrigation for efficient water use.';
    }
  }
  
  // Planting queries
  if (input.includes('plant') || input.includes('grow') || input.includes('sow')) {
    if (input.includes('tomato')) {
      return 'Tomatoes should be planted after the last frost date in your area. Plant them 2-3 feet apart in well-draining soil with full sun exposure. Stake or cage them for support as they grow.';
    } else if (input.includes('when') || input.includes('time')) {
      return 'Spring is generally the best time to plant most crops. Check your local frost dates and plant after the last frost. Some crops like peas and lettuce can be planted earlier as they tolerate cooler temperatures.';
    } else {
      return 'Choose a sunny location with well-draining soil for most plants. Prepare the soil by adding compost or organic matter. Follow the spacing recommendations on seed packets for optimal growth.';
    }
  }
  
  // Pest control queries
  if (input.includes('pest') || input.includes('insect') || input.includes('bug') || input.includes('aphid')) {
    if (input.includes('organic') || input.includes('natural')) {
      return 'Organic pest control methods include: using neem oil, introducing beneficial insects like ladybugs, planting companion plants like marigolds, and using insecticidal soap. Regular monitoring and early intervention are key.';
    } else {
      return 'Common garden pests include aphids, spider mites, and caterpillars. Identify the pest first, then choose the appropriate control method. Consider organic options before using chemical pesticides.';
    }
  }
  
  // Yellow leaves queries
  if (input.includes('yellow') || input.includes('yellowing')) {
    return 'Yellow leaves can indicate several issues: overwatering, underwatering, nutrient deficiency, or disease. Check soil moisture first. If soil is wet, reduce watering. If dry, increase watering. Consider adding fertilizer if the problem persists.';
  }
  
  // General farming queries
  if (input.includes('fertilizer') || input.includes('nutrient')) {
    return 'Use organic fertilizers like compost, manure, or fish emulsion. Apply fertilizer according to package instructions, usually every 4-6 weeks during the growing season. Avoid over-fertilizing as it can harm plants.';
  }
  
  if (input.includes('soil') || input.includes('dirt')) {
    return 'Good soil is essential for healthy plants. Test your soil pH and add amendments as needed. Most vegetables prefer slightly acidic soil (pH 6.0-7.0). Add organic matter like compost to improve soil structure and fertility.';
  }
  
  // Default response
  return 'I\'m here to help with your farming questions! You can ask me about plant diseases, watering, planting times, pest control, or general gardening advice. Try asking something specific like "How to treat plant diseases?" or "When to plant tomatoes?"';
}

function speakResponse() {
  const responseText = document.getElementById('assistantText').textContent;
  if (responseText && 'speechSynthesis' in window) {
    speechSynthesis = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(responseText);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;
    speechSynthesis.speak(utterance);
  } else {
    alert('Text-to-speech is not supported in this browser.');
  }
}

// Disease Detection Functions
function sendForPrediction(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Show loading indicator
  document.getElementById('loadingIndicator').classList.remove('hidden');
  document.getElementById('predictionResults').classList.add('hidden');
  document.getElementById('errorMessage').classList.add('hidden');

  const formData = new FormData();
  formData.append('image', file);

  fetch('http://localhost:5000/predict', {
    method: 'POST',
    body: formData
  })
  .then(res => res.json())
  .then(data => {
    document.getElementById('loadingIndicator').classList.add('hidden');
    
    if (data.error) {
      showError(data.error);
      return;
    }
    
    displayPredictionResults(data);
  })
  .catch(err => {
    document.getElementById('loadingIndicator').classList.add('hidden');
    showError('Failed to connect to prediction service. Please try again.');
    console.error(err);
  });
}

function displayPredictionResults(data) {
  const resultsDiv = document.getElementById('predictionResults');
  
  // Set prediction title and confidence
  document.getElementById('predictionTitle').textContent = data.prediction;
  document.getElementById('confidenceScore').textContent = `${data.confidence}%`;
  
  // Set severity badge
  const severityBadge = document.getElementById('severityBadge');
  severityBadge.textContent = data.severity;
  severityBadge.style.backgroundColor = data.color;
  
  // Set description and recommendation
  document.getElementById('diseaseDescription').textContent = data.description;
  document.getElementById('diseaseRecommendation').textContent = data.recommendation;
  
  // Show demo mode notice if applicable
  if (data.demo_mode) {
    const demoNotice = document.createElement('div');
    demoNotice.className = 'demo-notice';
    demoNotice.innerHTML = `
      <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; border-radius: 4px; margin-bottom: 15px;">
        <strong>⚠️ Demo Mode:</strong> ${data.note}
      </div>
    `;
    resultsDiv.insertBefore(demoNotice, resultsDiv.firstChild);
  }
  
  // Create probability bars
  const probabilityBars = document.getElementById('probabilityBars');
  probabilityBars.innerHTML = '';
  
  Object.entries(data.all_probabilities).forEach(([className, probability]) => {
    const barContainer = document.createElement('div');
    barContainer.className = 'probability-bar-container';
    
    const label = document.createElement('span');
    label.className = 'probability-label';
    label.textContent = className;
    
    const bar = document.createElement('div');
    bar.className = 'probability-bar';
    
    const fill = document.createElement('div');
    fill.className = 'probability-fill';
    fill.style.width = `${probability}%`;
    fill.style.backgroundColor = className === data.prediction ? data.color : '#ddd';
    
    const percentage = document.createElement('span');
    percentage.className = 'probability-percentage';
    percentage.textContent = `${probability.toFixed(1)}%`;
    
    bar.appendChild(fill);
    barContainer.appendChild(label);
    barContainer.appendChild(bar);
    barContainer.appendChild(percentage);
    probabilityBars.appendChild(barContainer);
  });
  
  resultsDiv.classList.remove('hidden');
}

function showError(message) {
  const errorDiv = document.getElementById('errorMessage');
  errorDiv.textContent = message;
  errorDiv.classList.remove('hidden');
}

// Crop Calendar Functions
function getCropInfo() {
  const month = document.getElementById('monthSelect').value;
  const crop = document.getElementById('cropSelect').value;
  
  if (!month || !crop) {
    showCalendarError('Please select both month and crop.');
    return;
  }
  
  // Show loading
  document.getElementById('calendarLoading').classList.remove('hidden');
  document.getElementById('cropResults').classList.add('hidden');
  document.getElementById('calendarError').classList.add('hidden');
  
  // Simulate loading delay
  setTimeout(() => {
    const cropData = generateCropData(month, crop);
    displayCropResults(cropData);
    document.getElementById('calendarLoading').classList.add('hidden');
  }, 1000);
}

function generateCropData(month, crop) {
  const cropDatabase = {
    tomato: {
      name: 'Tomato',
      seasons: ['spring', 'summer'],
      plantingTime: 'Plant 2-3 weeks after last frost date',
      harvestTime: '60-85 days from transplanting',
      fertilizerSchedule: [
        'At planting: Apply balanced fertilizer (10-10-10)',
        '3 weeks after planting: Apply nitrogen-rich fertilizer',
        'When flowers appear: Apply phosphorus-rich fertilizer',
        'Every 2-3 weeks: Apply liquid fertilizer'
      ],
      wateringNeeds: 'Water deeply 1-2 inches per week. Keep soil consistently moist but not waterlogged.',
      climateNeeds: 'Full sun (6-8 hours daily). Temperature: 65-85°F (18-29°C).',
      growingTips: 'Stake or cage plants for support. Remove suckers for better fruit production. Mulch to retain moisture.'
    },
    potato: {
      name: 'Potato',
      seasons: ['spring', 'fall'],
      plantingTime: 'Plant 2-4 weeks before last frost date',
      harvestTime: '80-120 days from planting',
      fertilizerSchedule: [
        'Before planting: Apply balanced fertilizer (10-10-10)',
        'When plants are 6 inches tall: Apply nitrogen fertilizer',
        'When flowering begins: Apply potassium-rich fertilizer',
        'Stop fertilizing 2 weeks before harvest'
      ],
      wateringNeeds: 'Water 1-2 inches per week. Increase during tuber formation.',
      climateNeeds: 'Full sun. Temperature: 60-70°F (15-21°C). Cool weather crop.',
      growingTips: 'Hill soil around plants as they grow. Keep tubers covered to prevent greening.'
    },
    onion: {
      name: 'Onion',
      seasons: ['spring', 'fall'],
      plantingTime: 'Plant in early spring or fall',
      harvestTime: '90-160 days depending on variety',
      fertilizerSchedule: [
        'Before planting: Apply phosphorus-rich fertilizer',
        '3 weeks after planting: Apply nitrogen fertilizer',
        'When bulbs start forming: Apply balanced fertilizer',
        'Stop fertilizing 3 weeks before harvest'
      ],
      wateringNeeds: 'Water 1 inch per week. Reduce watering as bulbs mature.',
      climateNeeds: 'Full sun. Temperature: 55-75°F (13-24°C).',
      growingTips: 'Plant in loose, well-draining soil. Space bulbs 4-6 inches apart.'
    },
    carrot: {
      name: 'Carrot',
      seasons: ['spring', 'fall'],
      plantingTime: 'Plant 2-4 weeks before last frost',
      harvestTime: '60-80 days from planting',
      fertilizerSchedule: [
        'Before planting: Apply phosphorus-rich fertilizer',
        'When tops are 4 inches tall: Apply nitrogen fertilizer',
        'Avoid high nitrogen fertilizers during root development'
      ],
      wateringNeeds: 'Water 1 inch per week. Keep soil consistently moist.',
      climateNeeds: 'Full sun to partial shade. Temperature: 60-70°F (15-21°C).',
      growingTips: 'Plant in loose, sandy soil. Thin seedlings to prevent crowding.'
    },
    cabbage: {
      name: 'Cabbage',
      seasons: ['spring', 'fall'],
      plantingTime: 'Plant 4-6 weeks before last frost',
      harvestTime: '60-100 days from transplanting',
      fertilizerSchedule: [
        'Before planting: Apply balanced fertilizer (10-10-10)',
        '3 weeks after planting: Apply nitrogen fertilizer',
        'When heads start forming: Apply balanced fertilizer'
      ],
      wateringNeeds: 'Water 1-1.5 inches per week. Keep soil consistently moist.',
      climateNeeds: 'Full sun. Temperature: 60-65°F (15-18°C). Cool weather crop.',
      growingTips: 'Plant in rich, well-draining soil. Space plants 12-18 inches apart.'
    },
    cauliflower: {
      name: 'Cauliflower',
      seasons: ['spring', 'fall'],
      plantingTime: 'Plant 4-6 weeks before last frost',
      harvestTime: '55-100 days from transplanting',
      fertilizerSchedule: [
        'Before planting: Apply balanced fertilizer (10-10-10)',
        '3 weeks after planting: Apply nitrogen fertilizer',
        'When heads start forming: Apply balanced fertilizer'
      ],
      wateringNeeds: 'Water 1-1.5 inches per week. Consistent moisture is crucial.',
      climateNeeds: 'Full sun. Temperature: 60-65°F (15-18°C). Cool weather crop.',
      growingTips: 'Blanch heads by covering with leaves when they reach 2-3 inches.'
    },
    peas: {
      name: 'Peas',
      seasons: ['spring', 'fall'],
      plantingTime: 'Plant 4-6 weeks before last frost',
      harvestTime: '55-70 days from planting',
      fertilizerSchedule: [
        'Before planting: Apply phosphorus-rich fertilizer',
        'When plants are 6 inches tall: Apply nitrogen fertilizer',
        'Peas fix their own nitrogen, so avoid over-fertilizing'
      ],
      wateringNeeds: 'Water 1 inch per week. Increase during flowering and pod formation.',
      climateNeeds: 'Full sun to partial shade. Temperature: 55-70°F (13-21°C).',
      growingTips: 'Provide support for climbing varieties. Harvest regularly to encourage more pods.'
    },
    beans: {
      name: 'Beans',
      seasons: ['spring', 'summer'],
      plantingTime: 'Plant after last frost date',
      harvestTime: '50-65 days from planting',
      fertilizerSchedule: [
        'Before planting: Apply balanced fertilizer (10-10-10)',
        'When plants are 6 inches tall: Apply nitrogen fertilizer',
        'Beans fix nitrogen, so avoid over-fertilizing'
      ],
      wateringNeeds: 'Water 1 inch per week. Increase during flowering and pod formation.',
      climateNeeds: 'Full sun. Temperature: 70-80°F (21-27°C).',
      growingTips: 'Provide support for pole beans. Harvest regularly to encourage more pods.'
    },
    cucumber: {
      name: 'Cucumber',
      seasons: ['spring', 'summer'],
      plantingTime: 'Plant 1-2 weeks after last frost',
      harvestTime: '50-70 days from planting',
      fertilizerSchedule: [
        'Before planting: Apply balanced fertilizer (10-10-10)',
        'When vines start running: Apply nitrogen fertilizer',
        'When flowers appear: Apply phosphorus-rich fertilizer'
      ],
      wateringNeeds: 'Water 1-2 inches per week. Keep soil consistently moist.',
      climateNeeds: 'Full sun. Temperature: 70-85°F (21-29°C).',
      growingTips: 'Provide support for vining varieties. Harvest regularly to encourage more fruit.'
    },
    pepper: {
      name: 'Pepper',
      seasons: ['spring', 'summer'],
      plantingTime: 'Plant 2-3 weeks after last frost',
      harvestTime: '60-90 days from transplanting',
      fertilizerSchedule: [
        'Before planting: Apply balanced fertilizer (10-10-10)',
        '3 weeks after planting: Apply nitrogen fertilizer',
        'When flowers appear: Apply phosphorus-rich fertilizer',
        'Every 3-4 weeks: Apply balanced fertilizer'
      ],
      wateringNeeds: 'Water 1-2 inches per week. Allow soil to dry slightly between watering.',
      climateNeeds: 'Full sun. Temperature: 70-85°F (21-29°C).',
      growingTips: 'Plant in warm soil. Provide support for heavy fruit. Mulch to retain moisture.'
    },
    lettuce: {
      name: 'Lettuce',
      seasons: ['spring', 'fall'],
      plantingTime: 'Plant 4-6 weeks before last frost',
      harvestTime: '45-60 days from planting',
      fertilizerSchedule: [
        'Before planting: Apply balanced fertilizer (10-10-10)',
        '2 weeks after planting: Apply nitrogen fertilizer',
        'Lettuce is a light feeder, avoid over-fertilizing'
      ],
      wateringNeeds: 'Water 1 inch per week. Keep soil consistently moist.',
      climateNeeds: 'Partial shade to full sun. Temperature: 60-70°F (15-21°C).',
      growingTips: 'Plant in loose, rich soil. Harvest outer leaves for continuous production.'
    },
    spinach: {
      name: 'Spinach',
      seasons: ['spring', 'fall'],
      plantingTime: 'Plant 4-6 weeks before last frost',
      harvestTime: '40-50 days from planting',
      fertilizerSchedule: [
        'Before planting: Apply balanced fertilizer (10-10-10)',
        '2 weeks after planting: Apply nitrogen fertilizer',
        'Spinach is a light feeder, avoid over-fertilizing'
      ],
      wateringNeeds: 'Water 1 inch per week. Keep soil consistently moist.',
      climateNeeds: 'Partial shade to full sun. Temperature: 50-70°F (10-21°C).',
      growingTips: 'Plant in rich, well-draining soil. Harvest outer leaves for continuous production.'
    },
    corn: {
      name: 'Corn',
      seasons: ['spring', 'summer'],
      plantingTime: 'Plant 2 weeks after last frost',
      harvestTime: '60-100 days from planting',
      fertilizerSchedule: [
        'Before planting: Apply balanced fertilizer (10-10-10)',
        'When plants are 12 inches tall: Apply nitrogen fertilizer',
        'When tassels appear: Apply nitrogen fertilizer',
        'Stop fertilizing when silks appear'
      ],
      wateringNeeds: 'Water 1-2 inches per week. Increase during tasseling and silking.',
      climateNeeds: 'Full sun. Temperature: 60-95°F (15-35°C).',
      growingTips: 'Plant in blocks for better pollination. Plant multiple rows for cross-pollination.'
    },
    wheat: {
      name: 'Wheat',
      seasons: ['fall', 'spring'],
      plantingTime: 'Plant in fall (winter wheat) or early spring (spring wheat)',
      harvestTime: '110-130 days from planting',
      fertilizerSchedule: [
        'Before planting: Apply phosphorus and potassium',
        'Early spring: Apply nitrogen fertilizer',
        'When stems start elongating: Apply nitrogen fertilizer'
      ],
      wateringNeeds: 'Water 1-2 inches per week during growing season.',
      climateNeeds: 'Full sun. Temperature: 60-75°F (15-24°C).',
      growingTips: 'Plant in well-draining soil. Monitor for pests and diseases regularly.'
    },
    rice: {
      name: 'Rice',
      seasons: ['spring', 'summer'],
      plantingTime: 'Plant in spring after last frost',
      harvestTime: '105-150 days from planting',
      fertilizerSchedule: [
        'Before planting: Apply balanced fertilizer (10-10-10)',
        'When plants are 6 inches tall: Apply nitrogen fertilizer',
        'When panicles form: Apply nitrogen fertilizer'
      ],
      wateringNeeds: 'Keep soil flooded or very wet throughout growing season.',
      climateNeeds: 'Full sun. Temperature: 70-85°F (21-29°C).',
      growingTips: 'Requires flooded conditions. Plant in clay soil that holds water well.'
    },
    cotton: {
      name: 'Cotton',
      seasons: ['spring', 'summer'],
      plantingTime: 'Plant 2-3 weeks after last frost',
      harvestTime: '150-180 days from planting',
      fertilizerSchedule: [
        'Before planting: Apply balanced fertilizer (10-10-10)',
        'When plants are 6 inches tall: Apply nitrogen fertilizer',
        'When flowers appear: Apply nitrogen fertilizer',
        'When bolls form: Apply potassium fertilizer'
      ],
      wateringNeeds: 'Water 1-2 inches per week. Increase during flowering and boll formation.',
      climateNeeds: 'Full sun. Temperature: 70-95°F (21-35°C).',
      growingTips: 'Plant in warm soil. Monitor for pests like boll weevils. Harvest when bolls open.'
    },
    sugarcane: {
      name: 'Sugarcane',
      seasons: ['spring', 'summer'],
      plantingTime: 'Plant in spring after last frost',
      harvestTime: '12-18 months from planting',
      fertilizerSchedule: [
        'Before planting: Apply balanced fertilizer (10-10-10)',
        '3 months after planting: Apply nitrogen fertilizer',
        'Every 3 months: Apply nitrogen and potassium fertilizer',
        'Stop fertilizing 3 months before harvest'
      ],
      wateringNeeds: 'Water 2-3 inches per week. Requires consistent moisture.',
      climateNeeds: 'Full sun. Temperature: 70-95°F (21-35°C). Tropical/subtropical crop.',
      growingTips: 'Plant in rich, well-draining soil. Requires long growing season. Harvest in winter.'
    }
  };
  
  const cropInfo = cropDatabase[crop];
  if (!cropInfo) {
    return null;
  }
  
  // Determine if the selected month is good for planting
  const monthSeasons = {
    january: 'winter', february: 'winter', march: 'spring', april: 'spring',
    may: 'spring', june: 'summer', july: 'summer', august: 'summer',
    september: 'fall', october: 'fall', november: 'fall', december: 'winter'
  };
  
  const selectedSeason = monthSeasons[month];
  const isGoodTime = cropInfo.seasons.includes(selectedSeason);
  
  return {
    ...cropInfo,
    selectedMonth: month,
    selectedSeason: selectedSeason,
    isGoodTime: isGoodTime
  };
}

function displayCropResults(cropData) {
  if (!cropData) {
    showCalendarError('Crop information not found. Please try a different crop.');
    return;
  }
  
  // Set crop title and season badge
  document.getElementById('cropTitle').textContent = cropData.name;
  const seasonBadge = document.getElementById('cropSeason');
  seasonBadge.textContent = cropData.selectedSeason.toUpperCase();
  seasonBadge.style.backgroundColor = cropData.isGoodTime ? '#00e600' : '#ff6b6b';
  
  // Set all the crop details
  document.getElementById('plantingTime').textContent = cropData.plantingTime;
  document.getElementById('harvestTime').textContent = cropData.harvestTime;
  document.getElementById('wateringNeeds').textContent = cropData.wateringNeeds;
  document.getElementById('climateNeeds').textContent = cropData.climateNeeds;
  document.getElementById('growingTips').textContent = cropData.growingTips;
  
  // Create fertilizer schedule list
  const fertilizerDiv = document.getElementById('fertilizerSchedule');
  fertilizerDiv.innerHTML = '';
  cropData.fertilizerSchedule.forEach(item => {
    const p = document.createElement('p');
    p.textContent = `• ${item}`;
    p.style.marginBottom = '5px';
    p.style.fontSize = '12px';
    fertilizerDiv.appendChild(p);
  });
  
  // Show results
  document.getElementById('cropResults').classList.remove('hidden');
}

function showCalendarError(message) {
  const errorDiv = document.getElementById('calendarError');
  errorDiv.textContent = message;
  errorDiv.classList.remove('hidden');
}

// Initialize app when page loads
window.onload = function() {
  const last = localStorage.getItem('lastScreen');
  if (last) navigate(last);
}