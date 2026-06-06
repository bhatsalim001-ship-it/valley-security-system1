# Valley Security System - Deployment & Usage Guide

## ✅ System Successfully Deployed!

Your professional employee management and ID card generation system is ready to use!

---

## 🚀 How to Run the System

### Starting the Server (Windows)

1. **Open Command Prompt** or **PowerShell**
2. **Navigate to the project folder**:
   ```cmd
   cd valley-security-system
   ```
3. **Start the server**:
   ```cmd
   npm start
   ```

4. **Open your browser** to: `http://localhost:3000`

### Current Network Addresses
- 🖥️ **Local Computer**: `http://localhost:3000`
- 🌐 **Other Computers (Same Network)**: 
  - `http://192.168.56.1:3000`
  - `http://192.168.1.8:3000`

---

## 📋 Complete Workflow: Employee Registration → ID Card

### Step 1: Register New Employee

1. Click **"Employees"** in the sidebar
2. Click **"Register New Employee"** button
3. **Fill out the comprehensive form**:
   - Personal Information (Name, Father's Name, DOB, Blood Group, etc.)
   - Contact Details (Phone, Email, Address)
   - Address Details (Permanent & Current Address)
   - Employment Details (Designation, Place of Work, Joining Date)
   - Emergency Contact Information
   - **Upload Photo (Required for ID card)** 
   - **Upload Signature/Initial (Required for ID card)**
   - Document verification status

4. Click **"Save & Generate ID Card"**

### Step 2: Generate ID Card

1. System automatically navigates to **ID Card Generation**
2. Select the employee you just added from the dropdown
3. Choose card validity period (1, 2, 3, or 5 years)
4. **Review the single-sided ID card** with:
   - Employee photo
   - Name, Father's Name, Address
   - Phone Number, Place of Work
   - Blood Group
   - Employee ID and Validity Dates
   - QR Code (scannable for verification)
   - Employee Signature

### Step 3: Print or Download

1. **To Print**: Press `Ctrl+P` (or Cmd+P on Mac)
2. **Select**: "Print to PDF" or your physical printer
3. **For ID Card Stock**: Choose "A4" or appropriate paper size
4. **Done!** Your professional ID card is ready

---

## 🎯 Key Features You Can Use

### 1. **Employee Management**
- ✅ Add new employees with comprehensive details
- ✅ Edit existing employee records
- ✅ Search employees by name, ID, or designation
- ✅ Filter by status (Active, Inactive, Suspended)
- ✅ View complete employee directory

### 2. **Professional ID Cards**
- ✅ Auto-populated with all registration details
- ✅ Single-sided professional layout
- ✅ Scannable QR codes for instant verification
- ✅ Photo and signature automatically included
- ✅ Print-ready in high quality

### 3. **Client/Site Management**
- ✅ Register client sites/deployment locations
- ✅ Track which employees are deployed where
- ✅ Monitor personnel at each location

### 4. **Asset Tracking**
- ✅ Track uniforms, equipment, and tools
- ✅ Issue assets to employees
- ✅ Track return of equipment

### 5. **Database Backup**
- ✅ Export complete database as JSON file
- ✅ Import from backup files
- ✅ All data stored locally (no internet needed)

---

## 🖼️ ID Card Layout (Single-Sided)

Your professional ID cards feature:

**Left Side:**
- Employee photo
- QR code (scannable with phone camera)

**Right Side:**
- Company logo and branding
- Employee Name (Large, prominent)
- Father's Name
- Address
- Phone Number
- Place of Work
- Blood Group
- Valid From/To dates
- Employee Signature

---

## 📱 QR Code Verification

Employees can verify their ID card by:

1. **Scan the QR code** on the ID card with their phone
2. Click the link that appears
3. View verified employee details on the verification page
4. Confirmation that ID is authentic and valid

---

## 💾 Data Storage

- **Database Location**: `db.json` (in the project folder)
- **Automatic Saving**: All changes auto-save to database
- **No Internet Required**: Completely offline system
- **Backup**: Export database regularly

---

## 🌐 Accessing from Other Computers

All staff in your office can access the system:

1. **Ensure computers are on the same Wi-Fi/Network**
2. **Open browser** (Chrome recommended)
3. **Enter LAN address** from server console (e.g., `http://192.168.1.8:3000`)
4. System loads instantly - all computers share the same database

---

## 🎨 Professional UI Features

- **Dark Professional Theme**: Modern office appearance
- **Gold Accents**: Premium, professional look
- **Responsive Design**: Works on desktop, tablet, mobile
- **Custom Cursor**: Smooth, professional interactions
- **Easy Navigation**: Clear sidebar menu

---

## ❌ Stopping the Server

Press `Ctrl+C` in the Command Prompt/Terminal window

---

## 🆘 Troubleshooting

### Issue: "Cannot find module 'express'"
**Solution**: Run `npm install` to install dependencies

### Issue: "Port 3000 already in use"
**Solution**: 
- Close the application and restart, OR
- Modify the PORT in `server.js` to 3001

### Issue: Can't access from other computers
**Solution**:
- Ensure both computers are on same network
- Check firewall settings (allow port 3000)
- Try using the exact IP address from console

### Issue: Photos/Signatures not appearing on ID card
**Solution**:
- Ensure files are uploaded during registration
- Supported formats: JPG, PNG, GIF
- Maximum file size: 500KB recommended

---

## 📞 Quick Tips

- 💡 **Always keep the server running** to access the system
- 💡 **Backup your database** regularly (Settings → Export Backup)
- 💡 **Print ID cards on quality paper** for professional appearance
- 💡 **Test QR codes** with your phone to ensure they work
- 💡 **Keep employee photos in good lighting** for best ID card quality

---

## 🎓 Example Workflow

**Scenario**: New security guard "Raj Kumar" joins

1. Click "Employees" → "Register New Employee"
2. Fill form with Raj's details
3. Upload Raj's passport photo and signature
4. Click "Save & Generate ID Card"
5. Review ID card (automatically populated)
6. Print ID card with Ctrl+P
7. Done! Raj's official ID card is ready

---

## ✨ Advantages of This System

✅ **Replace pen & paper** with digital registration  
✅ **Professional ID cards** in seconds  
✅ **No manual data entry** (auto-populated fields)  
✅ **Instant verification** with QR codes  
✅ **Offline operation** (no internet needed)  
✅ **Complete employee database** in one place  
✅ **Free, open-source** system  
✅ **Deploy locally** on your office network  

---

## 📄 File Information

- **Server**: `server.js` (Express.js backend)
- **Frontend**: `public/index.html, public/app.js, public/styles.css`
- **Database**: `db.json` (automatically created)
- **Dependencies**: Node.js (Express, CORS)

---

**Valley Security Service Agency Employee Management System v1.0**  
*Deployed: June 4, 2026*
