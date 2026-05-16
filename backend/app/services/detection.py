"""
YOLOv8 Model Service for infrastructure damage detection
"""

import cv2
import numpy as np
try:
    from ultralytics import YOLO
    HAS_ULTRALYTICS = True
except ImportError:
    HAS_ULTRALYTICS = False
    
import os
from typing import List, Tuple, Dict, Any
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

class DamageDetectionService:
    """Service for detecting infrastructure damage using YOLOv8"""
    
    def __init__(self, model_path: str = None):
        """
        Initialize detection service
        
        Args:
            model_path: Path to pre-trained YOLOv8 model
        """
        self.model_path = model_path
        self.model = None
        self.confidence_threshold = 0.5
        self.load_model()
    
    def load_model(self):
        """Load YOLOv8 model"""
        if not HAS_ULTRALYTICS:
            logger.warning("Ultralytics not installed. Detection will run in Cloud Mock Mode (Vercel Optimized).")
            self.model = None
            return

        try:
            if self.model_path is None:
                # Local config might not be available on Vercel
                try:
                    from config.settings import MODEL_PATH
                    self.model_path = MODEL_PATH
                except ImportError:
                    self.model_path = "model/trained_models/infrastructure_damage/weights/best.pt"

            logger.info(f"Loading model from {self.model_path}")
            if os.path.exists(self.model_path):
                self.model = YOLO(self.model_path)
                logger.info("Model loaded successfully")
            else:
                logger.warning(f"Model file not found at {self.model_path}. Running in mock mode.")
                self.model = None
        except Exception as e:
            logger.error(f"Error loading model: {str(e)}")
            self.model = None
    
    def detect_damage(self, image_path: str, conf: float = 0.5) -> Dict[str, Any]:
        """
        Detect damage in image
        """
        # Proactively try to load model if it wasn't loaded before
        if self.model is None:
            self.load_model()
            
        try:
            # Read image
            image = cv2.imread(image_path)
            if image is None:
                raise ValueError(f"Could not read image from {image_path}")
            
            annotated_image = image.copy()
            
            # Run inference
            if self.model is None:
                # Mock detection for demonstration if model is not found
                logger.warning("Running mock detection as model is not loaded")
                import time
                import random
                
                # Create a few mock detections based on image size
                h, w, _ = image.shape
                mock_detections = []
                
                # Only "detect" something if it's not a tiny image
                if h > 100 and w > 100:
                    damage_types = ["pothole", "crack", "alligator_cracking", "rutting"]
                    severities = ["minor", "moderate", "severe"]
                    
                    num_detections = random.randint(1, 3)
                    for i in range(num_detections):
                        dw, dh = random.randint(50, w//2), random.randint(50, h//2)
                        dx, dy = random.randint(0, w-dw), random.randint(0, h-dh)
                        
                        damage_type = random.choice(damage_types)
                        severity = random.choice(severities)
                        confidence = random.uniform(0.7, 0.95)
                        
                        mock_detections.append({
                            "damage_type": damage_type,
                            "confidence": confidence,
                            "bbox": {
                                "x1": float(dx),
                                "y1": float(dy),
                                "x2": float(dx+dw),
                                "y2": float(dy+dh)
                            },
                            "severity": severity,
                            "area_percentage": (dw*dh)/(w*h) * 100
                        })
                        
                        # Draw mock bounding box on annotated image
                        color = (0, 0, 255) if severity == "severe" else (0, 165, 255) if severity == "moderate" else (0, 255, 0)
                        cv2.rectangle(annotated_image, (dx, dy), (dx+dw, dy+dh), color, 3)
                        label = f"{damage_type} ({confidence:.2f})"
                        cv2.putText(annotated_image, label, (dx, dy-10), cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)
                
                # Save annotated image
                annotated_path = image_path.replace(".jpg", "_annotated.jpg").replace(".png", "_annotated.png")
                cv2.imwrite(annotated_path, annotated_image)
                
                return {
                    "success": True,
                    "detections": mock_detections,
                    "image_shape": image.shape,
                    "annotated_image_path": annotated_path,
                    "model_name": "mock_mode"
                }

            results = self.model(image, conf=conf, verbose=False)
            
            # Process results
            detections = self._process_results(results[0], image)
            
            # Draw bounding boxes for real model results
            for det in detections:
                bbox = det["bbox"]
                x1, y1, x2, y2 = int(bbox["x1"]), int(bbox["y1"]), int(bbox["x2"]), int(bbox["y2"])
                color = (0, 0, 255) if det["severity"] == "severe" else (0, 165, 255) if det["severity"] == "moderate" else (0, 255, 0)
                cv2.rectangle(annotated_image, (x1, y1), (x2, y2), color, 3)
                label = f"{det['damage_type']} ({det['confidence']:.2f})"
                cv2.putText(annotated_image, label, (x1, y1-10), cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)
            
            # Save annotated image
            annotated_path = image_path.replace(".jpg", "_annotated.jpg").replace(".png", "_annotated.png")
            cv2.imwrite(annotated_path, annotated_image)
            
            return {
                "success": True,
                "detections": detections,
                "image_shape": image.shape,
                "annotated_image_path": annotated_path,
                "model_name": self.model_path
            }
        except Exception as e:
            logger.error(f"Error detecting damage: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "detections": []
            }
    
    def detect_from_frame(self, frame: np.ndarray, conf: float = 0.5) -> Dict[str, Any]:
        """
        Detect damage in video frame
        
        Args:
            frame: Image frame as numpy array
            conf: Confidence threshold
            
        Returns:
            Dictionary with detection results
        """
        try:
            if self.model is None:
                return {
                    "success": True,
                    "detections": [],
                    "image_shape": frame.shape,
                    "model_name": "mock"
                }

            results = self.model(frame, conf=conf, verbose=False)
            detections = self._process_results(results[0], frame)
            
            return {
                "success": True,
                "detections": detections,
                "image_shape": frame.shape,
                "model_name": self.model_path
            }
        except Exception as e:
            logger.error(f"Error detecting from frame: {str(e)}")
            return {"success": False, "error": str(e), "detections": []}

    def detect_video(self, video_path: str, conf: float = 0.5, frame_interval: int = 10) -> Dict[str, Any]:
        """
        Detect damage in video file
        
        Args:
            video_path: Path to video file
            conf: Confidence threshold
            frame_interval: Process every N-th frame
            
        Returns:
            Summary of detections throughout the video
        """
        try:
            cap = cv2.VideoCapture(video_path)
            if not cap.isOpened():
                raise ValueError(f"Could not open video file {video_path}")

            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            fps = cap.get(cv2.CAP_PROP_FPS)
            duration = total_frames / fps if fps > 0 else 0

            all_detections = []
            frame_count = 0
            processed_count = 0

            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break

                if frame_count % frame_interval == 0:
                    detection_result = self.detect_from_frame(frame, conf=conf)
                    if detection_result["success"]:
                        timestamp = frame_count / fps if fps > 0 else 0
                        for det in detection_result["detections"]:
                            det["timestamp"] = timestamp
                            all_detections.append(det)
                        processed_count += 1
                
                frame_count += 1

            cap.release()

            # Group detections by type and severity for summary
            summary = {
                "total_detections": len(all_detections),
                "processed_frames": processed_count,
                "video_duration": duration,
                "by_type": {},
                "by_severity": {}
            }

            for det in all_detections:
                dtype = det["damage_type"]
                severity = det["severity"]
                summary["by_type"][dtype] = summary["by_type"].get(dtype, 0) + 1
                summary["by_severity"][severity] = summary["by_severity"].get(severity, 0) + 1

            return {
                "success": True,
                "detections": all_detections,
                "summary": summary
            }
        except Exception as e:
            logger.error(f"Error detecting in video: {str(e)}")
            return {"success": False, "error": str(e)}
    
    def _process_results(self, result, image: np.ndarray) -> List[Dict[str, Any]]:
        """
        Process YOLO results
        
        Args:
            result: YOLO result object
            image: Original image
            
        Returns:
            List of processed detections
        """
        detections = []
        
        if result.boxes is None:
            return detections
        
        for i, box in enumerate(result.boxes):
            # Extract coordinates
            x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
            confidence = float(box.conf[0])
            class_id = int(box.cls[0])
            
            # Clip coordinates to image bounds
            h, w = image.shape[:2]
            x1 = max(0, min(x1, w))
            y1 = max(0, min(y1, h))
            x2 = max(0, min(x2, w))
            y2 = max(0, min(y2, h))
            
            # Skip if bounding box is invalid (no area)
            if x2 <= x1 or y2 <= y1:
                logger.warning(f"Invalid bounding box after clipping: ({x1}, {y1}, {x2}, {y2})")
                continue
            
            # Calculate damage area (in pixels, normalized)
            area = (x2 - x1) * (y2 - y1)
            total_pixels = image.shape[0] * image.shape[1]
            area_percentage = (area / total_pixels) * 100
            
            # Classify damage type and severity
            damage_type, severity = self._classify_damage(
                area_percentage, confidence, class_id
            )
            
            # Crop damage region for further analysis
            x1_int, y1_int = int(x1), int(y1)
            x2_int, y2_int = int(x2), int(y2)
            
            damage_region = image[y1_int:y2_int, x1_int:x2_int]
            
            detection = {
                "bbox": {
                    "x1": float(x1),
                    "y1": float(y1),
                    "x2": float(x2),
                    "y2": float(y2)
                },
                "confidence": confidence,
                "class_id": class_id,
                "damage_type": damage_type,
                "severity": severity,
                "area_pixels": float(area),
                "area_percentage": area_percentage,
                "region_stats": self._analyze_region(damage_region)
            }
            
            detections.append(detection)
        
        return detections
    
    def _classify_damage(self, area_percentage: float, confidence: float, 
                        class_id: int) -> Tuple[str, str]:
        """
        Classify damage type and severity using dataset-specific labels
        
        Args:
            area_percentage: Percentage of image covered by damage
            confidence: Detection confidence
            class_id: YOLO class ID
            
        Returns:
            Tuple of (damage_type, severity)
        """
        # Mapping based on model/data.yaml: ['pothole', 'crack', 'structural']
        damage_types = {
            0: "pothole",
            1: "crack",
            2: "structural"
        }
        
        damage_type = damage_types.get(class_id, "unknown")
        
        # Severity thresholds derived from dataset analysis
        if area_percentage < 1.5:
            severity = "minor"
        elif area_percentage < 6.5:
            severity = "moderate"
        else:
            severity = "severe"
        
        # Confidence weighting
        if confidence < 0.45:
            severity = "minor"
            
        return damage_type, severity
    
    def _analyze_region(self, region: np.ndarray) -> Dict[str, float]:
        """
        Analyze image region for additional statistics
        
        Args:
            region: Image region
            
        Returns:
            Dictionary with region statistics
        """
        if region.size == 0:
            return {"mean_intensity": 0, "std_deviation": 0, "edge_density": 0}
        
        # Convert to grayscale if needed
        if len(region.shape) == 3:
            gray = cv2.cvtColor(region, cv2.COLOR_BGR2GRAY)
        else:
            gray = region
        
        # Calculate statistics
        mean_intensity = float(np.mean(gray))
        std_dev = float(np.std(gray))
        
        # Edge detection for texture analysis
        edges = cv2.Canny(gray, 50, 150)
        edge_density = float(np.sum(edges) / (edges.shape[0] * edges.shape[1]))
        
        return {
            "mean_intensity": mean_intensity,
            "std_deviation": std_dev,
            "edge_density": edge_density
        }
    
    def visualize_detections(self, image_path: str, output_path: str) -> bool:
        """
        Visualize detections on image
        
        Args:
            image_path: Path to input image
            output_path: Path to save annotated image
            
        Returns:
            True if successful
        """
        try:
            image = cv2.imread(image_path)
            if image is None:
                return False
            
            results = self.model(image, verbose=False)
            annotated_image = results[0].plot()
            
            cv2.imwrite(output_path, annotated_image)
            logger.info(f"Annotated image saved to {output_path}")
            return True
        except Exception as e:
            logger.error(f"Error visualizing detections: {str(e)}")
            return False
