"""
Detection Routes
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Form
from fastapi.responses import FileResponse
import os
import logging
from typing import Optional
from datetime import datetime
import shutil
import json

from app.schemas import DetectionRequest, DamageReportResponse
from app.services.detection import DamageDetectionService
from app.services.cost_estimation import CostEstimationService
from database.database import SessionLocal, get_db
from database.models import DamageReport
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)
router = APIRouter()

# Initialize detection service
detection_service = DamageDetectionService()

# Create uploads directory
IS_VERCEL = os.getenv("VERCEL") == "1"
UPLOAD_DIR = "/tmp/uploads" if IS_VERCEL else "uploads"
try:
    os.makedirs(UPLOAD_DIR, exist_ok=True)
except Exception as e:
    logger.warning(f"Could not create uploads directory: {e}")
    UPLOAD_DIR = "/tmp"

@router.post("/test-upload")
async def test_upload(
    file: Optional[UploadFile] = File(None),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    road_type: Optional[str] = Form(None)
):
    """Test endpoint to verify form data reception"""
    try:
        result = {
            "success": True,
            "file_received": file is not None,
            "file_name": file.filename if file else None,
            "file_size": file.size if file else None,
            "file_content_type": file.content_type if file else None,
            "latitude_received": latitude is not None,
            "latitude_value": latitude,
            "longitude_received": longitude is not None,
            "longitude_value": longitude,
            "road_type_received": road_type is not None,
            "road_type_value": road_type,
            "message": "Test upload successful"
        }
        logger.info(f"Test upload result: {result}")
        return result
    except Exception as e:
        logger.error(f"Error in test_upload: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Test failed: {str(e)}")

@router.post("/detect")
async def detect_damage(
    file: UploadFile = File(...),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    location_address: Optional[str] = Form(None),
    road_type: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Upload image and detect infrastructure damage
    
    Args:
        file: Image file
        latitude: GPS latitude (optional)
        longitude: GPS longitude (optional)
        location_address: Location address (optional)
        road_type: Type of road (optional)
        db: Database session (injected)
        
    Returns:
        Detection results with bounding boxes and severity
    """
    try:
        # Save uploaded file
        file_path = os.path.join(UPLOAD_DIR, f"{datetime.utcnow().timestamp()}_{file.filename}")
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        logger.info(f"Image saved to {file_path}")
        
        # Run detection
        detection_result = detection_service.detect_damage(file_path, conf=0.5)
        
        if not detection_result["success"]:
            raise HTTPException(
                status_code=400,
                detail=f"Detection failed: {detection_result.get('error', 'Unknown error')}"
            )
        
        # Process detections and calculate costs
        processed_detections = []
        for detection in detection_result["detections"]:
            # Calculate damage area in square meters (assuming 1 pixel ≈ 0.01 cm²)
            damage_area = (detection["area_percentage"] / 100) * 25  # Assume 5m x 5m area = 25 m²
            
            # Estimate cost
            cost_result = CostEstimationService.estimate_cost(
                damage_area=damage_area,
                damage_type=detection["damage_type"],
                severity=detection["severity"],
                road_type=road_type or 'unknown'
            )
            
            processed_detections.append({
                **detection,
                "damage_area_m2": damage_area,
                "cost_estimation": cost_result
            })
        
        # Save to database
        try:
            # Take the most severe detection as primary
            if processed_detections:
                primary = max(processed_detections, key=lambda x: {
                    "severe": 3,
                    "moderate": 2,
                    "minor": 1
                }.get(x["severity"], 0))
                
                damage_report = DamageReport(
                    image_path=file_path,
                    latitude=latitude,
                    longitude=longitude,
                    location_address=location_address,
                    damage_type=primary["damage_type"],
                    severity=primary["severity"],
                    confidence_score=primary["confidence"],
                    bounding_boxes=json.dumps(primary["bbox"]),
                    damage_area=primary["damage_area_m2"],
                    road_type=road_type,
                    estimated_cost=primary["cost_estimation"]["material_cost"],
                    labor_cost=primary["cost_estimation"]["labor_cost"],
                    total_cost=primary["cost_estimation"]["total_cost"],
                    status="reported"
                )
                
                db.add(damage_report)
                db.commit()
                db.refresh(damage_report)
                
                logger.info(f"Damage report saved with ID {damage_report.id}")
            else:
                # No damage detected
                damage_report = DamageReport(
                    image_path=file_path,
                    latitude=latitude,
                    longitude=longitude,
                    location_address=location_address,
                    damage_type="none",
                    severity="none",
                    confidence_score=0,
                    status="no_damage"
                )
                
                db.add(damage_report)
                db.commit()
                db.refresh(damage_report)
        finally:
            db.close()
        
        return {
            "success": True,
            "report_id": damage_report.id,
            "detections": processed_detections,
            "annotated_image_url": f"http://localhost:8000/api/detection/image/{os.path.basename(detection_result['annotated_image_path'])}",
            "summary": {
                "total_damage_areas": len(processed_detections),
                "max_severity": max([d["severity"] for d in processed_detections], default="none"),
                "total_estimated_cost": sum([d["cost_estimation"]["total_cost"] for d in processed_detections])
            }
        }
    
    except Exception as e:
        logger.error(f"Error in detect_damage: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Detection processing failed: {str(e)}")

@router.post("/detect-video")
async def detect_damage_video(
    file: UploadFile = File(...),
    frame_interval: int = 30
):
    """
    Upload video and detect infrastructure damage at intervals
    
    Args:
        file: Video file
        frame_interval: Process every N-th frame
        
    Returns:
        Summary of detections throughout the video
    """
    try:
        # Save uploaded file
        file_path = os.path.join(UPLOAD_DIR, f"{datetime.utcnow().timestamp()}_{file.filename}")
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        logger.info(f"Video saved to {file_path}")
        
        # Run video detection
        video_result = detection_service.detect_video(file_path, conf=0.5, frame_interval=frame_interval)
        
        if not video_result["success"]:
            raise HTTPException(
                status_code=400,
                detail=f"Video detection failed: {video_result.get('error', 'Unknown error')}"
            )
            
        return video_result
        
    except Exception as e:
        logger.error(f"Error in detect_damage_video: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/detect-frame")
async def detect_damage_frame(
    file: UploadFile = File(...),
    conf: float = 0.5
):
    """
    Detect damage from a single frame (used for real-time streaming)
    """
    try:
        # Save frame temporarily
        temp_path = os.path.join(UPLOAD_DIR, f"temp_frame_{datetime.utcnow().timestamp()}.jpg")
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Run detection
        result = detection_service.detect_damage(temp_path, conf=conf)
        
        # Clean up temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)
            
        return result
    except Exception as e:
        logger.error(f"Error in detect_damage_frame: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/image/{filename}")
async def get_detection_image(filename: str):
    """
    Get uploaded or annotated image by filename
    """
    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(file_path)

@router.get("/report/{report_id}")
async def get_damage_report(report_id: int, db: Session = Depends(get_db)):
    """
    Get damage report by ID
    
    Args:
        report_id: Report ID
        db: Database session (injected)
        
    Returns:
        Damage report details
    """
    report = db.query(DamageReport).filter(DamageReport.id == report_id).first()
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    return DamageReportResponse.model_validate(report)

@router.get("/report/{report_id}/image")
async def get_report_image(report_id: int, db: Session = Depends(get_db)):
    """
    Get image from damage report
    
    Args:
        report_id: Report ID
        db: Database session (injected)
        
    Returns:
        Image file
    """
    report = db.query(DamageReport).filter(DamageReport.id == report_id).first()
    
    if not report or not os.path.exists(report.image_path):
        raise HTTPException(status_code=404, detail="Image not found")
    
    return FileResponse(report.image_path)

@router.get("/report/{report_id}/annotated")
async def get_annotated_image(report_id: int, db: Session = Depends(get_db)):
    """
    Get annotated image with detection boxes
    
    Args:
        report_id: Report ID
        db: Database session (injected)
        
    Returns:
        Annotated image
    """
    report = db.query(DamageReport).filter(DamageReport.id == report_id).first()
    
    if not report or not os.path.exists(report.image_path):
        raise HTTPException(status_code=404, detail="Report or image not found")
    
    # Create annotated image
    output_path = os.path.join(UPLOAD_DIR, f"annotated_{report_id}.jpg")
    success = detection_service.visualize_detections(report.image_path, output_path)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to create annotated image")
    
    return FileResponse(output_path)

@router.get("/reports/recent")
async def get_recent_reports(limit: int = 10, db: Session = Depends(get_db)):
    """
    Get recent damage reports
    
    Args:
        limit: Number of reports to return
        db: Database session (injected)
        
    Returns:
        List of recent reports
    """
    reports = db.query(DamageReport).order_by(
        DamageReport.created_at.desc()
    ).limit(limit).all()
    
    return [DamageReportResponse.model_validate(r) for r in reports]

@router.get("/stats")
async def get_detection_statistics(db: Session = Depends(get_db)):
    """
    Get detection statistics
    
    Args:
        db: Database session (injected)
    
    Returns:
        Statistics about detected damages
    """
    reports = db.query(DamageReport).all()
    total_reports = len(reports)
    
    severity_counts = {}
    type_counts = {}
    confidence_scores = []
    alerts_sent_count = 0
    
    for report in reports:
        # Severity distribution
        severity = report.severity
        severity_counts[severity] = severity_counts.get(severity, 0) + 1
        
        # Type distribution
        dtype = report.damage_type
        type_counts[dtype] = type_counts.get(dtype, 0) + 1
        
        # Confidence tracking
        if report.confidence_score:
            confidence_scores.append(report.confidence_score)
        
        # Alerts tracking
        if report.alert_sent:
            alerts_sent_count += 1
    
    avg_confidence = sum(confidence_scores) / len(confidence_scores) if confidence_scores else 0.0
    
    return {
        "total_reports": total_reports,
        "by_severity": severity_counts,
        "by_type": type_counts,
        "avg_confidence": round(avg_confidence, 3),
        "alerts_sent": alerts_sent_count
    }
