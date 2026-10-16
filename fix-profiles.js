const fs = require('fs');
let content = fs.readFileSync('src/lib/parsers/fortigate-parser.ts', 'utf8');

// 1. IPS Sensor
const ipsRegex = /\/\/ Parse Security Profiles \(IPS Sensors\)[\s\S]*?for \(const line of lines\) \{[\s\S]*?\}\n/m;
const ipsReplacement = `// Parse Security Profiles (IPS Sensors)
    // -----------------------------------------------------------------------
    const ipsProfiles: { name: string; scan_botnet_connections: boolean; raw_snippet?: string }[] = [];
    let inIpsSensor = false;
    let ipsSensorNested = 0;
    let currentIpsSensor: { name: string; scan_botnet_connections: boolean; raw_snippet?: string } | null = null;
    let currentIpsSnippet: string[] = [];

    for (const line of lines) {
      const t = line.trim();
      if (t === 'config ips sensor') { inIpsSensor = true; ipsSensorNested = 0; continue; }
      if (!inIpsSensor) continue;

      if (t.startsWith('config ')) {
        ipsSensorNested++;
        if (currentIpsSensor) currentIpsSnippet.push(line);
        continue;
      }

      if (t === 'end') {
        if (ipsSensorNested > 0) {
          ipsSensorNested--;
          if (currentIpsSensor) currentIpsSnippet.push(line);
          continue;
        }
        if (currentIpsSensor?.name) { 
          currentIpsSensor.raw_snippet = currentIpsSnippet.join('\\n');
          ipsProfiles.push(currentIpsSensor); 
          currentIpsSensor = null; 
        }
        inIpsSensor = false;
        continue;
      }

      if (ipsSensorNested > 0) {
        if (currentIpsSensor) currentIpsSnippet.push(line);
        continue;
      }

      if (t.startsWith('edit ')) {
        if (currentIpsSensor?.name) {
          currentIpsSensor.raw_snippet = currentIpsSnippet.join('\\n');
          ipsProfiles.push(currentIpsSensor);
        }
        currentIpsSensor = { name: t.replace('edit ', '').replace(/['"]/g, '').trim(), scan_botnet_connections: false };
        currentIpsSnippet = [line];
      } else if (t === 'next' && currentIpsSensor?.name) {
        currentIpsSnippet.push(line);
        currentIpsSensor.raw_snippet = currentIpsSnippet.join('\\n');
        ipsProfiles.push(currentIpsSensor);
        currentIpsSensor = null;
      } else if (currentIpsSensor) {
        currentIpsSnippet.push(line);
        if (t.startsWith('set scan-botnet-connections ') && !t.includes('disable')) {
          currentIpsSensor.scan_botnet_connections = true;
        }
      }
    }
`;
content = content.replace(ipsRegex, ipsReplacement);

// 2. DNS Filter
const dnsRegex = /\/\/ Parse DNS Filter profiles[\s\S]*?for \(const line of lines\) \{[\s\S]*?\}\n/m;
const dnsReplacement = `// Parse DNS Filter profiles
    // -----------------------------------------------------------------------
    const dnsfilterProfiles: { name: string; redirect_botnet: boolean; log_all_domain: boolean; raw_snippet?: string }[] = [];
    let inDnsFilter = false;
    let dnsFilterNested = 0;
    let currentDnsProfile: { name: string; redirect_botnet: boolean; log_all_domain: boolean; raw_snippet?: string } | null = null;
    let currentDnsSnippet: string[] = [];

    for (const line of lines) {
      const t = line.trim();
      if (t === 'config dnsfilter profile') { inDnsFilter = true; dnsFilterNested = 0; continue; }
      if (!inDnsFilter) continue;

      if (t.startsWith('config ')) {
        dnsFilterNested++;
        if (currentDnsProfile) currentDnsSnippet.push(line);
        continue;
      }

      if (t === 'end') {
        if (dnsFilterNested > 0) {
          dnsFilterNested--;
          if (currentDnsProfile) currentDnsSnippet.push(line);
          continue;
        }
        if (currentDnsProfile?.name) { 
          currentDnsProfile.raw_snippet = currentDnsSnippet.join('\\n');
          dnsfilterProfiles.push(currentDnsProfile); 
          currentDnsProfile = null; 
        }
        inDnsFilter = false;
        continue;
      }

      if (dnsFilterNested > 0) {
        if (currentDnsProfile) currentDnsSnippet.push(line);
        continue;
      }

      if (t.startsWith('edit ')) {
        if (currentDnsProfile?.name) {
          currentDnsProfile.raw_snippet = currentDnsSnippet.join('\\n');
          dnsfilterProfiles.push(currentDnsProfile);
        }
        currentDnsProfile = { name: t.replace('edit ', '').replace(/['"]/g, '').trim(), redirect_botnet: false, log_all_domain: false };
        currentDnsSnippet = [line];
      } else if (t === 'next' && currentDnsProfile?.name) {
        currentDnsSnippet.push(line);
        currentDnsProfile.raw_snippet = currentDnsSnippet.join('\\n');
        dnsfilterProfiles.push(currentDnsProfile);
        currentDnsProfile = null;
      } else if (currentDnsProfile) {
        currentDnsSnippet.push(line);
        if (t.startsWith('set block-botnet ') || t.startsWith('set redirect-botnet ')) {
          currentDnsProfile.redirect_botnet = !t.includes('disable');
        }
        if (t.startsWith('set log-all-domain ')) {
          currentDnsProfile.log_all_domain = !t.includes('disable');
        }
      }
    }
`;
content = content.replace(dnsRegex, dnsReplacement);

// 3. Web Filter
const webRegex = /\/\/ Parse Web Filter profiles[\s\S]*?for \(const line of lines\) \{[\s\S]*?\}\n/m;
const webReplacement = `// Parse Web Filter profiles
    // -----------------------------------------------------------------------
    const webfilterProfiles: { name: string; blocks_malicious: boolean; raw_snippet?: string }[] = [];
    let inWebFilter = false;
    let webFilterNested = 0;
    let currentWebProfile: { name: string; blocks_malicious: boolean; raw_snippet?: string } | null = null;
    let currentWebSnippet: string[] = [];

    for (const line of lines) {
      const t = line.trim();
      if (t === 'config webfilter profile') { inWebFilter = true; webFilterNested = 0; continue; }
      if (!inWebFilter) continue;

      if (t.startsWith('config ')) {
        webFilterNested++;
        if (currentWebProfile) currentWebSnippet.push(line);
        continue;
      }

      if (t === 'end') {
        if (webFilterNested > 0) {
          webFilterNested--;
          if (currentWebProfile) currentWebSnippet.push(line);
          continue;
        }
        if (currentWebProfile?.name) { 
          currentWebProfile.raw_snippet = currentWebSnippet.join('\\n');
          webfilterProfiles.push(currentWebProfile); 
          currentWebProfile = null; 
        }
        inWebFilter = false;
        continue;
      }

      if (webFilterNested > 0) {
        if (currentWebProfile) currentWebSnippet.push(line);
        continue;
      }

      if (t.startsWith('edit ')) {
        if (currentWebProfile?.name) {
          currentWebProfile.raw_snippet = currentWebSnippet.join('\\n');
          webfilterProfiles.push(currentWebProfile);
        }
        currentWebProfile = { name: t.replace('edit ', '').replace(/['"]/g, '').trim(), blocks_malicious: false };
        currentWebSnippet = [line];
      } else if (t === 'next' && currentWebProfile?.name) {
        currentWebSnippet.push(line);
        currentWebProfile.raw_snippet = currentWebSnippet.join('\\n');
        webfilterProfiles.push(currentWebProfile);
        currentWebProfile = null;
      } else if (currentWebProfile) {
        currentWebSnippet.push(line);
        if (t.startsWith('set category ')) {
          const cats = t.replace('set category ', '').trim();
          if (cats.includes('26') || cats.includes('61') || cats.includes('86')) {
             currentWebProfile.blocks_malicious = true;
          }
        }
      }
    }
`;
content = content.replace(webRegex, webReplacement);


fs.writeFileSync('src/lib/parsers/fortigate-parser.ts', content);
console.log("Refactored profiles successfully.");
