// Hàm giải mã base64 + gzip từ file txt thành file html
const fs = require('fs');
const zlib = require('zlib');
function decodeGzipBase64ToHtml(inputFile, outputPrefix = 'decoded_case_') {
  const lines = fs.readFileSync(inputFile, 'utf-8').split(/\r?\n/).filter(Boolean);
  lines.forEach((line, idx) => {
    const gzippedBuffer = Buffer.from(line, 'base64');
    const htmlBuffer = zlib.gunzipSync(gzippedBuffer);
    fs.writeFileSync(`${outputPrefix}${idx + 1}.html`, htmlBuffer, 'utf-8');
    console.log(`Đã giải nén và ghi file: ${outputPrefix}${idx + 1}.html`);
  });
}
// Gọi hàm để giải mã file case_detail_gzip.txt
decodeGzipBase64ToHtml('case_detail_gzip.txt');

// Hàm sửa đường dẫn CSS/JS trong file HTML thành tuyệt đối để xem offline có style
function fixHtmlLinks(inputFile, outputFile, baseUrl) {
  let html = fs.readFileSync(inputFile, 'utf-8');
  // Sửa link href="/Content/..." => href="https://myeclerk.myorangeclerk.com/Content/..."
  html = html.replace(/href="\/(Content|bundles|Scripts|Images|DocView)[^"']*"/g, (match) => {
    return match.replace('href="/', `href="${baseUrl}/`);
  });
  // Sửa src="/Content/..." => src="https://myeclerk.myorangeclerk.com/Content/..."
  html = html.replace(/src="\/(Content|bundles|Scripts|Images|DocView)[^"']*"/g, (match) => {
    return match.replace('src="/', `src="${baseUrl}/`);
  });
  fs.writeFileSync(outputFile, html, 'utf-8');
  console.log(`Đã sửa link tuyệt đối và ghi ra file: ${outputFile}`);
}
// Gọi hàm ví dụ:
// fixHtmlLinks('decoded_case_1.html', 'decoded_case_1_fixed.html', 'https://myeclerk.myorangeclerk.com');

module.exports = { decodeGzipBase64ToHtml, fixHtmlLinks };