#pragma once
#include <windows.h>
#include <atomic>
#include "wintab.h"  // Wacom SDK

// Динамически загружаемые функции WinTab
typedef UINT (WINAPI *WTINFOA)(UINT, UINT, LPVOID);
typedef HCTX (WINAPI *WTOPENA)(HWND, LPLOGCONTEXTA, BOOL);
typedef BOOL (WINAPI *WTCLOSE)(HCTX);
typedef int (WINAPI *WTPACKETSGET)(HCTX, int, LPVOID);

class WintabContext {
public:
  WintabContext();
  ~WintabContext();

  bool Load();          // LoadLibrary("Wintab32.dll")
  bool Open(HWND hwnd); // WTOpen → создаём контекст
  void Close();
  void StartPolling();
  void StopPolling();
  bool IsAvailable() const;

  std::atomic<float> pressure{1.0f};  // 0.0 - 1.0
  std::atomic<int>   tiltX{0};        // градусы
  std::atomic<int>   tiltY{0};
  std::atomic<bool>  penDown{false};

private:
  void PollLoop();  // запускается в отдельном потоке

  HMODULE   _hLib    = nullptr;
  HCTX      _hCtx    = nullptr;
  HWND      _hHelperWnd = nullptr;
  bool      _running = false;
  UINT      _maxPressure = 1023; // узнаём из WTInfo

  WTINFOA      _WTInfo      = nullptr;
  WTOPENA      _WTOpen      = nullptr;
  WTCLOSE      _WTClose     = nullptr;
  WTPACKETSGET _WTPacketsGet = nullptr;
};
