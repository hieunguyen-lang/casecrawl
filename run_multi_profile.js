const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');
const xml2js = require('xml2js');
const readline = require('readline');
puppeteer.use(StealthPlugin());

function getRandomProfileName() {
  return 'hieunk_profile_' + Math.random().toString(36).substring(2, 10);
}

function splitCases(cases, n) {
  const result = Array.from({ length: n }, () => []);
  cases.forEach((item, i) => {
    result[i % n].push(item);
  });
  return result;
}

async function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans); }));
}

(async () => {
  // Lấy số profile từ argv hoặc hỏi
  let numProfiles = 0;
  const argIdx = process.argv.indexOf('--profiles');
  if (argIdx > -1 && process.argv[argIdx + 1]) {
    numProfiles = parseInt(process.argv[argIdx + 1]);
  }
  if (!numProfiles || isNaN(numProfiles) || numProfiles < 1) {
    numProfiles = parseInt(await ask('Nhập số lượng profile muốn chạy song song: '));
  }
  if (!numProfiles || isNaN(numProfiles) || numProfiles < 1) {
    console.log('Số lượng profile không hợp lệ!');
    process.exit(1);
  }

  // Tạo mảng profile random
  const profiles = [];
  for (let i = 0; i < numProfiles; i++) {
    const name = getRandomProfileName();
    const dir = path.resolve('./' + name);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    profiles.push(dir);
  }
  console.log('Profiles:', profiles);

  // Đọc danh sách case number từ file input.txt (dạng XML hoặc txt)
  const xmlContent = fs.readFileSync('input.txt', 'utf-8');
  // Nếu muốn tự động parse XML, có thể thay thế đoạn này
  const leads = [
    '2018CF004546BO', '2018CF005073BO', '2018CF005087BO',
    '2018CF005677BO', '2018CF006455BO', '2018CF006554BO', '2018CF007640BO'
  ];
  const caseChunks = splitCases(leads, profiles.length);

  // Fake fingerprint giữ nguyên như cũ
  const fakeFingerprint = {
    platform: 'Win32', vendor: 'Google Inc.', deviceMemory: 16, maxTouchPoints: 1, width: 1920, height: 1080, devicePixelRatio: 1,
    webglVendor: 'Google Inc. (NVIDIA)', webglRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Ti Direct3D11 vs_5_0 ps_5_0, D3D11)',
    webglVersion: 'WebGL 1.0 (OpenGL ES 2.0 Chromium)', audioSampleRate: 48000, timeZone: 'Asia/Ho_Chi_Minh', language: 'en-US',
    languages: ['en-US', 'en'], hardwareConcurrency: 16,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
    canvasDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA', profileName: 'HieuNK Test Profile'
  };

  async function crawlWithProfile(profileDir, cases, windowX, windowY) {
    const browser = await puppeteer.launch({
      headless: false,
      executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
      userDataDir: profileDir,
      defaultViewport: null,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--window-size=400,800',
        `--window-position=${windowX},${windowY}`
      ]
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 400, height: 800 });
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
    await page.evaluateOnNewDocument(fp => {
      // ... giữ nguyên đoạn fake fingerprint ...
      if (!window.chrome) window.chrome = {};
      window.chrome.runtime = { connect: function() { throw new TypeError('Error in invocation of runtime.connect(optional string extensionId, optional object connectInfo): chrome.runtime.connect() called from a webpage must specify an Extension ID (string) for its first argument.'); }, sendMessage: function() { throw new TypeError('Error in invocation of runtime.sendMessage(optional string extensionId, any message, optional object options, optional function responseCallback): No matching signature.'); }, id: undefined };
      window.chrome.webstore = { install: function() {}, onInstallStageChanged: {}, onDownloadProgress: {} };
      window.chrome.csi = function() { return {}; };
      window.chrome.loadTimes = function() { return {}; };
      window.chrome.app = { isInstalled: false, InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' }, RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' }, getDetails: function() { return null; }, getIsInstalled: function() { return false; }, runningState: function() { return 'running'; } };
      Object.defineProperty(navigator, 'platform', { get: () => fp.platform });
      Object.defineProperty(navigator, 'userAgent', { get: () => fp.userAgent });
      Object.defineProperty(navigator, 'language', { get: () => fp.language });
      Object.defineProperty(navigator, 'languages', { get: () => fp.languages });
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => fp.hardwareConcurrency });
      Object.defineProperty(navigator, 'deviceMemory', { get: () => fp.deviceMemory });
      Object.defineProperty(navigator, 'maxTouchPoints', { get: () => fp.maxTouchPoints });
      Object.defineProperty(navigator, 'vendor', { get: () => fp.vendor });
      Intl.DateTimeFormat = class extends Intl.DateTimeFormat { resolvedOptions() { return { timeZone: fp.timeZone }; } };
      Object.defineProperty(window.screen, 'width', { get: () => fp.width });
      Object.defineProperty(window.screen, 'height', { get: () => fp.height });
      Object.defineProperty(window.screen, 'availWidth', { get: () => fp.width });
      Object.defineProperty(window.screen, 'availHeight', { get: () => fp.height });
      Object.defineProperty(window, 'devicePixelRatio', { get: () => fp.devicePixelRatio });
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) return fp.webglVendor;
        if (parameter === 37446) return fp.webglRenderer;
        if (parameter === 0x1F02) return fp.webglVersion;
        return getParameter.call(this, parameter);
      };
      window.OfflineAudioContext = function() { return { sampleRate: fp.audioSampleRate }; };
      window.AudioContext = function() { return { sampleRate: fp.audioSampleRate }; };
      const copyToChannel = AudioBuffer.prototype.copyToChannel;
      AudioBuffer.prototype.copyToChannel = function(source, channelNumber, startInChannel) {
        if (source && source.length) {
          for (let i = 0; i < source.length; i++) {
            source[i] = source[i] + (Math.random() - 0.5) * 1e-7;
          }
        }
        return copyToChannel.call(this, source, channelNumber, startInChannel);
      };
      window.OfflineAudioContext = function() { return { sampleRate: fp.audioSampleRate }; };
      document.fonts = { check: () => true, forEach: () => {}, size: 0 };
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'mimeTypes', { get: () => [1, 2, 3] });
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => parameters.name === 'notifications' ? Promise.resolve({ state: Notification.permission }) : originalQuery(parameters);
      Object.defineProperty(window, 'outerWidth', { get: () => window.innerWidth });
      Object.defineProperty(window, 'outerHeight', { get: () => window.innerHeight });
      navigator.mediaDevices = { enumerateDevices: async () => [{ kind: 'audioinput' }, { kind: 'videoinput' }] };
      navigator.bluetooth = undefined;
      Object.defineProperty(window, 'RTCPeerConnection', { get: () => undefined });
      const toDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function() { return fp.canvasDataUrl || toDataURL.apply(this, arguments); };
    }, fakeFingerprint);
    for (let i = 0; i < cases.length; i++) {
      const caseNumber = cases[i];
      console.log(`[${profileDir}] Đang xử lý case: ${caseNumber}`);
      await page.goto('https://myeclerk.myorangeclerk.com/Cases/Search', { waitUntil: 'networkidle2' });
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 3000)));
      await page.type('#caseNumber', caseNumber);
      const frames = await page.frames();
      const recaptchaFrame = frames.find(frame => frame.url().includes('recaptcha'));
      if (recaptchaFrame) {
        const checkbox = await recaptchaFrame.waitForSelector('.recaptcha-checkbox-border', { visible: true });
        await checkbox.click();
        console.log(`[${profileDir}] Đã click vào reCAPTCHA`);
        await recaptchaFrame.waitForSelector('.recaptcha-checkbox-checked', { visible: true, timeout: 120000 });
        console.log(`[${profileDir}] Đã xác nhận reCAPTCHA đã được tích`);
      } else {
        console.log(`[${profileDir}] Không tìm thấy iframe reCAPTCHA`);
      }
      console.log(`[${profileDir}] Đã click nút Search`);
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2' }),
        page.click('#caseSearch')
      ]);
      let found = false;
      try {
        await page.waitForSelector('#caseList .caseLink', { visible: true, timeout: 10000 });
        found = true;
      } catch (e) {
        console.log(`[${profileDir}] Không tìm thấy kết quả cho case: ${caseNumber}`);
      }
      if (found) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2' }),
          page.click('#caseList .caseLink')
        ]);
        console.log(`[${profileDir}] Đã click vào link đầu tiên trong bảng kết quả`);
        const detailHtml = await page.content();
        const gzipped = zlib.gzipSync(detailHtml);
        const base64 = gzipped.toString('base64');
        fs.appendFileSync('case_detail_gzip.txt', base64 + '\n', 'utf-8');
        console.log(`[${profileDir}] Đã ghi file case_detail_gzip.txt với nội dung base64+gzip`);
      }
    }
    await browser.close();
  }

  // Dàn đều cửa sổ ngang
  const windowWidth = 420;
  const windowHeight = 800;
  const screenX0 = 0;
  const screenY0 = 0;
  const windowGap = 120;
  await Promise.all(
    profiles.map((profileDir, idx) => {
      const x = screenX0 + idx * (windowWidth + windowGap);
      const y = screenY0;
      return crawlWithProfile(profileDir, caseChunks[idx], x, y);
    })
  );
  console.log('Đã crawl xong với tất cả profile!');
})();
