//! macOS-specific process cwd resolution using `libproc`.
//!
//! `sysinfo::Process::cwd()` returns `None` on macOS because the kernel
//! does not expose it through the APIs that sysinfo uses. Instead, we call
//! `proc_pidinfo` with `PROC_PIDVNODEPATHINFO` directly via FFI, which is
//! the same mechanism `lsof` uses internally.

#[cfg(target_os = "macos")]
mod macos {
    use std::ffi::CStr;
    use std::mem;
    use std::os::raw::{c_char, c_int};
    use std::path::PathBuf;

    // Constants from <sys/proc_info.h>
    const PROC_PIDVNODEPATHINFO: c_int = 9;
    const MAXPATHLEN: usize = 1024;

    // Size of `struct vnode_info` from <sys/proc_info.h>.
    // Verified against macOS SDK: sizeof(struct vnode_info) == 152.
    const VNODE_INFO_SIZE: usize = 152;

    /// Mirrors `struct vnode_info_path` from <sys/proc_info.h>.
    /// sizeof == 1176 (152 + 1024).
    #[repr(C)]
    struct VnodeInfoPath {
        _vip_vi: [u8; VNODE_INFO_SIZE],
        vip_path: [c_char; MAXPATHLEN],
    }

    /// Mirrors `struct proc_vnodepathinfo` from <sys/proc_info.h>.
    /// sizeof == 2352 (1176 * 2).
    #[repr(C)]
    struct ProcVnodePathInfo {
        pvi_cdir: VnodeInfoPath,
        _pvi_rdir: VnodeInfoPath,
    }

    // Compile-time size checks against known macOS SDK values.
    const _: () = assert!(
        mem::size_of::<VnodeInfoPath>() == 1176,
        "VnodeInfoPath size mismatch with macOS SDK"
    );
    const _: () = assert!(
        mem::size_of::<ProcVnodePathInfo>() == 2352,
        "ProcVnodePathInfo size mismatch with macOS SDK"
    );

    extern "C" {
        fn proc_pidinfo(
            pid: c_int,
            flavor: c_int,
            arg: u64,
            buffer: *mut std::ffi::c_void,
            buffersize: c_int,
        ) -> c_int;
    }

    /// Get the current working directory of a process by PID on macOS.
    /// Returns `None` if the process doesn't exist or we lack permission.
    pub fn get_process_cwd(pid: u32) -> Option<PathBuf> {
        unsafe {
            let mut info: ProcVnodePathInfo = mem::zeroed();
            let size = mem::size_of::<ProcVnodePathInfo>() as c_int;

            let ret = proc_pidinfo(
                pid as c_int,
                PROC_PIDVNODEPATHINFO,
                0,
                &mut info as *mut _ as *mut std::ffi::c_void,
                size,
            );

            if ret <= 0 {
                return None;
            }

            let path = CStr::from_ptr(info.pvi_cdir.vip_path.as_ptr())
                .to_string_lossy()
                .to_string();

            if path.is_empty() || path == "/" {
                None
            } else {
                Some(PathBuf::from(path))
            }
        }
    }
}

#[cfg(not(target_os = "macos"))]
mod fallback {
    use std::path::PathBuf;

    /// On non-macOS platforms, fall back to sysinfo's built-in cwd().
    pub fn get_process_cwd_from_sysinfo(process: &sysinfo::Process) -> Option<PathBuf> {
        process.cwd().map(|p| p.to_path_buf())
    }
}

/// Get the current working directory for a process.
///
/// On macOS, uses `proc_pidinfo(PROC_PIDVNODEPATHINFO)` which actually works,
/// unlike sysinfo's `Process::cwd()` which always returns `None` on macOS.
///
/// On other platforms, falls back to sysinfo's built-in method.
#[cfg(target_os = "macos")]
pub fn get_cwd(pid: u32, _process: &sysinfo::Process) -> String {
    macos::get_process_cwd(pid)
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default()
}

#[cfg(not(target_os = "macos"))]
pub fn get_cwd(_pid: u32, process: &sysinfo::Process) -> String {
    fallback::get_process_cwd_from_sysinfo(process)
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default()
}
