const os = require('os');
const networkInterfaces = os.networkInterfaces();

console.log("All Network Interfaces:");
for (const interfaceName in networkInterfaces) {
  console.log(`\nInterface: ${interfaceName}`);
  const interfaces = networkInterfaces[interfaceName];
  for (const face of interfaces) {
    console.log(`  Family: ${face.family}, Address: ${face.address}, Internal: ${face.internal}`);
  }
}

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
  
  candidates.sort((a, b) => {
    if (a.isVirtual !== b.isVirtual) {
      return a.isVirtual ? 1 : -1;
    }
    if (a.isWifiOrEthernet !== b.isWifiOrEthernet) {
      return a.isWifiOrEthernet ? -1 : 1;
    }
    return 0;
  });
  
  console.log("\nCandidates sorted:");
  console.log(candidates);
  
  if (candidates.length > 0) {
    return candidates[0].address;
  }
  
  return fallbackIp;
}

console.log("\nSelected LAN IP:", getLANIP());
