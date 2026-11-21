import React, { useState, useEffect, useRef } from 'react';
import { Camera, Users, Package, User, Plus, Search, Edit, Trash2, Eye, EyeOff, X, Check, Calendar, Ruler, LogOut, Menu, ArrowLeft, ChevronRight, Mail, MessageCircle } from 'lucide-react';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import * as poseDetection from '@tensorflow-models/pose-detection';

// Initialize IndexedDB for persistent storage
const DB_NAME = 'FibricDB';
const DB_VERSION = 1;

let dbInstance = null;

const initDB = () => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => {
      console.error('Database failed to open:', request.error);
      reject(request.error);
    };
    
    request.onsuccess = () => {
      dbInstance = request.result;
      console.log('Database opened successfully');
      resolve(request.result);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      console.log('Upgrading database...');
      
      if (!db.objectStoreNames.contains('tailors')) {
        db.createObjectStore('tailors', { keyPath: 'id', autoIncrement: true });
        console.log('Created tailors store');
      }
      if (!db.objectStoreNames.contains('clients')) {
        const clientStore = db.createObjectStore('clients', { keyPath: 'id', autoIncrement: true });
        clientStore.createIndex('tailorId', 'tailorId', { unique: false });
        console.log('Created clients store');
      }
      if (!db.objectStoreNames.contains('measurements')) {
        const measurementStore = db.createObjectStore('measurements', { keyPath: 'id', autoIncrement: true });
        measurementStore.createIndex('clientId', 'clientId', { unique: false });
        console.log('Created measurements store');
      }
      if (!db.objectStoreNames.contains('orders')) {
        const orderStore = db.createObjectStore('orders', { keyPath: 'id', autoIncrement: true });
        orderStore.createIndex('clientId', 'clientId', { unique: false });
        orderStore.createIndex('status', 'status', { unique: false });
        console.log('Created orders store');
      }
      if (!db.objectStoreNames.contains('fabrics')) {
        const fabricStore = db.createObjectStore('fabrics', { keyPath: 'id', autoIncrement: true });
        fabricStore.createIndex('orderId', 'orderId', { unique: false });
        console.log('Created fabrics store');
      }
      if (!db.objectStoreNames.contains('session')) {
        db.createObjectStore('session', { keyPath: 'key' });
        console.log('Created session store');
      }
    };
  });
};

// Database operations
const dbOps = {
  async add(storeName, data) {
    try {
      const db = await initDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.add(data);
        request.onsuccess = () => {
          console.log(`Added to ${storeName}:`, request.result);
          resolve(request.result);
        };
        request.onerror = () => {
          console.error(`Error adding to ${storeName}:`, request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Add operation failed:', error);
      throw error;
    }
  },
  
  async getAll(storeName) {
    try {
      const db = await initDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => {
          console.log(`Got all from ${storeName}:`, request.result.length, 'items');
          resolve(request.result);
        };
        request.onerror = () => {
          console.error(`Error getting all from ${storeName}:`, request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('GetAll operation failed:', error);
      throw error;
    }
  },
  
  async getById(storeName, id) {
    try {
      const db = await initDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(id);
        request.onsuccess = () => {
          console.log(`Got from ${storeName} by id ${id}:`, request.result);
          resolve(request.result);
        };
        request.onerror = () => {
          console.error(`Error getting from ${storeName}:`, request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('GetById operation failed:', error);
      throw error;
    }
  },
  
  async getByIndex(storeName, indexName, value) {
    try {
      const db = await initDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const index = store.index(indexName);
        const request = index.getAll(value);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('GetByIndex operation failed:', error);
      throw error;
    }
  },
  
  async update(storeName, data) {
    try {
      const db = await initDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(data);
        request.onsuccess = () => {
          console.log(`Updated ${storeName}:`, request.result);
          resolve(request.result);
        };
        request.onerror = () => {
          console.error(`Error updating ${storeName}:`, request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Update operation failed:', error);
      throw error;
    }
  },
  
  async delete(storeName, id) {
    try {
      const db = await initDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(id);
        request.onsuccess = () => {
          console.log(`Deleted from ${storeName}:`, id);
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Delete operation failed:', error);
      throw error;
    }
  }
};

// Utility functions
const hashPassword = async (password) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
};

// Pose detection and measurement estimation
const estimateMeasurements = (poses) => {
  if (!poses || poses.length === 0) {
    return null;
  }

  const pose = poses[0];
  const keypoints = pose.keypoints;
  const keypointMap = {};
  
  // Map keypoints for easier access
  keypoints.forEach((kp, idx) => {
    // Standard COCO keypoint names
    const names = ['nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear', 
                   'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow', 
                   'left_wrist', 'right_wrist', 'left_hip', 'right_hip', 
                   'left_knee', 'right_knee', 'left_ankle', 'right_ankle'];
    keypointMap[names[idx]] = { x: kp.x, y: kp.y, score: kp.score };
  });

  // Calculate measurements based on pose keypoints
  const getDistance = (kp1, kp2) => {
    if (!kp1 || !kp2 || kp1.score < 0.5 || kp2.score < 0.5) return null;
    const dx = kp2.x - kp1.x;
    const dy = kp2.y - kp1.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Estimate measurements (these are relative pixel measurements that need calibration)
  const measurements = {};

  // Shoulder width
  const shoulderDist = getDistance(keypointMap.left_shoulder, keypointMap.right_shoulder);
  if (shoulderDist) measurements.shoulder = (shoulderDist * 0.045).toFixed(1);

  // Waist/Hip estimation (using hip position)
  const hipDist = getDistance(keypointMap.left_hip, keypointMap.right_hip);
  if (hipDist) {
    measurements.hip = (hipDist * 0.05).toFixed(1);
    measurements.waist = (hipDist * 0.048).toFixed(1);
  }

  // Chest estimation (between shoulders and hips)
  if (shoulderDist) {
    measurements.chest = (shoulderDist * 0.052).toFixed(1);
  }

  // Arm length estimation
  const armLength = getDistance(keypointMap.right_shoulder, keypointMap.right_wrist);
  if (armLength) measurements.sleeveLength = (armLength * 0.055).toFixed(1);

  // Height estimation (from head to ankles)
  const heightDist = getDistance(
    { x: keypointMap.nose.x, y: keypointMap.nose.y, score: 1 },
    keypointMap.right_ankle
  );
  if (heightDist) measurements.height = (heightDist * 0.0012).toFixed(1);

  // Neck estimation (approximated)
  if (shoulderDist) measurements.neck = (shoulderDist * 0.12).toFixed(1);

  // Trouser length (hip to ankle)
  const trouserLength = getDistance(keypointMap.right_hip, keypointMap.right_ankle);
  if (trouserLength) measurements.trouserLength = (trouserLength * 0.055).toFixed(1);

  return measurements;
};

// Camera component for measurement capture
function CameraCapture({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [cameraLoading, setCameraLoading] = useState(true);
  const [detectorLoading, setDetectorLoading] = useState(true);
  const [estimatedMeasurements, setEstimatedMeasurements] = useState(null);
  const [error, setError] = useState('');
  const [detector, setDetector] = useState(null);

  useEffect(() => {
    const initializeAll = async () => {
      try {
        // First, set up TensorFlow backend
        await tf.ready();
        console.log('TensorFlow backend ready');
        
        // Initialize pose detector
        console.log('Initializing pose detector...');
        const detectorConfig = {
          runtime: 'tfjs',
          maxPoses: 1,
          type: 'full'
        };
        
        const net = await poseDetection.createDetector(
          poseDetection.SupportedModels.BlazePose,
          detectorConfig
        );
        console.log('Pose detector initialized successfully');
        setDetector(net);
        setDetectorLoading(false);
      } catch (err) {
        console.error('Failed to initialize detector:', err);
        setError(`Failed to load pose detection model: ${err.message}`);
        setDetectorLoading(false);
      }
    };

    const initializeCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 }
          },
          audio: false
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            setCameraLoading(false);
            console.log('Camera loaded successfully');
          };
        }
      } catch (err) {
        console.error('Camera access denied:', err);
        setError('Camera access is required. Please allow camera permissions.');
        setCameraLoading(false);
      }
    };

    initializeAll();
    initializeCamera();

    return () => {
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current || !detector) {
      setError('Detector not ready. Please wait...');
      return;
    }

    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      
      ctx.drawImage(videoRef.current, 0, 0);

      // Detect pose
      const video = videoRef.current;
      console.log('Estimating poses...');
      const poses = await detector.estimatePoses(video);
      console.log('Poses detected:', poses.length);
      
      if (poses && poses.length > 0) {
        const measurements = estimateMeasurements(poses);
        if (measurements) {
          setEstimatedMeasurements(measurements);
        } else {
          setError('Could not estimate measurements. Try a clearer pose.');
        }
      } else {
        setError('No person detected. Please position yourself clearly in the camera.');
      }
    } catch (err) {
      console.error('Capture error:', err);
      setError('Error capturing measurement: ' + err.message);
    }
  };

  const handleAccept = () => {
    if (estimatedMeasurements) {
      onCapture(estimatedMeasurements);
    }
  };

  const isReady = !cameraLoading && !detectorLoading && detector && !error;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <h3 className="text-lg font-semibold">Capture Measurements</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {(cameraLoading || detectorLoading) && !error && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded text-sm">
              <div className="flex items-center gap-2">
                <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                <span>
                  {cameraLoading && 'Loading camera...'}
                  {detectorLoading && !cameraLoading && 'Loading pose detection model (this may take a moment)...'}
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          {!estimatedMeasurements ? (
            <>
              <div className="text-sm text-gray-600">
                <p className="mb-2">Position yourself in a standing position with arms at your sides for best results.</p>
              </div>

              <div className="relative w-full bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
                {(cameraLoading || !isReady) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
                    <div className="text-white text-center">
                      <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full mx-auto mb-2"></div>
                      <div>{cameraLoading ? 'Loading camera...' : 'Preparing...'}</div>
                    </div>
                  </div>
                )}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
              </div>

              <canvas ref={canvasRef} style={{ display: 'none' }} />

              <div className="flex gap-3">
                <button 
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={capturePhoto}
                  disabled={!isReady}
                  className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Camera className="w-4 h-4" />
                  {isReady ? 'Capture' : 'Loading...'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded text-sm">
                ✓ Measurements estimated! You can adjust them below if needed.
              </div>

              <div className="space-y-3 border-t pt-4">
                <div className="text-sm font-medium text-gray-700">Estimated Measurements (inches)</div>
                <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded">
                  {Object.entries(estimatedMeasurements).map(([key, value]) => (
                    <div key={key} className="text-sm">
                      <div className="text-gray-600 capitalize">{key.replace(/([A-Z])/g, ' $1')}</div>
                      <div className="font-medium">{value}"</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  type="button"
                  onClick={() => setEstimatedMeasurements(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Retake
                </button>
                <button 
                  type="button"
                  onClick={handleAccept}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
                >
                  Use Measurements
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const generateOrderNumber = () => {
  return 'ORD-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 5).toUpperCase();
};

const formatDate = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

// Main App Component
export default function FibricApp() {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentScreen, setCurrentScreen] = useState('login');
  const [selectedTab, setSelectedTab] = useState('dashboard');
  const [clients, setClients] = useState([]);
  const [orders, setOrders] = useState([]);
  const [measurements, setMeasurements] = useState([]);
  const [fabrics, setFabrics] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [orderFilter, setOrderFilter] = useState('all');

  useEffect(() => {
    checkSession();
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadData();
    }
  }, [currentUser]);

  const checkSession = async () => {
    try {
      const session = await dbOps.getById('session', 'currentUser');
      if (session) {
        const tailor = await dbOps.getById('tailors', session.value);
        if (tailor) {
          setCurrentUser(tailor);
          setCurrentScreen('main');
        }
      }
    } catch (error) {
      console.error('Session check failed:', error);
    }
  };

  const loadData = async () => {
    try {
      const [clientsData, ordersData, measurementsData, fabricsData] = await Promise.all([
        dbOps.getByIndex('clients', 'tailorId', currentUser.id),
        dbOps.getAll('orders'),
        dbOps.getAll('measurements'),
        dbOps.getAll('fabrics')
      ]);
      setClients(clientsData);
      setOrders(ordersData.filter(o => clientsData.some(c => c.id === o.clientId)));
      setMeasurements(measurementsData);
      setFabrics(fabricsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const handleLogin = async (phone, password) => {
    try {
      const tailors = await dbOps.getAll('tailors');
      const hashedPassword = await hashPassword(password);
      const tailor = tailors.find(t => t.phoneNumber === phone && t.passwordHash === hashedPassword);
      
      if (tailor) {
        try {
          await dbOps.update('session', { key: 'currentUser', value: tailor.id });
        } catch (e) {
          await dbOps.add('session', { key: 'currentUser', value: tailor.id });
        }
        setCurrentUser(tailor);
        setCurrentScreen('main');
        return { success: true };
      }
      return { success: false, error: 'Invalid phone number or password' };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Login failed: ' + error.message };
    }
  };

  const handleRegister = async (fullName, phone, password, businessName) => {
    try {
      const tailors = await dbOps.getAll('tailors');
      if (tailors.some(t => t.phoneNumber === phone)) {
        return { success: false, error: 'Phone number already registered' };
      }
      
      const hashedPassword = await hashPassword(password);
      const id = await dbOps.add('tailors', {
        fullName,
        phoneNumber: phone,
        passwordHash: hashedPassword,
        businessName: businessName || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      const tailor = await dbOps.getById('tailors', id);
      try {
        await dbOps.update('session', { key: 'currentUser', value: id });
      } catch (e) {
        await dbOps.add('session', { key: 'currentUser', value: id });
      }
      setCurrentUser(tailor);
      setCurrentScreen('main');
      return { success: true };
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: 'Registration failed: ' + error.message };
    }
  };

  const handleLogout = async () => {
    await dbOps.delete('session', 'currentUser');
    setCurrentUser(null);
    setCurrentScreen('login');
    setSelectedTab('dashboard');
  };

  const addClient = async (clientData) => {
    const id = await dbOps.add('clients', {
      ...clientData,
      tailorId: currentUser.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    await loadData();
    return id;
  };

  const updateClient = async (id, clientData) => {
    await dbOps.update('clients', {
      ...clientData,
      id,
      tailorId: currentUser.id,
      updatedAt: new Date().toISOString()
    });
    await loadData();
  };

  const deleteClient = async (id) => {
    await dbOps.delete('clients', id);
    const clientOrders = orders.filter(o => o.clientId === id);
    for (const order of clientOrders) {
      await dbOps.delete('orders', order.id);
    }
    const clientMeasurements = measurements.filter(m => m.clientId === id);
    for (const measurement of clientMeasurements) {
      await dbOps.delete('measurements', measurement.id);
    }
    await loadData();
  };

  const addMeasurement = async (clientId, measurementData) => {
    const id = await dbOps.add('measurements', {
      ...measurementData,
      clientId,
      recordedAt: new Date().toISOString()
    });
    await loadData();
    return id;
  };

  const addOrder = async (orderData, fabricData) => {
    const orderId = await dbOps.add('orders', {
      ...orderData,
      orderNumber: generateOrderNumber(),
      status: 'pending',
      amountPaid: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    if (fabricData) {
      await dbOps.add('fabrics', {
        ...fabricData,
        orderId,
        createdAt: new Date().toISOString()
      });
    }
    
    await loadData();
    return orderId;
  };

  const updateOrder = async (id, orderData) => {
    const existing = await dbOps.getById('orders', id);
    await dbOps.update('orders', {
      ...existing,
      ...orderData,
      id,
      updatedAt: new Date().toISOString()
    });
    await loadData();
  };

  const deleteOrder = async (id) => {
    await dbOps.delete('orders', id);
    const orderFabrics = fabrics.filter(f => f.orderId === id);
    for (const fabric of orderFabrics) {
      await dbOps.delete('fabrics', fabric.id);
    }
    await loadData();
  };

  if (currentScreen === 'login' || currentScreen === 'register') {
    return <AuthScreen 
      screen={currentScreen} 
      setScreen={setCurrentScreen}
      onLogin={handleLogin}
      onRegister={handleRegister}
    />;
  }

  const filteredClients = clients.filter(c => 
    c.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phoneNumber.includes(searchTerm)
  );

  const filteredOrders = orders.filter(o => 
    orderFilter === 'all' || o.status === orderFilter
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar */}
      <div className="bg-indigo-600 text-white p-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-6 h-6" />
            <h1 className="text-xl font-bold">FIBRIC</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm">{currentUser?.fullName}</span>
            <button onClick={handleLogout} className="p-2 hover:bg-indigo-700 rounded">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-4">
        {selectedTab === 'dashboard' && (
          <DashboardScreen 
            clients={clients}
            orders={orders}
            setSelectedTab={setSelectedTab}
            setSelectedClient={setSelectedClient}
            setSelectedOrder={setSelectedOrder}
          />
        )}
        
        {selectedTab === 'clients' && (
          <ClientsScreen 
            clients={filteredClients}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            onAddClient={addClient}
            onUpdateClient={updateClient}
            onDeleteClient={deleteClient}
            setSelectedClient={setSelectedClient}
            setSelectedTab={setSelectedTab}
            measurements={measurements}
            orders={orders}
          />
        )}
        
        {selectedTab === 'clientDetail' && selectedClient && (
          <ClientDetailScreen 
            client={selectedClient}
            measurements={measurements.filter(m => m.clientId === selectedClient.id)}
            orders={orders.filter(o => o.clientId === selectedClient.id)}
            fabrics={fabrics}
            onBack={() => { setSelectedTab('clients'); setSelectedClient(null); }}
            onAddMeasurement={addMeasurement}
            onUpdateClient={updateClient}
            onDeleteClient={deleteClient}
            setSelectedOrder={setSelectedOrder}
            setSelectedTab={setSelectedTab}
          />
        )}
        
        {selectedTab === 'orders' && (
          <OrdersScreen 
            orders={filteredOrders}
            clients={clients}
            measurements={measurements}
            fabrics={fabrics}
            orderFilter={orderFilter}
            setOrderFilter={setOrderFilter}
            onAddOrder={addOrder}
            onUpdateOrder={updateOrder}
            onDeleteOrder={deleteOrder}
            setSelectedOrder={setSelectedOrder}
            setSelectedTab={setSelectedTab}
          />
        )}
        
        {selectedTab === 'orderDetail' && selectedOrder && (
          <OrderDetailScreen 
            order={selectedOrder}
            client={clients.find(c => c.id === selectedOrder.clientId)}
            measurement={measurements.find(m => m.id === selectedOrder.measurementId)}
            fabric={fabrics.find(f => f.orderId === selectedOrder.id)}
            onBack={() => { setSelectedTab('orders'); setSelectedOrder(null); }}
            onUpdateOrder={updateOrder}
            onDeleteOrder={deleteOrder}
          />
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
        <div className="max-w-7xl mx-auto flex justify-around p-2">
          <NavButton 
            icon={<Package />} 
            label="Dashboard" 
            active={selectedTab === 'dashboard'}
            onClick={() => setSelectedTab('dashboard')}
          />
          <NavButton 
            icon={<Users />} 
            label="Clients" 
            active={selectedTab === 'clients'}
            onClick={() => setSelectedTab('clients')}
          />
          <NavButton 
            icon={<Ruler />} 
            label="Orders" 
            active={selectedTab === 'orders'}
            onClick={() => setSelectedTab('orders')}
          />
        </div>
      </div>
    </div>
  );
}

function NavButton({ icon, label, active, onClick }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
        active ? 'text-indigo-600 bg-indigo-50' : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      <div className="w-6 h-6">{icon}</div>
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}

function AuthScreen({ screen, setScreen, onLogin, onRegister }) {
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    password: '',
    businessName: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setDebugInfo('Processing...');
    setLoading(true);

    try {
      if (screen === 'login') {
        if (!formData.phone || !formData.password) {
          setError('Phone number and password are required');
          setDebugInfo('Validation failed');
          setLoading(false);
          return;
        }
        setDebugInfo('Attempting login...');
        const result = await onLogin(formData.phone, formData.password);
        setDebugInfo(`Login result: ${result.success ? 'Success' : result.error}`);
        if (!result.success) {
          setError(result.error);
        }
      } else {
        if (!formData.fullName || !formData.phone || !formData.password) {
          setError('Name, phone number and password are required');
          setDebugInfo('Validation failed');
          setLoading(false);
          return;
        }
        if (formData.password.length < 4) {
          setError('Password must be at least 4 characters');
          setDebugInfo('Password too short');
          setLoading(false);
          return;
        }
        setDebugInfo('Attempting registration...');
        const result = await onRegister(formData.fullName, formData.phone, formData.password, formData.businessName);
        setDebugInfo(`Registration result: ${result.success ? 'Success' : result.error}`);
        if (!result.success) {
          setError(result.error);
        }
      }
    } catch (err) {
      setError('An unexpected error occurred: ' + err.message);
      setDebugInfo('Exception: ' + err.message);
      console.error('Auth error:', err);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-full mb-4">
            <Package className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">FIBRIC</h1>
          <p className="text-gray-600">Digital Tailoring Management</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {screen === 'register' && (
            <>
              <Input 
                label="Full Name"
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                placeholder="Enter your full name"
              />
              <Input 
                label="Business Name (Optional)"
                type="text"
                value={formData.businessName}
                onChange={(e) => setFormData({...formData, businessName: e.target.value})}
                placeholder="Enter your business name"
              />
            </>
          )}
          
          <Input 
            label="Phone Number"
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({...formData, phone: e.target.value})}
            placeholder="Enter your phone number"
          />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                placeholder="Enter your password"
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {debugInfo && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2 rounded text-xs">
              Debug: {debugInfo}
            </div>
          )}

          <button 
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Please wait...' : (screen === 'login' ? 'Login' : 'Register')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => {
              setScreen(screen === 'login' ? 'register' : 'login');
              setError('');
              setFormData({ fullName: '', phone: '', password: '', businessName: '' });
            }}
            className="text-indigo-600 hover:text-indigo-700 font-medium"
          >
            {screen === 'login' ? 'Create new account' : 'Already have an account? Login'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DashboardScreen({ clients, orders, setSelectedTab, setSelectedClient, setSelectedOrder }) {
  const pendingOrders = orders.filter(o => o.status === 'pending').length;
  const inProgressOrders = orders.filter(o => o.status === 'in_progress').length;
  const completedOrders = orders.filter(o => o.status === 'completed').length;
  
  const today = new Date().toDateString();
  const dueTodayOrders = orders.filter(o => 
    o.expectedDeliveryDate && new Date(o.expectedDeliveryDate).toDateString() === today
  );

  const recentOrders = orders.slice().sort((a, b) => 
    new Date(b.createdAt) - new Date(a.createdAt)
  ).slice(0, 5);

  return (
    <div className="space-y-6 pb-20">
      <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard icon={<Users />} label="Total Clients" value={clients.length} color="blue" />
        <StatCard icon={<Package />} label="Pending Orders" value={pendingOrders} color="yellow" />
        <StatCard icon={<Ruler />} label="In Progress" value={inProgressOrders} color="purple" />
        <StatCard icon={<Check />} label="Completed" value={completedOrders} color="green" />
      </div>

      {/* Due Today */}
      {dueTodayOrders.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <h3 className="font-semibold text-orange-900 mb-2 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Due Today ({dueTodayOrders.length})
          </h3>
          <div className="space-y-2">
            {dueTodayOrders.map(order => {
              const client = clients.find(c => c.id === order.clientId);
              return (
                <div 
                  key={order.id}
                  onClick={() => {
                    setSelectedOrder(order);
                    setSelectedTab('orderDetail');
                  }}
                  className="bg-white p-3 rounded border border-orange-200 cursor-pointer hover:bg-orange-50"
                >
                  <div className="font-medium">{order.orderNumber}</div>
                  <div className="text-sm text-gray-600">{client?.fullName}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Orders */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Recent Orders</h3>
          <button 
            onClick={() => setSelectedTab('orders')}
            className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
          >
            View All
          </button>
        </div>
        <div className="divide-y divide-gray-200">
          {recentOrders.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No orders yet</p>
            </div>
          ) : (
            recentOrders.map(order => {
              const client = clients.find(c => c.id === order.clientId);
              return (
                <div 
                  key={order.id}
                  onClick={() => {
                    setSelectedOrder(order);
                    setSelectedTab('orderDetail');
                  }}
                  className="p-4 hover:bg-gray-50 cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900">{order.orderNumber}</div>
                      <div className="text-sm text-gray-600">{client?.fullName}</div>
                      <div className="text-xs text-gray-500 mt-1">{formatDate(order.createdAt)}</div>
                    </div>
                    <StatusBadge status={order.status} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    purple: 'bg-purple-50 text-purple-600',
    green: 'bg-green-50 text-green-600'
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className={`inline-flex p-2 rounded-lg mb-2 ${colors[color]}`}>
        <div className="w-5 h-5">{icon}</div>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-600">{label}</div>
    </div>
  );
}

function ClientsScreen({ clients, searchTerm, setSearchTerm, onAddClient, onUpdateClient, onDeleteClient, setSelectedClient, setSelectedTab, measurements, orders }) {
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState(null);

  const handleSubmit = async (clientData) => {
    if (editingClient) {
      await onUpdateClient(editingClient.id, clientData);
    } else {
      await onAddClient(clientData);
    }
    setShowForm(false);
    setEditingClient(null);
  };

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Clients</h2>
        <button 
          onClick={() => setShowForm(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-lg"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input 
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by name or phone..."
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      {/* Client List */}
      <div className="space-y-3">
        {clients.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <Users className="w-12 h-12 mx-auto mb-2 text-gray-400" />
            <p className="text-gray-500">No clients yet. Add your first client!</p>
          </div>
        ) : (
          clients.map(client => {
            const clientOrders = orders.filter(o => o.clientId === client.id);
            const clientMeasurements = measurements.filter(m => m.clientId === client.id);
            
            return (
              <div 
                key={client.id}
                onClick={() => {
                  setSelectedClient(client);
                  setSelectedTab('clientDetail');
                }}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{client.fullName}</h3>
                    <p className="text-sm text-gray-600">{client.phoneNumber}</p>
                    <div className="flex gap-4 mt-2">
                      <span className="text-xs text-gray-500">{clientOrders.length} orders</span>
                      <span className="text-xs text-gray-500">{clientMeasurements.length} measurements</span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Client Form Modal */}
      {showForm && (
        <ClientForm 
          client={editingClient}
          onSubmit={handleSubmit}
          onClose={() => {
            setShowForm(false);
            setEditingClient(null);
          }}
        />
      )}
    </div>
  );
}

function ClientForm({ client, onSubmit, onClose }) {
  const [formData, setFormData] = useState({
    fullName: client?.fullName || '',
    phoneNumber: client?.phoneNumber || '',
    gender: client?.gender || 'male',
    notes: client?.notes || ''
  });

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!formData.fullName || !formData.phoneNumber) {
      alert('Name and phone are required');
      return;
    }
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <h3 className="text-lg font-semibold">{client ? 'Edit Client' : 'Add Client'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 space-y-4">
          <Input 
            label="Full Name *"
            value={formData.fullName}
            onChange={(e) => setFormData({...formData, fullName: e.target.value})}
          />
          
          <Input 
            label="Phone Number *"
            type="tel"
            value={formData.phoneNumber}
            onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
          />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
            <select 
              value={formData.gender}
              onChange={(e) => setFormData({...formData, gender: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea 
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Optional notes..."
            />
          </div>
          
          <div className="flex gap-3">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button 
              type="button"
              onClick={handleSubmit}
              className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
            >
              {client ? 'Update' : 'Add Client'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ClientDetailScreen({ client, measurements, orders, fabrics, onBack, onAddMeasurement, onUpdateClient, onDeleteClient, setSelectedOrder, setSelectedTab }) {
  const [showMeasurementForm, setShowMeasurementForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  
  const latestMeasurement = measurements.sort((a, b) => 
    new Date(b.recordedAt) - new Date(a.recordedAt)
  )[0];

  const handleDelete = async () => {
    if (window.confirm(`Delete ${client.fullName}? This will also delete all their measurements and orders.`)) {
      await onDeleteClient(client.id);
      onBack();
    }
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowEditForm(true)}
            className="p-2 hover:bg-gray-100 rounded-lg text-indigo-600"
          >
            <Edit className="w-5 h-5" />
          </button>
          <button 
            onClick={handleDelete}
            className="p-2 hover:bg-gray-100 rounded-lg text-red-600"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Client Info */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">{client.fullName}</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Phone:</span>
            <span className="font-medium">{client.phoneNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Gender:</span>
            <span className="font-medium capitalize">{client.gender}</span>
          </div>
          {client.notes && (
            <div className="pt-2 border-t">
              <span className="text-gray-600">Notes:</span>
              <p className="mt-1 text-gray-900">{client.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Latest Measurement */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Latest Measurement</h3>
          <button 
            onClick={() => setShowMeasurementForm(true)}
            className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
          >
            + Add New
          </button>
        </div>
        {latestMeasurement ? (
          <div className="p-4">
            <div className="text-xs text-gray-500 mb-3">
              Recorded: {formatDate(latestMeasurement.recordedAt)}
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {latestMeasurement.chest && (
                <div>
                  <span className="text-gray-600">Chest:</span>
                  <span className="ml-2 font-medium">{latestMeasurement.chest}"</span>
                </div>
              )}
              {latestMeasurement.waist && (
                <div>
                  <span className="text-gray-600">Waist:</span>
                  <span className="ml-2 font-medium">{latestMeasurement.waist}"</span>
                </div>
              )}
              {latestMeasurement.hip && (
                <div>
                  <span className="text-gray-600">Hip:</span>
                  <span className="ml-2 font-medium">{latestMeasurement.hip}"</span>
                </div>
              )}
              {latestMeasurement.shoulder && (
                <div>
                  <span className="text-gray-600">Shoulder:</span>
                  <span className="ml-2 font-medium">{latestMeasurement.shoulder}"</span>
                </div>
              )}
              {latestMeasurement.sleeveLength && (
                <div>
                  <span className="text-gray-600">Sleeve:</span>
                  <span className="ml-2 font-medium">{latestMeasurement.sleeveLength}"</span>
                </div>
              )}
              {latestMeasurement.trouserLength && (
                <div>
                  <span className="text-gray-600">Trouser:</span>
                  <span className="ml-2 font-medium">{latestMeasurement.trouserLength}"</span>
                </div>
              )}
              {latestMeasurement.neck && (
                <div>
                  <span className="text-gray-600">Neck:</span>
                  <span className="ml-2 font-medium">{latestMeasurement.neck}"</span>
                </div>
              )}
              {latestMeasurement.height && (
                <div>
                  <span className="text-gray-600">Height:</span>
                  <span className="ml-2 font-medium">{latestMeasurement.height}"</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            <Ruler className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No measurements yet</p>
          </div>
        )}
      </div>

      {/* Measurement History */}
      {measurements.length > 1 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Measurement History</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {measurements.slice(1).map(m => (
              <div key={m.id} className="p-4">
                <div className="text-xs text-gray-500 mb-2">
                  {formatDate(m.recordedAt)}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {m.chest && <div>Chest: {m.chest}"</div>}
                  {m.waist && <div>Waist: {m.waist}"</div>}
                  {m.hip && <div>Hip: {m.hip}"</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Orders */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Orders ({orders.length})</h3>
        </div>
        {orders.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No orders yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {orders.map(order => (
              <div 
                key={order.id}
                onClick={() => {
                  setSelectedOrder(order);
                  setSelectedTab('orderDetail');
                }}
                className="p-4 hover:bg-gray-50 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{order.orderNumber}</div>
                    <div className="text-sm text-gray-600 capitalize">{order.garmentType}</div>
                    <div className="text-xs text-gray-500 mt-1">{formatDate(order.createdAt)}</div>
                  </div>
                  <StatusBadge status={order.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Measurement Form */}
      {showMeasurementForm && (
        <MeasurementForm 
          clientId={client.id}
          onSubmit={async (data) => {
            await onAddMeasurement(client.id, data);
            setShowMeasurementForm(false);
          }}
          onClose={() => setShowMeasurementForm(false)}
        />
      )}

      {/* Edit Client Form */}
      {showEditForm && (
        <ClientForm 
          client={client}
          onSubmit={async (data) => {
            await onUpdateClient(client.id, data);
            setShowEditForm(false);
          }}
          onClose={() => setShowEditForm(false)}
        />
      )}
    </div>
  );
}

function MeasurementForm({ clientId, onSubmit, onClose }) {
  const [formData, setFormData] = useState({
    chest: '',
    waist: '',
    hip: '',
    shoulder: '',
    sleeveLength: '',
    trouserLength: '',
    neck: '',
    height: '',
    measurementUnit: 'inches',
    notes: ''
  });
  const [showCamera, setShowCamera] = useState(false);

  const handleCameraCapture = (estimatedMeasurements) => {
    // Convert estimated measurements to form data
    const cameraData = {
      ...formData,
      chest: estimatedMeasurements.chest || '',
      waist: estimatedMeasurements.waist || '',
      hip: estimatedMeasurements.hip || '',
      shoulder: estimatedMeasurements.shoulder || '',
      sleeveLength: estimatedMeasurements.sleeveLength || '',
      trouserLength: estimatedMeasurements.trouserLength || '',
      neck: estimatedMeasurements.neck || '',
      height: estimatedMeasurements.height || '',
      measurementUnit: 'inches'
    };
    setFormData(cameraData);
    setShowCamera(false);
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    const cleanData = {};
    Object.keys(formData).forEach(key => {
      if (formData[key] !== '' && formData[key] !== null) {
        cleanData[key] = ['measurementUnit', 'notes'].includes(key) 
          ? formData[key] 
          : parseFloat(formData[key]) || formData[key];
      }
    });
    onSubmit(cleanData);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-40">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
            <h3 className="text-lg font-semibold">Add Measurement</h3>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="p-4 space-y-4">
            <button
              type="button"
              onClick={() => setShowCamera(true)}
              className="w-full px-4 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-lg font-medium flex items-center justify-center gap-2"
            >
              <Camera className="w-5 h-5" />
              Capture Measurements with Camera
            </button>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or enter manually</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input 
                label="Chest"
                type="number"
                step="0.1"
                value={formData.chest}
                onChange={(e) => setFormData({...formData, chest: e.target.value})}
                placeholder="0.0"
              />
              <Input 
                label="Waist"
                type="number"
                step="0.1"
                value={formData.waist}
                onChange={(e) => setFormData({...formData, waist: e.target.value})}
                placeholder="0.0"
              />
              <Input 
                label="Hip"
                type="number"
                step="0.1"
                value={formData.hip}
                onChange={(e) => setFormData({...formData, hip: e.target.value})}
                placeholder="0.0"
              />
              <Input 
                label="Shoulder"
                type="number"
                step="0.1"
                value={formData.shoulder}
                onChange={(e) => setFormData({...formData, shoulder: e.target.value})}
                placeholder="0.0"
              />
              <Input 
                label="Sleeve Length"
                type="number"
                step="0.1"
                value={formData.sleeveLength}
                onChange={(e) => setFormData({...formData, sleeveLength: e.target.value})}
                placeholder="0.0"
              />
              <Input 
                label="Trouser Length"
                type="number"
                step="0.1"
                value={formData.trouserLength}
                onChange={(e) => setFormData({...formData, trouserLength: e.target.value})}
                placeholder="0.0"
              />
              <Input 
                label="Neck"
                type="number"
                step="0.1"
                value={formData.neck}
                onChange={(e) => setFormData({...formData, neck: e.target.value})}
                placeholder="0.0"
              />
              <Input 
                label="Height"
                type="number"
                step="0.1"
                value={formData.height}
                onChange={(e) => setFormData({...formData, height: e.target.value})}
                placeholder="0.0"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
              <select 
                value={formData.measurementUnit}
                onChange={(e) => setFormData({...formData, measurementUnit: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="inches">Inches</option>
                <option value="cm">Centimeters</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea 
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="Optional notes..."
              />
            </div>
            
            <div className="flex gap-3">
              <button 
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={handleSubmit}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
              >
                Save Measurement
              </button>
            </div>
          </div>
        </div>
      </div>

      {showCamera && (
        <CameraCapture 
          onCapture={handleCameraCapture}
          onClose={() => setShowCamera(false)}
        />
      )}
    </>
  );
}

function OrdersScreen({ orders, clients, measurements, fabrics, orderFilter, setOrderFilter, onAddOrder, onUpdateOrder, onDeleteOrder, setSelectedOrder, setSelectedTab }) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Orders</h2>
        <button 
          onClick={() => setShowForm(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-lg"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { value: 'all', label: 'All' },
          { value: 'pending', label: 'Pending' },
          { value: 'in_progress', label: 'In Progress' },
          { value: 'completed', label: 'Completed' },
          { value: 'delivered', label: 'Delivered' }
        ].map(filter => (
          <button 
            key={filter.value}
            onClick={() => setOrderFilter(filter.value)}
            className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
              orderFilter === filter.value 
                ? 'bg-indigo-600 text-white' 
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Orders List */}
      <div className="space-y-3">
        {orders.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <Package className="w-12 h-12 mx-auto mb-2 text-gray-400" />
            <p className="text-gray-500">No orders found</p>
          </div>
        ) : (
          orders.map(order => {
            const client = clients.find(c => c.id === order.clientId);
            const fabric = fabrics.find(f => f.orderId === order.id);
            
            return (
              <div 
                key={order.id}
                onClick={() => {
                  setSelectedOrder(order);
                  setSelectedTab('orderDetail');
                }}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-semibold text-gray-900">{order.orderNumber}</div>
                    <div className="text-sm text-gray-600">{client?.fullName}</div>
                  </div>
                  <StatusBadge status={order.status} />
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <span className="text-gray-600 capitalize">{order.garmentType}</span>
                    {fabric && <span className="text-gray-400 ml-2">• {fabric.fabricType}</span>}
                  </div>
                  {order.expectedDeliveryDate && (
                    <div className="text-gray-500 flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {formatDate(order.expectedDeliveryDate)}
                    </div>
                  )}
                </div>
                
                {order.totalPrice && (
                  <div className="mt-2 pt-2 border-t text-sm">
                    <span className="text-gray-600">Total:</span>
                    <span className="ml-2 font-semibold">₦{order.totalPrice.toLocaleString()}</span>
                    {order.amountPaid > 0 && (
                      <span className="ml-2 text-green-600">
                        (Paid: ₦{order.amountPaid.toLocaleString()})
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Order Form */}
      {showForm && (
        <OrderForm 
          clients={clients}
          measurements={measurements}
          onSubmit={async (orderData, fabricData) => {
            await onAddOrder(orderData, fabricData);
            setShowForm(false);
          }}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

function OrderForm({ clients, measurements, onSubmit, onClose, order }) {
  const [step, setStep] = useState(1);
  const [orderData, setOrderData] = useState({
    clientId: order?.clientId || '',
    measurementId: order?.measurementId || '',
    garmentType: order?.garmentType || '',
    expectedDeliveryDate: order?.expectedDeliveryDate || '',
    totalPrice: order?.totalPrice || '',
    notes: order?.notes || ''
  });
  
  const [fabricData, setFabricData] = useState({
    fabricType: '',
    color: '',
    pattern: '',
    quantity: '',
    quantityUnit: 'yards',
    imagePath: '',
    notes: ''
  });

  const [imagePreview, setImagePreview] = useState(null);

  const clientMeasurements = orderData.clientId 
    ? measurements.filter(m => m.clientId === parseInt(orderData.clientId)).sort((a, b) => 
        new Date(b.recordedAt) - new Date(a.recordedAt)
      )
    : [];

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
        setFabricData({...fabricData, imagePath: reader.result});
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!orderData.clientId || !orderData.garmentType) {
      alert('Please fill in required fields');
      return;
    }
    
    const finalOrderData = {
      ...orderData,
      clientId: parseInt(orderData.clientId),
      measurementId: orderData.measurementId ? parseInt(orderData.measurementId) : null,
      totalPrice: orderData.totalPrice ? parseFloat(orderData.totalPrice) : null
    };
    
    const finalFabricData = fabricData.fabricType ? {
      ...fabricData,
      quantity: fabricData.quantity ? parseFloat(fabricData.quantity) : null
    } : null;
    
    onSubmit(finalOrderData, finalFabricData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <h3 className="text-lg font-semibold">New Order - Step {step} of 3</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 space-y-4">
          {step === 1 && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client *</label>
                <select 
                  value={orderData.clientId}
                  onChange={(e) => setOrderData({...orderData, clientId: e.target.value, measurementId: ''})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select client</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>{client.fullName}</option>
                  ))}
                </select>
              </div>
              
              {clientMeasurements.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Measurement</label>
                  <select 
                    value={orderData.measurementId}
                    onChange={(e) => setOrderData({...orderData, measurementId: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select measurement (optional)</option>
                    {clientMeasurements.map(m => (
                      <option key={m.id} value={m.id}>
                        {formatDate(m.recordedAt)} - Chest: {m.chest || 'N/A'}", Waist: {m.waist || 'N/A'}"
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              <Input 
                label="Garment Type *"
                value={orderData.garmentType}
                onChange={(e) => setOrderData({...orderData, garmentType: e.target.value})}
                placeholder="e.g., Shirt, Trouser, Suit"
              />
              
              <Input 
                label="Expected Delivery Date"
                type="date"
                value={orderData.expectedDeliveryDate}
                onChange={(e) => setOrderData({...orderData, expectedDeliveryDate: e.target.value})}
              />
              
              <Input 
                label="Total Price (₦)"
                type="number"
                value={orderData.totalPrice}
                onChange={(e) => setOrderData({...orderData, totalPrice: e.target.value})}
                placeholder="0.00"
              />
            </>
          )}
          
          {step === 2 && (
            <>
              <div className="text-sm text-gray-600 mb-4">Add fabric details (optional)</div>
              
              <Input 
                label="Fabric Type"
                value={fabricData.fabricType}
                onChange={(e) => setFabricData({...fabricData, fabricType: e.target.value})}
                placeholder="e.g., Cotton, Silk, Wool"
              />
              
              <div className="grid grid-cols-2 gap-3">
                <Input 
                  label="Color"
                  value={fabricData.color}
                  onChange={(e) => setFabricData({...fabricData, color: e.target.value})}
                  placeholder="e.g., Blue"
                />
                
                <Input 
                  label="Pattern"
                  value={fabricData.pattern}
                  onChange={(e) => setFabricData({...fabricData, pattern: e.target.value})}
                  placeholder="e.g., Striped"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <Input 
                  label="Quantity"
                  type="number"
                  step="0.1"
                  value={fabricData.quantity}
                  onChange={(e) => setFabricData({...fabricData, quantity: e.target.value})}
                  placeholder="0.0"
                />
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <select 
                    value={fabricData.quantityUnit}
                    onChange={(e) => setFabricData({...fabricData, quantityUnit: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="yards">Yards</option>
                    <option value="meters">Meters</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fabric Image</label>
                <input 
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
                {imagePreview && (
                  <img src={imagePreview} alt="Preview" className="mt-2 w-full h-32 object-cover rounded" />
                )}
              </div>
            </>
          )}
          
          {step === 3 && (
            <>
              <div className="text-sm text-gray-600 mb-4">Review your order</div>
              
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div>
                  <div className="text-xs text-gray-500">Client</div>
                  <div className="font-medium">{clients.find(c => c.id === parseInt(orderData.clientId))?.fullName}</div>
                </div>
                
                <div>
                  <div className="text-xs text-gray-500">Garment Type</div>
                  <div className="font-medium">{orderData.garmentType}</div>
                </div>
                
                {orderData.expectedDeliveryDate && (
                  <div>
                    <div className="text-xs text-gray-500">Delivery Date</div>
                    <div className="font-medium">{formatDate(orderData.expectedDeliveryDate)}</div>
                  </div>
                )}
                
                {orderData.totalPrice && (
                  <div>
                    <div className="text-xs text-gray-500">Total Price</div>
                    <div className="font-medium">₦{parseFloat(orderData.totalPrice).toLocaleString()}</div>
                  </div>
                )}
                
                {fabricData.fabricType && (
                  <div className="pt-3 border-t">
                    <div className="text-xs text-gray-500 mb-2">Fabric Details</div>
                    <div className="text-sm space-y-1">
                      <div>Type: {fabricData.fabricType}</div>
                      {fabricData.color && <div>Color: {fabricData.color}</div>}
                      {fabricData.quantity && <div>Quantity: {fabricData.quantity} {fabricData.quantityUnit}</div>}
                    </div>
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea 
                  value={orderData.notes}
                  onChange={(e) => setOrderData({...orderData, notes: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Optional notes..."
                />
              </div>
            </>
          )}
          
          <div className="flex gap-3">
            {step > 1 && (
              <button 
                type="button"
                onClick={() => setStep(step - 1)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Back
              </button>
            )}
            {step < 3 ? (
              <button 
                type="button"
                onClick={() => setStep(step + 1)}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
              >
                Next
              </button>
            ) : (
              <button 
                type="button"
                onClick={handleSubmit}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
              >
                Create Order
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// helper to build a plain-text receipt for sharing
const generateReceiptText = (order, client, measurement, fabric) => {
  const lines = [];
  lines.push(`Order #: ${order.orderNumber}`);
  lines.push(`Client: ${client?.fullName || 'N/A'}`);
  if (order.garmentType) lines.push(`Garment: ${order.garmentType}`);
  if (order.expectedDeliveryDate) lines.push(`Delivery: ${formatDate(order.expectedDeliveryDate)}`);
  if (order.totalPrice) lines.push(`Total Price: ₦${order.totalPrice.toLocaleString()}`);
  if (order.amountPaid) lines.push(`Amount Paid: ₦${order.amountPaid.toLocaleString()}`);
  const balance = order.totalPrice ? order.totalPrice - (order.amountPaid || 0) : 0;
  if (order.totalPrice) lines.push(`Balance: ₦${balance.toLocaleString()}`);
  lines.push(`Status: ${order.status.replace('_', ' ')}`);

  if (measurement) {
    lines.push('--- Measurements ---');
    Object.entries(measurement).forEach(([k,v]) => {
      if (['id','clientId','recordedAt'].includes(k)) return;
      lines.push(`${k.replace(/([A-Z])/g,' $1')}: ${v}"`);
    });
  }
  if (fabric) {
    lines.push('--- Fabric ---');
    if (fabric.fabricType) lines.push(`Type: ${fabric.fabricType}`);
    if (fabric.color) lines.push(`Color: ${fabric.color}`);
    if (fabric.quantity) lines.push(`Quantity: ${fabric.quantity} ${fabric.quantityUnit}`);
  }
  if (order.notes) {
    lines.push('--- Notes ---');
    lines.push(order.notes);
  }
  return lines.join('\n');
};

function OrderDetailScreen({ order, client, measurement, fabric, onBack, onUpdateOrder, onDeleteOrder }) {
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState(order.status);
  const [amountPaid, setAmountPaid] = useState(order.amountPaid || 0);

  const handleStatusUpdate = async () => {
    await onUpdateOrder(order.id, { status, amountPaid: parseFloat(amountPaid) });
    setEditing(false);
  };

  const handleDelete = async () => {
    if (window.confirm('Delete this order?')) {
      await onDeleteOrder(order.id);
      onBack();
    }
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(generateReceiptText(order, client, measurement, fabric));
    const url = `https://wa.me/?text=${text}`;
    window.open(url, '_blank');
  };

  const handleShareEmail = () => {
    const body = encodeURIComponent(generateReceiptText(order, client, measurement, fabric));
    const subject = `Order Receipt ${order.orderNumber}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${body}`;
  };

  const balance = order.totalPrice ? order.totalPrice - amountPaid : 0;

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex gap-2">
          <button
            onClick={handleShareWhatsApp}
            className="p-2 hover:bg-gray-100 rounded-lg text-green-600"
            title="Share receipt via WhatsApp"
          >
            <MessageCircle className="w-5 h-5" />
          </button>
          <button
            onClick={handleShareEmail}
            className="p-2 hover:bg-gray-100 rounded-lg text-blue-600"
            title="Share receipt via Email"
          >
            <Mail className="w-5 h-5" />
          </button>
          <button 
            onClick={handleDelete}
            className="p-2 hover:bg-gray-100 rounded-lg text-red-600"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Order Info */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">{order.orderNumber}</h2>
            <p className="text-sm text-gray-500">Created {formatDate(order.createdAt)}</p>
          </div>
          <StatusBadge status={status} />
        </div>
        
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Client:</span>
            <span className="font-medium">{client?.fullName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Garment Type:</span>
            <span className="font-medium capitalize">{order.garmentType}</span>
          </div>
          {order.expectedDeliveryDate && (
            <div className="flex justify-between">
              <span className="text-gray-600">Expected Delivery:</span>
              <span className="font-medium">{formatDate(order.expectedDeliveryDate)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Payment Info */}
      {order.totalPrice && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Payment Details</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Price:</span>
              <span className="font-semibold">₦{order.totalPrice.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Amount Paid:</span>
              {editing ? (
                <input 
                  type="number"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  className="w-32 px-2 py-1 border rounded text-right"
                />
              ) : (
                <span className="font-medium text-green-600">₦{order.amountPaid.toLocaleString()}</span>
              )}
            </div>
            <div className="flex justify-between pt-2 border-t">
              <span className="text-gray-600">Balance:</span>
              <span className={`font-semibold ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                ₦{balance.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Status Update */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Order Status</h3>
        {editing ? (
          <div className="space-y-3">
            <select 
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  setStatus(order.status);
                  setAmountPaid(order.amountPaid);
                  setEditing(false);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleStatusUpdate}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
              >
                Save Changes
              </button>
            </div>
          </div>
        ) : (
          <button 
            onClick={() => setEditing(true)}
            className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
          >
            Update Status
          </button>
        )}
      </div>

      {/* Measurement */}
      {measurement && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Measurements Used</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {measurement.chest && <div><span className="text-gray-600">Chest:</span> <span className="font-medium">{measurement.chest}"</span></div>}
            {measurement.waist && <div><span className="text-gray-600">Waist:</span> <span className="font-medium">{measurement.waist}"</span></div>}
            {measurement.hip && <div><span className="text-gray-600">Hip:</span> <span className="font-medium">{measurement.hip}"</span></div>}
            {measurement.shoulder && <div><span className="text-gray-600">Shoulder:</span> <span className="font-medium">{measurement.shoulder}"</span></div>}
            {measurement.sleeveLength && <div><span className="text-gray-600">Sleeve:</span> <span className="font-medium">{measurement.sleeveLength}"</span></div>}
            {measurement.trouserLength && <div><span className="text-gray-600">Trouser:</span> <span className="font-medium">{measurement.trouserLength}"</span></div>}
          </div>
        </div>
      )}

      {/* Fabric */}
      {fabric && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Fabric Details</h3>
          {fabric.imagePath && (
            <img src={fabric.imagePath} alt="Fabric" className="w-full h-48 object-cover rounded-lg mb-4" />
          )}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Type:</span>
              <span className="font-medium">{fabric.fabricType}</span>
            </div>
            {fabric.color && (
              <div className="flex justify-between">
                <span className="text-gray-600">Color:</span>
                <span className="font-medium">{fabric.color}</span>
              </div>
            )}
            {fabric.pattern && (
              <div className="flex justify-between">
                <span className="text-gray-600">Pattern:</span>
                <span className="font-medium">{fabric.pattern}</span>
              </div>
            )}
            {fabric.quantity && (
              <div className="flex justify-between">
                <span className="text-gray-600">Quantity:</span>
                <span className="font-medium">{fabric.quantity} {fabric.quantityUnit}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notes */}
      {order.notes && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-2">Notes</h3>
          <p className="text-sm text-gray-700">{order.notes}</p>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    pending: 'bg-yellow-100 text-yellow-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    delivered: 'bg-purple-100 text-purple-800',
    cancelled: 'bg-red-100 text-red-800'
  };

  const labels = {
    pending: 'Pending',
    in_progress: 'In Progress',
    completed: 'Completed',
    delivered: 'Delivered',
    cancelled: 'Cancelled'
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function Input({ label, type = 'text', value, onChange, placeholder, required = false, ...props }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input 
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        {...props}
      />
    </div>
  );
}