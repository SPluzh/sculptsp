/**
 * wintab_diag.cpp — автономная консольная диагностика Wintab32.dll
 * Использует оригинальные заголовочные файлы Wintab для точного соответствия структур.
 * Добавлено создание реального HWND для корректного открытия контекста.
 */

#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <cstdio>
#include <cstring>
#include <string>
#include <thread>
#include <atomic>
#include <chrono>

// Подключаем официальные заголовки Wintab
#include "../native/wintab/wintab.h"

// Динамически загружаемые функции WinTab
typedef UINT (WINAPI *PF_WTInfoA)(UINT, UINT, LPVOID);
typedef HCTX (WINAPI *PF_WTOpenA)(HWND, LPLOGCONTEXTA, BOOL);
typedef BOOL (WINAPI *PF_WTClose)(HCTX);
typedef int  (WINAPI *PF_WTPacketsGet)(HCTX, int, LPVOID);

// Определение структуры пакета данных
#define PACKETDATA (PK_X | PK_Y | PK_BUTTONS | PK_NORMAL_PRESSURE | PK_ORIENTATION)
#define PACKETMODE 0
#include "../native/wintab/pktdef.h"

static void hr(char c = '-', int n = 60) {
    for (int i = 0; i < n; i++) putchar(c);
    putchar('\n');
}

static std::string winerr(DWORD code = 0) {
    if (!code) code = GetLastError();
    char buf[256] = {};
    FormatMessageA(FORMAT_MESSAGE_FROM_SYSTEM | FORMAT_MESSAGE_IGNORE_INSERTS,
                   nullptr, code, 0, buf, sizeof(buf), nullptr);
    for (int i = (int)strlen(buf) - 1; i >= 0 && (buf[i] == '\r' || buf[i] == '\n'); i--)
        buf[i] = 0;
    return std::string(buf) + " (code " + std::to_string(code) + ")";
}

int main(int argc, char** argv) {
    bool liveMode = (argc > 1 && std::string(argv[1]) == "--live");

    hr('=');
    printf("  Wintab Real Diagnostic Tool\n");
    printf("  Mode: %s\n", liveMode ? "LIVE (Ctrl+C to exit)" : "SINGLE CHECK");
    hr('=');

    // Очищаем последнюю ошибку потока, чтобы не выводить устаревшие ошибки
    SetLastError(0);

    // 1. Поиск Wintab32.dll
    printf("\n[1] Searching Wintab32.dll...\n");
    const char* paths[] = {
        "Wintab32.dll",
        "C:\\Windows\\System32\\Wintab32.dll",
        "C:\\Windows\\SysWOW64\\Wintab32.dll",
        nullptr
    };
    for (int i = 0; paths[i]; i++) {
        DWORD attr = GetFileAttributesA(paths[i]);
        if (attr != INVALID_FILE_ATTRIBUTES) {
            printf("    FOUND : %s\n", paths[i]);
        } else {
            printf("    ABSENT: %s\n", paths[i]);
        }
    }

    SetLastError(0);

    // 2. LoadLibrary
    printf("\n[2] LoadLibraryA(\"Wintab32.dll\")...\n");
    HMODULE hLib = LoadLibraryA("Wintab32.dll");
    if (!hLib) {
        printf("    FAIL  : %s\n", winerr().c_str());
        return 1;
    }
    char dllPath[MAX_PATH] = {};
    GetModuleFileNameA(hLib, dllPath, MAX_PATH);
    printf("    OK    : loaded from %s\n", dllPath);

    // 3. GetProcAddress
    printf("\n[3] GetProcAddress for Wintab functions...\n");
    PF_WTInfoA      WTInfoA      = (PF_WTInfoA)GetProcAddress(hLib, "WTInfoA");
    PF_WTOpenA      WTOpenA      = (PF_WTOpenA)GetProcAddress(hLib, "WTOpenA");
    PF_WTClose      WTClose      = (PF_WTClose)GetProcAddress(hLib, "WTClose");
    PF_WTPacketsGet WTPacketsGet = (PF_WTPacketsGet)GetProcAddress(hLib, "WTPacketsGet");

    if (!WTInfoA || !WTOpenA || !WTClose || !WTPacketsGet) {
        printf("    FAIL  : Some Wintab functions are missing in DLL\n");
        FreeLibrary(hLib);
        return 2;
    }
    printf("    OK    : All functions loaded successfully\n");

    // 4. WTInfo service availability
    printf("\n[4] WTInfoA(0, 0, nullptr) — service availability...\n");
    UINT svcResult = WTInfoA(0, 0, nullptr);
    if (svcResult == 0) {
        printf("    FAIL  : Wintab service is NOT available\n");
        FreeLibrary(hLib);
        return 3;
    }
    printf("    OK    : returned %u\n", svcResult);

    // 5. Версия
    WORD specVer = 0, implVer = 0;
    WTInfoA(WTI_INTERFACE, IFC_SPECVERSION, &specVer);
    WTInfoA(WTI_INTERFACE, IFC_IMPLVERSION, &implVer);
    printf("\n[5] Wintab version:\n");
    printf("    Spec: %u.%u | Impl: %u.%u\n", HIBYTE(specVer), LOBYTE(specVer), HIBYTE(implVer), LOBYTE(implVer));

    // 6. Устройства
    UINT nDevices = 0;
    WTInfoA(WTI_INTERFACE, IFC_NDEVICES, &nDevices);
    printf("\n[6] Devices (IFC_NDEVICES = %u):\n", nDevices);
    for (UINT d = 0; d < (nDevices > 0 ? nDevices : 1); d++) {
        char devName[64] = {};
        if (WTInfoA(WTI_DEVICES + d, DVC_NAME, devName) > 0) {
            printf("    Device[%u]: \"%s\"\n", d, devName);
        }
    }

    // 7. Максимальное давление
    AXIS pressAxis = {};
    UINT paxResult = WTInfoA(WTI_DEVICES, DVC_NPRESSURE, &pressAxis);
    UINT maxPressure = 1023;
    if (paxResult > 0 && pressAxis.axMax > 0) {
        maxPressure = pressAxis.axMax;
        printf("\n[7] Pressure: Min=%d Max=%d\n", pressAxis.axMin, pressAxis.axMax);
    } else {
        printf("\n[7] Pressure: failed to get, using default 1023\n");
    }

    // 8. Контекст
    printf("\n[8] Getting default system context (WTI_DEFSYSCTX)...\n");
    LOGCONTEXTA lc = {};
    SetLastError(0);
    UINT lcResult = WTInfoA(WTI_DEFSYSCTX, 0, &lc);
    if (lcResult == 0) {
        printf("    WTI_DEFSYSCTX failed, trying WTI_DEFCONTEXT...\n");
        lcResult = WTInfoA(WTI_DEFCONTEXT, 0, &lc);
    }
    
    if (lcResult == 0) {
        printf("    FAIL  : Could not retrieve default context structure\n");
        FreeLibrary(hLib);
        return 4;
    }
    printf("    OK    : retrieved context struct (size %u bytes), name: \"%s\"\n", lcResult, lc.lcName);

    // Настраиваем нужные поля
    lc.lcPktData  = PACKETDATA;
    lc.lcPktMode  = PACKETMODE;
    lc.lcMoveMask = PACKETDATA;
    lc.lcOptions |= CXO_MESSAGES;

    // 9. Создаем реальное окно
    printf("\n[9] Creating a dummy Win32 window for context...\n");
    WNDCLASSA wc = {};
    wc.lpfnWndProc = DefWindowProcA;
    wc.hInstance = GetModuleHandleA(nullptr);
    wc.lpszClassName = "WintabDiagClass";
    RegisterClassA(&wc);

    HWND hWnd = CreateWindowExA(0, "WintabDiagClass", "Wintab Diag", 0, 0, 0, 0, 0, nullptr, nullptr, wc.hInstance, nullptr);
    if (!hWnd) {
        printf("    FAIL  : CreateWindowExA failed. GetLastError=%s\n", winerr().c_str());
    } else {
        printf("    OK    : Created window, HWND = %p\n", hWnd);
    }

    // 10. Открытие контекста
    printf("\n[10] WTOpenA with HWND...\n");
    SetLastError(0);
    HCTX hCtx = WTOpenA(hWnd, &lc, TRUE);
    if (!hCtx) {
        printf("    FAIL  : WTOpenA(hWnd) returned NULL. GetLastError=%s\n", winerr().c_str());
        
        printf("    Retrying WTOpenA(hWnd) with default context without modifications...\n");
        SetLastError(0);
        WTInfoA(WTI_DEFSYSCTX, 0, &lc);
        hCtx = WTOpenA(hWnd, &lc, TRUE);
        
        if (!hCtx) {
            printf("    FAIL  : Retry with hWnd also returned NULL. GetLastError=%s\n", winerr().c_str());
            
            printf("    Retrying WTOpenA(nullptr) as a last resort...\n");
            SetLastError(0);
            hCtx = WTOpenA(nullptr, &lc, TRUE);
            if (!hCtx) {
                printf("    FAIL  : nullptr HWND also returned NULL. GetLastError=%s\n", winerr().c_str());
                FreeLibrary(hLib);
                if (hWnd) DestroyWindow(hWnd);
                return 5;
            }
        }
    }
    printf("    OK    : Context opened successfully, hCtx = %p\n", hCtx);

    // 11. Чтение данных
    printf("\n[11] Reading packets for 3 seconds (touch pen to tablet)...\n");
    auto t0 = std::chrono::steady_clock::now();
    int totalPkts = 0;
    float minP = 1.0f, maxP = 0.0f;

    while (true) {
        if (std::chrono::steady_clock::now() - t0 > std::chrono::seconds(3)) break;

        // Обработка сообщений Windows (нужно для получения событий от драйвера)
        MSG msg;
        while (PeekMessageA(&msg, nullptr, 0, 0, PM_REMOVE)) {
            TranslateMessage(&msg);
            DispatchMessageA(&msg);
        }

        PACKET pkts[32] = {};
        int got = WTPacketsGet(hCtx, 32, pkts);
        if (got > 0) {
            totalPkts += got;
            auto& pkt = pkts[got - 1];
            float p = (float)pkt.pkNormalPressure / (float)maxPressure;
            if (p < minP) minP = p;
            if (p > maxP) maxP = p;
            printf("\r    packets=%-5d  pressure=%.3f (raw=%u)  min=%.3f max=%.3f   ",
                   totalPkts, p, (UINT)pkt.pkNormalPressure, minP, maxP);
            fflush(stdout);
        }
        Sleep(1);
    }

    printf("\n\n    SUMMARY: received %d packets in 3s\n", totalPkts);
    if (totalPkts > 0) {
        printf("\n>>> RESULT: Wintab is WORKING perfectly!\n");
    } else {
        printf("\n>>> RESULT: Context opened OK, but no pen events received (try touching tablet).\n");
    }

    if (liveMode && hCtx) {
        hr();
        printf("LIVE MODE — press Ctrl+C to exit\n");
        hr();
        while (true) {
            MSG msg;
            while (PeekMessageA(&msg, nullptr, 0, 0, PM_REMOVE)) {
                TranslateMessage(&msg);
                DispatchMessageA(&msg);
            }

            PACKET pkts[32] = {};
            int got = WTPacketsGet(hCtx, 32, pkts);
            if (got > 0) {
                auto& pkt = pkts[got - 1];
                float p = (float)pkt.pkNormalPressure / (float)maxPressure;
                int bars = (int)(p * 40);
                printf("\r  Pressure: %5.1f%%  [", p * 100.0f);
                for (int i = 0; i < 40; i++) putchar(i < bars ? '#' : ' ');
                printf("]  raw=%-5u ", (UINT)pkt.pkNormalPressure);
                fflush(stdout);
            }
            Sleep(4);
        }
    }

    WTClose(hCtx);
    if (hWnd) DestroyWindow(hWnd);
    FreeLibrary(hLib);
    return 0;
}
