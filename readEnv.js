
const fs = require('fs');
const content = fs.readFileSync('.env', 'utf8');
console.log(JSON.stringify(content));
