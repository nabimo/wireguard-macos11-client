const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')
const { execFile, spawn } = require('child_process')
const AdmZip = require('adm-zip')

const isDev = !app.isPackaged
const profilesDir = path.join(app.getPath('userData'), 'profiles')
let activeProcess = null
let activeProfile = null

function ensureDirs() {
  fs.mkdirSync(profilesDir, { recursive: true })
}

function safeName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function listProfiles() {
  ensureDirs()

  return fs.readdirSync(profilesDir)
    .filter(f => f.toLowerCase().endsWith('.conf'))
    .map(fileName => ({
      name: fileName.replace(/\.conf$/i, ''),
      fileName,
      path: path.join(profilesDir, fileName)
    }))
}

function run(command, args = [], options = {}) {
  return new Promise((resolve) => {
    execFile(command, args, { timeout: options.timeout || 15000 }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        code: error?.code ?? 0,
        stdout: String(stdout || ''),
        stderr: String(stderr || ''),
        error: error ? (stderr || error.message) : ''
      })
    })
  })
}

// macOS asks for administrator authorization through its native dialog.
// No password is stored by this app.
async function runAsAdmin(command, args = []) {
  const quoted = [command, ...args].map(x => `'${String(x).replace(/'/g, "'\\\\''")}'`).join(' ')
  const script = `do shell script ${JSON.stringify(quoted)} with administrator privileges`
  return run('/usr/bin/osascript', ['-e', script], { timeout: 60000 })
}

function validateConf(filePath) {
  const text = fs.readFileSync(filePath, 'utf8')

  if (!/\[Interface\]/i.test(text) || !/\[Peer\]/i.test(text)) {
    throw new Error('Not a valid WireGuard configuration.')
  }

  return text
}

function importConf(sourcePath) {
  ensureDirs()
  validateConf(sourcePath)
  const base = safeName(path.basename(sourcePath))
  const destination = path.join(profilesDir, base)
  fs.copyFileSync(sourcePath, destination)
  return destination
}

function importZip(zipPath) {
  ensureDirs()

  const zip = new AdmZip(zipPath)
  const entries = zip.getEntries()

  let imported = 0

  for (const entry of entries) {
    if (entry.isDirectory) continue
    if (!entry.entryName.toLowerCase().endsWith('.conf')) continue

    const original = path.basename(entry.entryName)
    const base = safeName(original)

    let destination = path.join(profilesDir, base)

    if (fs.existsSync(destination)) {
      const stem = base.replace(/\.conf$/i, '')

      destination = path.join(
        profilesDir,
        `${stem}-${Date.now()}-${imported}.conf`
      )
    }

    const data = entry.getData()
    const text = data.toString('utf8')

    if (!/\[Interface\]/i.test(text) || !/\[Peer\]/i.test(text)) {
      continue
    }

    fs.writeFileSync(destination, data, {
      mode: 0o600
    })

    imported++
  }

  return imported
}

function findWireGuardTools() {
  const candidates = [
    path.join(process.resourcesPath, 'assets', 'bin', 'darwin-x64', 'wg-quick'),
    '/opt/homebrew/bin/wg-quick',
    '/usr/local/bin/wg-quick',
    '/usr/bin/wg-quick'
  ]
  return candidates.find(p => fs.existsSync(p)) || 'wg-quick'
}

async function connect(profilePath) {
  if (!profilePath || !path.resolve(profilePath).startsWith(path.resolve(profilesDir) + path.sep)) {
    return { ok: false, error: 'Invalid profile.' }
  }

  try { validateConf(profilePath) } catch (e) {
    return { ok: false, error: e.message }
  }

  if (activeProfile) {
    return { ok: false, error: 'A VPN profile is already connected.' }
  }

  const wgQuick = findWireGuardTools()
  const result = await runAsAdmin(wgQuick, ['up', profilePath])

  if (!result.ok) return result

  activeProfile = profilePath
  return { ok: true, stdout: result.stdout }
}

async function disconnect() {
  if (!activeProfile) return { ok: true }

  const wgQuick = findWireGuardTools()
  const result = await runAsAdmin(wgQuick, ['down', activeProfile])

  if (result.ok) activeProfile = null
  return result
}

async function status() {
  if (!activeProfile) return { connected: false, interface: null }

  const result = await run('wg', ['show'])
  const file = path.basename(activeProfile, '.conf')
  return {
    connected: result.ok,
    interface: file,
    raw: result.stdout || result.stderr
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 480,
    height: 680,
    minWidth: 420,
    minHeight: 600,
    title: 'WireGuard Mac',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  if (isDev) win.loadURL('http://127.0.0.1:3333')
  else win.loadFile(path.join(app.getAppPath(), '.output/public/index.html'))
}

app.whenReady().then(() => {
  ensureDirs()

  ipcMain.handle('profiles:list', () => listProfiles())

  ipcMain.handle('profiles:import', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'WireGuard profiles', extensions: ['conf', 'zip'] }
      ]
    })

    if (result.canceled) {
      return { imported: 0, canceled: true, errors: [] }
    }

    let imported = 0
    const errors = []

    for (const file of result.filePaths) {
      try {
        if (file.toLowerCase().endsWith('.zip')) {
          imported += importZip(file)
        } else {
          importConf(file)
          imported++
        }
      } catch (e) {
        errors.push(`${path.basename(file)}: ${e.message}`)
      }
    }

    return { imported, errors }
  })

  ipcMain.handle('vpn:connect', (_, profilePath) => connect(profilePath))
  ipcMain.handle('vpn:disconnect', () => disconnect())
  ipcMain.handle('vpn:status', () => status())

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', async () => {
  if (process.platform === 'darwin') return
  await disconnect()
  app.quit()
})

process.on('SIGINT', async () => {
  await disconnect()
  app.quit()
})
