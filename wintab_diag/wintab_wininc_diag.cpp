/**
 * wintab_wininc_diag.cpp — WinTab & Windows Ink Interactive GUI Diagnostic Tool
 * Uses pure Win32 API and double-buffered GDI.
 */

#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <cstdio>
#include <vector>
#include <string>

// --------------------------------------------------------------------------
// WinTab
// --------------------------------------------------------------------------
#include "../native/wintab/wintab.h"

typedef UINT (WINAPI *PF_WTInfoA)     (UINT, UINT, LPVOID);
typedef HCTX (WINAPI *PF_WTOpenA)     (HWND, LPLOGCONTEXTA, BOOL);
typedef BOOL (WINAPI *PF_WTClose)     (HCTX);
typedef int  (WINAPI *PF_WTPacketsGet)(HCTX, int, LPVOID);
typedef BOOL (WINAPI *PF_WTPacket)    (HCTX, UINT, LPVOID);

#define PACKETDATA (PK_X | PK_Y | PK_BUTTONS | PK_NORMAL_PRESSURE)
#define PACKETMODE 0
#include "../native/wintab/pktdef.h"

// --------------------------------------------------------------------------
// Windows Ink / Pointer API
// --------------------------------------------------------------------------
#ifndef PEN_FLAG_BARREL
#  define PEN_FLAG_NONE     0x00000000
#  define PEN_FLAG_BARREL   0x00000001
#  define PEN_FLAG_INVERTED 0x00000002
#  define PEN_FLAG_ERASER   0x00000004
#endif
#ifndef POINTER_FLAG_INCONTACT
#  define POINTER_FLAG_INCONTACT 0x00000004
#endif

typedef struct {
    DWORD  pointerType;
    UINT32 pointerId;
    UINT32 frameId;
    DWORD  pointerFlags;
    HANDLE sourceDevice;
    HWND   hwndTarget;
    POINT  ptPixelLocation;
    POINT  ptHimetricLocation;
    POINT  ptPixelLocationRaw;
    POINT  ptHimetricLocationRaw;
    DWORD  dwTime;
    UINT32 historyCount;
    INT32  InputData;
    DWORD  dwKeyStates;
    UINT64 PerformanceCount;
    int    ButtonChangeType;
} POINTER_INFO_2;

typedef struct {
    POINTER_INFO_2 pointerInfo;
    DWORD  penFlags;
    DWORD  penMask;
    UINT32 pressure;   // 0–1024
    INT32  rotation;
    INT32  tiltX;
    INT32  tiltY;
} POINTER_PEN_INFO_2;

typedef BOOL (WINAPI *PF_GetPointerPenInfo)  (UINT32, POINTER_PEN_INFO_2*);
typedef BOOL (WINAPI *PF_EnableMouseInPointer)(BOOL);

#ifndef POINTER_INPUT_TYPE
typedef DWORD POINTER_INPUT_TYPE;
#define PT_POINTER   0x00000001
#define PT_TOUCH     0x00000002
#define PT_PEN       0x00000003
#define PT_MOUSE     0x00000004
#define PT_TOUCHPAD  0x00000005
#endif

typedef BOOL (WINAPI *PF_GetPointerType)(UINT32, POINTER_INPUT_TYPE*);

typedef BOOL (WINAPI *PF_GetPointerDevices)(UINT32*, ::POINTER_DEVICE_INFO*);

// --------------------------------------------------------------------------
// Drawing structures
// --------------------------------------------------------------------------
struct StrokePoint {
    int x, y;
    float pressure;
    bool isInk; // true = Ink, false = WinTab
    bool isStart;
};

// --------------------------------------------------------------------------
// Globals
// --------------------------------------------------------------------------
static HMODULE          g_hWintab      = nullptr;
static PF_WTInfoA       g_WTInfoA      = nullptr;
static PF_WTOpenA       g_WTOpenA      = nullptr;
static PF_WTClose       g_WTClose      = nullptr;
static PF_WTPacket      g_WTPacket     = nullptr;
static HCTX             g_hCtx         = nullptr;
static UINT             g_maxPressure  = 1023;

static PF_GetPointerPenInfo g_GetPointerPenInfo = nullptr;
static PF_GetPointerType g_GetPointerType = nullptr;
static PF_GetPointerDevices g_GetPointerDevices = nullptr;

// Live diagnostic metrics
static std::string g_wtStatus = "Not Init";
static std::string g_inkStatus = "Not Init";
static std::string g_inkDriverChecked = "Unknown";
static bool g_seenInkPenEvents = false;

static float g_wtCurPressure = 0.0f;
static float g_inkCurPressure = 0.0f;
static DWORD g_wtCurButtons = 0;
static DWORD g_inkCurPenFlags = 0;
static DWORD g_inkCurPtrFlags = 0;
static DWORD g_inkCurPenMask = 0;

static std::vector<StrokePoint> g_strokePoints;
static bool g_wtDrawing = false;
static bool g_inkDrawing = false;
static bool g_inkHasData = false;

// Layout Rects
static RECT g_rectCanvas = { 20, 180, 560, 480 };
static RECT g_rectClearBtn = { 460, 140, 560, 170 };

// Helper to check if point is in draw area
static bool IsInsideDrawArea(int x, int y) {
    return (x >= g_rectCanvas.left && x <= g_rectCanvas.right &&
            y >= g_rectCanvas.top && y <= g_rectCanvas.bottom);
}

// --------------------------------------------------------------------------
// Window proc
// --------------------------------------------------------------------------
static LRESULT CALLBACK WndProc(HWND hWnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    static LOGCONTEXTA s_lc = {};

    switch (msg) {
    case WM_CREATE:
        // Initialize WinTab
        g_hWintab = LoadLibraryA("Wintab32.dll");
        if (g_hWintab) {
            g_WTInfoA = (PF_WTInfoA)GetProcAddress(g_hWintab, "WTInfoA");
            g_WTOpenA = (PF_WTOpenA)GetProcAddress(g_hWintab, "WTOpenA");
            g_WTClose = (PF_WTClose)GetProcAddress(g_hWintab, "WTClose");
            g_WTPacket = (PF_WTPacket)GetProcAddress(g_hWintab, "WTPacket");

            if (g_WTInfoA && g_WTOpenA && g_WTClose && g_WTPacket && g_WTInfoA(0, 0, nullptr)) {
                char devName[64] = "";
                g_WTInfoA(WTI_DEVICES, DVC_NAME, devName);
                
                AXIS pressAxis = {};
                if (g_WTInfoA(WTI_DEVICES, DVC_NPRESSURE, &pressAxis) > 0 && pressAxis.axMax > 0) {
                    g_maxPressure = pressAxis.axMax;
                }
                
                g_WTInfoA(WTI_DEFSYSCTX, 0, &s_lc);
                s_lc.lcPktData = PACKETDATA;
                s_lc.lcPktMode = PACKETMODE;
                s_lc.lcOptions |= CXO_MESSAGES;
                
                g_hCtx = g_WTOpenA(hWnd, &s_lc, TRUE);
                if (g_hCtx) {
                    g_wtStatus = std::string("OK (") + devName + ")";
                } else {
                    g_wtStatus = "Open Context FAILED";
                }
            } else {
                g_wtStatus = "No Service or Missing Exports";
            }
        } else {
            g_wtStatus = "Wintab32.dll not found";
        }

        // Initialize Windows Ink
        {
            HMODULE u32 = GetModuleHandleA("user32.dll");
            g_GetPointerPenInfo = (PF_GetPointerPenInfo)GetProcAddress(u32, "GetPointerPenInfo");
            g_GetPointerType = (PF_GetPointerType)GetProcAddress(u32, "GetPointerType");
            g_GetPointerDevices = (PF_GetPointerDevices)GetProcAddress(u32, "GetPointerDevices");
            
            auto EnableMIP = (PF_EnableMouseInPointer)GetProcAddress(u32, "EnableMouseInPointer");
            if (!EnableMIP) EnableMIP = (PF_EnableMouseInPointer)GetProcAddress(u32, "EnableMouseInPointerForThread");
            if (EnableMIP) EnableMIP(TRUE);

            if (g_GetPointerPenInfo) {
                int sm = GetSystemMetrics(SM_DIGITIZER);
                g_inkStatus = (sm & 0x0001) ? "OK (Digitizer Present)" : "OK (No Pen Digitizer Found)";
                
                // Scan pointer devices for pen
                if (g_GetPointerDevices) {
                    UINT32 deviceCount = 0;
                    if (g_GetPointerDevices(&deviceCount, nullptr)) {
                        if (deviceCount > 0) {
                            std::vector<POINTER_DEVICE_INFO> devices(deviceCount);
                            
                            if (g_GetPointerDevices(&deviceCount, &devices[0])) {
                                bool foundPen = false;
                                for (const auto& dev : devices) {
                                    if (dev.pointerDeviceType == POINTER_DEVICE_TYPE_INTEGRATED_PEN ||
                                        dev.pointerDeviceType == POINTER_DEVICE_TYPE_EXTERNAL_PEN) {
                                        foundPen = true;
                                        break;
                                    }
                                }
                                if (foundPen) {
                                    g_inkDriverChecked = "ENABLED (Pen device detected)";
                                } else {
                                    g_inkDriverChecked = "DISABLED / WinTab-only (No Pen device detected)";
                                }
                            } else {
                                g_inkDriverChecked = "Unknown (GetPointerDevices call failed)";
                            }
                        } else {
                            g_inkDriverChecked = "DISABLED (No pointer devices found)";
                        }
                    } else {
                        g_inkDriverChecked = "Unknown (GetPointerDevices query failed)";
                    }
                } else {
                    g_inkDriverChecked = "Unknown (API not exported)";
                }
            } else {
                g_inkStatus = "Requires Windows 8+";
                g_inkDriverChecked = "Unsupported OS";
            }
        }
        return 0;

    // WinTab packets
    case WT_PACKET:
        if (g_WTPacket) {
            PACKET pkt = {};
            if (g_WTPacket((HCTX)lParam, (UINT)wParam, &pkt)) {
                g_wtCurPressure = (float)pkt.pkNormalPressure / g_maxPressure;
                g_wtCurButtons = pkt.pkButtons;
                
                // If WinTab is receiving active pressure but Ink pointer events have not occurred,
                // the tablet driver has Windows Ink unchecked/disabled.
                if (pkt.pkNormalPressure > 0 && !g_seenInkPenEvents) {
                    g_inkDriverChecked = "DISABLED in driver (WinTab active)";
                }

                POINT pt = {};
                GetCursorPos(&pt);
                ScreenToClient(hWnd, &pt);
                
                bool isTipDown = (pkt.pkButtons & 0x01) != 0;

                if (isTipDown && IsInsideDrawArea(pt.x, pt.y)) {
                    g_strokePoints.push_back({ pt.x, pt.y, g_wtCurPressure, false, !g_wtDrawing });
                    g_wtDrawing = true;
                } else {
                    g_wtDrawing = false;
                }
                InvalidateRect(hWnd, nullptr, FALSE);
            }
        }
        return 0;

    // Windows Ink
    case WM_POINTERDOWN:
        {
            POINT pt = { (short)LOWORD(lParam), (short)HIWORD(lParam) };
            ScreenToClient(hWnd, &pt);
            if (pt.x >= g_rectClearBtn.left && pt.x <= g_rectClearBtn.right &&
                pt.y >= g_rectClearBtn.top && pt.y <= g_rectClearBtn.bottom) {
                g_strokePoints.clear();
                InvalidateRect(hWnd, nullptr, FALSE);
                return 0;
            }
        }
        // fallthrough to handle drawing
    case WM_POINTERUPDATE:
        if (g_GetPointerPenInfo) {
            UINT32 pid = GET_POINTERID_WPARAM(wParam);
            
            // Check pointer type in real-time
            if (g_GetPointerType) {
                POINTER_INPUT_TYPE type = 0;
                if (g_GetPointerType(pid, &type) && type == PT_PEN) {
                    g_seenInkPenEvents = true;
                    g_inkDriverChecked = "ENABLED (Pen events received)";
                }
            }

            POINTER_PEN_INFO_2 pi = {};
            if (g_GetPointerPenInfo(pid, &pi)) {
                g_inkCurPenFlags = pi.penFlags;
                g_inkCurPtrFlags = pi.pointerInfo.pointerFlags;
                g_inkCurPenMask = pi.penMask;
                g_inkCurPressure = (float)pi.pressure / 1024.0f;
                g_inkHasData = true;

                POINT pt = pi.pointerInfo.ptPixelLocation;
                ScreenToClient(hWnd, &pt);

                bool isTipDown = (pi.pointerInfo.pointerFlags & POINTER_FLAG_INCONTACT) != 0;
                
                if (isTipDown && IsInsideDrawArea(pt.x, pt.y)) {
                    g_strokePoints.push_back({ pt.x, pt.y, g_inkCurPressure, true, !g_inkDrawing });
                    g_inkDrawing = true;
                } else {
                    g_inkDrawing = false;
                }
                InvalidateRect(hWnd, nullptr, FALSE);
            }
        }
        return 0;

    case WM_POINTERUP:
        g_inkCurPtrFlags &= ~(DWORD)POINTER_FLAG_INCONTACT;
        g_inkDrawing = false;
        InvalidateRect(hWnd, nullptr, FALSE);
        return 0;

    case WM_LBUTTONDOWN:
        {
            int mx = LOWORD(lParam);
            int my = HIWORD(lParam);
            // Check Clear button click
            if (mx >= g_rectClearBtn.left && mx <= g_rectClearBtn.right &&
                my >= g_rectClearBtn.top && my <= g_rectClearBtn.bottom) {
                g_strokePoints.clear();
                InvalidateRect(hWnd, nullptr, FALSE);
            } else if (!g_wtDrawing && !g_inkDrawing && IsInsideDrawArea(mx, my)) {
                // Mouse drawing fallback (uses constant pressure simulated at 0.5)
                g_strokePoints.push_back({ mx, my, 0.5f, false, true });
                InvalidateRect(hWnd, nullptr, FALSE);
            }
        }
        return 0;

    case WM_MOUSEMOVE:
        if ((wParam & MK_LBUTTON) && !g_wtDrawing && !g_inkDrawing) {
            int mx = LOWORD(lParam);
            int my = HIWORD(lParam);
            if (IsInsideDrawArea(mx, my)) {
                g_strokePoints.push_back({ mx, my, 0.5f, false, false });
                InvalidateRect(hWnd, nullptr, FALSE);
            }
        }
        return 0;

    case WM_PAINT:
        {
            PAINTSTRUCT ps;
            HDC hdc = BeginPaint(hWnd, &ps);
            RECT clientRect;
            GetClientRect(hWnd, &clientRect);

            // Double buffering
            HDC memDC = CreateCompatibleDC(hdc);
            HBITMAP memBM = CreateCompatibleBitmap(hdc, clientRect.right, clientRect.bottom);
            HBITMAP oldBM = (HBITMAP)SelectObject(memDC, memBM);

            // Background
            HBRUSH hbg = CreateSolidBrush(RGB(30, 30, 36)); // Sleek dark #1e1e24
            FillRect(memDC, &clientRect, hbg);
            DeleteObject(hbg);

            // Set text settings
            SetTextColor(memDC, RGB(240, 240, 245));
            SetBkMode(memDC, TRANSPARENT);

            // Font creation
            HFONT hFontTitle = CreateFontA(24, 0, 0, 0, FW_BOLD, FALSE, FALSE, FALSE, DEFAULT_CHARSET, OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, DEFAULT_QUALITY, DEFAULT_PITCH | FF_DONTCARE, "Arial");
            HFONT hFontSection = CreateFontA(16, 0, 0, 0, FW_BOLD, FALSE, FALSE, FALSE, DEFAULT_CHARSET, OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, DEFAULT_QUALITY, DEFAULT_PITCH | FF_DONTCARE, "Arial");
            HFONT hFontNormal = CreateFontA(14, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE, DEFAULT_CHARSET, OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, DEFAULT_QUALITY, DEFAULT_PITCH | FF_DONTCARE, "Arial");

            // Draw Title
            SelectObject(memDC, hFontTitle);
            TextOutA(memDC, 20, 20, "WinTab & Windows Ink Real-Time Diagnostic", 41);

            // Draw Section - WinTab
            SelectObject(memDC, hFontSection);
            TextOutA(memDC, 20, 60, "WinTab API Status:", 18);
            SelectObject(memDC, hFontNormal);
            TextOutA(memDC, 160, 62, g_wtStatus.c_str(), (int)g_wtStatus.length());

            // WinTab Pressure Bar
            RECT wtBarBg = { 20, 85, 260, 105 };
            HBRUSH hBarBg = CreateSolidBrush(RGB(45, 45, 52));
            FillRect(memDC, &wtBarBg, hBarBg);
            DeleteObject(hBarBg);

            RECT wtBarFill = { 20, 85, 20 + (int)(g_wtCurPressure * 240), 105 };
            // Gradient / Solid cyan to purple
            HBRUSH hWtBarFill = CreateSolidBrush(RGB(0, 192, 255));
            FillRect(memDC, &wtBarFill, hWtBarFill);
            DeleteObject(hWtBarFill);

            // WinTab values text
            char wtValBuf[64];
            snprintf(wtValBuf, sizeof(wtValBuf), "Pressure: %.1f%% | Buttons: %s", g_wtCurPressure * 100.0f, (g_wtCurButtons & 0x01) ? "TIP" : "NONE");
            TextOutA(memDC, 20, 110, wtValBuf, (int)strlen(wtValBuf));


            // Draw Section - Windows Ink
            SelectObject(memDC, hFontSection);
            TextOutA(memDC, 320, 60, "Windows Ink Status:", 19);
            SelectObject(memDC, hFontNormal);
            TextOutA(memDC, 470, 62, g_inkStatus.c_str(), (int)g_inkStatus.length());

            // Ink Pressure Bar
            RECT inkBarBg = { 320, 85, 560, 105 };
            hBarBg = CreateSolidBrush(RGB(45, 45, 52));
            FillRect(memDC, &inkBarBg, hBarBg);
            DeleteObject(hBarBg);

            RECT inkBarFill = { 320, 85, 320 + (int)(g_inkCurPressure * 240), 105 };
            HBRUSH hInkBarFill = CreateSolidBrush(RGB(0, 255, 128));
            FillRect(memDC, &inkBarFill, hInkBarFill);
            DeleteObject(hInkBarFill);

            // Ink values text
            char inkValBuf[128];
            bool inkPressureValid = (g_inkCurPenMask & 0x01) != 0 || g_inkCurPressure > 0;
            if (inkPressureValid) {
                snprintf(inkValBuf, sizeof(inkValBuf), "Pressure: %.1f%% | Buttons: %s", 
                         g_inkCurPressure * 100.0f, 
                         (g_inkCurPtrFlags & POINTER_FLAG_INCONTACT) ? "TIP" : "NONE");
            } else {
                snprintf(inkValBuf, sizeof(inkValBuf), "Events OK | Mask: 0x%02lX (No Pressure)", g_inkCurPenMask);
            }
            TextOutA(memDC, 320, 110, inkValBuf, (int)strlen(inkValBuf));

            // Windows Ink Driver Checkbox state display
            char inkDrBuf[128];
            snprintf(inkDrBuf, sizeof(inkDrBuf), "Driver Config: %s", g_inkDriverChecked.c_str());
            TextOutA(memDC, 320, 130, inkDrBuf, (int)strlen(inkDrBuf));

            // Canvas box border and header
            SelectObject(memDC, hFontSection);
            TextOutA(memDC, 20, 150, "Interactive Draw Canvas (Test Pen Tracking & Pressure):", 55);

            // Clear button
            HBRUSH hClearBrush = CreateSolidBrush(RGB(70, 70, 80));
            FillRect(memDC, &g_rectClearBtn, hClearBrush);
            DeleteObject(hClearBrush);
            SetTextColor(memDC, RGB(255, 255, 255));
            SelectObject(memDC, hFontNormal);
            DrawTextA(memDC, "Clear Canvas", -1, &g_rectClearBtn, DT_CENTER | DT_VCENTER | DT_SINGLELINE);

            // Draw Canvas Box
            HBRUSH hCanvasBg = CreateSolidBrush(RGB(15, 15, 18));
            FillRect(memDC, &g_rectCanvas, hCanvasBg);
            DeleteObject(hCanvasBg);

            HPEN hBorderPen = CreatePen(PS_SOLID, 1, RGB(70, 70, 80));
            HPEN hOldPen = (HPEN)SelectObject(memDC, hBorderPen);
            HBRUSH hOldBrush = (HBRUSH)SelectObject(memDC, GetStockObject(NULL_BRUSH));
            Rectangle(memDC, g_rectCanvas.left, g_rectCanvas.top, g_rectCanvas.right, g_rectCanvas.bottom);
            SelectObject(memDC, hOldPen);
            DeleteObject(hBorderPen);

            // Draw strokes
            if (!g_strokePoints.empty()) {
                for (size_t i = 0; i < g_strokePoints.size(); ++i) {
                    const auto& pt = g_strokePoints[i];
                    if (pt.isStart || i == 0) {
                        // Draw a single dot for start of stroke
                        int width = (int)(pt.pressure * 16.0f);
                        if (width < 2) width = 2;
                        COLORREF color = pt.isInk ? RGB(0, 255, 128) : RGB(0, 192, 255);
                        HBRUSH hBrush = CreateSolidBrush(color);
                        HBRUSH hOldB = (HBRUSH)SelectObject(memDC, hBrush);
                        HPEN hPen = CreatePen(PS_NULL, 0, 0);
                        HPEN hOldP = (HPEN)SelectObject(memDC, hPen);

                        int r = width / 2;
                        Ellipse(memDC, pt.x - r, pt.y - r, pt.x + r + 1, pt.y + r + 1);

                        SelectObject(memDC, hOldP);
                        SelectObject(memDC, hOldB);
                        DeleteObject(hPen);
                        DeleteObject(hBrush);
                        continue;
                    }

                    const auto& prev = g_strokePoints[i - 1];

                    // Set pen color & thickness based on pressure and input API
                    int width = (int)(pt.pressure * 16.0f);
                    if (width < 2) width = 2;

                    COLORREF color = pt.isInk ? RGB(0, 255, 128) : RGB(0, 192, 255);
                    
                    // Draw connecting line
                    HPEN hStrokePen = CreatePen(PS_SOLID, width, color);
                    HPEN hOldStrokePen = (HPEN)SelectObject(memDC, hStrokePen);

                    MoveToEx(memDC, prev.x, prev.y, nullptr);
                    LineTo(memDC, pt.x, pt.y);

                    SelectObject(memDC, hOldStrokePen);
                    DeleteObject(hStrokePen);

                    // Draw round joint/cap
                    HBRUSH hBrush = CreateSolidBrush(color);
                    HBRUSH hOldB = (HBRUSH)SelectObject(memDC, hBrush);
                    HPEN hPen = CreatePen(PS_NULL, 0, 0);
                    HPEN hOldP = (HPEN)SelectObject(memDC, hPen);

                    int r = width / 2;
                    Ellipse(memDC, pt.x - r, pt.y - r, pt.x + r + 1, pt.y + r + 1);

                    SelectObject(memDC, hOldP);
                    SelectObject(memDC, hOldB);
                    DeleteObject(hPen);
                    DeleteObject(hBrush);
                }
            }

            // Legend
            int lx = 20;
            int ly = 495;
            SelectObject(memDC, hFontNormal);
            SetTextColor(memDC, RGB(140, 140, 150));
            TextOutA(memDC, lx, ly, "Legend:", 7);
            
            // WinTab color marker and label
            lx += 65;
            HBRUSH hWtBrush = CreateSolidBrush(RGB(0, 192, 255));
            RECT rWt = { lx, ly + 2, lx + 12, ly + 14 };
            FillRect(memDC, &rWt, hWtBrush);
            DeleteObject(hWtBrush);
            lx += 18;
            TextOutA(memDC, lx, ly, "WinTab (Cyan)", 13);
            
            // Windows Ink color marker and label
            lx += 120;
            HBRUSH hInkBrush = CreateSolidBrush(RGB(0, 255, 128));
            RECT rInk = { lx, ly + 2, lx + 12, ly + 14 };
            FillRect(memDC, &rInk, hInkBrush);
            DeleteObject(hInkBrush);
            lx += 18;
            TextOutA(memDC, lx, ly, "Windows Ink (Green)", 19);

            // Clean up font objects
            SelectObject(memDC, hOldBrush);
            DeleteObject(hFontTitle);
            DeleteObject(hFontSection);
            DeleteObject(hFontNormal);

            // Blit memory DC to window HDC
            BitBlt(hdc, 0, 0, clientRect.right, clientRect.bottom, memDC, 0, 0, SRCCOPY);

            SelectObject(memDC, oldBM);
            DeleteObject(memBM);
            DeleteDC(memDC);

            EndPaint(hWnd, &ps);
        }
        return 0;

    case WM_DESTROY:
        if (g_hCtx && g_WTClose) g_WTClose(g_hCtx);
        if (g_hWintab) FreeLibrary(g_hWintab);
        PostQuitMessage(0);
        return 0;
    }
    return DefWindowProcA(hWnd, msg, wParam, lParam);
}

// --------------------------------------------------------------------------
// WinMain - pure Win32 GUI
// --------------------------------------------------------------------------
int WINAPI WinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance, LPSTR lpCmdLine, int nCmdShow) {
    WNDCLASSA wc = {};
    wc.lpfnWndProc = WndProc;
    wc.hInstance = hInstance;
    wc.lpszClassName = "WintabInkDiagGUIClass";
    wc.hCursor = LoadCursor(nullptr, IDC_ARROW);
    RegisterClassA(&wc);

    // Beautiful centered window
    int sw = GetSystemMetrics(SM_CXSCREEN);
    int sh = GetSystemMetrics(SM_CYSCREEN);
    int ww = 600;
    int wh = 560;
    int wx = (sw - ww) / 2;
    int wy = (sh - wh) / 2;

    HWND hWnd = CreateWindowExA(
        0,
        "WintabInkDiagGUIClass",
        "WinTab & Windows Ink Interactive Diagnostics",
        WS_OVERLAPPED | WS_CAPTION | WS_SYSMENU | WS_MINIMIZEBOX,
        wx, wy, ww, wh,
        nullptr, nullptr, hInstance, nullptr);

    if (!hWnd) return 1;

    ShowWindow(hWnd, nCmdShow);
    UpdateWindow(hWnd);

    MSG msg;
    while (GetMessage(&msg, nullptr, 0, 0)) {
        TranslateMessage(&msg);
        DispatchMessage(&msg);
    }

    return (int)msg.wParam;
}
