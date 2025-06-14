const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { fork, spawn } = require('child_process');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 900,
    minHeight: 500,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  // Load file HTML tĩnh
  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC để gọi script crawl từ renderer (nhận số lượng profile)
ipcMain.handle('start-crawl', async (event, args) => {
    
  const profileCount = args && args.profileCount ? args.profileCount : 3;
  //console.log('start-crawl IPC received with args:', args);
  const extKey = args && args.extKey ? args.extKey : '';
  const inputContent = args && args.inputContent ? args.inputContent : '';
  const inputFileName = args && args.inputFileName ? args.inputFileName : 'input.txt';
  const chromePath = args && args.chromePath ? args.chromePath : 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const proxyList = args && args.proxyList ? args.proxyList : '';
  // Ghi extKey vào configs.json trong my_extenstion (thay đúng api_key)
  if (extKey) {
    const configPath = path.join(__dirname, 'my_extenstion', 'configs.json');
    try {
      let configRaw = fs.readFileSync(configPath, 'utf-8');
      let config = JSON.parse(configRaw);
      config.api_key = extKey;
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (e) {
      console.error('Lỗi ghi configs.json:', e.message);
    }
  }
  // Ghi file input mới (nếu có)
  let inputPath = path.join(__dirname, inputFileName);
  let userDataDir = app.getPath('userData');
  if (inputContent) {
    // Nếu đang chạy bản đóng gói, lưu vào userData
    inputPath = path.join(userDataDir, inputFileName);
    fs.writeFileSync(inputPath, inputContent, 'utf-8');
  }
  return new Promise((resolve, reject) => {
    console.log('proxyList truyền vào child:', proxyList);
    console.log('chromePath truyền vào child:', chromePath);
    console.log('profileCount truyền vào child:', profileCount);
    // Truyền đường dẫn file input tuyệt đối và userDataDir cho puppeter_fake_finger_print.js
    const crawl = fork(
      path.join(__dirname, 'puppeter_fake_finger_print.js'),
      [profileCount, inputPath, userDataDir, chromePath, proxyList],
      { stdio: ['inherit', 'inherit', 'inherit', 'ipc'] }
    );
    crawl.on('message', msg => {
      if (msg && msg.type === 'leads-distribution') {
        // Gửi danh sách leads đã chia về renderer (UI)
        mainWindow.webContents.send('leads-distribution', msg.data);
      }
      if (msg && msg.type === 'case-done') {
        mainWindow.webContents.send('case-done', msg.data);
      }
      if (msg && msg.type === 'case-error') {
        mainWindow.webContents.send('case-error', msg.data);
      }
      if (msg && msg.type === 'export-done') {
        mainWindow.webContents.send('export-done', msg.data);
      }
      if (msg && msg.type === 'export-error') {
        mainWindow.webContents.send('export-error', msg.data);
      }
    });
    crawl.on('exit', code => resolve(code));
    crawl.on('error', err => reject(err));
  });
});

// Lắng nghe IPC từ renderer để kill Chrome và xuất file
ipcMain.handle('kill-chrome-export', async (event) => {
  const { spawn } = require('child_process');
  const os = require('os');
  try {
    // 1. Kill Chrome trước
    await new Promise((resolve, reject) => {
      const kill = spawn('taskkill', ['/F', '/IM', 'chrome.exe']);
      kill.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Failed to kill Chrome with code ${code}`));
      });
    });

    // 2. Copy file case_detail_gzip.txt ra Desktop với timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const desktopPath = path.join(os.homedir(), 'Desktop');
    const outputFilename = `case_detail_gzip_${timestamp}.txt`;
    const outputPath = path.join(desktopPath, outputFilename);
    const sourcePath = path.join(__dirname, 'case_detail_gzip.txt');
    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, outputPath);
      mainWindow.webContents.send('export-done', { destPath: outputPath });
      return { success: true, path: outputPath };
    } else {
      throw new Error('Không tìm thấy file case_detail_gzip.txt');
    }
  } catch (error) {
    console.error('Error during kill and export:', error);
    mainWindow.webContents.send('export-error', { error: error.message });
    return { success: false, error: error.message };
  }
});
