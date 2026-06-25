const { Pool } = require('pg');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const connectionString = 'postgresql://neondb_owner:npg_cXIo8r0OBYaJ@ep-shiny-king-aosr4w3y-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

const femaleNames = new Set([
  "Neesa Rafiq", "Saffa Jan", "Elasha Ahsan", "Safiya Jan", "Iram Wani", 
  "Heena Nazir", "Rekha Devi(Female)", "Ritu Devi", "Uzma Maqbool", 
  "Hurmat Ul Nisa", "Sukriti Malla", "Fozia Ashraf"
]);

// 1. MTS Outsource (41 employees)
const mtsEmployees = [
  { name: "Neesa Rafiq", acc: "0252040100023473", ifsc: "JAKA0AIRCAR", adhaar: "806617363347", uan: "102107297371", mobile: "8899430277" },
  { name: "Adil Yaqoob", acc: "0352040100008115", ifsc: "JAKA0RAJPUR", adhaar: "547053698404", uan: "102107297453", mobile: "9149404538" },
  { name: "Nawneet Kour", acc: "39567187144", ifsc: "SBIN0010458", adhaar: "335031837491", uan: "102107297411", mobile: "7298713619" },
  { name: "Saffa Jan", acc: "0524040100000808", ifsc: "JAKA0NATIPR", adhaar: "607333173743", uan: "101855527766", mobile: "8082523675" },
  { name: "Elasha Ahsan", acc: "0524040100003022", ifsc: "JAKA0NATIPR", adhaar: "319162492499", uan: "101533602935", mobile: "7889954722" },
  { name: "Faizan Manzoor", acc: "0634040150000322", ifsc: "JAKA0MEHJUR", adhaar: "450875691044", uan: "102107297328", mobile: "8082700545" },
  { name: "Dawood Gulzar", acc: "0762040100000254", ifsc: "JAKA0TRENZZ", adhaar: "700558749934", uan: "101855518307", mobile: "7006598372" },
  { name: "Safiya Jan", acc: "43441708079", ifsc: "SBIN0010458", adhaar: "710775037255", uan: "102153711797", mobile: "7006287565" },
  { name: "Iram Wani", acc: "0067040100092980", ifsc: "JAKA0STREET", adhaar: "568226806133", uan: "101855496250", mobile: "7006254574" },
  { name: "Irshad Zargar", acc: "35701346499", ifsc: "SBIN0018361", adhaar: "685925437612", uan: "101855509129", mobile: "7780874848" },
  { name: "Amanpal Singh", acc: "0761040100000073", ifsc: "JAKA0SIMTRA", adhaar: "521567956260", uan: "102153711766", mobile: "9906792879" },
  { name: "Waseem Ahmad Sheikh", acc: "0855040100000372", ifsc: "JAKA0PARNEW", adhaar: "718900788351", uan: "101855518311", mobile: "914992166" },
  { name: "Basit Showket", acc: "41992559134", ifsc: "SBIN0010458", adhaar: "281908320034", uan: "10189687219", mobile: "7006098485" },
  { name: "Romi Singh", acc: "39618473026", ifsc: "SBIN0016832", adhaar: "319683383249", uan: "101855519597", mobile: "7006068121" },
  { name: "Mudasir Ahmad Shah", acc: "0492040100007087", ifsc: "JAKA0HERMAN", adhaar: "854415545318", uan: "101855505203", mobile: "6006357469" },
  { name: "Shakir Maqsood", acc: "40402594409", ifsc: "SBIO010458", adhaar: "663725464192", uan: "101868042581", mobile: "6005526315" },
  { name: "Gurmeet Singh (I)", acc: "0078040100774916", ifsc: "JAKA0MAJLAS", adhaar: "803685094040", uan: "101533602926", mobile: "8082568958" },
  { name: "Bashir Ahmad", acc: "0101040100011848", ifsc: "JAKA0SHIRAZ", adhaar: "646980447074", uan: "101685581891", mobile: "" },
  { name: "Heena Nazir", acc: "0356040100000032", ifsc: "JAKA0MARDAN", adhaar: "764641013239", uan: "101618286329", mobile: "7889535265" },
  { name: "Rayees Rasool", acc: "41426822285", ifsc: "SBIN0004593", adhaar: "532422571797", uan: "102107297300", mobile: "7006943764" },
  { name: "Mohd Tussadiq Khan", acc: "0005040100060907", ifsc: "JAKA0CHINAR", adhaar: "269736741499", uan: "101709142837", mobile: "9596071615" },
  { name: "Shah Samiullah", acc: "0939040100000158", ifsc: "JAKA0DKPORA", adhaar: "766291226994", uan: "102107297359", mobile: "9682159505" },
  { name: "Danish Mushtaq", acc: "0130040800002402", ifsc: "JAKA0ICHGAM", adhaar: "749646349040", uan: "102107297316", mobile: "9797961545" },
  { name: "Roby Singh", acc: "0807040100000074", ifsc: "JAKA0SILIGM", adhaar: "658773991665", uan: "102107297392", mobile: "6006109301" },
  { name: "Gurmeet Singh (II)", acc: "43662654463", ifsc: "SBIN0010458", adhaar: "982326405490", uan: "102107297337", mobile: "9797852347" },
  { name: "Ifraz Hussain Shah", acc: "412402010005069", ifsc: "UBIN0541249", adhaar: "824664846107", uan: "102117286213", mobile: "8082709447" },
  { name: "Mohd Mohsin Bhat", acc: "0115040100810980", ifsc: "JAKA0SALMAR", adhaar: "849962225525", uan: "102207763490", mobile: "7006757547" },
  { name: "Rajesh Singh", acc: "31762059865", ifsc: "SBIN0011856", adhaar: "317583482621", uan: "101533602921", mobile: "8082209237" },
  { name: "Vijay Kumar", acc: "20175435738", ifsc: "SBIN0000657", adhaar: "956246004442", uan: "101535458011", mobile: "7298105780" },
  { name: "Anil Kumar", acc: "41148748395", ifsc: "SBIN0011856", adhaar: "932622256685", uan: "101868027549", mobile: "9186223945" },
  { name: "Gulshan Kumar", acc: "40924258385", ifsc: "SBIN0006371", adhaar: "571892274542", uan: "101867965050", mobile: "9153834450" },
  { name: "Divanshu Kumar", acc: "41585130062", ifsc: "SBIN0011856", adhaar: "574236148903", uan: "101592800177", mobile: "7281818787" },
  { name: "Rekha Devi(Female)", acc: "44979161333", ifsc: "SBIN0011856", adhaar: "870033930581", uan: "101640094722", mobile: "7051561259" },
  { name: "Mohd Nazish Chandel", acc: "44990276825", ifsc: "SBIN0011856", adhaar: "210837565161", uan: "101867957515", mobile: "9596694008" },
  { name: "Rajat Kumar", acc: "20411080811", ifsc: "SBIN0016424", adhaar: "478924643413", uan: "101917144622", mobile: "6005280816" },
  { name: "Sandeep Kumar", acc: "36715651715", ifsc: "SBIN0006371", adhaar: "488041446067", uan: "101403011438", mobile: "7493856277" },
  { name: "Ankush Singh Manhas", acc: "44134168181", ifsc: "SBIN0011856", adhaar: "299668474796", uan: "102118673205", mobile: "7051282260" },
  { name: "Kushwinder Kumar", acc: "44979329207", ifsc: "SBIN0011856", adhaar: "545891074362", uan: "102118663185", mobile: "8580491271" },
  { name: "Ritu Devi", acc: "44985449550", ifsc: "SBIN0002386", adhaar: "265386673792", uan: "102151566288", mobile: "6006572196" },
  { name: "Nerinder Kumar", acc: "44979267330", ifsc: "SBIN0011856", adhaar: "884285475951", uan: "101658515059", mobile: "8437941062" },
  { name: "Manhor Lal", acc: "32311519357", ifsc: "SBIN0000657", adhaar: "893926541899", uan: "100989825992", mobile: "9968382609" }
].map(e => ({ ...e, desig: "MULTI TASKING STAFF" }));

// 2. DEO Outsource (10 employees)
const deoEmployees = [
  { name: "Waheed Ahmad", acc: "41864087994", ifsc: "SBIN0010458", uan: "101618289782", adhaar: "843488300394", mobile: "9469094505" },
  { name: "Uzma Maqbool", acc: "37566138181", ifsc: "SBIN0010458", uan: "101533602919", adhaar: "841156577987", mobile: "9797777873" },
  { name: "Hurmat Ul Nisa", acc: "0637041000000326", ifsc: "JAKA0JADEED", uan: "102107297430", adhaar: "675254908377", mobile: "7889500064" },
  { name: "Mohd Musadiq Khan", acc: "0005040100055638", ifsc: "JAKA0CHINAR", uan: "101591388904", adhaar: "458247008242", mobile: "9906472544" },
  { name: "Burhan Nissar", acc: "41205233880", ifsc: "SBIN0010458", uan: "101855501732", adhaar: "313463931675", mobile: "7006604157" },
  { name: "Shahnawaz Lone", acc: "0091041000000389", ifsc: "JAKA0BBHARA", uan: "102107297363", adhaar: "669490235333", mobile: "6006404809" },
  { name: "Saurav Kumar", acc: "38310464981", ifsc: "SBIN0006371", uan: "101867964233", adhaar: "732946578954", mobile: "6299593831" },
  { name: "Arjun", acc: "39631026808", ifsc: "SBIN0014642", uan: "102118673192", adhaar: "330310069004", mobile: "7006657895" },
  { name: "Sukriti Malla", acc: "35976149260", ifsc: "SBIN0009124", uan: "101868047157", adhaar: "943739402113", mobile: "7889823926" },
  { name: "Vishwajeet Singh", acc: "44395374116", ifsc: "SBIN0000657", uan: "101500362185", adhaar: "993054816659", mobile: "8356997355" }
].map(e => ({ ...e, desig: "DATA ENTRY OPERATOR" }));

// 3. STENO/SCD Outsource (4 employees)
const stenoEmployees = [
  { name: "Tanveer Ahmad", desig: "STAFF CAR DRIVER", acc: "20304469231", ifsc: "SBIN0010458", uan: "101533602961", adhaar: "631665183993", mobile: "9858388388" },
  { name: "Basit Mukhtar", desig: "STENOGRAPHER", acc: "0367040100007854", ifsc: "JAKA0TANKEE", uan: "101570019401", adhaar: "656706355977", mobile: "7006728522" },
  { name: "Zeeshan Rashid", desig: "STENOGRAPHER", acc: "1255041000000021", ifsc: "JAKA0CZEWN", uan: "102015262748", adhaar: "276343391220", mobile: "7006276625" },
  { name: "Sanjeev Kumar", desig: "STENOGRAPHER", acc: "43576545994", ifsc: "SBIN0011856", uan: "101527290789", adhaar: "374559224954", mobile: "7006027456" }
];

// 4. Canteen Staff (10 employees)
const canteenEmployees = [
  { name: "Mudasir Tariq Lone", desig: "ASSISTANT MANAGER CUM STORE KEEPER", acc: "20304469208", ifsc: "SBIN0010458", uan: "101533603002", adhaar: "978227542485", mobile: "7006959542" },
  { name: "Muneer Ahmad", desig: "CLERK", acc: "20304469253", ifsc: "SBIN0010458", uan: "101533602990", adhaar: "490540383305", mobile: "7006046219" },
  { name: "Zahid Ahmad Shah", desig: "CLERK", acc: "20112251846", ifsc: "SBIN0010458", uan: "101533602957", adhaar: "423147987598", mobile: "7006718807" },
  { name: "Noor Ul Amin", desig: "ASSISTANT HALWAI CUM COOK", acc: "20304469242", ifsc: "SBIN0010458", uan: "101533602974", adhaar: "803640125618", mobile: "8493052980" },
  { name: "Mohd Iqbal Ashraf", desig: "CANTEEN ATTENDANT", acc: "20304469219", ifsc: "SBIN0010458", uan: "101533602988", adhaar: "565534404418", mobile: "7006611494" },
  { name: "Fozia Ashraf", desig: "CANTEEN ATTENDANT", acc: "20304469184", ifsc: "SBIN0010458", uan: "101533602942", adhaar: "590680295878", mobile: "7006700057" },
  { name: "Sajid Ali", desig: "CANTEEN ATTENDANT", acc: "38397292578", ifsc: "SBIN0010458", uan: "101533401944", adhaar: "920177491771", mobile: "8825012308" },
  { name: "Zahid Rashid", desig: "CANTEEN ATTENDANT", acc: "42088420012", ifsc: "SBIN0010458", uan: "101749189634", adhaar: "896284737364", mobile: "7051673704" },
  { name: "Absar Majeed", desig: "CANTEEN ATTENDANT", acc: "0086041000000192", ifsc: "JAKA0BULBUL", uan: "102266566218", adhaar: "908877151415", mobile: "9682130150" },
  { name: "Aaqib Nabi", desig: "CANTEEN ATTENDANT", acc: "44641689390", ifsc: "SBIN0010458", uan: "102267699292", adhaar: "941868100802", mobile: "7006216647" }
];

// Combine all employees
const allNewEmployees = [
  ...mtsEmployees,
  ...deoEmployees,
  ...stenoEmployees,
  ...canteenEmployees
];

console.log(`Transcribed total of ${allNewEmployees.length} employees.`);

async function run() {
  try {
    // 1. Get the current highest VSA ID from PostgreSQL
    const idRes = await pool.query('SELECT id FROM employees');
    const allIds = idRes.rows
      .map(r => parseInt(r.id.replace('VSA-', ''), 10))
      .filter(n => !isNaN(n));
      
    let startId = 1065;
    if (allIds.length > 0) {
      const maxVal = Math.max(...allIds);
      startId = maxVal < 1065 ? 1065 : maxVal + 1;
    }
    console.log(`Auto-assigning VSA IDs starting from: VSA-${startId}`);
    
    // 2. Load the local db.json file
    const dbPath = path.join(__dirname, '../db.json');
    let localDb = { employees: [] };
    if (fs.existsSync(dbPath)) {
      localDb = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    }
    
    // Ensure lists in db.json exist
    if (!localDb.employees) localDb.employees = [];
    
    let currentIdNum = startId;
    
    // 3. Process and insert each employee
    for (const empData of allNewEmployees) {
      const vsaId = `VSA-${currentIdNum}`;
      const token = crypto.randomBytes(16).toString('hex');
      const isFemale = femaleNames.has(empData.name);
      
      const employeeRecord = {
        id: vsaId,
        employeeId: vsaId,
        name: empData.name,
        dob: "",
        gender: isFemale ? "Female" : "Male",
        bloodGroup: "",
        mobile: empData.mobile,
        altMobile: "",
        email: "",
        permanentAddress: "",
        currentAddress: "",
        district: "",
        state: "Jammu & Kashmir",
        pinCode: "",
        designation: empData.desig,
        department: "ACCOUNTANT GENERAL'S OFFICE",
        clientLocation: "",
        joiningDate: "2026-06-01",
        status: "Active",
        category: empData.desig.includes("ATTENDANT") || empData.desig.includes("COOK") || empData.desig.includes("STAFF") ? "Unskilled" : "Skilled",
        reportingManager: "Vikram Rathore",
        emergencyContactName: "",
        emergencyContactRelation: "Father",
        emergencyContactMobile: "",
        secureToken: token,
        companyName: "Valley Security Service Agency Pvt Ltd.",
        manpowerType: "Security Force",
        cardValidity: 3,
        documents: {
          photo: "",
          signature: "",
          aadhaar: "Completed",
          pan: "Completed",
          policeVerification: "Verified"
        },
        bankAccount: empData.acc,
        ifsc: empData.ifsc,
        aadhaarNo: empData.adhaar,
        uanNo: empData.uan,
        bankDetails: {
          accountNumber: empData.acc,
          ifscCode: empData.ifsc,
          bankName: ""
        },
        aadhaarNumber: empData.adhaar,
        uanNumber: empData.uan,
        panNumber: "",
        salary: "",
        age: "",
        remarks: ""
      };
      
      // A. Insert into PostgreSQL with ON CONFLICT UPDATE to allow re-running safely
      await pool.query('INSERT INTO employees (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data', [
        vsaId,
        JSON.stringify(employeeRecord)
      ]);
      
      // B. Append to local db.json if not already present
      const index = localDb.employees.findIndex(e => e.id === vsaId);
      if (index === -1) {
        localDb.employees.push(employeeRecord);
      } else {
        localDb.employees[index] = employeeRecord;
      }
      
      console.log(`Inserted ${vsaId}: ${empData.name} (${empData.desig})`);
      currentIdNum++;
    }
    
    // 4. Save the local db.json file
    fs.writeFileSync(dbPath, JSON.stringify(localDb, null, 2), 'utf8');
    console.log(`✅ local db.json updated successfully with ${allNewEmployees.length} employees.`);
    console.log(`✅ All ${allNewEmployees.length} employees inserted into PostgreSQL successfully.`);
    
  } catch (err) {
    console.error('❌ Insertion failed:', err);
  } finally {
    await pool.end();
  }
}

run();
