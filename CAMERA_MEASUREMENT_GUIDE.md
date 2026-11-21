# Camera-Based Measurement Capture Feature

## Overview

The FIBRIC application now includes an advanced camera-based measurement capture system that uses AI-powered pose detection to automatically estimate body measurements. This feature saves time and reduces measurement errors by analyzing body proportions from a single photo.

## How It Works

### 1. **Pose Detection Technology**
- Uses **TensorFlow.js** with **BlazePose** model for real-time pose estimation
- Detects 17 key body points (shoulders, hips, elbows, wrists, ankles, etc.)
- Calculates body measurements based on geometric relationships between these points

### 2. **Measurement Estimation**
The system automatically estimates these measurements from detected pose:
- **Chest** - Width between shoulders
- **Waist** - Hip width approximation
- **Hip** - Distance between hip joints
- **Shoulder** - Shoulder width
- **Sleeve Length** - Arm length from shoulder to wrist
- **Trouser Length** - Leg length from hip to ankle
- **Neck** - Neck circumference approximation (12% of shoulder width)
- **Height** - Full body height from head to feet

### 3. **Measurement Accuracy**
- Estimates are provided in **inches** (with centimeter option)
- Based on standard body proportions and pose geometry
- Accuracy depends on:
  - Clear visibility of the full body
  - Good lighting conditions
  - Proper standing posture (arms at sides)
- Users can manually adjust any measurements after capture

## Using the Camera Feature

### Step 1: Add New Measurement
1. Navigate to a client's detail page
2. Click **"+ Add New"** button next to "Latest Measurement"
3. The measurement form opens

### Step 2: Capture with Camera
1. Click the blue **"Capture Measurements with Camera"** button
2. Allow camera permissions when prompted
3. Position yourself clearly in the camera frame:
   - Stand straight with arms at your sides
   - Face the camera directly
   - Ensure full body is visible (head to feet)
   - Good lighting is important

### Step 3: Pose Detection
1. Click **"Capture"** button to take a photo
2. The system runs pose detection algorithm
3. Body measurements are automatically calculated

### Step 4: Review and Accept
1. Review the estimated measurements displayed
2. The estimates appear in inches by default
3. Click **"Use Measurements"** to populate the form
4. Or click **"Retake"** to capture another photo

### Step 5: Manual Adjustment
1. Once measurements are loaded, you can:
   - Edit any individual measurement
   - Change the unit (inches ↔ centimeters)
   - Add measurement notes
2. Click **"Save Measurement"** to store

### Alternative: Manual Entry
- If you prefer, skip the camera feature and enter measurements manually
- This is useful when:
  - Camera access isn't available
  - You want precise manual measurements
  - For quick data entry

## Technical Implementation

### Dependencies Added
```json
{
  "@tensorflow/tfjs": "^4.11.0",
  "@tensorflow-models/pose-detection": "^2.1.0"
}
```

### Key Components

#### 1. **CameraCapture Component**
```jsx
<CameraCapture 
  onCapture={handleCameraCapture}
  onClose={() => setShowCamera(false)}
/>
```
- Manages camera access via `getUserMedia` API
- Initializes TensorFlow.js pose detector
- Captures video and processes frames
- Displays estimated measurements

#### 2. **estimateMeasurements Function**
- Takes pose keypoints from BlazePose model
- Calculates distances between key body points
- Applies conversion formulas to estimate actual measurements
- Returns measurements in inches

#### 3. **Enhanced MeasurementForm Component**
- Added camera capture button at the top
- Integrates with CameraCapture component
- Allows switching between camera and manual entry
- Pre-fills form with camera estimates

## Browser Compatibility

The camera feature requires:
- **Browser Support**: Modern browsers with WebRTC support
  - Chrome 50+
  - Firefox 37+
  - Safari 11+
  - Edge 79+

- **Permissions**: User must grant camera access
  - Browsers will prompt for permission
  - Users can revoke at any time

## Best Practices for Accurate Measurements

### 1. **Proper Positioning**
- Stand straight facing the camera
- Keep arms relaxed at your sides
- Feet shoulder-width apart
- Head centered in frame

### 2. **Lighting**
- Use well-lit environments
- Avoid backlighting
- Natural light or bright indoor lighting works best

### 3. **Clothing**
- Wear fitted clothing that shows body outline
- Avoid bulky jackets or oversized garments
- Close-fitting clothes help pose detection

### 4. **Distance**
- Position 4-6 feet from camera
- Ensure full body visible from head to feet
- Center yourself in the frame

### 5. **Camera Quality**
- Use device's main/rear camera for better quality
- Clear camera lens before capturing
- 720p or better resolution recommended

## Troubleshooting

### Camera Won't Access
**Problem**: "Camera access is required for pose detection"
- **Solution**: Check browser camera permissions
- Go to browser settings → Privacy → Camera
- Allow access to the website

### "No person detected"
**Problem**: System can't find a body in the image
- **Solution**: 
  - Ensure entire body is visible
  - Move closer to camera
  - Improve lighting
  - Try repositioning

### Measurements Seem Inaccurate
**Problem**: Captured measurements don't match actual measurements
- **Solution**: 
  - Ensure proper standing posture
  - Use better lighting
  - Clear the camera lens
  - Manually adjust in the form
  - Note: AI estimates are approximations and may need fine-tuning

### "Could not estimate measurements"
**Problem**: Pose detected but measurements couldn't be calculated
- **Solution**: Retake the photo
- Improve positioning and lighting
- If persists, use manual entry

## Privacy & Security

- **Camera Feed**: Only processed locally in your browser
- **No Cloud Upload**: Images are NOT sent to any server
- **No Stored Photos**: Images are not saved or stored
- **Local Processing**: All pose detection happens on your device
- **Permission Control**: You control when camera is accessed

## Sharing & Communication Features

The app now supports sending a complete order receipt directly to your customer via WhatsApp or email from the order details screen. Simply tap the respective icon in the order header to open the messaging app with a pre‑formatted receipt text including measurements, fabric info, pricing, status and notes. This makes delivery confirmation and record-keeping easier without leaving the browser.

## Future Improvements

Potential enhancements for future versions:
1. **3D Body Scanning** - Use depth sensors for more accurate 3D measurements
2. **Garment-Specific Estimates** - Different measurement sets for different garment types
3. **Measurement History Comparison** - Track body changes over time
4. **AR Visualization** - Show virtual garments fitting
5. **Advanced Calibration** - User-defined reference objects for calibration
6. **Multiple Poses** - Capture from multiple angles for better accuracy

## Support & Feedback

If you experience issues or have suggestions:
1. Note the specific problem and steps to reproduce
2. Check pose detection requirements above
3. Try with different lighting and positioning
4. Contact support with detailed information

## Related Documentation

- [Main README](./README.md) - Full application documentation
- [Measurement Tracking Guide](./README.md#measurement-tracking) - General measurement features
- [Installation Guide](./README.md#installation) - Setup instructions

---

**Version**: 1.0.0  
**Last Updated**: March 2026  
**Feature Status**: Active and fully integrated
