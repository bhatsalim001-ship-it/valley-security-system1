const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const sharp = require('sharp');

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

// User list from prompt
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

function normalize(str) {
  if (!str) return "";
  return str.replace(/[^0-9]/g, '');
}

function normalizeName(str) {
  if (!str) return "";
  return str.toLowerCase().replace(/[^a-z]/g, '');
}

async function run() {
  const indexData = JSON.parse(fs.readFileSync(path.join(__dirname, 'parsed_forms_index.json'), 'utf8'));

  const client = new Client({ connectionString });
  await client.connect();

  const res = await client.query("SELECT id, data->>'name' as name, data FROM employees");
  const employees = res.rows.map(row => ({
    id: row.id,
    name: row.name,
    data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data
  }));

  console.log(`Loaded ${employees.length} employees from database.`);

  let matchCount = 0;

  for (const item of indexData) {
    if (item.error) continue;

    const snippet = item.textSnippet || "";
    
    // Find all 10-12 digit numbers in the text (potential UAN, Aadhaar, Mobile, or Bank Account)
    const numbersFound = snippet.replace(/[^0-9]/g, ' ')
      .split(/\s+/)
      .filter(n => n.length >= 10 && n.length <= 16);

    let matchedEmp = null;

    for (const num of numbersFound) {
      // Ignore common header/license numbers
      if (num.includes("9419689773") || num.includes("38060315") || num.includes("181152") || num.includes("042019137")) continue;

      const found = employees.find(emp => {
        const uan = normalize(emp.data?.uanNumber || emp.data?.uanNo || "");
        const acc = normalize(emp.data?.bankAccount || "");
        const mob = normalize(emp.data?.mobile || "");
        const aadh = normalize(emp.data?.aadhaarNumber || emp.data?.aadhaarNo || "");

        return (uan === num || acc === num || mob === num || aadh === num);
      });

      if (found) {
        matchedEmp = found;
        break;
      }
    }

    // Fallback: If no number matched, try matching the handwritten name (which might be partially captured)
    if (!matchedEmp) {
      const snippetClean = snippet.toLowerCase().replace(/[^a-z\s]/g, ' ');
      for (const emp of employees) {
        const nameClean = emp.name.replace(/\(.*?\)/g, "").trim().toLowerCase();
        const nameWords = nameClean.split(/\s+/).filter(w => w.length >= 4);
        if (nameWords.length >= 2) {
          let wordMatches = 0;
          for (const w of nameWords) {
            if (snippetClean.includes(w)) wordMatches++;
          }
          if (wordMatches === nameWords.length) {
            matchedEmp = emp;
            break;
          }
        }
      }
    }

    if (matchedEmp) {
      matchCount++;
      console.log(`\n✅ MATCHED: Form file "${item.file}" matches database employee: "${matchedEmp.name}" (${matchedEmp.id})`);

      // Find user-provided details for this employee to update parentage/address
      const userDetails = userList.find(u => {
        const n1 = normalizeName(u.name);
        const n2 = normalizeName(matchedEmp.name);
        return n1 === n2 || n1.includes(n2) || n2.includes(n1);
      });

      const updatedData = { ...matchedEmp.data };

      if (userDetails) {
        console.log(`  Updating parentage to: "${userDetails.parentage}"`);
        console.log(`  Updating address to: "${userDetails.address}"`);
        console.log(`  Updating designation to: "${userDetails.designation}"`);
        
        updatedData.fatherName = userDetails.parentage;
        updatedData.currentAddress = userDetails.address;
        updatedData.permanentAddress = userDetails.address;
        updatedData.designation = userDetails.designation;
      }

      // Crop the passport photo from the top-right corner of the form!
      // In the form layout, the photo is typically on the top-right (x: 75% to 95%, y: 5% to 25%)
      const formPath = path.join(__dirname, '..', 'Form_employeesMTS', item.file);
      try {
        const metadata = await sharp(formPath).metadata();
        const width = metadata.width;
        const height = metadata.height;

        const photoLeft = Math.round(width * 0.73);
        const photoTop = Math.round(height * 0.10);
        const photoWidth = Math.min(Math.round(width * 0.22), width - photoLeft);
        const photoHeight = Math.min(Math.round(height * 0.17), height - photoTop);

        const croppedBuffer = await sharp(formPath)
          .extract({ left: photoLeft, top: photoTop, width: photoWidth, height: photoHeight })
          .jpeg({ quality: 90 })
          .toBuffer();

        const base64Photo = `data:image/jpeg;base64,${croppedBuffer.toString('base64')}`;
        
        // Update database
        const checkRes = await client.query('SELECT 1 FROM employee_photos WHERE employee_id = $1', [matchedEmp.id]);
        if (checkRes.rows.length > 0) {
          await client.query('UPDATE employee_photos SET photo = $1, updated_at = NOW() WHERE employee_id = $2', [base64Photo, matchedEmp.id]);
        } else {
          await client.query('INSERT INTO employee_photos (employee_id, photo, signature) VALUES ($1, $2, $3)', [matchedEmp.id, base64Photo, ""]);
        }

        if (!updatedData.documents) updatedData.documents = {};
        updatedData.documents.photo = `/api/employees/${matchedEmp.id}/photo`;
        console.log(`  Successfully cropped and uploaded passport photo.`);

      } catch (cropErr) {
        console.error(`  Failed to crop photo:`, cropErr.message);
      }

      // Update main employee record
      await client.query('UPDATE employees SET data = $1 WHERE id = $2', [JSON.stringify(updatedData), matchedEmp.id]);
      console.log(`  Successfully updated employee record!`);
    } else {
      console.log(`❌ UNMATCHED: Form file "${item.file}"`);
    }
  }

  console.log(`\n=============================================================`);
  console.log(`BATCH UPDATE SUMMARY`);
  console.log(`=============================================================`);
  console.log(`Total matched forms: ${matchCount}`);
  console.log(`=============================================================`);

  await client.end();
}

run().catch(err => console.error(err));
