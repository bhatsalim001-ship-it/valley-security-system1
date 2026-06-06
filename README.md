# Valley Security System - Professional Employee Management & ID Card Generation

Valley Security Service Agency's comprehensive, modern office management system. Replace pen-and-paper registration with a professional digital solution. Generate instant, print-ready ID cards with QR codes for instant verification.

---

## 🚀 Quick Start (Deploy Locally on Windows/Mac/Linux)

### Prerequisites
* **Node.js**: Download from [nodejs.org](https://nodejs.org/) (free, required on host computer only)

### Launch the Server

1. **Open Terminal/Command Prompt** on your computer
2. **Navigate to the project folder**:
   ```bash
   cd valley-security-system
   ```
3. **Install dependencies** (first time only):
   ```bash
   npm install
   ```
4. **Start the server**:
   ```bash
   npm start
   ```

You should see:
```
================================================================
 VALLEY SECURITY AGENCY - EMPLOYEE MANAGEMENT & ID SYSTEM SERVER
================================================================
[Local Server] Running locally at: http://localhost:3000
[LAN Office Network] Access from other computers at: http://192.168.x.x:3000
================================================================
```

5. **Open your browser** and go to: `http://localhost:3000`

---

## 💻 Access from Other Computers in Your Office

All computers must be connected to the **same Wi-Fi/Network**:

1. On another computer, open **Google Chrome** or any browser
2. Enter the **LAN address** from the console (e.g., `http://192.168.1.50:3000`)
3. The system loads automatically - all computers sync to the same database!

---

## ✨ Key Features

### 1. **Professional Employee Registration Form**
- **Fill Once, Use Forever**: Register new employees with one comprehensive form
- **All Details Captured**: Name, Father's Name, Address, Phone, Blood Group, Designation, Place of Work, Emergency Contact
- **Photo & Signature Upload**: Upload passport-size photos and signature scans directly
- **Document Status Tracking**: Aadhaar, PAN, and Police Clearance verification status
- **Auto-Population**: Fill the form once, and all ID cards automatically populate

### 2. **Instant ID Card Generation**
- **Single-Sided, Print-Ready**: Professional 850x540px layout ready to print
- **Auto-Populated Fields**:
  - All employee details from registration
  - Company logo and branding
  - Employee photo
  - QR code for verification
  - Valid from/to dates
  - Blood group
  - Signature
- **No Manual Entry**: All data pulls directly from registration form

### 3. **Smart QR Code Verification**
- **Scannable with Any Phone**: Use Google Chrome camera or QR scanner app
- **Instant ID Verification**: Click the link to verify employee details
- **Security Ready**: Links to built-in verification page

### 4. **Print & Download Options**
- **Print Directly**: Use Ctrl+P → Print to PDF to save as image
- **Professional Quality**: Print on standard A4 paper or ID card stock
- **Color-Accurate**: High-quality color output for photo printing

### 5. **Professional Dashboard**
- **Dark Professional Theme**: Easy on the eyes, modern office look
- **Employee Directory**: Search, filter, and manage all employees
- **Client Site Management**: Track where each employee is deployed
- **Asset Tracking**: Uniform, equipment, and asset management
- **Backup & Export**: Export database as JSON for backups

---

## 📋 Workflow: From Registration to ID Card

1. **Click "Register New Employee"** in the Employees section
2. **Fill the comprehensive form** with all employee details
3. **Upload photo and signature**
4. **Click "Save & Generate ID Card"**
5. **Review the single-sided ID card preview**
6. **Print using Ctrl+P or download as PDF**
7. **Done!** - No manual ID card creation needed

---

## 🎨 UI Customizations

### Professional Office Theme
- Dark blue/navy background with gold accents
- Clean, minimal sidebar navigation
- Responsive cards and forms
- Professional typography

### Responsive Design
- Works on desktop computers
- Optimized for tablets (iPad, Android)
- Mobile-friendly interface
- Accessible color contrast

---

## 💾 Data Management

### Automatic Storage
- Database automatically saves to `db.json` in the project folder
- All computers access the same central database
- No internet required - completely offline

### Backup & Restore
- **Export**: Download complete database as JSON file
- **Import**: Restore from backup file
- Located in Settings section

---

## 🔧 File Structure

```
valley-security-system/
├── server.js                 # Node.js express server
├── db.json                   # Employee database (auto-created)
├── package.json              # Dependencies
├── README.md                 # This file
└── public/
    ├── index.html            # Main app (improved UI)
    ├── styles.css            # Professional styling
    ├── app.js                # Frontend logic
    └── verification.html     # QR verification page
```

---

## 🎯 Use Cases

✅ **Security Guards** - Track all personnel  
✅ **Deployment Management** - Monitor who works where  
✅ **ID Card Generation** - Professional, instant ID cards  
✅ **Asset Tracking** - Uniforms, equipment, tools  
✅ **Emergency Contacts** - Quick access to contact information  
✅ **Document Verification Status** - Track Aadhaar, PAN, Police clearance  

---

## 📱 Accessing from Employees' Phones

Employees can verify ID card validity by:
1. **Scanning the QR code** on the ID card with their phone camera
2. **Clicking the link** shown
3. **Viewing their verified details** on the verification page

---

## 🛑 Troubleshooting

### "Cannot find module" error
```bash
# Solution: Install dependencies
npm install
```

### Port 3000 already in use
```bash
# Try a different port
node server.js --port 3001
```

### Connection from other computers fails
- Ensure both computers are on **same Wi-Fi network**
- Check if firewall is blocking port 3000 (Windows Defender, antivirus)
- Disable VPN if using one

### QR Code verification page not appearing
- Keep the system server running
- Use the exact URL from the QR code (including `http://` and IP address)

---

## 📞 Support

All employee data stored locally. No cloud service. Completely free and offline!

**For Questions**: Review the in-app help text or check the database structure in `db.json`

---

## 📄 License

ISC - Valley Security Service Agency, 2026
* **3D Tilting**: Stat cards and ID badges tilt in 3D perspective as your mouse moves over them.

### 2. ID Card Generation
1. Select an employee from the dropdown list.
2. Choose an accent theme (Brushed Gold, Electric Blue, Crimson, or Emerald).
3. Set the validity period (default is 3 years).
4. Review the double-sided badge (use "Flip Card View" to look at the back side).
5. Click **Download / Print** to output the badge directly to your card printer (styled for standard CR-80 card sizes).

### 3. QR Verification System
* Every generated badge includes a QR code printed on the back.
* Scanning the QR code with any smartphone will open the public-facing `verification.html` portal showing their verified status, designation, and location.

### 4. Backups and Settings
* Navigate to the **Settings** view in the sidebar.
* Use **Export Backup JSON** to save a complete file copy of all employee records, documents, deployments, and assets.
* Use **Import Backup File** to restore data or migrate to a new main host computer instantly.
