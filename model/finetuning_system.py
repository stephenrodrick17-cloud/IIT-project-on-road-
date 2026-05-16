"""
Hard Negative Mining & Fine-tuning System
Collects false positives and retrains model for your specific infrastructure
"""

import os
import json
import shutil
from pathlib import Path
from datetime import datetime
import logging
from typing import Dict, List, Any
try:
    import cv2
    HAS_OPENCV = True
except ImportError:
    HAS_OPENCV = False

try:
    import numpy as np
    HAS_NUMPY = True
except ImportError:
    HAS_NUMPY = False

try:
    from ultralytics import YOLO
    HAS_ULTRALYTICS = True
except ImportError:
    HAS_ULTRALYTICS = False

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class FeedbackManager:
    """Manages user feedback on model predictions"""
    
    def __init__(self, feedback_dir=None):
        """
        Initialize feedback manager
        
        Args:
            feedback_dir: Directory to store feedback
        """
        if feedback_dir is None:
            # On Vercel, use /tmp for writable storage
            IS_VERCEL = os.getenv("VERCEL") == "1"
            feedback_dir = "/tmp/feedback" if IS_VERCEL else "backend/uploads/feedback"
            
        try:
            self.feedback_dir = Path(feedback_dir)
            self.feedback_dir.mkdir(parents=True, exist_ok=True)
            
            self.false_positives_dir = self.feedback_dir / "false_positives"
            self.false_negatives_dir = self.feedback_dir / "false_negatives"
            self.corrected_detections_dir = self.feedback_dir / "corrections"
            
            for d in [self.false_positives_dir, self.false_negatives_dir, self.corrected_detections_dir]:
                d.mkdir(parents=True, exist_ok=True)
            
            self.feedback_log = self.feedback_dir / "feedback_log.json"
            self.load_feedback_log()
        except Exception as e:
            logger.warning(f"Could not initialize feedback directory: {e}. Feedback will be disabled.")
            self.feedback_data = {"false_positives": [], "false_negatives": [], "corrections": [], "total_feedback": 0}
            self.feedback_log = None
    
    def load_feedback_log(self):
        """Load existing feedback log"""
        if self.feedback_log.exists():
            with open(self.feedback_log, 'r') as f:
                self.feedback_data = json.load(f)
        else:
            self.feedback_data = {
                "false_positives": [],
                "false_negatives": [],
                "corrections": [],
                "total_feedback": 0
            }
    
    def save_feedback_log(self):
        """Save feedback log"""
        with open(self.feedback_log, 'w') as f:
            json.dump(self.feedback_data, f, indent=2)
    
    def add_false_positive(self, image_path: str, detection_info: Dict[str, Any]) -> str:
        """
        Record a false positive (model detected something that wasn't there)
        
        Args:
            image_path: Path to image
            detection_info: Detection details
        
        Returns:
            Storage path
        """
        try:
            timestamp = datetime.now().isoformat()
            filename = f"fp_{len(self.feedback_data['false_positives'])}.jpg"
            dest_path = self.false_positives_dir / filename
            
            # Copy image
            shutil.copy2(image_path, dest_path)
            
            # Store metadata
            metadata = {
                "timestamp": timestamp,
                "image": str(dest_path),
                "detection": detection_info,
                "original_image": image_path
            }
            
            self.feedback_data["false_positives"].append(metadata)
            self.feedback_data["total_feedback"] += 1
            self.save_feedback_log()
            
            logger.info(f"✓ Recorded false positive: {filename}")
            return str(dest_path)
        
        except Exception as e:
            logger.error(f"Error recording false positive: {e}")
            return None
    
    def add_false_negative(self, image_path: str, missing_detection_info: Dict[str, Any]) -> str:
        """
        Record a false negative (model missed a detection)
        
        Args:
            image_path: Path to image
            missing_detection_info: Info about missed detection
        
        Returns:
            Storage path
        """
        try:
            timestamp = datetime.now().isoformat()
            filename = f"fn_{len(self.feedback_data['false_negatives'])}.jpg"
            dest_path = self.false_negatives_dir / filename
            
            # Copy image
            shutil.copy2(image_path, dest_path)
            
            # Store metadata with annotation
            metadata = {
                "timestamp": timestamp,
                "image": str(dest_path),
                "missing_damage": missing_detection_info,
                "original_image": image_path
            }
            
            self.feedback_data["false_negatives"].append(metadata)
            self.feedback_data["total_feedback"] += 1
            self.save_feedback_log()
            
            logger.info(f"✓ Recorded false negative: {filename}")
            return str(dest_path)
        
        except Exception as e:
            logger.error(f"Error recording false negative: {e}")
            return None
    
    def add_correction(self, image_path: str, correction_info: Dict[str, Any]) -> str:
        """
        Record corrected detection bbox
        
        Args:
            image_path: Path to image
            correction_info: Corrected detection info
        
        Returns:
            Storage path
        """
        try:
            timestamp = datetime.now().isoformat()
            filename = f"corr_{len(self.feedback_data['corrections'])}.jpg"
            dest_path = self.corrected_detections_dir / filename
            
            # Copy image
            shutil.copy2(image_path, dest_path)
            
            # Store correction
            metadata = {
                "timestamp": timestamp,
                "image": str(dest_path),
                "correction": correction_info,
                "original_image": image_path
            }
            
            self.feedback_data["corrections"].append(metadata)
            self.feedback_data["total_feedback"] += 1
            self.save_feedback_log()
            
            logger.info(f"✓ Recorded correction: {filename}")
            return str(dest_path)
        
        except Exception as e:
            logger.error(f"Error recording correction: {e}")
            return None
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get feedback statistics"""
        return {
            "total_feedback": self.feedback_data["total_feedback"],
            "false_positives": len(self.feedback_data["false_positives"]),
            "false_negatives": len(self.feedback_data["false_negatives"]),
            "corrections": len(self.feedback_data["corrections"]),
            "ready_for_retraining": len(self.feedback_data["false_positives"]) >= 50
        }

class HardNegativeMiner:
    """Mine hard negatives from false positives for model improvement"""
    
    def __init__(self, model_path: str, feedback_manager: FeedbackManager):
        """
        Initialize hard negative miner
        
        Args:
            model_path: Path to YOLO model
            feedback_manager: FeedbackManager instance
        """
        self.model = YOLO(model_path)
        self.feedback_manager = feedback_manager
        self.device = 0 if torch.cuda.is_available() else 'cpu'
    
    def mine_hard_negatives(self) -> Dict[str, Any]:
        """
        Collect hard negatives from false positives
        
        Returns:
            Statistics about mined hard negatives
        """
        logger.info("\n" + "="*70)
        logger.info("🔍 MINING HARD NEGATIVES FROM FALSE POSITIVES")
        logger.info("="*70)
        
        false_positives = self.feedback_manager.feedback_data["false_positives"]
        
        if len(false_positives) < 50:
            logger.warning(f"⚠ Only {len(false_positives)} false positives. Need at least 50 for retraining.")
            return {"ready": False, "count": len(false_positives), "needed": 50-len(false_positives)}
        
        logger.info(f"\n▶️  Processing {len(false_positives)} false positives...")
        
        mined_dir = Path("model/datasets/hard_negatives")
        mined_dir.mkdir(parents=True, exist_ok=True)
        
        images_dir = mined_dir / "images"
        labels_dir = mined_dir / "labels"
        images_dir.mkdir(exist_ok=True)
        labels_dir.mkdir(exist_ok=True)
        
        count = 0
        for idx, fp_data in enumerate(false_positives):
            try:
                img_path = fp_data["image"]
                if not os.path.exists(img_path):
                    continue
                
                # Copy image as hard negative (class = no_damage/background)
                dest_name = f"hard_neg_{idx}.jpg"
                dest_path = images_dir / dest_name
                
                shutil.copy2(img_path, dest_path)
                
                # Create empty label file (no objects = background class)
                label_path = labels_dir / f"hard_neg_{idx}.txt"
                with open(label_path, 'w') as f:
                    f.write("")  # Empty = no damage detected
                
                count += 1
            
            except Exception as e:
                logger.warning(f"Error mining {img_path}: {e}")
        
        logger.info(f"✓ Mined {count} hard negatives from false positives")
        logger.info(f"  Location: {mined_dir}")
        
        return {
            "ready": True,
            "mined_hard_negatives": count,
            "location": str(mined_dir),
            "can_retrain": count >= 50
        }

class ModelFinetuner:
    """Fine-tune model on uploaded/feedback images"""
    
    def __init__(self, model_path: str):
        """
        Initialize fine-tuner
        
        Args:
            model_path: Path to base model
        """
        self.base_model = YOLO(model_path)
        self.device = 0 if torch.cuda.is_available() else 'cpu'
    
    def create_finetuning_dataset(self, feedback_manager: FeedbackManager) -> bool:
        """
        Create dataset from feedback for fine-tuning
        
        Args:
            feedback_manager: FeedbackManager instance
        
        Returns:
            True if dataset created successfully
        """
        logger.info("\n" + "="*70)
        logger.info("📦 CREATING FINE-TUNING DATASET FROM FEEDBACK")
        logger.info("="*70)
        
        # Create dataset directory
        dataset_dir = Path("model/datasets/finetuning_dataset")
        dataset_dir.mkdir(parents=True, exist_ok=True)
        
        # Use hard negatives + original dataset
        logger.info("\n1. Collecting hard negatives (false positives from users)...")
        
        finetuning_images = dataset_dir / "images" / "finetune"
        finetuning_labels = dataset_dir / "labels" / "finetune"
        finetuning_images.mkdir(parents=True, exist_ok=True)
        finetuning_labels.mkdir(parents=True, exist_ok=True)
        
        count = 0
        
        # Copy false positives (hard negatives)
        for fp_data in feedback_manager.feedback_data["false_positives"]:
            try:
                src_path = fp_data["image"]
                if os.path.exists(src_path):
                    dest_path = finetuning_images / f"fp_{count}.jpg"
                    shutil.copy2(src_path, dest_path)
                    
                    # Create empty label (no damage)
                    label_path = finetuning_labels / f"fp_{count}.txt"
                    with open(label_path, 'w') as f:
                        f.write("")
                    
                    count += 1
            except Exception as e:
                logger.warning(f"Error copying false positive: {e}")
        
        logger.info(f"  ✓ Added {count} hard negatives (false positives)")
        
        # Copy false negatives (missed detections) with annotations
        logger.info("\n2. Collecting false negatives (missed detections)...")
        fn_count = 0
        for fn_data in feedback_manager.feedback_data["false_negatives"]:
            try:
                src_path = fn_data["image"]
                if os.path.exists(src_path):
                    dest_path = finetuning_images / f"fn_{fn_count}.jpg"
                    shutil.copy2(src_path, dest_path)
                    
                    # Create label from missing detection info
                    label_path = finetuning_labels / f"fn_{fn_count}.txt"
                    if "bbox" in fn_data.get("missing_damage", {}):
                        bbox = fn_data["missing_damage"]["bbox"]
                        damage_class = fn_data["missing_damage"].get("damage_type", "crack")
                        
                        # Convert to YOLO format if needed
                        with open(label_path, 'w') as f:
                            f.write(f"{damage_class} {bbox}\n")
                    
                    fn_count += 1
            except Exception as e:
                logger.warning(f"Error copying false negative: {e}")
        
        logger.info(f"  ✓ Added {fn_count} false negatives (missed detections)")
        
        # Copy corrections
        logger.info("\n3. Collecting corrected detections...")
        corr_count = 0
        for corr_data in feedback_manager.feedback_data["corrections"]:
            try:
                src_path = corr_data["image"]
                if os.path.exists(src_path):
                    dest_path = finetuning_images / f"corr_{corr_count}.jpg"
                    shutil.copy2(src_path, dest_path)
                    
                    # Create corrected label
                    label_path = finetuning_labels / f"corr_{corr_count}.txt"
                    if "bbox" in corr_data.get("correction", {}):
                        bbox = corr_data["correction"]["bbox"]
                        damage_class = corr_data["correction"].get("damage_type", "crack")
                        
                        with open(label_path, 'w') as f:
                            f.write(f"{damage_class} {bbox}\n")
                    
                    corr_count += 1
            except Exception as e:
                logger.warning(f"Error copying correction: {e}")
        
        logger.info(f"  ✓ Added {corr_count} corrected detections")
        
        total_samples = count + fn_count + corr_count
        logger.info(f"\n✓ Created fine-tuning dataset: {total_samples} images")
        
        return total_samples >= 50
    
    def finetune(self, dataset_yaml: str, epochs: int = 30) -> bool:
        """
        Fine-tune model on feedback dataset
        
        Args:
            dataset_yaml: Path to data.yaml
            epochs: Number of fine-tuning epochs
        
        Returns:
            True if successful
        """
        logger.info("\n" + "="*70)
        logger.info("🔄 FINE-TUNING MODEL ON USER FEEDBACK")
        logger.info("="*70)
        
        logger.info(f"\n▶️  Fine-tuning configuration:")
        logger.info(f"  Dataset: {dataset_yaml}")
        logger.info(f"  Epochs: {epochs}")
        logger.info(f"  Purpose: Eliminate false positives, catch missed damage")
        
        try:
            # Fine-tune with fewer epochs on smaller dataset
            results = self.base_model.train(
                data=dataset_yaml,
                epochs=epochs,
                batch=16,  # Smaller batch for fine-tuning
                imgsz=640,
                device=self.device,
                patience=10,  # Early stopping
                project="runs/train/finetuned_models",
                name="user_adapted",
                exist_ok=True,
                verbose=True,
                lr0=0.001,  # Lower learning rate
                warmup_epochs=1,
                freeze=10  # Freeze first 10 layers
            )
            
            logger.info("\n✅ Fine-tuning complete!")
            return True
        
        except Exception as e:
            logger.error(f"❌ Fine-tuning failed: {e}")
            return False

import torch

def main():
    """Main fine-tuning entry point"""
    
    logger.info("🔧 Model Fine-tuning System")
    logger.info("="*70)
    
    # Initialize feedback manager
    feedback_mgr = FeedbackManager()
    
    # Check feedback statistics
    stats = feedback_mgr.get_statistics()
    logger.info(f"\n📊 Feedback Statistics:")
    logger.info(f"  Total Feedback: {stats['total_feedback']}")
    logger.info(f"  False Positives: {stats['false_positives']}")
    logger.info(f"  False Negatives: {stats['false_negatives']}")
    logger.info(f"  Corrections: {stats['corrections']}")
    
    if not stats['ready_for_retraining']:
        logger.warning(f"\n⚠ Need at least 50 false positives. Currently have {stats['false_positives']}")
        logger.info(f"   Collect {50 - stats['false_positives']} more false positives to enable retraining")
        return
    
    logger.info(f"\n✅ Ready for fine-tuning!")
    
    # Mine hard negatives
    logger.info("\n" + "="*70)
    miner = HardNegativeMiner("yolov8m.pt", feedback_mgr)
    hard_neg_stats = miner.mine_hard_negatives()
    
    if not hard_neg_stats['ready']:
        logger.warning(f"Cannot mine hard negatives yet: {hard_neg_stats}")
        return
    
    # Create fine-tuning dataset
    finetuner = ModelFinetuner("yolov8m.pt")
    
    success = finetuner.create_finetuning_dataset(feedback_mgr)
    if not success:
        logger.warning("Dataset not ready for fine-tuning")
        return
    
    # Fine-tune model
    dataset_yaml = "model/datasets/finetuning_dataset/data.yaml"
    
    response = input("\nFine-tune model now? (yes/no): ").lower().strip()
    if response == 'yes':
        finetuner.finetune(dataset_yaml, epochs=30)
    else:
        logger.info("Skipped fine-tuning. Run manually when ready.")

if __name__ == "__main__":
    main()
