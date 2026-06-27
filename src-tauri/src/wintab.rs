// c:\Users\user\Desktop\javascript\sculptsp\src-tauri\src\wintab.rs

#![allow(non_snake_case, non_camel_case_types, dead_code)]

use std::sync::{Arc, Mutex};
use tauri::{State, Window};

#[cfg(target_os = "windows")]
mod win {
    use std::ffi::c_void;
    use std::sync::{Arc, Mutex, Once};
    use std::thread;
    use std::time::Duration;
    use tauri::{AppHandle, Emitter};

    // Types & Structs
    #[repr(C)]
    #[derive(Copy, Clone, Debug)]
    pub struct WNDCLASSA {
        pub style: u32,
        pub lpfnWndProc: Option<unsafe extern "system" fn(*mut c_void, u32, usize, isize) -> isize>,
        pub cbClsExtra: i32,
        pub cbWndExtra: i32,
        pub hInstance: *mut c_void,
        pub hIcon: *mut c_void,
        pub hCursor: *mut c_void,
        pub hbrBackground: *mut c_void,
        pub lpszMenuName: *const u8,
        pub lpszClassName: *const u8,
    }

    #[repr(C)]
    #[derive(Copy, Clone, Debug)]
    pub struct POINT {
        pub x: i32,
        pub y: i32,
    }

    #[repr(C)]
    #[derive(Copy, Clone, Debug)]
    pub struct MSG {
        pub hwnd: *mut c_void,
        pub message: u32,
        pub wParam: usize,
        pub lParam: isize,
        pub time: u32,
        pub pt: POINT,
    }

    #[repr(C)]
    #[derive(Copy, Clone, Debug)]
    pub struct ORIENTATION {
        pub orAzimuth: i32,
        pub orAltitude: i32,
        pub orTwist: i32,
    }

    #[repr(C)]
    #[derive(Copy, Clone, Debug)]
    pub struct PACKET {
        pub pkButtons: u32,
        pub pkX: i32,
        pub pkY: i32,
        pub pkNormalPressure: u32,
        pub pkOrientation: ORIENTATION,
    }

    #[repr(C)]
    #[derive(Clone, Copy, Debug)]
    pub struct LOGCONTEXTA {
        pub lcName: [u8; 40],
        pub lcOptions: u32,
        pub lcStatus: u32,
        pub lcLocks: u32,
        pub lcMsgBase: u32,
        pub lcDevice: u32,
        pub lcPktRate: u32,
        pub lcPktData: u32,
        pub lcPktMode: u32,
        pub lcMoveMask: u32,
        pub lcBtnDnMask: u32,
        pub lcBtnUpMask: u32,
        pub lcInOrgX: i32,
        pub lcInOrgY: i32,
        pub lcInOrgZ: i32,
        pub lcInExtX: i32,
        pub lcInExtY: i32,
        pub lcInExtZ: i32,
        pub lcOutOrgX: i32,
        pub lcOutOrgY: i32,
        pub lcOutOrgZ: i32,
        pub lcOutExtX: i32,
        pub lcOutExtY: i32,
        pub lcOutExtZ: i32,
        pub lcSensX: u32,
        pub lcSensY: u32,
        pub lcSensZ: u32,
        pub lcSysMode: i32,
        pub lcSysOrgX: i32,
        pub lcSysOrgY: i32,
        pub lcSysExtX: i32,
        pub lcSysExtY: i32,
        pub lcSysSensX: u32,
        pub lcSysSensY: u32,
    }

    #[repr(C)]
    #[derive(Clone, Copy, Default, Debug)]
    pub struct AXIS {
        pub axMin: i32,
        pub axMax: i32,
        pub axUnits: u32,
        pub axResolution: u32,
    }

    extern "system" {
        pub fn LoadLibraryA(lpLibFileName: *const u8) -> *mut c_void;
        pub fn GetProcAddress(hModule: *mut c_void, lpProcName: *const u8) -> *mut c_void;
        pub fn FreeLibrary(hModule: *mut c_void) -> i32;
        pub fn GetLastError() -> u32;

        pub fn GetModuleHandleA(lpModuleName: *const u8) -> *mut c_void;
        pub fn RegisterClassA(lpWndClass: *const WNDCLASSA) -> u16;
        pub fn CreateWindowExA(
            dwExStyle: u32,
            lpClassName: *const u8,
            lpWindowName: *const u8,
            dwStyle: u32,
            X: i32,
            Y: i32,
            nWidth: i32,
            nHeight: i32,
            hWndParent: *mut c_void,
            hMenu: *mut c_void,
            hInstance: *mut c_void,
            lpParam: *mut c_void,
        ) -> *mut c_void;
        pub fn DestroyWindow(hWnd: *mut c_void) -> i32;
        pub fn DefWindowProcA(hWnd: *mut c_void, Msg: u32, wParam: usize, lParam: isize) -> isize;
        pub fn PeekMessageA(
            lpMsg: *mut MSG,
            hWnd: *mut c_void,
            wMsgFilterMin: u32,
            wMsgFilterMax: u32,
            wRemoveMsg: u32,
        ) -> i32;
        pub fn TranslateMessage(lpMsg: *const MSG) -> i32;
        pub fn DispatchMessageA(lpMsg: *const MSG) -> isize;
    }

    type WTInfoA = unsafe extern "system" fn(u32, u32, *mut c_void) -> u32;
    type WTOpenA = unsafe extern "system" fn(*mut c_void, *mut LOGCONTEXTA, i32) -> *mut c_void;
    type WTClose = unsafe extern "system" fn(*mut c_void) -> i32;
    type WTPacketsGet = unsafe extern "system" fn(*mut c_void, i32, *mut c_void) -> i32;

    #[derive(Clone)]
    struct WintabLib {
        h_lib: *mut c_void,
        wt_info: WTInfoA,
        wt_open: WTOpenA,
        wt_close: WTClose,
        wt_packets_get: WTPacketsGet,
    }

    unsafe impl Send for WintabLib {}
    unsafe impl Sync for WintabLib {}

    pub const PK_X: u32 = 0x0080;
    pub const PK_Y: u32 = 0x0100;
    pub const PK_BUTTONS: u32 = 0x0040;
    pub const PK_NORMAL_PRESSURE: u32 = 0x0400;
    pub const PK_ORIENTATION: u32 = 0x1000;

    pub const PACKETDATA: u32 = PK_X | PK_Y | PK_BUTTONS | PK_NORMAL_PRESSURE | PK_ORIENTATION;
    pub const PACKETMODE: u32 = 0;

    pub const CXO_MESSAGES: u32 = 0x0004;

    pub const WTI_DEFCONTEXT: u32 = 3;
    pub const WTI_DEFSYSCTX: u32 = 4;
    pub const WTI_DEVICES: u32 = 100;
    pub const DVC_NPRESSURE: u32 = 15;

    pub const PM_REMOVE: u32 = 0x0001;

    static mut G_WND_CLASS: u16 = 0;

    unsafe extern "system" fn wintab_helper_wnd_proc(
        hwnd: *mut c_void,
        msg: u32,
        w_param: usize,
        l_param: isize,
    ) -> isize {
        DefWindowProcA(hwnd, msg, w_param, l_param)
    }

    static REGISTER_CLASS_ONCE: Once = Once::new();

    fn ensure_helper_class_registered() -> Result<(), String> {
        let mut err_msg = None;
        REGISTER_CLASS_ONCE.call_once(|| {
            let class_name = b"WintabHelperClass\0";
            unsafe {
                let wc = WNDCLASSA {
                    style: 0,
                    lpfnWndProc: Some(wintab_helper_wnd_proc),
                    cbClsExtra: 0,
                    cbWndExtra: 0,
                    hInstance: GetModuleHandleA(std::ptr::null()),
                    hIcon: std::ptr::null_mut(),
                    hCursor: std::ptr::null_mut(),
                    hbrBackground: std::ptr::null_mut(),
                    lpszMenuName: std::ptr::null(),
                    lpszClassName: class_name.as_ptr(),
                };
                let atom = RegisterClassA(&wc);
                if atom == 0 {
                    let err = GetLastError();
                    err_msg = Some(format!("RegisterClassA failed with error {}", err));
                }
            }
        });
        if let Some(err) = err_msg {
            Err(err)
        } else {
            Ok(())
        }
    }

    impl WintabLib {
        fn load() -> Result<Self, String> {
            unsafe {
                let h_lib = LoadLibraryA(b"Wintab32.dll\0".as_ptr());
                if h_lib.is_null() {
                    let err = GetLastError();
                    return Err(format!("LoadLibraryA Wintab32.dll failed with error {}", err));
                }

                let wt_info_addr = GetProcAddress(h_lib, b"WTInfoA\0".as_ptr());
                let wt_open_addr = GetProcAddress(h_lib, b"WTOpenA\0".as_ptr());
                let wt_close_addr = GetProcAddress(h_lib, b"WTClose\0".as_ptr());
                let wt_packets_get_addr = GetProcAddress(h_lib, b"WTPacketsGet\0".as_ptr());

                if wt_info_addr.is_null() || wt_open_addr.is_null() || wt_close_addr.is_null() || wt_packets_get_addr.is_null() {
                    FreeLibrary(h_lib);
                    return Err("Failed to find Wintab functions".to_string());
                }

                Ok(Self {
                    h_lib,
                    wt_info: std::mem::transmute(wt_info_addr),
                    wt_open: std::mem::transmute(wt_open_addr),
                    wt_close: std::mem::transmute(wt_close_addr),
                    wt_packets_get: std::mem::transmute(wt_packets_get_addr),
                })
            }
        }
    }

    impl Drop for WintabLib {
        fn drop(&mut self) {
            unsafe {
                if !self.h_lib.is_null() {
                    FreeLibrary(self.h_lib);
                }
            }
        }
    }

    #[derive(serde::Serialize, Clone, Debug)]
    #[serde(rename_all = "camelCase")]
    struct WintabData {
        active: bool,
        pen_down: bool,
        pressure: f32,
        tilt_x: i32,
        tilt_y: i32,
    }

    pub struct WintabStateInner {
        lib: Option<WintabLib>,
        h_ctx: *mut c_void,
        h_wnd: *mut c_void,
        running: bool,
        max_pressure: u32,
        last_pen_down: bool,
        last_pressure: f32,
        last_tilt_x: i32,
        last_tilt_y: i32,
    }

    unsafe impl Send for WintabStateInner {}
    unsafe impl Sync for WintabStateInner {}

    impl WintabStateInner {
        pub fn new() -> Self {
            Self {
                lib: None,
                h_ctx: std::ptr::null_mut(),
                h_wnd: std::ptr::null_mut(),
                running: false,
                max_pressure: 1023,
                last_pen_down: false,
                last_pressure: -1.0,
                last_tilt_x: -999,
                last_tilt_y: -999,
            }
        }

        pub fn disable(&mut self) {
            self.running = false;
            if !self.h_ctx.is_null() {
                if let Some(ref lib) = self.lib {
                    unsafe { (lib.wt_close)(self.h_ctx); }
                }
                self.h_ctx = std::ptr::null_mut();
            }
            if !self.h_wnd.is_null() {
                unsafe { DestroyWindow(self.h_wnd); }
                self.h_wnd = std::ptr::null_mut();
            }
            self.lib = None;
            println!("[Wintab] Disabled");
        }
    }

    impl Drop for WintabStateInner {
        fn drop(&mut self) {
            self.disable();
        }
    }

    pub fn enable_wintab(
        state_arc: Arc<Mutex<WintabStateInner>>,
        main_hwnd: Option<*mut c_void>,
        app: AppHandle,
    ) -> Result<bool, String> {
        let mut s = state_arc.lock().unwrap();
        if !s.h_ctx.is_null() {
            return Ok(true); // already enabled
        }

        // Load the lib if not already loaded
        let lib = match WintabLib::load() {
            Ok(l) => l,
            Err(e) => {
                println!("[Wintab] Failed to load library: {}", e);
                return Err(e);
            }
        };

        // Create helper window
        if let Err(e) = ensure_helper_class_registered() {
            return Err(e);
        }

        let class_name = b"WintabHelperClass\0";
        let helper_title = b"Wintab Helper\0";
        let h_wnd = unsafe {
            CreateWindowExA(
                0,
                class_name.as_ptr(),
                helper_title.as_ptr(),
                0, 0, 0, 0, 0,
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                GetModuleHandleA(std::ptr::null()),
                std::ptr::null_mut(),
            )
        };

        if h_wnd.is_null() {
            return Err("Failed to create helper window".to_string());
        }

        // Check if Wintab service is available
        unsafe {
            if (lib.wt_info)(0, 0, std::ptr::null_mut()) == 0 {
                DestroyWindow(h_wnd);
                return Err("WTInfo returned 0, Wintab service not available".to_string());
            }
        }

        // Retrieve max pressure
        let mut pressure_axis = AXIS::default();
        let mut max_pressure = 1023;
        unsafe {
            let res = (lib.wt_info)(
                WTI_DEVICES,
                DVC_NPRESSURE,
                &mut pressure_axis as *mut AXIS as *mut c_void,
            );
            if res > 0 && pressure_axis.axMax > 0 {
                max_pressure = pressure_axis.axMax as u32;
            }
        }

        // Prepare context
        let mut lc = unsafe { std::mem::zeroed::<LOGCONTEXTA>() };
        
        // Try getting WTI_DEFSYSCTX first
        unsafe {
            if (lib.wt_info)(WTI_DEFSYSCTX, 0, &mut lc as *mut LOGCONTEXTA as *mut c_void) == 0 {
                if (lib.wt_info)(WTI_DEFCONTEXT, 0, &mut lc as *mut LOGCONTEXTA as *mut c_void) == 0 {
                    DestroyWindow(h_wnd);
                    return Err("Failed to get Wintab default context info".to_string());
                }
            }
        }

        lc.lcPktData = PACKETDATA;
        lc.lcPktMode = PACKETMODE;
        lc.lcMoveMask = PACKETDATA;
        lc.lcBtnUpMask = lc.lcBtnDnMask;
        lc.lcOptions |= CXO_MESSAGES;

        // Try opening context
        let mut h_ctx = std::ptr::null_mut();
        
        // 1. Try helper HWND
        if !h_wnd.is_null() {
            println!("[Wintab] Trying WTOpen with helper HWND={:?}", h_wnd);
            h_ctx = unsafe { (lib.wt_open)(h_wnd, &mut lc, 1) };
        }

        // 2. Try main window HWND if helper failed
        if h_ctx.is_null() {
            if let Some(hwnd) = main_hwnd {
                println!("[Wintab] Helper WTOpen failed, trying main HWND={:?}", hwnd);
                h_ctx = unsafe { (lib.wt_open)(hwnd, &mut lc, 1) };
            }
        }

        // 3. Try nullptr if everything else failed
        if h_ctx.is_null() {
            println!("[Wintab] Main HWND WTOpen failed, trying nullptr HWND");
            h_ctx = unsafe { (lib.wt_open)(std::ptr::null_mut(), &mut lc, 1) };
        }

        if h_ctx.is_null() {
            unsafe { DestroyWindow(h_wnd); }
            return Err("WTOpen failed for all window handles".to_string());
        }

        println!(
            "[Wintab] Enabled OK. Context: {:?}, Helper HWND: {:?}, Max Pressure: {}",
            h_ctx, h_wnd, max_pressure
        );

        s.lib = Some(lib);
        s.h_ctx = h_ctx;
        s.h_wnd = h_wnd;
        s.max_pressure = max_pressure;
        s.running = true;

        s.last_pen_down = false;
        s.last_pressure = -1.0;
        s.last_tilt_x = -999;
        s.last_tilt_y = -999;

        // Spawn background polling thread
        let state_clone = state_arc.clone();
        thread::spawn(move || {
            let mut pkts = [PACKET {
                pkButtons: 0,
                pkX: 0,
                pkY: 0,
                pkNormalPressure: 0,
                pkOrientation: ORIENTATION { orAzimuth: 0, orAltitude: 0, orTwist: 0 },
            }; 32];

            loop {
                let mut data_to_emit = None;
                {
                    let mut s = state_clone.lock().unwrap();
                    if !s.running || s.lib.is_none() || s.h_ctx.is_null() {
                        break;
                    }
                    let lib = s.lib.as_ref().unwrap();
                    let h_ctx = s.h_ctx;
                    let h_wnd = s.h_wnd;
                    let max_pressure = s.max_pressure;

                    // Process windows helper messages
                    if !h_wnd.is_null() {
                        unsafe {
                            let mut msg = std::mem::zeroed::<MSG>();
                            while PeekMessageA(&mut msg, h_wnd, 0, 0, PM_REMOVE) != 0 {
                                TranslateMessage(&msg);
                                DispatchMessageA(&msg);
                            }
                        }
                    }

                    // Fetch packets
                    let got = unsafe {
                        (lib.wt_packets_get)(h_ctx, 32, pkts.as_mut_ptr() as *mut c_void)
                    };

                    if got > 0 {
                        let p = pkts[(got - 1) as usize];
                        let pressure = p.pkNormalPressure as f32 / max_pressure as f32;
                        let tilt_x = p.pkOrientation.orAzimuth / 10;
                        let tilt_y = p.pkOrientation.orAltitude / 10;
                        let pen_down = (p.pkButtons & 1) != 0;

                        let changed = pen_down != s.last_pen_down ||
                                      (pressure - s.last_pressure).abs() > 0.0005 ||
                                      tilt_x != s.last_tilt_x ||
                                      tilt_y != s.last_tilt_y;
                        if changed {
                            s.last_pen_down = pen_down;
                            s.last_pressure = pressure;
                            s.last_tilt_x = tilt_x;
                            s.last_tilt_y = tilt_y;

                            data_to_emit = Some(WintabData {
                                active: true,
                                pen_down,
                                pressure,
                                tilt_x,
                                tilt_y,
                            });
                        }
                    }
                }

                if let Some(data) = data_to_emit {
                    let _ = app.emit("wintab:data", data);
                }

                thread::sleep(Duration::from_millis(2));
            }
            println!("[Wintab] Polling thread exit");
        });

        Ok(true)
    }
}

#[cfg(target_os = "windows")]
pub struct WintabState(pub Arc<Mutex<win::WintabStateInner>>);

#[cfg(target_os = "windows")]
impl WintabState {
    pub fn new() -> Self {
        Self(Arc::new(Mutex::new(win::WintabStateInner::new())))
    }
}

#[cfg(not(target_os = "windows"))]
pub struct WintabState;

#[cfg(not(target_os = "windows"))]
impl WintabState {
    pub fn new() -> Self {
        Self
    }
}

#[tauri::command]
pub fn wintab_enable(
    window: Window,
    state: State<'_, WintabState>,
) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        use tauri::Manager;
        use raw_window_handle::{HasWindowHandle, RawWindowHandle};
        let main_hwnd = match window.window_handle() {
            Ok(handle) => match handle.as_raw() {
                RawWindowHandle::Win32(win32_handle) => Some(win32_handle.hwnd.get() as *mut std::ffi::c_void),
                _ => None,
            },
            _ => None,
        };
        let app = window.app_handle().clone();
        win::enable_wintab(state.0.clone(), main_hwnd, app)
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = window;
        let _ = state;
        Ok(false)
    }
}

#[tauri::command]
pub fn wintab_disable(
    state: State<'_, WintabState>,
) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        state.0.lock().unwrap().disable();
        Ok(true)
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = state;
        Ok(true)
    }
}
