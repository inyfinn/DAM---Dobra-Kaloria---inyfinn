# DAM ETA - invoke Synology Drive "Get link" / "Uzyskaj lacze" via IContextMenu.
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File synology_get_link.ps1 -FilePath "D:\..."
# Output: one JSON line on stdout.
param(
  [Parameter(Mandatory = $true)]
  [string]$FilePath
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Write-JsonResult([hashtable]$obj) {
  $obj | ConvertTo-Json -Compress
}

if (-not (Test-Path -LiteralPath $FilePath)) {
  Write-JsonResult @{ ok = $false; error = "path_not_found"; path = $FilePath }
  exit 1
}

$code = @'
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Collections.Generic;

public static class SynologyGetLink {
  [ComImport, Guid("000214E6-0000-0000-C000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IShellFolder {
    void ParseDisplayName(IntPtr hwnd, IntPtr pbc, [MarshalAs(UnmanagedType.LPWStr)] string pszDisplayName, ref uint pchEaten, out IntPtr ppidl, ref uint pdwAttributes);
    [PreserveSig] int EnumObjects(IntPtr hwnd, int grfFlags, out IntPtr ppenumIDList);
    void BindToObject(IntPtr pidl, IntPtr pbc, [MarshalAs(UnmanagedType.LPStruct)] Guid riid, out IntPtr ppv);
    void BindToStorage(IntPtr pidl, IntPtr pbc, [MarshalAs(UnmanagedType.LPStruct)] Guid riid, out IntPtr ppv);
    [PreserveSig] int CompareIDs(IntPtr lParam, IntPtr pidl1, IntPtr pidl2);
    void CreateViewObject(IntPtr hwndOwner, [MarshalAs(UnmanagedType.LPStruct)] Guid riid, out IntPtr ppv);
    void GetAttributesOf(uint cidl, IntPtr apidl, ref uint rgfInOut);
    void GetUIObjectOf(IntPtr hwndOwner, uint cidl, [MarshalAs(UnmanagedType.LPArray)] IntPtr[] apidl, [MarshalAs(UnmanagedType.LPStruct)] Guid riid, IntPtr rgfReserved, out IntPtr ppv);
    void GetDisplayNameOf(IntPtr pidl, uint uFlags, IntPtr pName);
    void SetNameOf(IntPtr hwnd, IntPtr pidl, [MarshalAs(UnmanagedType.LPWStr)] string pszName, uint uFlags, out IntPtr ppidlOut);
  }

  [ComImport, Guid("000214E4-0000-0000-C000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IContextMenu {
    [PreserveSig] int QueryContextMenu(IntPtr hmenu, uint indexMenu, uint idCmdFirst, uint idCmdLast, uint uFlags);
    [PreserveSig] int InvokeCommand(ref CMINVOKECOMMANDINFO pici);
    [PreserveSig] int GetCommandString(UIntPtr idCmd, uint uFlags, IntPtr pReserved, StringBuilder pszName, uint cchMax);
  }

  [StructLayout(LayoutKind.Sequential)]
  struct CMINVOKECOMMANDINFO {
    public int cbSize;
    public int fMask;
    public IntPtr hwnd;
    public IntPtr lpVerb;
    public IntPtr lpParameters;
    public IntPtr lpDirectory;
    public int nShow;
    public int dwHotKey;
    public IntPtr hIcon;
  }

  [DllImport("shell32.dll")] static extern int SHGetDesktopFolder(out IShellFolder ppshf);
  [DllImport("user32.dll")] static extern IntPtr CreatePopupMenu();
  [DllImport("user32.dll")] static extern bool DestroyMenu(IntPtr hMenu);
  [DllImport("user32.dll")] static extern int GetMenuItemCount(IntPtr hMenu);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  static extern int GetMenuString(IntPtr hMenu, uint uIDItem, StringBuilder lpString, int cchMax, uint uFlags);
  [DllImport("user32.dll")] static extern uint GetMenuItemID(IntPtr hMenu, int nPos);
  [DllImport("user32.dll")] static extern IntPtr GetSubMenu(IntPtr hMenu, int nPos);

  const uint MF_BYPOSITION = 0x0400;
  const uint CMF_NORMAL = 0;
  const uint CMF_EXTENDEDVERBS = 0x100;
  const uint CMF_EXPLORE = 0x4;

  static string MenuLabel(IntPtr hMenu, int pos) {
    var sb = new StringBuilder(512);
    GetMenuString(hMenu, (uint)pos, sb, sb.Capacity, MF_BYPOSITION);
    return sb.ToString().Replace("&", "").Trim();
  }

  static bool IsGetLinkLabel(string label) {
    if (string.IsNullOrEmpty(label)) return false;
    // PL: "Uzyskaj lacze" / EN: "Get link"
    if (label.IndexOf("Uzyskaj", StringComparison.OrdinalIgnoreCase) >= 0) return true;
    if (label.IndexOf("Get link", StringComparison.OrdinalIgnoreCase) >= 0) return true;
    if (string.Equals(label, "GetLink", StringComparison.OrdinalIgnoreCase)) return true;
    return false;
  }

  static bool IsSynologyMenu(string label) {
    return !string.IsNullOrEmpty(label) &&
      label.IndexOf("Synology", StringComparison.OrdinalIgnoreCase) >= 0;
  }

  static bool TryInvokeInMenu(IntPtr hMenu, IContextMenu cm, uint idFirst, bool requireSynologyParent, out string matchedLabel) {
    matchedLabel = "";
    int count = GetMenuItemCount(hMenu);
    for (int i = 0; i < count; i++) {
      string label = MenuLabel(hMenu, i);
      IntPtr sub = GetSubMenu(hMenu, i);
      if (sub != IntPtr.Zero) {
        bool dive = !requireSynologyParent || IsSynologyMenu(label);
        if (dive) {
          string child;
          if (TryInvokeInMenu(sub, cm, idFirst, false, out child)) {
            matchedLabel = child;
            return true;
          }
        }
        continue;
      }
      if (requireSynologyParent) continue;
      if (!IsGetLinkLabel(label)) continue;
      uint id = GetMenuItemID(hMenu, i);
      if (id < idFirst || id == 0xFFFFFFFF) continue;
      uint cmd = id - idFirst;
      var info = new CMINVOKECOMMANDINFO();
      info.cbSize = Marshal.SizeOf(typeof(CMINVOKECOMMANDINFO));
      info.hwnd = IntPtr.Zero;
      info.lpVerb = (IntPtr)(int)cmd;
      info.nShow = 1;
      int hr = cm.InvokeCommand(ref info);
      if (hr == 0) {
        matchedLabel = label;
        return true;
      }
    }
    return false;
  }

  public static string Run(string path) {
    IShellFolder desktop;
    SHGetDesktopFolder(out desktop);
    string dir = System.IO.Path.GetDirectoryName(path);
    string name = System.IO.Path.GetFileName(path);
    uint eaten = 0, attrs = 0;
    IntPtr folderAbs;
    desktop.ParseDisplayName(IntPtr.Zero, IntPtr.Zero, dir, ref eaten, out folderAbs, ref attrs);
    IntPtr psf;
    desktop.BindToObject(folderAbs, IntPtr.Zero, new Guid("000214E6-0000-0000-C000-000000000046"), out psf);
    var folder = (IShellFolder)Marshal.GetObjectForIUnknown(psf);

    uint eaten2 = 0, attrs2 = 0;
    IntPtr rel;
    folder.ParseDisplayName(IntPtr.Zero, IntPtr.Zero, name, ref eaten2, out rel, ref attrs2);

    IntPtr pcm;
    folder.GetUIObjectOf(IntPtr.Zero, 1, new IntPtr[] { rel }, new Guid("000214E4-0000-0000-C000-000000000046"), IntPtr.Zero, out pcm);
    var cm = (IContextMenu)Marshal.GetObjectForIUnknown(pcm);

    IntPtr hMenu = CreatePopupMenu();
    try {
      uint idFirst = 1;
      cm.QueryContextMenu(hMenu, 0, idFirst, 0x7FFF, CMF_NORMAL | CMF_EXPLORE | CMF_EXTENDEDVERBS);
      string matched;
      // Prefer Synology Drive submenu only (avoid Windows "Udostepnij")
      if (TryInvokeInMenu(hMenu, cm, idFirst, true, out matched)) {
        return "OK|" + matched;
      }
      return "ERR|synology_get_link_not_found";
    } finally {
      DestroyMenu(hMenu);
    }
  }
}
'@

try {
  Add-Type -TypeDefinition $code -ErrorAction Stop | Out-Null
  $result = [SynologyGetLink]::Run($FilePath)
  if ($result -like "OK|*") {
    $label = $result.Substring(3)
    Write-JsonResult @{ ok = $true; path = $FilePath; verb = $label; method = "icontextmenu" }
    exit 0
  }
  Write-JsonResult @{ ok = $false; path = $FilePath; error = ($result -replace '^ERR\|', '') }
  exit 2
} catch {
  Write-JsonResult @{ ok = $false; path = $FilePath; error = $_.Exception.Message }
  exit 3
}
