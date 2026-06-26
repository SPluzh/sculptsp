{
  "variables": {
    "openssl_fips": "0"
  },
  "targets": [{
    "target_name": "wintab",
    "sources": ["wintab_addon.cpp", "wintab_context.cpp"],
    "include_dirs": ["<!@(node -p \"require('node-addon-api').include\")"],
    "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"],
    "libraries": [],
    "msvs_settings": {
      "VCCLCompilerTool": {
        "ExceptionHandling": 1,
        "AdditionalOptions": [ "/std:c++17" ]
      }
    }
  }]
}
