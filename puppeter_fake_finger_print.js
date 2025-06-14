const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const zlib = require('zlib');
puppeteer.use(StealthPlugin());
const path = require('path');
const xml2js = require('xml2js');
const os = require('os');

// Fake fingerprint giống thật nhất theo thông tin bạn cung cấp
const fakeFingerprint = {
  platform: 'Win32',
  vendor: 'Google Inc.',
  
  deviceMemory: 16,
  maxTouchPoints: 1,
  width: 1920,
  height: 1080,
  devicePixelRatio: 1,
  webglVendor: 'Google Inc. (NVIDIA)',
  webglRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Ti Direct3D11 vs_5_0 ps_5_0, D3D11)',
  webglVersion: 'WebGL 1.0 (OpenGL ES 2.0 Chromium)', // Thêm dòng này
  audioSampleRate: 48000,
  timeZone: 'Asia/Ho_Chi_Minh',
  language: 'en-US',
  languages: ['en-US', 'en'],
  hardwareConcurrency: 16,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  canvasDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA', // Bạn có thể thay bằng base64 canvas thật nếu lấy được
  profileName: 'HieuNK Test Profile'
};

// Danh sách profile (userDataDir) muốn chạy song song
let profiles = [];

// Cho phép nhận số lượng profile và executablePath từ dòng lệnh (Electron IPC)
console.log('argProfileCount:', process.argv[2]);
let argProfileCount = parseInt(process.argv[2], 10);
if (isNaN(argProfileCount) || argProfileCount < 1) argProfileCount = 1;
const executablePathArg = process.argv[5] || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
profiles = Array.from({ length: argProfileCount }, (_, i) => `./hieunk_profile${i+1}`);

// Nhận proxyList từ argv[5] (chuỗi, mỗi dòng 1 proxy)
console.log('Số process.argv[5]:', process.argv);
let proxyList = [];
if (process.argv[6]) {
  proxyList = process.argv[6].split('\n').map(x => x.trim()).filter(Boolean);
}
// Gán proxy cho từng profile (dùng lại nếu thiếu)
const assignedProxies = profiles.map((_, i) => proxyList.length ? proxyList[i % proxyList.length] : null);

// Hàm parseProxy: trả về {protocol, host, port, username, password}
function parseProxy(proxyStr) {
  let protocol = 'http';
  let host, port, username, password;
  let str = proxyStr.trim();
  // Nếu có protocol
  if (str.startsWith('socks5://')) {
    protocol = 'socks5';
    str = str.replace('socks5://', '');
  } else if (str.startsWith('http://')) {
    protocol = 'http';
    str = str.replace('http://', '');
  } else if (str.startsWith('https://')) {
    protocol = 'https';
    str = str.replace('https://', '');
  }
  // Nếu có user:pass@host:port
  if (str.includes('@')) {
    const [auth, addr] = str.split('@');
    [username, password] = auth.split(':');
    [host, port] = addr.split(':');
  } else {
    const parts = str.split(':');
    if (parts.length === 4) {
      host = parts[0];
      port = parts[1];
      username = parts[2];
      password = parts[3];
    } else if (parts.length === 2) {
      host = parts[0];
      port = parts[1];
    }
  }
  return { protocol, host, port, username, password };
}

// Hàm chia đều mảng case cho các profile (nếu số case < số profile thì các profile còn lại là mảng rỗng)
function splitCases(cases, n) {
  const result = Array.from({ length: n }, () => []);
  cases.forEach((item, i) => {
    result[i % n].push(item);
  });
  return result;
}

// Hàm sinh fingerprint random cho từng profile
function generateFingerprint(idx) {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36'
  ];
  const webglVendors = [
    'Google Inc. (NVIDIA)',
    'Google Inc. (AMD)',
    'Google Inc. (Intel)'
  ];
  const webglRenderers = [
    'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Ti Direct3D11 vs_5_0 ps_5_0, D3D11)',
    'ANGLE (AMD, AMD Radeon RX 6600 XT Direct3D11 vs_5_0 ps_5_0, D3D11)',
    'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)'
  ];
  const webglVersions = [
    'WebGL 1.0 (OpenGL ES 2.0 Chromium)',
    'WebGL 2.0 (OpenGL ES 3.0 Chromium)'
  ];
  const width = 360 + idx * 40;
  const height = 720 + idx * 20;
  return {
    platform: 'Win32',
    vendor: 'Google Inc.',
    deviceMemory: [4, 8, 16][idx % 3],
    maxTouchPoints: [1, 2, 5][idx % 3],
    width,
    height,
    devicePixelRatio: [1, 2][idx % 2],
    webglVendor: webglVendors[idx % webglVendors.length],
    webglRenderer: webglRenderers[idx % webglRenderers.length],
    webglVersion: webglVersions[idx % webglVersions.length],
    audioSampleRate: 48000,
    timeZone: ['Asia/Ho_Chi_Minh', 'America/New_York', 'Europe/Berlin'][idx % 3],
    language: ['en-US', 'vi-VN', 'de-DE'][idx % 3],
    languages: [['en-US', 'en'], ['vi-VN', 'en'], ['de-DE', 'en']][idx % 3],
    hardwareConcurrency: [4, 8, 16][idx % 3],
    userAgent: userAgents[idx % userAgents.length],
    canvasDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA' + idx,
    profileName: 'Profile_' + idx
  };
}

/**
 * Encode HTML thành base64(gzip(XML)), trong đó XML chứa base64(gzip(HTML))
 * @param {string} html - Nội dung HTML gốc
 * @param {object} options - Thông tin bổ sung cho XML (uri, timestamp, các thẻ khác)
 * @returns {string} base64(gzip(XML))
 */
function encodeHtmlToBase64GzipXml(html, options = {}) {
  const zlib = require('zlib');

  // Gzip + base64 cho HTML
  const gzippedHtml = zlib.gzipSync(html, { level: 9 });
  const base64Html = gzippedHtml.toString('base64');

  // Tạo timestamp đúng định dạng
  function getTimestamp() {
    const now = new Date();
    const ms = String(now.getMilliseconds()).padStart(3, '0') + '0000';
    const iso = now.toISOString();
    return iso.replace(/\.(\d+)Z$/, `.${ms}Z`);
  }
  const timestamp = options.timestamp || getTimestamp();
  const uri = options.uri || 'https://casesearch.courts.state.md.us/casesearch/inquiryByCaseNum.jis';
  const otherTags = options.otherTags || '';

  // Tạo XML
  const xml = `<?xml version="1.0" encoding="utf-16"?>
      <CollectionRecord xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
        <Uri>${uri}</Uri>
        <TimeStamp>${timestamp}</TimeStamp>
        ${otherTags}
        <Base64EncodedGZipCompressedContent>${base64Html}</Base64EncodedGZipCompressedContent>
      </CollectionRecord>
      `;

  // Gzip + base64 cho XML
  const gzippedXml = zlib.gzipSync(Buffer.from(xml, 'utf-8'), { level: 9 });
  
  
  return gzippedXml.toString('base64');
}
// Sinh fingerprint cho từng profile
const fingerprints = profiles.map((_, idx) => generateFingerprint(idx));

// Thêm hàm wait(ms) dùng setTimeout, thay mọi chỗ await page.waitForTimeout(x) thành await wait(x) để tránh lỗi page.waitForTimeout is not a function.
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
async function waitForReady(page, maxRetry = 10, interval = 1000 ) {
  for (let attempt = 1; attempt <= maxRetry; attempt++) {
    try {
      const frames = page.frames();
      const recaptchaFrame = frames.find(frame => frame.url().includes('recaptcha'));

      let checkboxReady = false;
      if (recaptchaFrame) {
        checkbox = await recaptchaFrame.waitForSelector('.recaptcha-checkbox-checked', { visible: true, timeout: 20000 });
        if (checkbox) {
          checkboxReady = true;
        }
        
      }
      const isSearchButtonEnabled = await page.$eval('#caseSearch', btn => !btn.disabled);
      wait(1000); // Đợi 1 giây để DOM ổn định sau khi click checkbox
      if(isSearchButtonEnabled) {
        searchReady = true;
      }
      console.log(`Checkbox ready: ${checkboxReady}, Search button enabled: ${isSearchButtonEnabled}`);
      if (checkboxReady && searchReady) {
        console.log(' Checkbox va  Search is ready.');
        return true;
      }

      console.log(`⏳ [Lần ${attempt}/${maxRetry}] Chưa sẵn sàng, thử lại sau ${interval}ms...`);
    } catch (err) {
      if (err.message && (err.message.includes('Target closed') || err.message.includes('Protocol error'))) {
          console.error('Chrome đã bị đóng, dừng crawl và xuất file!');
          if (process.send) {
            process.send({ type: 'chrome-closed', data: { caseId, caseKey: caseNumber } });
            
          }
          fs.copyFileSync(outputFilePath, outputFilePathcopy);
          console.log('Đã copy file case_detail_gzip.txt ra Desktop:', destPath);
          process.exit(0);

      }else {
        console.log(`Loi kiem tra san sang (lan ${attempt}):`, err.message);
      }
    }

    await wait(interval);
  }

  console.log('❌ Quá số lần thử, checkbox hoặc nút Search vẫn chưa sẵn sàng.');
  return false;
}

(async () => {
  // Đọc tên file input từ argv, mặc định là 'input.txt' nếu không truyền
  const inputFileName = process.argv[3] || 'input.txt';
  // Di chuyển file case_detail_gzip.txt ra Desktop (hoặc thư mục Download)
  const now = new Date();
  const timestamp = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0') + '_' + String(now.getHours()).padStart(2,'0') + '-' + String(now.getMinutes()).padStart(2,'0') + '-' + String(now.getSeconds()).padStart(2,'0');
  const desktopDir = path.join(os.homedir(), 'Desktop');
  const destPath = path.join(desktopDir, `case_detail_gzip_${timestamp}.txt`);
  

  const xmlContent = fs.readFileSync(inputFileName, 'utf-8');
  // Parse XML để lấy LeadListGuid (ID ở <root>) và danh sách leads (CaseKey, ID)
  const { LeadListGuid, leads } = await new Promise((resolve, reject) => {
    xml2js.parseString(xmlContent, { explicitRoot: false, preserveChildrenOrder: true, attrkey: '$' }, (err, result) => {
      if (err) return reject(err);
      let rootId = '';
      let arr = [];
      // Lấy ID ở <Root> (cả chữ hoa đầu)
      if (result && result.$ && result.$.ID) {
        rootId = result.$.ID;
      }
      // Lấy danh sách Lead (CaseKey, ID)
      function extractLeads(obj) {
        if (obj.Lead && Array.isArray(obj.Lead)) {
          obj.Lead.forEach(lead => {
            if (lead.$ && lead.$.CaseKey && lead.$.ID) {
              arr.push({
                CaseKey: lead.$.CaseKey,
                ID: lead.$.ID
              });
            }
          });
        }
        for (const key in obj) {
          if (typeof obj[key] === 'object') extractLeads(obj[key]);
        }
      }
      extractLeads(result);
      resolve({ LeadListGuid: rootId, leads: arr });
    });
  });

  // Chia đều case cho các profile
  const caseChunks = splitCases(leads, profiles.length);

  // Hiển thị danh sách leads đã chia cho từng profile
  console.log('Danh sách leads đã chia cho từng profile:');
  caseChunks.forEach((chunk, idx) => {
    console.log(`Profile ${idx + 1} (${profiles[idx]}):`);
    //chunk.forEach(lead => console.log('  -', lead.CaseKey, '|', lead.ID));
  });

  // Hiển thị danh sách leads đã chia cho từng profile trên UI Electron (nếu có)
  if (process.send) {
    process.send({
      type: 'leads-distribution',
      data: caseChunks.map((chunk, idx) => ({
        profile: profiles[idx],
        leads: chunk.map(l => l.CaseKey + ' | ' + l.ID)
      }))
    });
  }

  // Lấy đường dẫn thư mục userData từ argv (nếu có)
const userDataDir = process.argv[4] || process.env.USERDATA_DIR || null;
const outputFileName = 'case_detail_gzip.txt';
let outputFilePath = userDataDir ? path.join(userDataDir, outputFileName) : outputFileName;
if (!userDataDir || (typeof process.resourcesPath === 'string' && outputFilePath.startsWith(process.resourcesPath))) {
  // Nếu không truyền userDataDir hoặc đang ghi vào thư mục app, chuyển sang Desktop
  outputFilePath = path.join(os.homedir(), 'Desktop', outputFileName);
}
console.log('userDataDir:', userDataDir);
console.log('Final outputFilePath:', outputFilePath);

// Ghi HEADER ROW vào file case_detail_gzip.txt
const header = `HEADER ROW - CompressionType="GZip" - Encoding="base64" - LeadListGuid="${LeadListGuid}"
`;
const dir = require('path').dirname(outputFilePath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}
try {
  require('fs').writeFileSync(outputFilePath, header, 'utf-8');
  console.log('Đã ghi header ra file:', outputFilePath);
} catch (err) {
  console.error('Lỗi ghi header:', outputFilePath, err.message);
}

  const extensionPath = path.resolve('./my_extenstion');
  // Hàm crawl cho 1 profile, thêm tham số vị trí cửa sổ
  async function crawlWithProfile(profileDir, cases, windowX, windowY, fingerprint, proxyStr) {
    console.log(`proxyStr: ${proxyStr}`);
    let proxy = proxyStr ? parseProxy(proxyStr) : null;
    
    const args = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=400,800',
      `--window-position=${windowX},${windowY}`,
      '--disable-extensions-except=' + extensionPath,
      '--load-extension=' + extensionPath
    ];
    if (proxy && proxy.host && proxy.port) {
      let proxyArg;
      if (proxy.protocol === 'http' || proxy.protocol === 'https') {
        proxyArg = `--proxy-server=${proxy.protocol}://${proxy.host}:${proxy.port}`;
      } else if (proxy.protocol === 'socks5') {
        proxyArg = `--proxy-server=socks5://${proxy.host}:${proxy.port}`;
      } else {
        proxyArg = `--proxy-server=${proxy.host}:${proxy.port}`;
      }
      console.log('Proxy arg truyền vào Chrome:', proxyArg);
      args.push(proxyArg);
    }
    const browser = await puppeteer.launch({
      headless: false,
      executablePath: executablePathArg,
      userDataDir: profileDir,
      defaultViewport: null,
      args
    });
    const page = await browser.newPage();
    if (proxy && proxy.username && proxy.password) {
      await page.authenticate({ username: proxy.username, password: proxy.password });
    }
    // Đặt viewport nhỏ như mobile
    await page.setViewport({ width: 400, height: 800 });
    // Di chuyển cửa sổ đến vị trí mong muốn (nếu có thể)
    try {
      const pages = await browser.pages();
      const session = await pages[0].target().createCDPSession();
      const { windowId } = await session.send('Browser.getWindowForTarget');
      await session.send('Browser.setWindowBounds', {
        windowId,
        bounds: { left: windowX, top: windowY, width: 420, height: 800, windowState: 'normal' }
      });
    } catch (e) {
      console.log('Không thể di chuyển cửa sổ:', e.message);
    }

    // Fake fingerprint bằng script JS (dùng fingerprint truyền vào)
    await page.evaluateOnNewDocument(fp => {
       if (!window.chrome) window.chrome = {};

    // Fake chrome.runtime
    window.chrome.runtime = {
    connect: function() {
      throw new TypeError(
        "Error in invocation of runtime.connect(optional string extensionId, optional object connectInfo): " +
        "chrome.runtime.connect() called from a webpage must specify an Extension ID (string) for its first argument."
      );
    },
    sendMessage: function() {
      throw new TypeError(
        "Error in invocation of runtime.sendMessage(optional string extensionId, any message, optional object options, optional function responseCallback): No matching signature."
      );
    },
    id: undefined
  };

    // Fake chrome.webstore
    window.chrome.webstore = {
      install: function() {},
      onInstallStageChanged: {},
      onDownloadProgress: {}
    };

    // Fake chrome.csi
    window.chrome.csi = function() { return {}; };

    // Fake chrome.loadTimes
    window.chrome.loadTimes = function() { return {}; };

    // Fake chrome.app
    window.chrome.app = {
      isInstalled: false,
      InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
      RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
      getDetails: function() { return null; },
      getIsInstalled: function() { return false; },
      runningState: function() { return 'running'; }
    };
      // Fake navigator properties
      Object.defineProperty(navigator, 'platform', { get: () => fp.platform });
      Object.defineProperty(navigator, 'userAgent', { get: () => fp.userAgent });
      Object.defineProperty(navigator, 'language', { get: () => fp.language });
      Object.defineProperty(navigator, 'languages', { get: () => fp.languages });
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => fp.hardwareConcurrency });
      Object.defineProperty(navigator, 'deviceMemory', { get: () => fp.deviceMemory });
      Object.defineProperty(navigator, 'maxTouchPoints', { get: () => fp.maxTouchPoints });
      Object.defineProperty(navigator, 'vendor', { get: () => fp.vendor });

      // Fake timezone
      Intl.DateTimeFormat = class extends Intl.DateTimeFormat {
        resolvedOptions() {
          return { timeZone: fp.timeZone };
        }
      };

      // Fake screen
      Object.defineProperty(window.screen, 'width', { get: () => fp.width });
      Object.defineProperty(window.screen, 'height', { get: () => fp.height });
      Object.defineProperty(window.screen, 'availWidth', { get: () => fp.width });
      Object.defineProperty(window.screen, 'availHeight', { get: () => fp.height });
      Object.defineProperty(window, 'devicePixelRatio', { get: () => fp.devicePixelRatio });

      // Fake WebGL metadata
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) return fp.webglVendor; // UNMASKED_VENDOR_WEBGL
        if (parameter === 37446) return fp.webglRenderer; // UNMASKED_RENDERER_WEBGL
        if (parameter === 0x1F02) return fp.webglVersion; // VERSION
        return getParameter.call(this, parameter);
      };

      window.OfflineAudioContext = function() { return { sampleRate: fp.audioSampleRate }; };
      window.AudioContext = function() { return { sampleRate: fp.audioSampleRate }; };

      // Fake AudioContext fingerprint (noise)
      const copyToChannel = AudioBuffer.prototype.copyToChannel;
      AudioBuffer.prototype.copyToChannel = function(source, channelNumber, startInChannel) {
        // Thêm nhiễu vào buffer để hash khác đi
        if (source && source.length) {
          for (let i = 0; i < source.length; i++) {
            source[i] = source[i] + (Math.random() - 0.5) * 1e-7;
          }
        }
        return copyToChannel.call(this, source, channelNumber, startInChannel);
      };
      // Fake AudioContext
      window.OfflineAudioContext = function() { return { sampleRate: fp.audioSampleRate }; };

      // Fake fonts (not perfect, but can help)
      document.fonts = {
        check: () => true,
        forEach: () => {},
        size: 0
      };
      // Ẩn webdriver
    Object.defineProperty(navigator, 'webdriver', { get: () => false });

    // Fake plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5]
    });

    // Fake mimeTypes
    Object.defineProperty(navigator, 'mimeTypes', {
      get: () => [1, 2, 3]
    });

    // Fake permissions
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) =>
      parameters.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission })
        : originalQuery(parameters);

    // Fake outerWidth/outerHeight
    Object.defineProperty(window, 'outerWidth', { get: () => window.innerWidth });
    Object.defineProperty(window, 'outerHeight', { get: () => window.innerHeight });

    // Fake mediaDevices
    navigator.mediaDevices = {
      enumerateDevices: async () => [{ kind: 'audioinput' }, { kind: 'videoinput' }]
    };
      // Fake Bluetooth
      navigator.bluetooth = undefined;

      // Fake WebRTC
      Object.defineProperty(window, 'RTCPeerConnection', { get: () => undefined });

      // Fake Canvas
      const toDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function() {
        return fp.canvasDataUrl || toDataURL.apply(this, arguments);
      };
     
    }, fingerprint);

    // Chạy từng case trong danh sách cases
    for (let i = 0; i < cases.length; i++) {
      const caseObj = cases[i];
      const caseNumber = caseObj.CaseKey;
      const caseId = caseObj.ID;
      try {
        console.log(`Đang xử lý case: ${caseNumber}`);
        await page.goto('https://myeclerk.myorangeclerk.com/Cases/Search', { waitUntil: 'networkidle2' });
        await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 3000)));
        await page.type('#caseNumber', caseNumber);
        // Chờ và click reCAPTCHA (có retry nếu bị detach hoặc không tìm thấy)
        let recaptchaSuccess = false;
        
        const ready = await waitForReady(page, 20); // thử 20 lần, mỗi lần cách 1 giây
        if (!ready) {
          recaptchaSuccess = true; // Không thao tác được reCAPTCHA
          console.log('🔁 Reload vì checkbox/search chưa sẵn sàng.');
          await page.reload({ waitUntil: ['networkidle0', 'domcontentloaded'] });
          await page.waitForTimeout(2000);
          
          process.exit(0);
        }else {
          recaptchaSuccess = true;
        }

        if (!recaptchaSuccess) {
          console.log('Bo qua case vi khong thao tac duoc reCAPTCHA:', caseNumber);
          // Gửi log lỗi lên Electron nếu có
          if (process.send) {
            process.send({
              type: 'case-error',
              data: {
                caseId,
                caseKey: caseNumber,
                crawlTime: new Date().toLocaleString('en-US', { hour12: true }),
                reason: 'Không thao tác được reCAPTCHA'
              }
            });
          }
          continue;
        }
        console.log(' click  Search');
        const isSearchButtonEnabled = await page.$eval('#caseSearch', btn => !btn.disabled);
        if (isSearchButtonEnabled) {
          console.log('Nút Search đang ENABLE, chuẩn bị click...');
          await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2' }),
            page.click('#caseSearch')
          ]);
        } else {
          console.log('Nút Search hiện đang DISABLED, thử lại sau...');
        }
        let found = false;
        try {
          await page.waitForSelector('#caseList .caseLink', { visible: true, timeout: 10000 });
          found = true;
        } catch (e) {
          console.log(`Không tìm thấy kết quả cho case: ${caseNumber}`);
          // Lấy HTML của trang chi tiết, double encode: HTML -> base64 -> gzip -> base64 và ghi ra file txt
          const detailHtml = await page.content();
          // const htmlBase64 = Buffer.from(detailHtml, 'utf-8').toString('base64');
          // const gzipped = zlib.gzipSync(htmlBase64);
          const base64 = encodeHtmlToBase64GzipXml(detailHtml);
          const xml = zlib.gunzipSync(Buffer.from(base64, 'base64')).toString('utf-8');
          console.log(xml);
          // Lấy thời gian crawl hiện tại
          const crawlTime = new Date().toLocaleString('en-US', { hour12: true });
          // Ghi theo format: id|thời gian|base64, mỗi dòng 1 case
          
          fs.appendFileSync(outputFilePath, `${caseId}|${crawlTime}|${base64}\n`, 'utf-8');
          // Gửi log lỗi lên Electron nếu có
          if (process.send) {
            process.send({
              type: 'case-error',
              data: {
                caseId,
                caseKey: caseNumber,
                crawlTime: new Date().toLocaleString('en-US', { hour12: true }),
                reason: 'Không tìm thấy kết quả'
              }
            });
          }
        }
        if (found) {
          await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2' }),
            page.click('#caseList .caseLink')
          ]);
          console.log('Đã click vào link đầu tiên trong bảng kết quả');
          // Lấy HTML của trang chi tiết, double encode: HTML -> base64 -> gzip -> base64 và ghi ra file txt
          const detailHtml = await page.content();
          // const htmlBase64 = Buffer.from(detailHtml, 'utf-8').toString('base64');
          // const gzipped = zlib.gzipSync(htmlBase64);
          const base64 = encodeHtmlToBase64GzipXml(detailHtml);
          // Lấy thời gian crawl hiện tại
          const crawlTime = new Date().toLocaleString('en-US', { hour12: true });
          // Ghi theo format: id|thời gian|base64, mỗi dòng 1 case
          fs.appendFileSync(outputFilePath, `${caseId}|${crawlTime}|${base64}\n`, 'utf-8');
          console.log('Đã ghi file case_detail_gzip.txt với nội dung id|thời gian|base64');
          // Gửi log đã xong từng case lên Electron (nếu chạy dưới child_process)
          if (process.send) {
            process.send({
              type: 'case-done',
              data: {
                caseId,
                caseKey: caseNumber,
                crawlTime
              }
            });
          }
        }
      } catch (err) {
        // Nếu browser bị đóng hoặc target closed thì dừng crawl
        if (err.message && (err.message.includes('Target closed') || err.message.includes('Protocol error'))) {
          console.error('Chrome đã bị đóng, dừng crawl và xuất file!');
          if (process.send) {
            process.send({ type: 'chrome-closed', data: { caseId, caseKey: caseNumber } });
            
          }
          fs.copyFileSync(outputFilePath, destPath);
          console.log('Đã copy file case_detail_gzip.txt ra Desktop:', destPath);
          process.exit(0);
          
        } else {
          console.error('Loi khong xac dinh khi crawl:', err.message);
          fs.copyFileSync(outputFilePath, destPath);
          console.log('Đã copy file case_detail_gzip.txt ra Desktop:', destPath);
          process.exit(0);
        }
      }
    }
    await browser.close();
  }

  // Chạy song song các profile, truyền fingerprint tương ứng
  // Kích thước cửa sổ mobile (ví dụ iPhone X)
const windowWidth = 420;
const windowHeight = 800;
const screenX0 = 0;
const screenY0 = 0;
const windowGap = 120; // Tăng khoảng cách giữa các cửa sổ lên 120px
await Promise.all(
  profiles.map((profileDir, idx) => {
    const x = screenX0 + idx * (windowWidth + windowGap); // Tăng gap để không bị chớm đè
    const y = screenY0;
    console.log(`Đang crawl profile ${idx + 1} tại vị trí (${x}, ${y}) với fingerprint:`, assignedProxies[idx]);
    return crawlWithProfile(profileDir, caseChunks[idx], x, y, fingerprints[idx], assignedProxies[idx]);
  })
);

  console.log('Đã crawl xong với tất cả profile!');

  
  console.log('Đường dẫn Desktop:', desktopDir);
  try {
    fs.copyFileSync(outputFilePath, destPath);
    console.log('Đã copy file case_detail_gzip.txt ra Desktop:', destPath);
    if (process.send) {
      process.send({
        type: 'export-done',
        data: {
          destPath
        }
      });
    }
  } catch (e) {
    console.error('Không thể copy file ra Desktop:', e.message);
    if (process.send) {
      process.send({
        type: 'export-error',
        data: {
          error: e.message,
          destPath
        }
      });
    }
  }

  process.exit(0);
})();