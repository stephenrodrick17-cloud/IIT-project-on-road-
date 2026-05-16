/**
 * Location Data Service
 * Fetches roads, hospitals, police stations data using Open Router API
 */

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_API_KEY = process.env.REACT_APP_OPENROUTER_KEY || "";

/**
 * Get location-based infrastructure data using AI
 */
export const getLocationData = async (latitude, longitude, radius = 5) => {
  try {
    const messages = [
      {
        role: "system",
        content:
          "You are a location data assistant. Provide JSON data about nearby roads, hospitals, and police stations. Always respond with valid JSON only.",
      },
      {
        role: "user",
        content: `Get nearby infrastructure data for coordinates (${latitude}, ${longitude}) within ${radius}km radius. Return JSON with this structure:
{
  "roads": [{"name": "", "condition": "good/fair/poor", "priority": 1-10, "location": {"lat": 0, "lng": 0}}],
  "hospitals": [{"name": "", "distance_km": 0, "location": {"lat": 0, "lng": 0}}],
  "police_stations": [{"name": "", "distance_km": 0, "location": {"lat": 0, "lng": 0}}]
}`,
      },
    ];

    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": window.location.href,
        "X-Title": "RoadGuard Location Data",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages,
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) throw new Error("Failed to fetch location data");

    const data = await response.json();
    const content = data.choices[0]?.message?.content || "{}";

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : getDefaultLocationData();
  } catch (error) {
    console.error("Error fetching location data:", error);
    return getDefaultLocationData();
  }
};

/**
 * Get road condition analysis
 */
export const getRoadAnalysis = async (roadName, damageData) => {
  try {
    const messages = [
      {
        role: "system",
        content:
          "You are a road infrastructure expert. Analyze road conditions and provide detailed recommendations.",
      },
      {
        role: "user",
        content: `Analyze the road "${roadName}" with this damage data: ${JSON.stringify(
          damageData
        )}. Provide a detailed analysis in JSON format:
{
  "overall_condition": "good/fair/poor/critical",
  "risk_level": 1-10,
  "recommended_repairs": [],
  "estimated_cost": 0,
  "urgency": "low/medium/high/critical",
  "safety_concerns": []
}`,
      },
    ];

    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": window.location.href,
        "X-Title": "RoadGuard Analysis",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages,
        temperature: 0.7,
        max_tokens: 800,
      }),
    });

    if (!response.ok) throw new Error("Failed to fetch analysis");

    const data = await response.json();
    const content = data.choices[0]?.message?.content || "{}";

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : getDefaultAnalysis();
  } catch (error) {
    console.error("Error fetching analysis:", error);
    return getDefaultAnalysis();
  }
};

/**
 * Get emergency response recommendations
 */
export const getEmergencyResponse = async (damageType, severity, location) => {
  try {
    const messages = [
      {
        role: "system",
        content:
          "You are an emergency response coordinator for road infrastructure damage. Provide emergency response recommendations.",
      },
      {
        role: "user",
        content: `An emergency situation: ${damageType} with severity ${severity} at location ${location}. 
Recommend immediate actions in JSON format:
{
  "response_type": "critical/urgent/important",
  "immediate_actions": [],
  "agencies_to_contact": [],
  "evacuation_needed": true/false,
  "time_to_response": "minutes",
  "estimated_recovery_time": "hours/days"
}`,
      },
    ];

    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": window.location.href,
        "X-Title": "RoadGuard Emergency",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages,
        temperature: 0.7,
        max_tokens: 600,
      }),
    });

    if (!response.ok) throw new Error("Failed to fetch emergency response");

    const data = await response.json();
    const content = data.choices[0]?.message?.content || "{}";

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : getDefaultEmergencyResponse();
  } catch (error) {
    console.error("Error fetching emergency response:", error);
    return getDefaultEmergencyResponse();
  }
};

// Default data functions
function getDefaultLocationData() {
  return {
    roads: [
      {
        name: "Main Street",
        condition: "fair",
        priority: 7,
        location: { lat: 28.7041, lng: 77.1025 },
      },
      {
        name: "Airport Road",
        condition: "poor",
        priority: 9,
        location: { lat: 28.5355, lng: 77.1073 },
      },
    ],
    hospitals: [
      {
        name: "Apollo Hospital",
        distance_km: 2.5,
        location: { lat: 28.5244, lng: 77.0855 },
      },
      {
        name: "Max Healthcare",
        distance_km: 3.2,
        location: { lat: 28.6129, lng: 77.0997 },
      },
    ],
    police_stations: [
      {
        name: "Central Police Station",
        distance_km: 1.8,
        location: { lat: 28.6309, lng: 77.2197 },
      },
      {
        name: "Traffic Police Unit",
        distance_km: 2.1,
        location: { lat: 28.5821, lng: 77.1773 },
      },
    ],
  };
}

function getDefaultAnalysis() {
  return {
    overall_condition: "fair",
    risk_level: 6,
    recommended_repairs: ["Pothole repair", "Surface treatment"],
    estimated_cost: 50000,
    urgency: "medium",
    safety_concerns: ["Water accumulation", "Traffic hazards"],
  };
}

function getDefaultEmergencyResponse() {
  return {
    response_type: "urgent",
    immediate_actions: ["Cordone off area", "Alert traffic control"],
    agencies_to_contact: ["Police", "Traffic Department", "Emergency Services"],
    evacuation_needed: false,
    time_to_response: "15-20",
    estimated_recovery_time: "2-3 days",
  };
}

const locationDataService = {
  getLocationData,
  getRoadAnalysis,
  getEmergencyResponse,
};

export default locationDataService;
