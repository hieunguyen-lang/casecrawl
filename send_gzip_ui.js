const express = require('express');
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Đọc file gzip base64
function getGzipRecords() {
  const file = path.join(__dirname, 'case_detail_gzip.txt');
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf-8').split('\n').filter(Boolean);
}

// Trang chính: danh sách bản ghi
app.get('/', (req, res) => {
  const records = getGzipRecords();
  let html = `
  <html><head>
    <title>Gzip Records UI</title>
    <style>
      body { font-family: Arial; margin: 40px; }
      .record { border: 1px solid #ccc; margin-bottom: 10px; padding: 10px; }
      .actions { margin-top: 5px; }
      textarea { width: 100%; height: 60px; }
      .preview { background: #f9f9f9; margin-top: 5px; padding: 5px; font-size: 13px; }
    </style>
  </head><body>
    <h2>Danh sách bản ghi Gzip (case_detail_gzip.txt)</h2>
    <button onclick="sendAll()">Gửi tất cả bản ghi</button>
    <div id="result" style="color:green"></div>
    <hr/>
  `;
  records.forEach((rec, idx) => {
    html += `
      <div class="record">
        <b>Bản ghi #${idx + 1}</b>
        <div class="actions">
          <button onclick="sendRecord(${idx})">Gửi bản ghi này</button>
          <button onclick="previewRecord(${idx})">Xem nội dung</button>
        </div>
        <textarea readonly id="rec_${idx}">${rec}</textarea>
        <div class="preview" id="preview_${idx}" style="display:none"></div>
      </div>
    `;
  });
  html += `
    <script>
      function sendRecord(idx) {
        const data = document.getElementById('rec_' + idx).value;
        fetch('/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data, idx })
        }).then(r => r.json()).then(j => {
          document.getElementById('result').innerText = j.message;
        });
      }
      function sendAll() {
        fetch('/send-all', { method: 'POST' })
          .then(r => r.json()).then(j => {
            document.getElementById('result').innerText = j.message;
          });
      }
      function previewRecord(idx) {
        fetch('/preview/' + idx)
          .then(r => r.json()).then(j => {
            const el = document.getElementById('preview_' + idx);
            el.style.display = 'block';
            el.innerText = j.html || j.error;
          });
      }
    </script>
  </body></html>
  `;
  res.send(html);
});

// API gửi 1 bản ghi (bạn sửa lại endpoint thật ở đây)
app.post('/send', (req, res) => {
  // const { data, idx } = req.body;
  // TODO: Gửi tới API thật ở đây
  res.json({ message: 'Đã gửi bản ghi #' + (req.body.idx + 1) });
});

// API gửi tất cả bản ghi
app.post('/send-all', (req, res) => {
  // TODO: Gửi tất cả tới API thật ở đây
  res.json({ message: 'Đã gửi tất cả bản ghi!' });
});

// API preview nội dung giải nén
app.get('/preview/:idx', (req, res) => {
  const idx = parseInt(req.params.idx);
  const records = getGzipRecords();
  if (idx < 0 || idx >= records.length) return res.json({ error: 'Không tìm thấy bản ghi' });
  try {
    const buf = Buffer.from(records[idx], 'base64');
    const html = zlib.gunzipSync(buf).toString('utf-8');
    res.json({ html: html.substring(0, 2000) + (html.length > 2000 ? '\n... (cắt bớt)' : '') });
  } catch (e) {
    res.json({ error: 'Không giải nén được: ' + e.message });
  }
});

app.listen(PORT, () => {
  console.log('Giao diện xem/gửi bản ghi gzip chạy tại http://localhost:' + PORT);
});
