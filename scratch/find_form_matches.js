const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const indexFile = path.join(__dirname, 'parsed_forms_index.json');

// User-provided lists
const userList = [
  { name: "Mudasir Tariq Lone", parentage: "Tariq Ahmad Lone", address: "Mohalla Jaded Nowpora Baramulla", designation: "Assistant Manager Cum Store Keeper" },
  { name: "Muneer Ahmad", parentage: "Nazir Ahmad Rather", address: "Shiraz Colony Nowshera Soura", designation: "Clerk" },
  { name: "Zahid Ahmad Shah", parentage: "Abdul Rashid Shah", address: "Sempora Derapora Kulgam", designation: "Clerk" },
  { name: "Mohammad Iqbal Wani", parentage: "Mohammad Asadullah", address: "Jahangir pora Baramulla", designation: "Canteen Attendent" },
  { name: "Sajid Ali Tantray", parentage: "Riyaz Ahmad Tantray", address: "Mandibal Nowshera Srinagar", designation: "Canteen Attendent" },
  { name: "Aaqib Nabi", parentage: "Gh Nabi Sheikh", address: "Nadir Gund Baramulla", designation: "Canteen Attendent" },
  { name: "Noor Ul Amin Wani", parentage: "Sonaullah Wani", address: "Shatpora Hayihama Kupwara", designation: "Assistant Halwai Cum Cook" },
  { name: "Zahid Rasheed Wani", parentage: "Abdul Rasheed WANI", address: "Shatpora Hayihama Kupwara", designation: "Canteen Attendent" },
  { name: "Fozia Ashraf Khan", parentage: "Danish Latief Khan", address: "Frends Colony Chanapora", designation: "Canteen Attendent" },
  { name: "Absar Majeed Sodagar", parentage: "Abdul Majeed Sodagar", address: "Saifdin Pora Sgr", designation: "Canteen Attendent" },
  { name: "Zeeshan Rashid", parentage: "Abdul Rashid Bhat", address: "Zewan Bala Panta Chowk Lajan", designation: "Stenographer" },
  { name: "Sanjeev Kumar", parentage: "Gian Chand", address: "Ward no 5 Kathua", designation: "Stenographer" },
  { name: "Basit Mukhtar", parentage: "Mukhtar Ahmad", address: "", designation: "Stenographer" },
  { name: "Tanveer Ahmad", parentage: "", address: "", designation: "SCD" },
  { name: "Saurav Kumar", parentage: "Subodh Kumar", address: "Sanha Purab Brgusaral Bihar", designation: "DEO" },
  { name: "Arjun", parentage: "Koushal Kumar", address: "Hno 118 Janki Vihar Jammu", designation: "DEO" },
  { name: "Sukriti Malla", parentage: "Ajay Malla", address: "Subash Nagar Jammu", designation: "DEO" },
  { name: "Vishwa Jeet Singh", parentage: "Shiv Bahadur Singh", address: "Chatrakoat Uttar Pradesh", designation: "DEO" },
  { name: "Hurmat ul Nisa", parentage: "Mohammad Yaseen", address: "Kokar Haman Baramulla", designation: "DEO" },
  { name: "Mohd Musadiq Khan", parentage: "Mohd Sadiq Khan", address: "Durabal Road Near Dall Colony Hamdaniya", designation: "DEO" },
  { name: "Shahnawaz Gaffar Lone", parentage: "Ab Gaffar Lone", address: "Semthan Bijehara Anantnag", designation: "DEO" },
  { name: "Burhan Nissar Rather", parentage: "Nissar Ahmad Rather", address: "Dangerpora Hazratbal", designation: "DEO" },
  { name: "Waheed Ahmad", parentage: "", address: "", designation: "DEO" },
  { name: "Uzma Maqbool", parentage: "", address: "", designation: "DEO" },
  { name: "Saffa Jan", parentage: "Mohd Ahsan Ahanger", address: "Budshah Nagar Natipora Sgr", designation: "MTS" },
  { name: "Bashir Ahmad Wani", parentage: "Ghulam Mohammad Wani", address: "Khalifa Pora Khanyar", designation: "MTS" },
  { name: "Heena Nazir", parentage: "Mohd Shoib Baba", address: "Hathi Khan Kathi Darwaza Sgr", designation: "MTS" },
  { name: "Iram Wani", parentage: "Syed Anwar", address: "Near MASJID Muslimpor Sopore", designation: "MTS" },
  { name: "Neesa Rafiq", parentage: "Mohammad Rafiq Dar", address: "Kursoo Rajbagh Srinagar", designation: "MTS" },
  { name: "Basit Showket Malik", parentage: "Showket Ahmad Malik", address: "Shnakerpora Bagh Mehtab Srinagar", designation: "MTS" },
  { name: "Rajesh Singh", parentage: "Behari Singh", address: "Pallan Walla", designation: "MTS" },
  { name: "Faizan Manzoor", parentage: "Manzoor Ahmad Rather", address: "Kursoo Padshahi Bagh", designation: "MTS" },
  { name: "Dawood Gulzar", parentage: "Gulzar Ahmad Mir", address: "Mohand Pora Shupiyan", designation: "MTS" },
  { name: "Vijay Kumar", parentage: "Krishan Lal", address: "Vill Bachyal Bajyal Jammu", designation: "MTS" },
  { name: "Kushwinder Kumar", parentage: "Som Raj", address: "Narot Jaimal Punjab", designation: "MTS" },
  { name: "Ritu Devi", parentage: "Tara Chand", address: "Near Gms Kathua Mehtab Pur", designation: "MTS" },
  { name: "Ankush Singh Manhas", parentage: "Anchal Singh", address: "Band Patniyal Jammu", designation: "MTS" },
  { name: "Rekha Devi", parentage: "Shakti Kumar", address: "Old Rolki Bakshi Nagar Jammu", designation: "MTS" },
  { name: "Anil Kumar", parentage: "Madan Lal", address: "Village Khepar Matadar Stand", designation: "MTS" },
  { name: "Rajat Kumar", parentage: "Dev Raj", address: "Joian Kathar Pind Chaulea Kalan", designation: "MTS" },
  { name: "Irshad Ahmad Zargar", parentage: "Mohammad Yousuf Zargar", address: "Gousia Colony Baghi Mehtab", designation: "MTS" },
  { name: "Adil Yaqoob Ganie", parentage: "Mohammad Yaqoob Ganie", address: "Bellow Dergund Rajpora Pulwama", designation: "MTS" },
  { name: "Elasha Ahsan", parentage: "Arif Hussain", address: "Ikhraj Pora Rajbagh", designation: "MTS" },
  { name: "Mohd Nazish Chandel", parentage: "Mohd Ashraf Chandal", address: "Ward No 3 New Bus Stand Udhampur", designation: "MTS" },
  { name: "Narinder Kumar", parentage: "Som Raj", address: "Pathankot Gurdaspora Punjab", designation: "MTS" },
  { name: "Manohar Lal", parentage: "Shambhu", address: "Village Ramnagar Udhampur", designation: "MTS" },
  { name: "Sandeep Kumar", parentage: "Bablu Singh", address: "House No. 23 Gandhi Nagar Jammu", designation: "MTS" },
  { name: "Divanshu Kumar", parentage: "Chandra Bhushan Singh", address: "Parpora Begusarai Bihar", designation: "MTS" },
  { name: "Gulshan Kumar Singh", parentage: "Bishundev Singh", address: "Ward No 10 Gram ParoraBegusaria", designation: "MTS" },
  { name: "Roby Singh", parentage: "Mangath Singh", address: "Channi Gam Anantnag", designation: "MTS" },
  { name: "Aman Pal Singh", parentage: "Manjeet Singh", address: "Saimoh Pulwama", designation: "MTS" },
  { name: "Ifraz Hussain Shah", parentage: "Ali Azmat Shah", address: "Bande uri Baramulla", designation: "MTS" },
  { name: "Mudasir Ahmed Shah", parentage: "Riyaz Ahmad Shah", address: "Derapora Sempora Kulgam", designation: "MTS" },
  { name: "Danish Mushtaq", parentage: "Mushtaq Ahmad Zargar", address: "Zargar Mohalla Badgam", designation: "MTS" },
  { name: "Waseem Ahmad Sheikh", parentage: "Abdul Rehman Sheikh", address: "Bugroo Jamia Masjid Badgam", designation: "MTS" },
  { name: "Gurmeet Singh", parentage: "Moti Singh", address: "Bandi Bagh Badgam", designation: "MTS" },
  { name: "Shah Samiullah", parentage: "Mushtaq Ahmad Shah", address: "Airtel Tower Dk pora Kalipora Shupiyan", designation: "MTS" },
  { name: "Romi Singh", parentage: "Jamail Singh", address: "Bona Gund Hut Murah Anantnag", designation: "MTS" },
  { name: "Nawneet Kour Khalsa", parentage: "Kavi Singh", address: "Rajpura Awantipora", designation: "MTS" },
  { name: "Safiya Jan", parentage: "Irfan Ahmad Matoo", address: "Nundreshi Colony Bemina", designation: "MTS" },
  { name: "Mohd Tussadiq Khan", parentage: "Mohd Sadiq Khan", address: "Hamdaniya Colony Bemina Sgr", designation: "MTS" },
  { name: "Mohammad Mohassin Bhat", parentage: "Nissar Ahmad Bhat", address: "Tailbal Hazratbal Sgr", designation: "MTS" },
  { name: "Rayees Rasool Khan", parentage: "Ghulam Rasool Khan", address: "Check Shopain Keller Pulwama", designation: "MTS" }
];

// Load environment variables from .env file
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split(/\r?\n/).forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
      if (key && !key.startsWith('#')) {
        process.env[key] = value;
      }
    }
  });
}

const connectionString = process.env.DATABASE_URL;

function normalize(str) {
  if (!str) return "";
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function run() {
  const client = new Client({ connectionString });
  await client.connect();

  const res = await client.query("SELECT id, data->>'name' as name, data FROM employees");
  const employees = res.rows.map(row => ({
    id: row.id,
    name: row.name,
    data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data
  }));

  const indexData = JSON.parse(fs.readFileSync(indexFile, 'utf8'));

  const matches = [];

  for (const item of indexData) {
    if (item.error) continue;

    const snippet = item.textSnippet || "";
    const snippetLower = snippet.toLowerCase();
    
    // Find best match in database
    let bestEmp = null;
    let bestScore = 0;
    let matchReason = "";

    // 1. Try matching by unique UAN/Mobile/Account numbers
    for (const num of (item.numbers || [])) {
      if (num.length < 8) continue;
      const found = employees.find(emp => {
        const uan = normalize(emp.data?.uanNumber || emp.data?.uanNo || "");
        const acc = normalize(emp.data?.bankAccount || "");
        const mob = normalize(emp.data?.mobile || "");
        const aadh = normalize(emp.data?.aadhaarNumber || emp.data?.aadhaarNo || "");
        
        return (uan.includes(num) || acc.includes(num) || mob.includes(num) || aadh.includes(num));
      });

      if (found) {
        bestEmp = found;
        bestScore = 100;
        matchReason = `Number Match: ${num}`;
        break;
      }
    }

    // 2. Try word matching on employee names
    if (!bestEmp) {
      for (const emp of employees) {
        const nameNormalized = emp.name.replace(/\(.*?\)/g, "").trim();
        const words = nameNormalized.toLowerCase().split(/\s+/).filter(w => w.length >= 3);
        
        let matchCount = 0;
        for (const w of words) {
          if (snippetLower.includes(w)) matchCount++;
        }

        if (matchCount > bestScore && matchCount >= 2) {
          bestScore = matchCount;
          bestEmp = emp;
          matchReason = `Name Word Match (${matchCount} words)`;
        }
      }
    }

    // 3. Try matching userList addresses or parentage words
    if (!bestEmp) {
      for (const userEmp of userList) {
        const parentageNormalized = userEmp.parentage || "";
        const parentageWords = parentageNormalized.toLowerCase().split(/\s+/).filter(w => w.length >= 4);
        
        let matchCount = 0;
        for (const w of parentageWords) {
          if (snippetLower.includes(w)) matchCount++;
        }

        if (matchCount > bestScore && matchCount >= 2) {
          bestScore = matchCount;
          
          // Map userEmp back to database employee
          const dbEmp = employees.find(emp => {
            const name1 = normalize(emp.name);
            const name2 = normalize(userEmp.name);
            return name1 === name2 || name1.includes(name2) || name2.includes(name1);
          });

          if (dbEmp) {
            bestEmp = dbEmp;
            matchReason = `Parentage Match: ${parentageNormalized}`;
          }
        }
      }
    }

    // 4. Try matching address words
    if (!bestEmp) {
      for (const userEmp of userList) {
        const addr = userEmp.address || "";
        const addrWords = addr.toLowerCase().split(/\s+/).filter(w => w.length >= 5);
        
        let matchCount = 0;
        for (const w of addrWords) {
          if (snippetLower.includes(w)) matchCount++;
        }

        if (matchCount > bestScore && matchCount >= 2) {
          bestScore = matchCount;
          const dbEmp = employees.find(emp => {
            const name1 = normalize(emp.name);
            const name2 = normalize(userEmp.name);
            return name1 === name2 || name1.includes(name2) || name2.includes(name1);
          });

          if (dbEmp) {
            bestEmp = dbEmp;
            matchReason = `Address Match: ${addr}`;
          }
        }
      }
    }

    matches.push({
      file: item.file,
      score: bestScore,
      reason: matchReason,
      empId: bestEmp ? bestEmp.id : "-",
      empName: bestEmp ? bestEmp.name : "-",
      snippetSnippet: snippet.substring(0, 150)
    });
  }

  // Print results
  console.log("\n=============================================================");
  console.log("DETAILED FORM MATCHING");
  console.log("=============================================================");
  for (const m of matches) {
    console.log(`FILE: ${m.file}`);
    console.log(`MATCHED: ${m.empName} (${m.empId}) - Score: ${m.score} - Reason: ${m.reason}`);
    console.log(`SNIPPET: ${m.snippetSnippet}...`);
    console.log(`-------------------------------------------------------------`);
  }

  await client.end();
}

run().catch(err => console.error(err));
