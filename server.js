const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const PORT = 3000;
const DB_PATH = path.join(__dirname, 'db.json');

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Support base64 images
app.use(express.static(path.join(__dirname, 'public')));

// Initialize database if it doesn't exist
const initialData = {
  employees: [
    {
      id: "VSA-1001",
      name: "Rajesh Kumar",
      fatherName: "Sohan Lal Kumar",
      dob: "1988-10-15",
      gender: "Male",
      bloodGroup: "O+",
      maritalStatus: "Married",
      mobile: "9876543210",
      altMobile: "9876543211",
      email: "rajesh.vsa@gmail.com",
      permanentAddress: "124, Sector 4, Salt Lake, Kolkata",
      currentAddress: "Sector 4, Salt Lake, Kolkata",
      district: "North 24 Parganas",
      state: "West Bengal",
      pinCode: "700091",
      designation: "Security Guard",
      department: "Security Operations",
      clientLocation: "Tata Consultancy Services (TCS) - Salt Lake",
      joiningDate: "2022-04-12",
      status: "Active",
      category: "Skilled",
      reportingManager: "Vikram Rathore",
      emergencyContactName: "Priya Kumar",
      emergencyContactRelation: "Wife",
      emergencyContactMobile: "9876543215",
      documents: {
        photo: "",
        signature: "",
        aadhaar: "Completed",
        pan: "Completed",
        policeVerification: "Verified"
      },
      assets: [
        { name: "Uniform", issueDate: "2022-04-12", status: "Issued" },
        { name: "Shoes", issueDate: "2022-04-12", status: "Issued" },
        { name: "Torch", issueDate: "2022-04-12", status: "Issued" },
        { name: "Cap", issueDate: "2022-04-12", status: "Issued" }
      ]
    },
    {
      id: "VSA-1002",
      name: "Amit Sharma",
      fatherName: "Vijay Kumar Sharma",
      dob: "1992-05-20",
      gender: "Male",
      bloodGroup: "B+",
      maritalStatus: "Single",
      mobile: "9812345678",
      altMobile: "",
      email: "amit.sharma@gmail.com",
      permanentAddress: "H.No. 45, Line 3, Jammu",
      currentAddress: "H.No. 45, Line 3, Jammu",
      district: "Jammu",
      state: "Jammu & Kashmir",
      pinCode: "180001",
      designation: "Supervisor",
      department: "Field Supervision",
      clientLocation: "Wave Mall - Jammu",
      joiningDate: "2023-01-15",
      status: "Active",
      category: "Highly Skilled",
      reportingManager: "Vikram Rathore",
      emergencyContactName: "Vijay Kumar Sharma",
      emergencyContactRelation: "Father",
      emergencyContactMobile: "9812345670",
      documents: {
        photo: "",
        signature: "",
        aadhaar: "Completed",
        pan: "Completed",
        policeVerification: "Verified"
      },
      assets: [
        { name: "Uniform", issueDate: "2023-01-15", status: "Issued" },
        { name: "Shoes", issueDate: "2023-01-15", status: "Issued" },
        { name: "Belt", issueDate: "2023-01-15", status: "Issued" },
        { name: "Torch", issueDate: "2023-01-15", status: "Issued" }
      ]
    }
  ],
  clients: [
    { name: "Tata Consultancy Services (TCS) - Salt Lake", location: "Kolkata", manager: "R. K. Sen", contact: "9830012345" },
    { name: "Wave Mall - Jammu", location: "Jammu", manager: "S. K. Gupta", contact: "9419112345" },
    { name: "Reliance Retail Hub", location: "Mumbai", manager: "Amit Patel", contact: "9820098765" }
  ],
  assetsCatalog: [
    { name: "Uniform", stock: 150 },
    { name: "Shoes", stock: 100 },
    { name: "Belt", stock: 200 },
    { name: "Cap", stock: 180 },
    { name: "Torch", stock: 80 },
    { name: "Baton", stock: 120 }
  ],
  departments: [
    "Security Operations",
    "Healthcare Services",
    "Facility & Cleaning",
    "Administrative Support"
  ],
  designations: [
    "Security Guard",
    "Supervisor",
    "Staff Nurse",
    "Clinical Assistant",
    "Housekeeper",
    "Clerical Staff"
  ],
  manpowerTypes: [
    "Security Force",
    "Medical Staff",
    "General Manpower",
    "Office Staff"
  ],
  templates: [
    {
      id: "tpl-default",
      name: "Standard Luxury Security Badge",
      layout: "vertical",
      headerText: "VALLEY SECURITY SERVICE AGENCY",
      subheaderText: "SHAHEED GUNJ NATH COMPLEX SRINAGAR 190001",
      headerBgColor: "#ffffff",
      accentColor: "#d4af37",
      logo: "",
      background: "",
      signature: "",
      fields: {
        name: true,
        employeeId: true,
        designation: true,
        department: true,
        fatherName: true,
        phone: true,
        bloodGroup: true,
        permanentAddress: true
      }
    }
  ],
  users: [
    {
      email: "admin@valley-security.com",
      password: "Admin@123",
      name: "Administrator",
      role: "admin",
      createdAt: "2026-06-01"
    },
    {
      email: "user@valley-security.com",
      password: "User@123",
      name: "Standard User",
      role: "user",
      createdAt: "2026-06-01"
    }
  ]
};

// Load massive templates - Disabled
function loadMassiveTemplates() {
  return false;
}

function readDb() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2));
      return initialData;
    }
    const data = fs.readFileSync(DB_PATH, 'utf8');
    const db = JSON.parse(data);
    
    // Auto-upgrade existing db.json file with new categories
    let updated = false;
    if (!db.departments) { db.departments = initialData.departments; updated = true; }
    if (!db.designations) { db.designations = initialData.designations; updated = true; }
    if (!db.manpowerTypes) { db.manpowerTypes = initialData.manpowerTypes; updated = true; }
    if (!db.templates) { db.templates = initialData.templates; updated = true; }
    if (!db.users) { db.users = initialData.users; updated = true; }
    

    
    if (updated) {
      fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
    }
    
    return db;
  } catch (err) {
    console.error('Error reading database file:', err);
    return initialData;
  }
}

function writeDb(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error writing database file:', err);
  }
}

// LOGIN ENDPOINT
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const db = readDb();
  const user = db.users.find(u => u.email === email && u.password === password);
  
  if (user) {
    const userCopy = { ...user };
    delete userCopy.password; // Never send password back
    res.json({
      success: true,
      user: userCopy,
      message: `Welcome back, ${user.name}!`
    });
  } else {
    res.status(401).json({
      success: false,
      error: 'Invalid email or password.'
    });
  }
});

// REST API Endpoints
app.get('/api/db', (req, res) => {
  res.json(readDb());
});

app.post('/api/db/import', (req, res) => {
  const incoming = req.body;
  if (incoming.employees && incoming.clients) {
    writeDb(incoming);
    res.json({ success: true, message: 'Database imported successfully.' });
  } else {
    res.status(400).json({ success: false, error: 'Invalid database backup format.' });
  }
});

// Logout Endpoint
app.post('/api/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

// Employee Endpoints
app.get('/api/employees', (req, res) => {
  const db = readDb();
  res.json(db.employees);
});

app.post('/api/employees', (req, res) => {
  const db = readDb();
  const newEmp = req.body;
  
  // Calculate next ID
  let nextNum = 1001;
  if (db.employees.length > 0) {
    const ids = db.employees.map(e => parseInt(e.id.replace('VSA-', ''))).filter(n => !isNaN(n));
    if (ids.length > 0) {
      nextNum = Math.max(...ids) + 1;
    }
  }
  newEmp.id = `VSA-${nextNum}`;
  
  db.employees.push(newEmp);
  writeDb(db);
  res.status(201).json(newEmp);
});

app.put('/api/employees/:id', (req, res) => {
  const db = readDb();
  const index = db.employees.findIndex(e => e.id === req.params.id);
  if (index !== -1) {
    db.employees[index] = { ...db.employees[index], ...req.body, id: req.params.id };
    writeDb(db);
    res.json(db.employees[index]);
  } else {
    res.status(404).json({ error: 'Employee not found' });
  }
});

app.delete('/api/employees/:id', (req, res) => {
  const db = readDb();
  const index = db.employees.findIndex(e => e.id === req.params.id);
  if (index !== -1) {
    const deleted = db.employees.splice(index, 1);
    writeDb(db);
    res.json(deleted[0]);
  } else {
    res.status(404).json({ error: 'Employee not found' });
  }
});

// Client Endpoints
app.get('/api/clients', (req, res) => {
  const db = readDb();
  res.json(db.clients);
});

app.post('/api/clients', (req, res) => {
  const db = readDb();
  db.clients.push(req.body);
  writeDb(db);
  res.status(201).json(req.body);
});


// Classifications Endpoints
app.get('/api/classifications', (req, res) => {
  const db = readDb();
  res.json({
    departments: db.departments || [],
    designations: db.designations || [],
    manpowerTypes: db.manpowerTypes || []
  });
});

app.post('/api/classifications', (req, res) => {
  const db = readDb();
  db.departments = req.body.departments || [];
  db.designations = req.body.designations || [];
  db.manpowerTypes = req.body.manpowerTypes || [];
  writeDb(db);
  res.json({
    success: true,
    departments: db.departments,
    designations: db.designations,
    manpowerTypes: db.manpowerTypes
  });
});

// Helper to select the best physical LAN IP address
function getLANIP() {
  const networkInterfaces = os.networkInterfaces();
  let fallbackIp = 'localhost';
  
  const virtualRegex = /(virtualbox|vmware|vbox|wsl|vethernet|host-only|hostonly|hyper-v|hyperv|loopback|vpn)/i;
  let candidates = [];
  
  for (const interfaceName in networkInterfaces) {
    const interfaces = networkInterfaces[interfaceName];
    const isVirtual = virtualRegex.test(interfaceName);
    
    for (const face of interfaces) {
      if (face.family === 'IPv4' && !face.internal) {
        // Exclude virtual subnet ranges like VirtualBox host-only (192.168.56.x) and APIPA (169.254.x.x)
        const isVirtualSubnet = face.address.startsWith('192.168.56.') || face.address.startsWith('169.254.');
        
        candidates.push({
          address: face.address,
          name: interfaceName,
          isVirtual: isVirtual || isVirtualSubnet,
          isWifiOrEthernet: /wifi|wi-fi|ethernet|wlan/i.test(interfaceName)
        });
      }
    }
  }
  
  // Sort: prioritize physical interfaces first, then Wi-Fi/Ethernet names
  candidates.sort((a, b) => {
    if (a.isVirtual !== b.isVirtual) {
      return a.isVirtual ? 1 : -1;
    }
    if (a.isWifiOrEthernet !== b.isWifiOrEthernet) {
      return a.isWifiOrEthernet ? -1 : 1;
    }
    return 0;
  });
  
  if (candidates.length > 0) {
    return candidates[0].address;
  }
  return fallbackIp;
}

// LAN IP Endpoint
app.get('/api/lan-ip', (req, res) => {
  const lanIp = `${getLANIP()}:${PORT}`;
  res.json({ lanIp });
});


// Templates Endpoints
app.get('/api/templates', (req, res) => {
  const db = readDb();
  res.json(db.templates || []);
});

app.post('/api/templates', (req, res) => {
  const db = readDb();
  if (!db.templates) db.templates = [];
  const tpl = req.body;
  if (!tpl.id) {
    tpl.id = `tpl-${Date.now()}`;
    db.templates.push(tpl);
  } else {
    const idx = db.templates.findIndex(t => t.id === tpl.id);
    if (idx !== -1) {
      db.templates[idx] = tpl;
    } else {
      db.templates.push(tpl);
    }
  }
  writeDb(db);
  res.json(tpl);
});

app.delete('/api/templates/:id', (req, res) => {
  const db = readDb();
  if (!db.templates) db.templates = [];
  const idx = db.templates.findIndex(t => t.id === req.params.id);
  if (idx !== -1) {
    const deleted = db.templates.splice(idx, 1);
    writeDb(db);
    res.json(deleted[0]);
  } else {
    res.status(404).json({ error: 'Template not found' });
  }
});

// Load massive templates before starting server
loadMassiveTemplates();

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  const primaryIp = getLANIP();
  
  console.log('================================================================');
  console.log(' VALLEY SECURITY AGENCY - EMPLOYEE MANAGEMENT & ID SYSTEM SERVER');
  console.log('================================================================');
  console.log(`[Local Server] Running locally at: http://localhost:${PORT}`);
  console.log(`[LAN Office Network] Scan/Access from your phone: http://${primaryIp}:${PORT}`);
  console.log('----------------------------------------------------------------');
  console.log('All available network interfaces:');
  const networkInterfaces = os.networkInterfaces();
  for (const interfaceName in networkInterfaces) {
    const interfaces = networkInterfaces[interfaceName];
    for (const face of interfaces) {
      if (face.family === 'IPv4' && !face.internal) {
        console.log(` - ${interfaceName}: http://${face.address}:${PORT}`);
      }
    }
  }
  console.log('================================================================');
});
