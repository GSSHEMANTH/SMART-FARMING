from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
import numpy as np
import io
import os
import json
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Check if model file exists and is not empty
model = None
model_available = False

try:
    if os.path.exists('model.h5') and os.path.getsize('model.h5') > 0:
        from tensorflow.keras.models import load_model # pyright: ignore[reportMissingImports]
        from tensorflow.keras.preprocessing.image import img_to_array # pyright: ignore[reportMissingImports]
        model = load_model('model.h5')
        model_available = True
        print("✅ Model loaded successfully!")
    else:
        print("⚠️  Model file is missing or empty. Using demo mode.")
except Exception as e:
    print(f"⚠️  Could not load model: {e}")
    print("⚠️  Using demo mode with simulated predictions.")

# Define class names (edit these as per your model)
class_names = ['Healthy', 'Early Blight', 'Late Blight']

# Disease information dictionary
disease_info = {
    'Healthy': {
        'description': 'The plant appears to be healthy with no visible disease symptoms.',
        'recommendation': 'Continue regular monitoring and maintain current care practices.',
        'severity': 'None',
        'color': '#00e600',
        'water_adjustment': 1.0  # No adjustment needed
    },
    'Early Blight': {
        'description': 'Early blight is a fungal disease that causes dark brown spots with concentric rings on leaves.',
        'recommendation': 'Remove infected leaves, improve air circulation, and consider fungicide treatment.',
        'severity': 'Moderate',
        'color': '#ffa500',
        'water_adjustment': 0.8  # Reduce water to prevent fungal growth
    },
    'Late Blight': {
        'description': 'Late blight is a serious fungal disease that can quickly destroy entire plants.',
        'recommendation': 'Immediate action required: Remove infected plants, apply fungicide, and improve drainage.',
        'severity': 'High',
        'color': '#ff0000',
        'water_adjustment': 0.6  # Significantly reduce water
    }
}

# Water requirement database
water_requirements = {
    'tomato': {
        'base_water': 1.5,  # inches per week
        'growth_stages': {
            'seedling': 0.8,
            'vegetative': 1.2,
            'flowering': 1.8,
            'fruiting': 2.0,
            'mature': 1.5
        },
        'soil_preferences': {
            'sandy': 1.3,
            'loamy': 1.0,
            'clay': 0.8
        }
    },
    'potato': {
        'base_water': 1.2,
        'growth_stages': {
            'seedling': 0.6,
            'vegetative': 1.0,
            'flowering': 1.5,
            'tuber_formation': 1.8,
            'mature': 1.0
        },
        'soil_preferences': {
            'sandy': 1.2,
            'loamy': 1.0,
            'clay': 0.9
        }
    },
    'corn': {
        'base_water': 1.8,
        'growth_stages': {
            'seedling': 0.8,
            'vegetative': 1.5,
            'tasseling': 2.2,
            'silking': 2.5,
            'mature': 1.8
        },
        'soil_preferences': {
            'sandy': 1.4,
            'loamy': 1.0,
            'clay': 0.9
        }
    },
    'wheat': {
        'base_water': 1.0,
        'growth_stages': {
            'seedling': 0.5,
            'vegetative': 0.8,
            'flowering': 1.2,
            'grain_filling': 1.5,
            'mature': 0.8
        },
        'soil_preferences': {
            'sandy': 1.1,
            'loamy': 1.0,
            'clay': 0.9
        }
    },
    'rice': {
        'base_water': 3.0,
        'growth_stages': {
            'seedling': 2.0,
            'vegetative': 2.5,
            'flowering': 3.5,
            'grain_filling': 3.0,
            'mature': 2.5
        },
        'soil_preferences': {
            'sandy': 1.2,
            'loamy': 1.0,
            'clay': 0.8
        }
    }
}

# Weather conditions impact
weather_impact = {
    'sunny': 1.3,
    'partly_cloudy': 1.1,
    'cloudy': 1.0,
    'rainy': 0.3,
    'hot': 1.5,
    'cool': 0.8
}

def analyze_image_for_water_prediction(image_data):
    """Analyze image to extract features for water prediction using PIL only"""
    try:
        # Convert PIL image to numpy array
        img_array = np.array(image_data)
        
        # Ensure RGB format
        if len(img_array.shape) == 2:
            # Convert grayscale to RGB
            img_array = np.stack([img_array] * 3, axis=-1)
        elif img_array.shape[2] == 4:  # RGBA
            img_array = img_array[:, :, :3]
        
        # Analyze image characteristics
        analysis = {}
        
        # 1. Detect crop type based on color and texture
        analysis['crop_type'] = detect_crop_type(img_array)
        
        # 2. Detect growth stage based on plant size and structure
        analysis['growth_stage'] = detect_growth_stage(img_array)
        
        # 3. Detect soil type based on visible soil characteristics
        analysis['soil_type'] = detect_soil_type(img_array)
        
        # 4. Detect soil moisture based on soil color and texture
        analysis['soil_moisture'] = detect_soil_moisture(img_array)
        
        # 5. Detect weather conditions based on image brightness and color temperature
        analysis['weather_condition'] = detect_weather_condition(img_array)
        
        # 6. Detect disease status (using existing model)
        analysis['disease_status'] = 'Healthy'  # Will be updated by disease detection
        
        return analysis
        
    except Exception as e:
        print(f"Error in image analysis: {e}")
        # Return default values if analysis fails
        return {
            'crop_type': 'tomato',
            'growth_stage': 'vegetative',
            'soil_type': 'loamy',
            'soil_moisture': 'moist',
            'weather_condition': 'sunny',
            'disease_status': 'Healthy'
        }

def detect_crop_type(img_array):
    """Detect crop type based on image characteristics using PIL/numpy"""
    # Calculate color histograms
    red_channel = np.mean(img_array[:, :, 0])
    green_channel = np.mean(img_array[:, :, 1])
    blue_channel = np.mean(img_array[:, :, 2])
    
    # Green channel analysis (for plant detection)
    green_ratio = green_channel / (red_channel + blue_channel + 1e-8)
    
    # Brightness analysis
    brightness = np.mean(img_array)
    
    # Simple heuristics for crop detection
    if green_ratio > 1.3 and brightness > 120:
        # High green content and bright - likely tomato or leafy vegetables
        if red_channel > green_channel * 0.8:
            return 'tomato'
        else:
            return 'lettuce'
    elif green_ratio > 1.1 and brightness < 100:
        # Medium green, darker - likely potato or root vegetables
        return 'potato'
    elif brightness > 150 and green_channel > 100:
        # Very bright with good green - likely corn
        return 'corn'
    elif brightness < 80:
        # Dark image - likely wheat or rice
        if green_ratio < 0.8:
            return 'wheat'
        else:
            return 'rice'
    else:
        # Default to tomato
        return 'tomato'

def detect_growth_stage(img_array):
    """Detect growth stage based on plant characteristics"""
    # Analyze plant size and structure using simple metrics
    gray = np.mean(img_array, axis=2)  # Convert to grayscale
    
    # Calculate edge-like features (simple gradient)
    height, width = gray.shape
    edge_density = 0
    
    # Simple edge detection using differences
    for i in range(1, height-1):
        for j in range(1, width-1):
            diff_h = abs(gray[i, j] - gray[i, j-1]) + abs(gray[i, j] - gray[i, j+1])
            diff_v = abs(gray[i, j] - gray[i-1, j]) + abs(gray[i, j] - gray[i+1, j])
            edge_density += (diff_h + diff_v) / 255.0
    
    edge_density = edge_density / (height * width)
    
    # Brightness analysis
    brightness = np.mean(img_array)
    
    # Simple heuristics for growth stage
    if edge_density < 0.1:
        return 'seedling'
    elif edge_density < 0.2:
        return 'vegetative'
    elif edge_density < 0.3:
        return 'flowering'
    elif edge_density < 0.4:
        return 'fruiting'
    else:
        return 'mature'

def detect_soil_type(img_array):
    """Detect soil type based on visible soil characteristics"""
    # Focus on bottom portion of image (likely soil)
    height, width = img_array.shape[:2]
    soil_region = img_array[int(height*0.7):, :]
    
    if len(soil_region) == 0:
        return 'loamy'
    
    # Color analysis of soil region
    soil_brightness = np.mean(soil_region)
    soil_red = np.mean(soil_region[:, :, 0])
    soil_green = np.mean(soil_region[:, :, 1])
    soil_blue = np.mean(soil_region[:, :, 2])
    
    # Simple heuristics for soil type
    if soil_brightness > 150:
        return 'sandy'  # Light colored soil
    elif soil_brightness < 80:
        return 'clay'   # Dark colored soil
    else:
        return 'loamy'  # Medium colored soil

def detect_soil_moisture(img_array):
    """Detect soil moisture based on soil color and texture"""
    # Focus on bottom portion of image
    height, width = img_array.shape[:2]
    soil_region = img_array[int(height*0.7):, :]
    
    if len(soil_region) == 0:
        return 'moist'
    
    # Analyze soil color for moisture
    soil_brightness = np.mean(soil_region)
    
    # Simple heuristics for soil moisture
    if soil_brightness < 60:
        return 'wet'    # Dark soil indicates wetness
    elif soil_brightness > 140:
        return 'dry'    # Light soil indicates dryness
    else:
        return 'moist'  # Medium brightness indicates moist soil

def detect_weather_condition(img_array):
    """Detect weather condition based on image characteristics"""
    # Analyze overall brightness and color temperature
    brightness = np.mean(img_array)
    
    # Color temperature analysis
    red_channel = np.mean(img_array[:, :, 0])
    blue_channel = np.mean(img_array[:, :, 2])
    color_temp = red_channel / (blue_channel + 1e-8)
    
    # Simple heuristics for weather
    if brightness > 180:
        return 'sunny'
    elif brightness > 140:
        return 'partly_cloudy'
    elif brightness > 100:
        return 'cloudy'
    elif brightness < 80:
        return 'rainy'
    elif color_temp > 1.5:
        return 'hot'
    else:
        return 'cool'

def generate_demo_prediction(image_data):
    """Generate realistic demo predictions based on image characteristics"""
    # Simple heuristic: analyze image brightness and color distribution
    img_array = np.array(image_data)
    
    # Calculate average brightness
    if len(img_array.shape) == 3:
        brightness = np.mean(img_array)
    else:
        brightness = np.mean(img_array)
    
    # Calculate green channel dominance (for plant images)
    if len(img_array.shape) == 3 and img_array.shape[2] >= 3:
        green_ratio = np.mean(img_array[:, :, 1]) / (np.mean(img_array[:, :, 0]) + np.mean(img_array[:, :, 2]) + 1e-8)
    else:
        green_ratio = 0.5
    
    # Generate predictions based on image characteristics
    if brightness > 150 and green_ratio > 1.2:  # Bright and green = likely healthy
        prediction = np.array([0.7, 0.2, 0.1])  # High probability for healthy
    elif brightness < 100:  # Dark = likely late blight
        prediction = np.array([0.1, 0.2, 0.7])  # High probability for late blight
    else:  # Medium brightness = likely early blight
        prediction = np.array([0.2, 0.6, 0.2])  # High probability for early blight
    
    # Add some randomness
    prediction += np.random.normal(0, 0.05, 3)
    prediction = np.maximum(prediction, 0)  # Ensure non-negative
    prediction = prediction / np.sum(prediction)  # Normalize
    
    return prediction

def calculate_water_requirement(crop_type, soil_type, growth_stage, weather_condition, disease_status, soil_moisture):
    """Calculate water requirement based on multiple factors"""
    
    if crop_type not in water_requirements:
        return {
            'error': 'Crop type not found in database',
            'water_needed': 0
        }
    
    crop_data = water_requirements[crop_type]
    
    # Base water requirement
    base_water = crop_data['base_water']
    
    # Growth stage adjustment
    growth_multiplier = crop_data['growth_stages'].get(growth_stage, 1.0)
    
    # Soil type adjustment
    soil_multiplier = crop_data['soil_preferences'].get(soil_type, 1.0)
    
    # Weather adjustment
    weather_multiplier = weather_impact.get(weather_condition, 1.0)
    
    # Disease adjustment
    disease_data = disease_info.get(disease_status, {})
    disease_multiplier = disease_data.get('water_adjustment', 1.0)
    
    # Soil moisture adjustment (if soil is already wet, reduce water)
    moisture_adjustment = 1.0
    if soil_moisture == 'wet':
        moisture_adjustment = 0.3
    elif soil_moisture == 'moist':
        moisture_adjustment = 0.7
    elif soil_moisture == 'dry':
        moisture_adjustment = 1.3
    
    # Calculate final water requirement
    water_needed = base_water * growth_multiplier * soil_multiplier * weather_multiplier * disease_multiplier * moisture_adjustment
    
    # Round to 2 decimal places
    water_needed = round(water_needed, 2)
    
    return {
        'water_needed': water_needed,
        'base_water': base_water,
        'growth_multiplier': growth_multiplier,
        'soil_multiplier': soil_multiplier,
        'weather_multiplier': weather_multiplier,
        'disease_multiplier': disease_multiplier,
        'moisture_adjustment': moisture_adjustment,
        'recommendations': generate_water_recommendations(crop_type, water_needed, disease_status, soil_moisture),
        'detected_conditions': {
            'crop_type': crop_type,
            'growth_stage': growth_stage,
            'soil_type': soil_type,
            'weather_condition': weather_condition,
            'soil_moisture': soil_moisture
        }
    }

def generate_water_recommendations(crop_type, water_needed, disease_status, soil_moisture):
    """Generate specific watering recommendations"""
    recommendations = []
    
    # Base recommendations
    if water_needed > 2.0:
        recommendations.append("High water requirement - consider drip irrigation for efficiency")
    elif water_needed < 0.5:
        recommendations.append("Low water requirement - avoid overwatering")
    
    # Disease-specific recommendations
    if disease_status == 'Early Blight':
        recommendations.append("Reduce overhead watering to prevent fungal spread")
        recommendations.append("Water at the base of plants only")
    elif disease_status == 'Late Blight':
        recommendations.append("Minimize watering until disease is controlled")
        recommendations.append("Improve soil drainage immediately")
    
    # Soil moisture recommendations
    if soil_moisture == 'wet':
        recommendations.append("Soil is already wet - skip watering for now")
        recommendations.append("Check drainage to prevent root rot")
    elif soil_moisture == 'dry':
        recommendations.append("Soil is dry - water immediately")
        recommendations.append("Consider mulching to retain moisture")
    
    # Crop-specific recommendations
    if crop_type == 'rice':
        recommendations.append("Maintain flooded conditions as required for rice")
    elif crop_type in ['tomato', 'pepper']:
        recommendations.append("Water deeply but less frequently to encourage deep roots")
    
    return recommendations

@app.route('/predict', methods=['POST'])
def predict():
    if 'image' not in request.files:
        return jsonify({'error': 'No image uploaded'}), 400

    try:
        file = request.files['image']
        img = Image.open(io.BytesIO(file.read())).resize((128, 128))
        
        if model_available and model is not None:
            # Use real model prediction
            from tensorflow.keras.preprocessing.image import img_to_array # pyright: ignore[reportMissingImports]
            img_array = img_to_array(img) / 255.0
            img_array = np.expand_dims(img_array, axis=0)
            prediction = model.predict(img_array)[0]
        else:
            # Use demo prediction
            prediction = generate_demo_prediction(img)
        
        predicted_class = class_names[np.argmax(prediction)]
        confidence = float(np.max(prediction) * 100)
        
        # Get disease information
        disease_data = disease_info.get(predicted_class, {})
        
        # Get all class probabilities
        all_probabilities = {}
        for i, class_name in enumerate(class_names):
            all_probabilities[class_name] = float(prediction[i] * 100)

        response_data = {
            'prediction': predicted_class,
            'confidence': round(confidence, 2),
            'description': disease_data.get('description', ''),
            'recommendation': disease_data.get('recommendation', ''),
            'severity': disease_data.get('severity', ''),
            'color': disease_data.get('color', '#000000'),
            'all_probabilities': all_probabilities
        }
        
        # Add demo mode indicator if using demo predictions
        if not model_available:
            response_data['demo_mode'] = True
            response_data['note'] = 'Demo mode: Using simulated predictions. Upload a real model.h5 file for actual predictions.'

        return jsonify(response_data)
        
    except Exception as e:
        return jsonify({'error': f'Prediction failed: {str(e)}'}), 500

@app.route('/predict_water', methods=['POST'])
def predict_water():
    """Predict water requirements directly from image"""
    if 'image' not in request.files:
        return jsonify({'error': 'No image uploaded'}), 400

    try:
        file = request.files['image']
        img = Image.open(io.BytesIO(file.read())).resize((256, 256))
        
        # Analyze image for water prediction
        image_analysis = analyze_image_for_water_prediction(img)
        
        # Get disease prediction
        if model_available and model is not None:
            from tensorflow.keras.preprocessing.image import img_to_array # pyright: ignore[reportMissingImports]
            img_array = img_to_array(img) / 255.0
            img_array = np.expand_dims(img_array, axis=0)
            prediction = model.predict(img_array)[0]
            predicted_class = class_names[np.argmax(prediction)]
        else:
            prediction = generate_demo_prediction(img)
            predicted_class = class_names[np.argmax(prediction)]
        
        # Update disease status in analysis
        image_analysis['disease_status'] = predicted_class
        
        # Calculate water requirement
        result = calculate_water_requirement(
            image_analysis['crop_type'],
            image_analysis['soil_type'],
            image_analysis['growth_stage'],
            image_analysis['weather_condition'],
            image_analysis['disease_status'],
            image_analysis['soil_moisture']
        )
        
        if 'error' in result:
            return jsonify(result), 400
        
        # Add image analysis results
        result['image_analysis'] = image_analysis
        result['timestamp'] = datetime.now().isoformat()
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'error': f'Water prediction failed: {str(e)}'}), 500

@app.route('/calculate_water', methods=['POST'])
def calculate_water():
    """Calculate water requirements based on multiple factors"""
    try:
        data = request.get_json()
        
        # Extract parameters
        crop_type = data.get('crop_type', '').lower()
        soil_type = data.get('soil_type', 'loamy')
        growth_stage = data.get('growth_stage', 'vegetative')
        weather_condition = data.get('weather_condition', 'sunny')
        disease_status = data.get('disease_status', 'Healthy')
        soil_moisture = data.get('soil_moisture', 'moist')
        
        # Calculate water requirement
        result = calculate_water_requirement(
            crop_type, soil_type, growth_stage, 
            weather_condition, disease_status, soil_moisture
        )
        
        if 'error' in result:
            return jsonify(result), 400
        
        # Add additional information
        result['timestamp'] = datetime.now().isoformat()
        result['parameters'] = {
            'crop_type': crop_type,
            'soil_type': soil_type,
            'growth_stage': growth_stage,
            'weather_condition': weather_condition,
            'disease_status': disease_status,
            'soil_moisture': soil_moisture
        }
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'error': f'Water calculation failed: {str(e)}'}), 500

@app.route('/get_crops', methods=['GET'])
def get_crops():
    """Get list of available crops for water calculation"""
    return jsonify({
        'crops': list(water_requirements.keys()),
        'soil_types': ['sandy', 'loamy', 'clay'],
        'growth_stages': ['seedling', 'vegetative', 'flowering', 'fruiting', 'mature'],
        'weather_conditions': list(weather_impact.keys()),
        'soil_moisture_levels': ['dry', 'moist', 'wet']
    })

@app.route('/test', methods=['GET'])
def test():
    return jsonify({
        'message': 'Flask server is running!',
        'model_available': model_available,
        'status': 'ready'
    })

@app.route('/', methods=['GET'])
def home():
    return jsonify({
        'message': 'Plant Disease Detection API',
        'model_available': model_available,
        'endpoints': {
            'test': '/test',
            'predict': '/predict (POST)',
            'predict_water': '/predict_water (POST)',
            'calculate_water': '/calculate_water (POST)',
            'get_crops': '/get_crops (GET)'
        }
    })

if __name__ == '__main__':
    print("🚀 Starting Plant Disease Detection Server...")
    print(f"📊 Model Status: {'✅ Available' if model_available else '⚠️  Demo Mode'}")
    print("🌐 Server will be available at: http://localhost:5000")
    app.run(debug=True, host='0.0.0.0', port=5000)