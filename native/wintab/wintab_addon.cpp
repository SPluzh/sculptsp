#include <napi.h>
#include "wintab_context.h"

static WintabContext g_ctx;

// initialize(hwndBuffer: Buffer) → boolean
Napi::Value Initialize(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  if (info.Length() < 1 || !info[0].IsBuffer())
    return Napi::Boolean::New(env, false);

  // Извлекаем HWND из Buffer (Electron передаёт как Buffer)
  auto buf = info[0].As<Napi::Buffer<uint8_t>>();
  HWND hwnd = *reinterpret_cast<HWND*>(buf.Data());

  if (!g_ctx.Load()) return Napi::Boolean::New(env, false);
  bool ok = g_ctx.Open(hwnd);
  return Napi::Boolean::New(env, ok);
}

Napi::Value StartPolling(const Napi::CallbackInfo& info) {
  g_ctx.StartPolling();
  return info.Env().Undefined();
}

Napi::Value StopPolling(const Napi::CallbackInfo& info) {
  g_ctx.StopPolling();
  return info.Env().Undefined();
}

Napi::Value Destroy(const Napi::CallbackInfo& info) {
  g_ctx.Close();
  return info.Env().Undefined();
}

// getData() → { pressure, tiltX, tiltY, penDown }
Napi::Value GetData(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  auto obj = Napi::Object::New(env);
  obj.Set("pressure", Napi::Number::New(env, g_ctx.pressure.load()));
  obj.Set("tiltX",    Napi::Number::New(env, g_ctx.tiltX.load()));
  obj.Set("tiltY",    Napi::Number::New(env, g_ctx.tiltY.load()));
  obj.Set("penDown",  Napi::Boolean::New(env, g_ctx.penDown.load()));
  obj.Set("active",   Napi::Boolean::New(env, g_ctx.IsAvailable()));
  return obj;
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("initialize",   Napi::Function::New(env, Initialize));
  exports.Set("startPolling", Napi::Function::New(env, StartPolling));
  exports.Set("stopPolling",  Napi::Function::New(env, StopPolling));
  exports.Set("destroy",      Napi::Function::New(env, Destroy));
  exports.Set("getData",      Napi::Function::New(env, GetData));
  return exports;
}

NODE_API_MODULE(wintab, Init)
