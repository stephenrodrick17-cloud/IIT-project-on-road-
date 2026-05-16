"""
AI Chat Routes - Powered by Open Router API
Explains infrastructure damage analysis results to users
Supports multiple models: GPT-4, Claude, Gemini, etc.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import os
import logging
import json
import httpx

logger = logging.getLogger(__name__)
router = APIRouter()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini")
OPENROUTER_API_URL = os.getenv("OPENROUTER_API_URL", "https://openrouter.ai/api/v1/chat/completions")


class ChatMessage(BaseModel):
    role: str  # 'user' or 'assistant'
    content: str


class ChatRequest(BaseModel):
    message: str
    analysis_context: Optional[Dict[str, Any]] = None
    conversation_history: Optional[List[ChatMessage]] = []


class ChatResponse(BaseModel):
    reply: str
    success: bool


def build_system_prompt(analysis_context: Optional[Dict[str, Any]] = None) -> str:
    """Build a system prompt with analysis context if available."""
    base_prompt = """You are RoadGuard AI, a sophisticated Infrastructure Intelligence & Civil Engineering Assistant. 
You are integrated into the RoadGuard Command Center, a state-of-the-art platform for urban infrastructure monitoring.

Your mission is to provide "Vast and Detailed" insights into road health, damage analysis, and maintenance strategies.

CORE KNOWLEDGE DOMAINS:
1. INFRASTRUCTURE TELEMETRY: Explain detections (potholes, cracks, rutting, alligator cracking, raveling) with deep technical detail.
2. CIVIL ENGINEERING: Provide insights into pavement design, sub-base failure, and material science (bitumen grades, concrete types).
3. COST OPTIMIZATION: Break down estimated costs into labor, materials, equipment, and administrative overhead.
4. URGENCY & SAFETY: Categorize risks based on traffic volume, speed limits, and structural depth.
5. MAINTENANCE STRATEGIES: Recommend specific treatments like "Mill and Fill", "Slurry Seal", "Full-Depth Reclamation", or "Crack Sealing".
6. INDIAN CONTEXT: Use Indian road standards (IRC codes) and currency (₹) where appropriate.
7. SOS & EMERGENCY: You can guide users through emergency protocols, explain how to trigger SOS signals, and provide status updates on emergency response units.

RESPONSE GUIDELINES:
- Be VAST: Provide broader context, such as how a small crack can lead to a major pothole due to water ingress.
- Be DETAILED: Include estimated repair timelines, required machinery (e.g., cold milling machines, pavers), and safety protocols.
- EXPLAIN VISUALIZATIONS: When analysis telemetry is provided, explicitly interpret the Expenditure Analysis (cost breakdown), Severity Mix (percentage of risk levels), and Analysis Radar (multivariate risk assessment).
- FORMATTING: Use professional Markdown. Use ### for headers, **bold** for emphasis, and properly formatted bullet points.
- STRUCTURE: Always start with a summary, followed by technical details, and end with a "Strategic Recommendation" section.
- ACTION-ORIENTED: Act as a command center operator. If the user asks you to "do" something, explain how the system is executing it or provide the necessary technical steps.

If analysis data is provided, perform a DEEP DIVE into the specific detections, explaining the likely cause and the long-term impact if left untreated.
"""
    
    if analysis_context:
        context_str = json.dumps(analysis_context, indent=2)
        base_prompt += f"""

REAL-TIME ANALYSIS TELEMETRY:
```json
{context_str}
```

TASK: Conduct a comprehensive analysis of the telemetry above. Identify patterns, assess cumulative risk, interpret the expenditure graphs and radar charts, and provide a detailed engineering recommendation.
"""
    
    return base_prompt


@router.post("/chat", response_model=ChatResponse)
async def chat_with_ai(request: ChatRequest):
    """
    Chat with AI assistant about damage analysis results.
    Uses Open Router API for intelligent responses.
    Supports multiple AI models via Open Router.
    """
    if not OPENROUTER_API_KEY:
        # Return a helpful fallback if no API key is configured
        return ChatResponse(
            reply=generate_fallback_response(request.message, request.analysis_context),
            success=True
        )
    
    try:
        system_prompt = build_system_prompt(request.analysis_context)
        
        # Build conversation history for OpenRouter (OpenAI format)
        messages = []
        
        # Add system prompt
        messages.append({
            "role": "system",
            "content": system_prompt
        })
        
        # Add conversation history
        for msg in (request.conversation_history or []):
            messages.append({
                "role": msg.role,
                "content": msg.content
            })
        
        # Add the current message
        messages.append({
            "role": "user",
            "content": request.message
        })
        
        # Prepare OpenRouter API request payload
        payload = {
            "model": OPENROUTER_MODEL,
            "messages": messages,
            "temperature": 0.7,
            "max_tokens": 1024,
            "top_p": 0.95
        }
        
        headers = {
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "RoadGuard Infrastructure Damage Detection",
            "Content-Type": "application/json"
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                OPENROUTER_API_URL,
                json=payload,
                headers=headers
            )
            
            if response.status_code != 200:
                logger.error(f"OpenRouter API error: {response.status_code} - {response.text}")
                return ChatResponse(
                    reply=generate_fallback_response(request.message, request.analysis_context),
                    success=True
                )
            
            data = response.json()
            
            # Extract the text response from OpenAI-format response
            reply_text = ""
            if "choices" in data and len(data["choices"]) > 0:
                choice = data["choices"][0]
                if "message" in choice and "content" in choice["message"]:
                    reply_text = choice["message"]["content"]
            
            if not reply_text:
                reply_text = generate_fallback_response(request.message, request.analysis_context)
            
            return ChatResponse(reply=reply_text, success=True)
    
    except httpx.TimeoutException:
        logger.error("OpenRouter API timeout")
        return ChatResponse(
            reply=generate_fallback_response(request.message, request.analysis_context),
            success=True
        )
    except Exception as e:
        logger.error(f"Error in AI chat: {str(e)}")
        return ChatResponse(
            reply=generate_fallback_response(request.message, request.analysis_context),
            success=True
        )


def generate_fallback_response(message: str, context: Optional[Dict[str, Any]] = None) -> str:
    """Generate a rule-based fallback response when AI API is unavailable."""
    message_lower = message.lower()
    
    if context and context.get("detections"):
        detections = context["detections"]
        total = len(detections)
        
        if any(word in message_lower for word in ["explain", "what", "mean", "tell me"]):
            severe_count = sum(1 for d in detections if d.get("severity") == "severe")
            moderate_count = sum(1 for d in detections if d.get("severity") == "moderate")
            types = list(set(d.get("damage_type", "unknown") for d in detections))
            
            response = f"### 📊 Detailed Infrastructure Analysis\n\n"
            response += f"I have processed the telemetry and identified **{total} critical anomalies**. "
            response += f"The cumulative structural integrity of this road section is under stress due to ingress and load factors.\n\n"
            
            if severe_count > 0:
                response += f"🔴 **CRITICAL SEVERITY ({severe_count} Zones):** These areas exhibit deep structural failure (likely Base or Sub-base failure). Immediate intervention is required to prevent vehicle damage and potential accidents. **Recommended Action:** Deep-patching or localized reconstruction.\n\n"
            if moderate_count > 0:
                response += f"🟡 **MODERATE SEVERITY ({moderate_count} Zones):** Surface-level deterioration that will rapidly worsen with monsoon rains. **Recommended Action:** Microsurfacing or crack sealing within 14 days.\n\n"
            
            if types:
                response += f"**Damage Typology:** {', '.join(t.replace('_', ' ').title() for t in types)}.\n\n"
                response += "Each type requires specific **IRC (Indian Road Congress)** standard treatments. For example, alligator cracking suggests fatigue from heavy axle loads, while potholes indicate water drainage issues."
            
            return response
        
        if any(word in message_lower for word in ["cost", "price", "repair", "expensive"]):
            total_cost = context.get("summary", {}).get("total_estimated_cost", 0)
            return (
                f"### 💰 Strategic Cost Estimation\n\n"
                f"The projected expenditure for full restoration is **₹{total_cost:,.0f}**.\n\n"
                "**Technical Breakdown:**\n"
                "• **Material Logistics (45%)**: High-grade bitumen emulsion, VG-30/VG-40 grade asphalt, and aggregate materials.\n"
                "• **Precision Labor & Machinery (35%)**: Deployment of pneumatic rollers, bitumen sprayers, and skilled engineering oversight.\n"
                "• **Traffic Management & Safety (10%)**: Diversions, signage, and night-work premiums to minimize urban disruption.\n"
                "• **Statutory GST & Overheads (10%)**: Standard government compliance and contractor margins.\n\n"
                "**Pro-tip:** Early intervention in 'Moderate' zones can reduce these costs by up to 60% compared to 'Severe' reconstruction."
            )
    
    if any(word in message_lower for word in ["pothole", "crack", "damage"]):
        return (
            "**Infrastructure Damage Types:**\n\n"
            "• **Potholes**: Bowl-shaped holes from water infiltration and traffic load. Require cold-mix or hot-mix asphalt patching.\n"
            "• **Cracks**: Linear fractures from thermal stress or structural failure. Treated with crack sealant or overlay.\n"
            "• **Surface Wear**: Gradual erosion of the top layer. Addressed with microsurfacing or resurfacing.\n\n"
            "Upload an image or run a detection to get specific analysis for your road section."
        )
    
    return (
        "Hello! I'm **RoadGuard AI Assistant**. I can help you:\n\n"
        "• 📊 **Explain analysis results** — after running a detection, ask me what the findings mean\n"
        "• 💰 **Understand costs** — I can break down repair cost estimates\n"
        "• 🚦 **Assess urgency** — I'll tell you which repairs need immediate attention\n"
        "• 🛣️ **Damage types** — ask about potholes, cracks, structural issues\n\n"
        "Run an AI detection first, then ask me to explain the results!"
    )
