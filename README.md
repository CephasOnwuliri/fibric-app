# FIBRIC - Digital Tailoring Management System

![FIBRIC](https://img.shields.io/badge/version-1.0.0-blue.svg)
![React](https://img.shields.io/badge/react-18.2.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

A modern, mobile-first web application designed for professional tailors to digitally manage client measurements, fabric records, and tailoring orders, reducing disputes and improving workflow efficiency.

## ✨ Features

### Authentication & Security
- 🔐 Secure user registration and login
- 🔑 Password hashing with SHA-256
- 👁️ Password visibility toggle
- 💾 Persistent sessions with IndexedDB

### Client Management
- 👥 Create, view, edit, and delete client profiles
- 📱 Store client contact information
- 📝 Add custom notes for each client
- 🔍 Quick search by name or phone number

### Measurement Tracking
- 📏 Digital forms for body measurements (chest, waist, hip, shoulder, sleeve, trouser, neck, height)
- ⏰ Automatic timestamping of measurements
- 📊 Complete measurement history preservation
- 🔄 Update measurements without overwriting past data
- 📐 Support for inches and centimeters

### Fabric Management
- 🧵 Record fabric type, color, pattern, and quantity
- 📸 Upload fabric images
- 🔗 Link fabrics to specific orders
- 📦 Track fabric quantities in yards or meters

### Order Management
- 📋 3-step order creation wizard
- 🔗 Link orders to clients and measurements
- 📊 Order status tracking (pending, in progress, completed, delivered, cancelled)
- 📅 Expected delivery date tracking
- 💰 Payment tracking (total price, amount paid, balance)
- 🔢 Auto-generated unique order numbers
- 📤 Shareable order receipts via WhatsApp or email directly from order page

### Dashboard & Analytics
- 📈 Quick statistics overview
- ⚡ Due today alerts
- 📜 Recent orders list
- 🎯 Status-based filtering

## 🚀 Tech Stack

- **Frontend Framework**: React 18
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Database**: IndexedDB (browser-based, offline-first)
- **Build Tool**: Vite
- **Language**: JavaScript (ES6+)

## 📦 Installation

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/fibric-app.git
   cd fibric-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run development server**
   ```bash
   npm run dev
   ```
   The app will open at `http://localhost:3000`

4. **Build for production**
   ```bash
   npm run build
   ```
   Production files will be in the `dist/` folder

5. **Preview production build**
   ```bash
   npm run preview
   ```

## 🌐 Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Go to [Vercel](https://vercel.com)
3. Click "Import Project"
4. Select your repository
5. Vercel will auto-detect Vite settings
6. Click "Deploy"

### Deploy to Netlify

1. Push your code to GitHub
2. Go to [Netlify](https://netlify.com)
3. Click "Add new site" → "Import an existing project"
4. Select your repository
5. Build command: `npm run build`
6. Publish directory: `dist`
7. Click "Deploy"

### Custom Domain Setup

**Vercel:**
1. Go to Project Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed

**Netlify:**
1. Go to Domain Settings
2. Add custom domain
3. Follow DNS configuration steps

## 📱 Usage

### First Time Setup
1. Open the application
2. Click "Create new account"
3. Fill in your details:
   - Full name
   - Phone number
   - Password (min 4 characters)
   - Business name (optional)
4. Click "Register"

### Adding Clients
1. Navigate to "Clients" tab
2. Click the "+" button
3. Enter client details
4. Click "Add Client"

### Recording Measurements
1. Open a client's detail page
2. Click "Add New" under measurements
3. Enter body measurements
4. Click "Save Measurement"

### Creating Orders
1. Go to "Orders" tab
2. Click "+" button
3. Follow the 3-step wizard:
   - **Step 1**: Select client, measurements, garment type, delivery date, price
   - **Step 2**: Add fabric details and upload image
   - **Step 3**: Review and confirm
4. Click "Create Order"

### Tracking Orders
1. View all orders in the "Orders" tab
2. Filter by status (All, Pending, In Progress, Completed, Delivered)
3. Click an order to view details
4. Update status and payment information

## 🗄️ Database Schema

The application uses IndexedDB with the following stores:

### Tailors
- id, fullName, phoneNumber, passwordHash, businessName, createdAt, updatedAt

### Clients
- id, tailorId, fullName, phoneNumber, gender, notes, createdAt, updatedAt

### Measurements
- id, clientId, chest, waist, hip, shoulder, sleeveLength, trouserLength, neck, height, measurementUnit, notes, recordedAt

### Orders
- id, clientId, measurementId, orderNumber, garmentType, status, expectedDeliveryDate, actualDeliveryDate, totalPrice, amountPaid, notes, createdAt, updatedAt

### Fabrics
- id, orderId, fabricType, color, pattern, quantity, quantityUnit, imagePath, notes, createdAt

### Session
- key, value (stores current user session)

## 🔒 Security Features

- Password hashing using SHA-256
- Session-based authentication
- Data stored locally (client-side)
- No server-side data exposure
- Secure client-tailor relationship enforcement

## 📊 Performance

- ⚡ Lightweight bundle size
- 📱 Optimized for low-end Android devices
- 🔌 Works completely offline
- 💨 Fast IndexedDB operations (<100ms)
- 🎯 Minimal re-renders with React optimization

## 🛠️ Future Enhancements

- [ ] Cloud backup and sync
- [ ] Multi-device support
- [ ] PDF receipt generation
- [ ] SMS notifications
- [ ] WhatsApp integration
- [ ] Advanced analytics dashboard
- [ ] Export data to Excel/CSV
- [ ] Dark mode support
- [ ] Multi-language support

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👨‍💻 Author

**FIBRIC Development Team**

- Developed By Cephas Onwuliri
- Designed for professional tailors
- Built with modern web technologies

## 📞 Support

For support, email dambi032@gmail.com or open an issue in the GitHub repository.

## 🙏 Acknowledgments

- Icons by [Lucide](https://lucide.dev/)
- UI inspiration from modern design systems
- Built with [React](https://react.dev/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)

---

**Made with ❤️ for tailors worldwide**