const crypto = require('crypto');
const QR_SECRET = process.env.QR_SECRET || 'replace_with_strong_secret';
function signPayload(obj){
  const payload = Buffer.from(JSON.stringify(obj)).toString('base64');
  const sig = crypto.createHmac('sha256', QR_SECRET).update(payload).digest('hex');
  return `${payload}.${sig}`;
}
function verifyToken(token){
  if(!token) return null;
  const parts = token.split('.');
  if(parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  const expected = crypto.createHmac('sha256', QR_SECRET).update(payloadB64).digest('hex');
  try{
    if(!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  }catch(e){ return null; }
  try{ return JSON.parse(Buffer.from(payloadB64, 'base64').toString()); }catch(e){ return null; }
}
module.exports = { signPayload, verifyToken };
