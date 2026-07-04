const fs = require('fs');
const path = require('path');

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

const blacklist = new Set([
  'valley', 'security', 'service', 'agency', 'pvt', 'ltd', 'shaheed', 'gunj', 'nath', 'complex', 'sgr', 
  'bathandi', 'jammu', 'nasechahmadd801', 'gmail', 'com', 'employee', 'registration', 'form', 'home', 
  'pasara', 'license', 'no', 'office', 'branch', 'email', 'cell', 'head', 'tel', 'every', 'should', 'be',
  'in', 'time', 'for', 'his', 'her', 'duty', 'hours', 'during', 'must', 'with', 'proper', 'grooming',
  'work', 'under', 'shift', 'supervisor', 'wants', 'to', 'resign', 'from', 'job', 'they', 'submit',
  'resignation', 'before', 'prior', 'of', 'days', 'agree', 'rules', 'regulation', 'company', 'if',
  'am', 'ortble', 'full', 'fill', 'that', 'take', 'any', 'action', 'against', 'me', 'date', 'joining',
  'sig', 'salary', 'month', 'remarks', 'original', 'documents', 'received', 'reference', 'by', 'passport',
  'photo', 'aadhaar', 'card', 'bank', 'account', 'detail', 'ifsc', 'mobile', 'guardian', 'verification',
  'issued', 'validity', 'age', 'dob', 'contact', 'regd', 'gstin', '01belpa2398d1zy', '38060315', '9419689773'
]);

function cleanText(text) {
  if (!text) return "";
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !blacklist.has(w))
    .join(' ');
}

async function main() {
  const indexData = JSON.parse(fs.readFileSync(path.join(__dirname, 'parsed_forms_index.json'), 'utf8'));

  for (const item of indexData) {
    if (item.error) continue;

    const snippet = item.textSnippet || "";
    const cleanedSnippet = cleanText(snippet);

    let bestMatch = null;
    let bestScore = 0;

    for (const u of userList) {
      const nameNormalized = u.name.toLowerCase();
      const parentageNormalized = u.parentage ? u.parentage.toLowerCase() : "";
      const addressNormalized = u.address ? u.address.toLowerCase() : "";
      
      // Calculate token score
      const nameTokens = nameNormalized.split(/\s+/).filter(w => w.length >= 3 && !blacklist.has(w));
      let matches = 0;
      for (const t of nameTokens) {
        if (cleanedSnippet.includes(t)) matches++;
      }

      // Check parentage token
      const parentTokens = parentageNormalized.split(/\s+/).filter(w => w.length >= 3 && !blacklist.has(w));
      let parentMatches = 0;
      for (const pt of parentTokens) {
        if (cleanedSnippet.includes(pt)) parentMatches++;
      }

      // Check address token
      const addrTokens = addressNormalized.split(/\s+/).filter(w => w.length >= 4 && !blacklist.has(w));
      let addrMatches = 0;
      for (const at of addrTokens) {
        if (cleanedSnippet.includes(at)) addrMatches++;
      }

      const totalScore = matches * 2.0 + parentMatches * 1.5 + addrMatches * 1.0;

      if (totalScore > bestScore && matches >= 1) {
        bestScore = totalScore;
        bestMatch = u;
      }
    }

    if (bestMatch && bestScore >= 2.0) {
      console.log(`FILE: ${item.file}`);
      console.log(`  MATCH: ${bestMatch.name} (Parentage: ${bestMatch.parentage}, Desig: ${bestMatch.designation}) [Score: ${bestScore}]`);
      console.log(`  CLEANED OCR WORDS: "${cleanedSnippet}"`);
      console.log(`-------------------------------------------------------------`);
    } else {
      console.log(`FILE: ${item.file} ➡️ UNMATCHED (Cleaned OCR: "${cleanedSnippet}")`);
      console.log(`-------------------------------------------------------------`);
    }
  }
}

main().catch(err => console.error(err));
