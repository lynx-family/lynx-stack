use std::ffi::{c_char, c_double, c_void};
use std::ptr;
use std::sync::{Once, OnceLock};

type Id = *mut c_void;
type Class = *mut c_void;
type Sel = *mut c_void;
type Ivar = *mut c_void;
type Imp = *mut c_void;
type CFAbsoluteTime = c_double;
type CFAllocatorRef = *const c_void;
type CFRunLoopRef = *mut c_void;
type CFRunLoopTimerRef = *mut c_void;
type CFStringRef = *const c_void;

const PTR_ALIGN_LOG2: u8 = 3;

struct DisplayLinkState {
  target: Id,
  selector: Sel,
  paused: bool,
  invalidated: bool,
  tick_scheduled: bool,
  timer: CFRunLoopTimerRef,
  timer_context: *mut TickContext,
  timestamp: f64,
  target_timestamp: f64,
}

struct TickContext {
  display_link: Id,
}

pub fn install_if_needed() {
  unsafe {
    let screen_class = class("NSScreen");
    let screens = send_id(screen_class, sel("screens"));
    let screen_count = if screens.is_null() {
      0
    } else {
      send_usize(screens, sel("count"))
    };
    debug(&format!("NSScreen count before shim: {screen_count}"));
    if screen_count > 0 {
      return;
    }

    ensure_classes();
    let meta_class = object_getClass(screen_class);
    class_replaceMethod(
      meta_class,
      sel("screens"),
      fake_screens as Imp,
      c"@@:".as_ptr(),
    );
    class_replaceMethod(
      meta_class,
      sel("mainScreen"),
      fake_main_screen as Imp,
      c"@@:".as_ptr(),
    );
    debug("installed fake NSScreen methods");
  }
}

unsafe extern "C" fn fake_screens(_class: Id, _cmd: Sel) -> Id {
  let array_class = class("NSArray");
  send_id_id(array_class, sel("arrayWithObject:"), fake_screen())
}

unsafe extern "C" fn fake_main_screen(_class: Id, _cmd: Sel) -> Id {
  fake_screen()
}

unsafe extern "C" fn fake_screen_display_link(
  _screen: Id,
  _cmd: Sel,
  target: Id,
  selector: Sel,
) -> Id {
  debug("created fake display link");
  let display_link = send_id(display_link_class(), sel("new"));
  let now = CACurrentMediaTime();
  let state = Box::new(DisplayLinkState {
    target,
    selector,
    paused: true,
    invalidated: false,
    tick_scheduled: false,
    timer: ptr::null_mut(),
    timer_context: ptr::null_mut(),
    timestamp: now,
    target_timestamp: now + (1.0 / 60.0),
  });
  set_state(display_link, Box::into_raw(state));
  display_link
}

unsafe extern "C" fn fake_screen_maximum_frames_per_second(_screen: Id, _cmd: Sel) -> isize {
  60
}

unsafe extern "C" fn fake_display_link_add_to_run_loop(
  _display_link: Id,
  _cmd: Sel,
  _run_loop: Id,
  _mode: Id,
) {
}

unsafe extern "C" fn fake_display_link_set_paused(display_link: Id, _cmd: Sel, paused: bool) {
  debug(&format!("fake display link setPaused:{paused}"));
  let Some(state) = state_mut(display_link) else {
    return;
  };
  state.paused = paused;
  if !paused {
    schedule_tick(display_link);
  }
}

unsafe extern "C" fn fake_display_link_paused(display_link: Id, _cmd: Sel) -> bool {
  state_mut(display_link)
    .map(|state| state.paused)
    .unwrap_or(true)
}

unsafe extern "C" fn fake_display_link_timestamp(display_link: Id, _cmd: Sel) -> c_double {
  state_mut(display_link)
    .map(|state| state.timestamp)
    .unwrap_or_default()
}

unsafe extern "C" fn fake_display_link_target_timestamp(display_link: Id, _cmd: Sel) -> c_double {
  state_mut(display_link)
    .map(|state| state.target_timestamp)
    .unwrap_or_default()
}

unsafe extern "C" fn fake_display_link_invalidate(display_link: Id, _cmd: Sel) {
  let state = take_state(display_link);
  if let Some(mut state) = state {
    state.invalidated = true;
    if !state.timer.is_null() {
      CFRunLoopTimerInvalidate(state.timer);
      CFRelease(state.timer.cast());
      state.timer = ptr::null_mut();
    }
    if !state.timer_context.is_null() {
      let _ = Box::from_raw(state.timer_context);
      state.timer_context = ptr::null_mut();
    }
  }
}

unsafe fn schedule_tick(display_link: Id) {
  debug("fake display link schedule tick");
  let Some(state) = state_mut(display_link) else {
    return;
  };
  if state.tick_scheduled || state.invalidated || state.target.is_null() {
    return;
  }

  schedule_timer(display_link);
}

unsafe fn schedule_timer(display_link: Id) {
  let Some(state) = state_mut(display_link) else {
    return;
  };
  if state.tick_scheduled || state.invalidated || !state.timer.is_null() {
    return;
  }
  state.tick_scheduled = true;
  let context = Box::into_raw(Box::new(TickContext { display_link }));
  state.timer_context = context;
  let mut timer_context = CFRunLoopTimerContext {
    version: 0,
    info: context.cast(),
    retain: None,
    release: None,
    copy_description: None,
  };
  let timer = CFRunLoopTimerCreate(
    ptr::null(),
    CFAbsoluteTimeGetCurrent() + (1.0 / 60.0),
    1.0 / 60.0,
    0,
    0,
    fake_display_link_timer_fired,
    &mut timer_context,
  );
  if timer.is_null() {
    let _ = Box::from_raw(context);
    state.tick_scheduled = false;
    state.timer_context = ptr::null_mut();
    return;
  }
  state.timer = timer;

  let run_loop = CFRunLoopGetMain();
  CFRunLoopAddTimer(run_loop, timer, kCFRunLoopCommonModes);
  CFRunLoopWakeUp(run_loop);
}

unsafe extern "C" fn fake_display_link_timer_fired(_timer: CFRunLoopTimerRef, info: *mut c_void) {
  let context = &*info.cast::<TickContext>();
  let display_link = context.display_link;
  let Some(state) = state_mut(display_link) else {
    return;
  };

  if state.invalidated || state.target.is_null() {
    return;
  }

  state.timestamp = CACurrentMediaTime();
  state.target_timestamp = state.timestamp + (1.0 / 60.0);
  state.paused = true;

  let target = state.target;
  let selector = state.selector;
  debug("fake display link fire tick");
  send_void_id(target, selector, display_link);
}

fn debug(message: &str) {
  if std::env::var_os("LYNX_HEADLESS_DEBUG").is_some() {
    eprintln!("[lynx-headless-display] {message}");
  }
}

unsafe fn state_mut(display_link: Id) -> Option<&'static mut DisplayLinkState> {
  let state = get_state(display_link);
  if state.is_null() {
    None
  } else {
    Some(&mut *state)
  }
}

unsafe fn get_state(display_link: Id) -> *mut DisplayLinkState {
  let mut value = ptr::null_mut();
  object_getInstanceVariable(display_link, c"state".as_ptr(), &mut value);
  value.cast()
}

unsafe fn set_state(display_link: Id, state: *mut DisplayLinkState) {
  object_setInstanceVariable(display_link, c"state".as_ptr(), state.cast());
}

unsafe fn take_state(display_link: Id) -> Option<Box<DisplayLinkState>> {
  let state = get_state(display_link);
  if state.is_null() {
    None
  } else {
    set_state(display_link, ptr::null_mut());
    Some(Box::from_raw(state))
  }
}

fn ensure_classes() {
  static CLASSES: Once = Once::new();
  CLASSES.call_once(|| unsafe {
    register_fake_screen_class();
    register_fake_display_link_class();
  });
}

unsafe fn register_fake_screen_class() {
  let superclass = class("NSObject");
  let cls = objc_allocateClassPair(superclass, c"LynxRustHeadlessFakeScreen".as_ptr(), 0);
  if cls.is_null() {
    return;
  }
  class_addMethod(
    cls,
    sel("displayLinkWithTarget:selector:"),
    fake_screen_display_link as Imp,
    c"@@:@:".as_ptr(),
  );
  class_addMethod(
    cls,
    sel("maximumFramesPerSecond"),
    fake_screen_maximum_frames_per_second as Imp,
    c"q@:".as_ptr(),
  );
  objc_registerClassPair(cls);
}

unsafe fn register_fake_display_link_class() {
  let superclass = class("NSObject");
  let cls = objc_allocateClassPair(superclass, c"LynxRustHeadlessFakeDisplayLink".as_ptr(), 0);
  if cls.is_null() {
    return;
  }
  class_addIvar(
    cls,
    c"state".as_ptr(),
    std::mem::size_of::<*mut DisplayLinkState>(),
    PTR_ALIGN_LOG2,
    c"^v".as_ptr(),
  );
  class_addMethod(
    cls,
    sel("addToRunLoop:forMode:"),
    fake_display_link_add_to_run_loop as Imp,
    c"v@:@@".as_ptr(),
  );
  class_addMethod(
    cls,
    sel("setPaused:"),
    fake_display_link_set_paused as Imp,
    c"v@:B".as_ptr(),
  );
  class_addMethod(
    cls,
    sel("paused"),
    fake_display_link_paused as Imp,
    c"B@:".as_ptr(),
  );
  class_addMethod(
    cls,
    sel("timestamp"),
    fake_display_link_timestamp as Imp,
    c"d@:".as_ptr(),
  );
  class_addMethod(
    cls,
    sel("targetTimestamp"),
    fake_display_link_target_timestamp as Imp,
    c"d@:".as_ptr(),
  );
  class_addMethod(
    cls,
    sel("invalidate"),
    fake_display_link_invalidate as Imp,
    c"v@:".as_ptr(),
  );
  objc_registerClassPair(cls);
}

unsafe fn fake_screen() -> Id {
  static SCREEN: OnceLock<usize> = OnceLock::new();
  *SCREEN.get_or_init(|| send_id(fake_screen_class(), sel("new")) as usize) as Id
}

unsafe fn fake_screen_class() -> Class {
  class("LynxRustHeadlessFakeScreen")
}

unsafe fn display_link_class() -> Class {
  class("LynxRustHeadlessFakeDisplayLink")
}

unsafe fn class(name: &str) -> Class {
  let mut bytes = Vec::with_capacity(name.len() + 1);
  bytes.extend_from_slice(name.as_bytes());
  bytes.push(0);
  objc_getClass(bytes.as_ptr().cast())
}

unsafe fn sel(name: &str) -> Sel {
  let mut bytes = Vec::with_capacity(name.len() + 1);
  bytes.extend_from_slice(name.as_bytes());
  bytes.push(0);
  sel_registerName(bytes.as_ptr().cast())
}

unsafe fn send_id(receiver: Id, selector: Sel) -> Id {
  let send: unsafe extern "C" fn(Id, Sel) -> Id = std::mem::transmute(objc_msgSend as *const ());
  send(receiver, selector)
}

unsafe fn send_id_id(receiver: Id, selector: Sel, arg: Id) -> Id {
  let send: unsafe extern "C" fn(Id, Sel, Id) -> Id =
    std::mem::transmute(objc_msgSend as *const ());
  send(receiver, selector, arg)
}

unsafe fn send_void_id(receiver: Id, selector: Sel, arg: Id) {
  let send: unsafe extern "C" fn(Id, Sel, Id) = std::mem::transmute(objc_msgSend as *const ());
  send(receiver, selector, arg);
}

unsafe fn send_usize(receiver: Id, selector: Sel) -> usize {
  let send: unsafe extern "C" fn(Id, Sel) -> usize = std::mem::transmute(objc_msgSend as *const ());
  send(receiver, selector)
}

#[repr(C)]
struct CFRunLoopTimerContext {
  version: isize,
  info: *mut c_void,
  retain: Option<unsafe extern "C" fn(*const c_void) -> *const c_void>,
  release: Option<unsafe extern "C" fn(*const c_void)>,
  copy_description: Option<unsafe extern "C" fn(*const c_void) -> CFStringRef>,
}

#[link(name = "objc")]
unsafe extern "C" {
  fn objc_msgSend();
  fn objc_getClass(name: *const c_char) -> Class;
  fn objc_allocateClassPair(superclass: Class, name: *const c_char, extra_bytes: usize) -> Class;
  fn objc_registerClassPair(cls: Class);
  fn object_getClass(object: Id) -> Class;
  fn class_addIvar(
    cls: Class,
    name: *const c_char,
    size: usize,
    alignment: u8,
    types: *const c_char,
  ) -> bool;
  fn class_addMethod(cls: Class, name: Sel, imp: Imp, types: *const c_char) -> bool;
  fn class_replaceMethod(cls: Class, name: Sel, imp: Imp, types: *const c_char) -> Imp;
  fn object_getInstanceVariable(object: Id, name: *const c_char, out_value: *mut Id) -> Ivar;
  fn object_setInstanceVariable(object: Id, name: *const c_char, value: Id) -> Ivar;
  fn sel_registerName(name: *const c_char) -> Sel;
}

#[link(name = "QuartzCore", kind = "framework")]
unsafe extern "C" {
  fn CACurrentMediaTime() -> c_double;
}

#[link(name = "CoreFoundation", kind = "framework")]
unsafe extern "C" {
  static kCFRunLoopCommonModes: CFStringRef;
  fn CFAbsoluteTimeGetCurrent() -> CFAbsoluteTime;
  fn CFRunLoopGetMain() -> CFRunLoopRef;
  fn CFRunLoopWakeUp(run_loop: CFRunLoopRef);
  fn CFRunLoopAddTimer(run_loop: CFRunLoopRef, timer: CFRunLoopTimerRef, mode: CFStringRef);
  fn CFRunLoopTimerInvalidate(timer: CFRunLoopTimerRef);
  fn CFRunLoopTimerCreate(
    allocator: CFAllocatorRef,
    fire_date: CFAbsoluteTime,
    interval: c_double,
    flags: usize,
    order: isize,
    callout: unsafe extern "C" fn(CFRunLoopTimerRef, *mut c_void),
    context: *mut CFRunLoopTimerContext,
  ) -> CFRunLoopTimerRef;
  fn CFRelease(value: *const c_void);
}

#[link(name = "AppKit", kind = "framework")]
unsafe extern "C" {}

#[link(name = "Foundation", kind = "framework")]
unsafe extern "C" {}
