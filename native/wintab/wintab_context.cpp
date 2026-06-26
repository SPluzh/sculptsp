#include "wintab_context.h"
#include <thread>

// Определение пакета — только нужные поля
#define PACKETDATA (PK_X | PK_Y | PK_BUTTONS | PK_NORMAL_PRESSURE | PK_ORIENTATION)
#define PACKETMODE 0
#include "pktdef.h"  // генерирует структуру PACKET

WintabContext::WintabContext() {}
WintabContext::~WintabContext() { Close(); }

bool WintabContext::Load() {
  printf("[C++] LoadLibraryA(\"Wintab32.dll\")...\n");
  _hLib = LoadLibraryA("Wintab32.dll");
  if (!_hLib) {
    printf("[C++] LoadLibraryA failed. GetLastError=%lu\n", GetLastError());
    return false;
  }

  _WTInfo       = (WTINFOA)      GetProcAddress(_hLib, "WTInfoA");
  _WTOpen       = (WTOPENA)      GetProcAddress(_hLib, "WTOpenA");
  _WTClose      = (WTCLOSE)      GetProcAddress(_hLib, "WTClose");
  _WTPacketsGet = (WTPACKETSGET) GetProcAddress(_hLib, "WTPacketsGet");

  if (!_WTInfo || !_WTOpen || !_WTClose || !_WTPacketsGet) {
    printf("[C++] GetProcAddress failed.\n");
    FreeLibrary(_hLib); _hLib = nullptr;
    return false;
  }

  // Проверка доступности сервиса Wintab
  if (!_WTInfo(0, 0, nullptr)) {
    printf("[C++] WTInfo(0, 0, nullptr) returned 0.\n");
    FreeLibrary(_hLib); _hLib = nullptr;
    return false;
  }

  // Получаем максимальное давление
  AXIS pressureAxis = {};
  if (_WTInfo(WTI_DEVICES, DVC_NPRESSURE, &pressureAxis) > 0) {
    _maxPressure = pressureAxis.axMax > 0 ? pressureAxis.axMax : 1023;
  } else {
    _maxPressure = 1023;
  }

  printf("[C++] Wintab loaded. Max pressure: %u\n", _maxPressure);
  return true;
}

static ATOM g_wndClass = 0;

static LRESULT CALLBACK WintabHelperWndProc(HWND hwnd, UINT msg, WPARAM wp, LPARAM lp) {
  return DefWindowProcA(hwnd, msg, wp, lp);
}

static HWND CreateHelperWindow() {
  if (!g_wndClass) {
    WNDCLASSA wc = {};
    wc.lpfnWndProc   = WintabHelperWndProc;
    wc.hInstance     = GetModuleHandleA(nullptr);
    wc.lpszClassName = "WintabHelperClass";
    g_wndClass = RegisterClassA(&wc);
  }
  return CreateWindowExA(
    0, "WintabHelperClass", "Wintab Helper",
    0, 0, 0, 0, 0,
    nullptr, nullptr, GetModuleHandleA(nullptr), nullptr
  );
}

bool WintabContext::Open(HWND hwnd) {
  if (!_WTOpen) {
    printf("[C++] _WTOpen is NULL\n");
    return false;
  }

  // Создаем скрытое вспомогательное окно для контекста Wintab
  _hHelperWnd = CreateHelperWindow();
  if (!_hHelperWnd) {
    printf("[C++] CreateHelperWindow failed. GetLastError=%lu\n", GetLastError());
  } else {
    printf("[C++] CreateHelperWindow succeeded. HWND = %p\n", _hHelperWnd);
  }

  LOGCONTEXTA lc = {};
  // Получаем системный контекст по умолчанию
  if (_WTInfo(WTI_DEFSYSCTX, 0, &lc) == 0) {
    // В случае неудачи пробуем WTI_DEFCONTEXT
    if (_WTInfo(WTI_DEFCONTEXT, 0, &lc) == 0) {
      printf("[C++] WTInfo for context failed.\n");
      if (_hHelperWnd) { DestroyWindow(_hHelperWnd); _hHelperWnd = nullptr; }
      return false;
    }
  }

  lc.lcPktData    = PACKETDATA;
  lc.lcPktMode    = PACKETMODE;
  lc.lcMoveMask   = PACKETDATA;
  lc.lcBtnUpMask  = lc.lcBtnDnMask;
  lc.lcOptions   |= CXO_MESSAGES;

  // Сначала пробуем открыть контекст на наше вспомогательное окно
  if (_hHelperWnd) {
    printf("[C++] Trying WTOpen with helper HWND...\n");
    _hCtx = _WTOpen(_hHelperWnd, &lc, TRUE);
  }

  // Резервные варианты
  if (!_hCtx) {
    printf("[C++] Helper HWND WTOpen failed, trying electron HWND...\n");
    _hCtx = _WTOpen(hwnd, &lc, TRUE);
  }
  if (!_hCtx) {
    printf("[C++] Electron HWND WTOpen failed, trying nullptr HWND...\n");
    _hCtx = _WTOpen(nullptr, &lc, TRUE);
  }

  if (_hCtx) {
    printf("[C++] WTOpen succeeded! hCtx = %p\n", _hCtx);
  } else {
    printf("[C++] WTOpen failed for all HWNDs. GetLastError=%lu\n", GetLastError());
    if (_hHelperWnd) {
      DestroyWindow(_hHelperWnd);
      _hHelperWnd = nullptr;
    }
  }

  return _hCtx != nullptr;
}

void WintabContext::Close() {
  StopPolling();
  if (_hCtx)  { _WTClose(_hCtx); _hCtx = nullptr; }
  if (_hHelperWnd) { DestroyWindow(_hHelperWnd); _hHelperWnd = nullptr; }
  if (_hLib)  { FreeLibrary(_hLib); _hLib = nullptr; }
}

bool WintabContext::IsAvailable() const {
  return _hCtx != nullptr;
}

void WintabContext::StartPolling() {
  if (_running) return;
  _running = true;
  std::thread([this]() { PollLoop(); }).detach();
}

void WintabContext::StopPolling() {
  _running = false;
}

void WintabContext::PollLoop() {
  while (_running) {
    // Обработка сообщений Windows для вспомогательного окна
    if (_hHelperWnd) {
      MSG msg;
      while (PeekMessageA(&msg, _hHelperWnd, 0, 0, PM_REMOVE)) {
        TranslateMessage(&msg);
        DispatchMessageA(&msg);
      }
    }

    PACKET pkts[32];
    int got = _WTPacketsGet(_hCtx, 32, pkts);
    if (got > 0) {
      auto& p = pkts[got - 1];
      // Нормализуем давление 0.0 - 1.0
      pressure.store((float)p.pkNormalPressure / (float)_maxPressure);
      tiltX.store(p.pkOrientation.orAzimuth / 10);   // в градусах
      tiltY.store(p.pkOrientation.orAltitude / 10);
      penDown.store((p.pkButtons & 1) != 0);
    }
    Sleep(1); // ~1000 Hz, достаточно для 120fps рендера
  }
}
