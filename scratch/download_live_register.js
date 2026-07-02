async function checkLiveRegister() {
  const url = "https://valleysecurityserviceagency.in/register.html";
  try {
    const res = await fetch(url);
    const html = await res.text();
    console.log("=== Live register.html HEAD check ===");
    console.log("HTML length:", html.length);
    
    // Find script tags or key lines
    const lines = html.split('\n');
    lines.slice(0, 30).forEach((l, idx) => {
        console.log(`${idx + 1}: ${l}`);
    });
  } catch (e) {
    console.error("Error:", e);
  }
}

checkLiveRegister();
