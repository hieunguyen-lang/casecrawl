const fs = require('fs');
const zlib = require('zlib');

// Đọc file đầu vào
const lines = fs.readFileSync('TEST.TXT', 'utf-8').split(/\r?\n/).filter(Boolean);

lines.forEach((line, idx) => {
  // Tách base64 (sau dấu | hoặc trường cuối)
  const parts = line.split('|');
  const base64 = parts.length > 2 ? parts.slice(2).join('|') : parts[parts.length - 1];

  try {
    // Bước 1: base64 decode + gunzip ra HTML trung gian
    const gzipped = Buffer.from(base64, 'base64');
    const htmlMid = zlib.gunzipSync(gzipped).toString('utf-8');

    // Bước 2: Tìm nội dung trong thẻ <Base64EncodedGZipCompressedContent>
    const match = htmlMid.match(/<Base64EncodedGZipCompressedContent>([\s\S]*?)<\/Base64EncodedGZipCompressedContent>/);
    if (!match) {
      // Nếu không có thẻ, ghi luôn HTML trung gian
      fs.writeFileSync(`decoded_case_${idx + 1}_mid.html`, htmlMid, 'utf-8');
      console.log(`Dòng ${idx + 1}: Không tìm thấy thẻ Base64EncodedGZipCompressedContent, đã ghi HTML trung gian.`);
      return;
    }
    const innerBase64 = match[1].trim();

    // Bước 3: base64 decode + gunzip lần 2 ra HTML cuối cùng
    const innerGzipped = Buffer.from(innerBase64, 'base64');
    const finalHtml = zlib.gunzipSync(innerGzipped).toString('utf-8');

    // Ghi ra file
    fs.writeFileSync(`decoded_case_${idx + 1}.html`, finalHtml, 'utf-8');
    console.log(`Dòng ${idx + 1}: Đã giải nén thành công!`);
  } catch (err) {
    console.error(`Lỗi dòng ${idx + 1}:`, err.message);
  }
});