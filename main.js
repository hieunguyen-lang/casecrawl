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
  if (inputContent) {
    const inputPath = path.join(__dirname, inputFileName);
    fs.writeFileSync(inputPath, inputContent, 'utf-8');
  }
  return new Promise((resolve, reject) => {
    console.log('proxyList truyền vào child:', proxyList);
    console.log('chromePath truyền vào child:', chromePath);
    console.log('profileCount truyền vào child:', profileCount);
    const crawl = fork(path.join(__dirname, 'puppeter_fake_finger_print.js'), [profileCount, inputFileName, '', chromePath, proxyList], { stdio: ['inherit', 'inherit', 'inherit', 'ipc'] });
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
  // Kill toàn bộ process Chrome (Windows)
  const { spawn } = require('child_process');
  return new Promise((resolve) => {
    const kill = spawn('taskkill', ['/F', '/IM', 'chrome.exe']);
    kill.on('close', (code) => {
      resolve({ code });
    });
  });
});
