const os = require('os');

function isIPv4(net) {
  return net.family === 'IPv4' || net.family === 4;
}

function listLanIPv4() {
  const nets = os.networkInterfaces();
  const out = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (isIPv4(net) && !net.internal) {
        out.push({ name, address: net.address });
      }
    }
  }
  return out;
}

const port = process.env.PORT || '3000';
const lan = listLanIPv4();

console.log('');
console.log('Dev server URLs (port ' + port + ')');
console.log('  Local:   http://127.0.0.1:' + port);
if (lan.length) {
  for (const { name, address } of lan) {
    console.log('  Network: http://' + address + ':' + port + '  (' + name + ')');
  }
} else {
  console.log('  (No LAN IPv4 interfaces found — use localhost only)');
}
console.log('');
